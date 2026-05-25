// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Tax Calculation Engine (v2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The FIFO engine now computes tax per realized match inline.
// This tax engine adds:
//
//   1. Fee source resolution (CSV vs Exchange default %)
//   2. TDS source resolution (CSV vs default %)
//   3. Per-trade source tracking (for audit trail)
//   4. Aggregate tax summary with effective rates
//
// IMPORTANT RULES:
//   1. CSV-provided fees and TDS ALWAYS take priority over defaults
//   2. Default % from ExchangeSettings is ONLY used when CSV value is 0/missing
//   3. If CSV explicitly contains 0, treat 0 as valid, not missing
//   4. Do NOT double-count fees or TDS
//   5. All calculations use Decimal.js for financial precision
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { toD, Decimal, sumD } from '@/lib/decimal'
import type { RealizedTrade } from '@/lib/fifo-engine'

// ── Type Definitions ───────────────────────────────────────

/** Exchange settings from the workspace configuration */
export interface ExchangeSettingsInput {
  defaultBuyFeePercent: string   // e.g., "0.1" means 0.1%
  defaultSellFeePercent: string
  defaultTdsPercent: string      // e.g., "1.0" means 1%
  gstPercent: string             // e.g., "18.0" means 18%
  cryptoTaxPercent: string       // e.g., "30.0" means 30%
  cessPercent: string            // e.g., "4.0" means 4%
  feesIncludeGst: boolean        // If true, CSV fees already include GST — don't add GST on top
  applyDefaultFees: boolean      // If true, apply default fee % when CSV fee = 0; if false, treat CSV 0 as explicit
}

/** A realized trade with fee/TDS source tracking */
export interface TaxedRealizedTrade extends RealizedTrade {
  // ── Fee resolution (CSV vs default) ──
  buyFeeSource: 'CSV' | 'DEFAULT'
  sellFeeSource: 'CSV' | 'DEFAULT'
  resolvedBuyFee: string
  resolvedSellFee: string
  resolvedTotalFees: string

  // ── TDS resolution ──
  buyTdsSource: 'CSV' | 'DEFAULT'
  sellTdsSource: 'CSV' | 'DEFAULT'
  resolvedBuyTds: string
  resolvedSellTds: string
  resolvedTotalTds: string

  // ── Recalculated with resolved fees ──
  resolvedGstOnFees: string
  resolvedNetProfitInHand: string
  resolvedFinalNetProfit: string
  resolvedProfitLossStatus: 'PROFIT' | 'LOSS'

  // ── Tax from resolved fees ──
  resolvedBaseCryptoTax: string
  resolvedCess: string
  resolvedTotalDirectTax: string
}

/** Summary of tax calculations across all trades */
export interface TaxSummary {
  totalTrades: number
  profitableTrades: number
  lossTrades: number

  totalBuyValue: string
  totalSellValue: string
  totalGrossProfit: string
  totalGrossLoss: string
  taxablePositiveGain: string  // Total positive gross profits (taxable base)

  totalFees: string
  totalGstOnFees: string
  totalTds: string
  totalBaseCryptoTax: string   // 30% of taxable positive gain
  totalSurcharge: string       // Surcharge on high-income taxpayers
  totalCess: string            // 4% on (base tax + surcharge)
  totalDirectTax: string       // base + surcharge + cess

  totalNetProfit: string
  totalNetProfitFromProfitableTrades: string
  totalNetLossFromLossTrades: string

  effectiveTaxRate: string
  avgProfitPerTrade: string
  avgLossPerTrade: string
  surchargeApplicable: boolean  // Whether surcharge threshold was crossed
}

/** Complete tax engine result */
export interface TaxEngineResult {
  taxedTrades: TaxedRealizedTrade[]
  summary: TaxSummary
}

// ── Helper: Resolve Fee Source ─────────────────────────────

function resolveFee(
  csvFee: string,
  tradeValue: string,
  defaultFeePercent: string,
  applyDefault: boolean = false,
): { fee: Decimal; source: 'CSV' | 'DEFAULT' } {
  const fee = toD(csvFee)

  // If CSV provides a non-zero fee, always use it
  if (fee.gt(0)) {
    return { fee, source: 'CSV' }
  }

  // If CSV fee is 0, check if we should apply defaults.
  // When applyDefault is false, treat CSV 0 as explicit "no fee".
  // When applyDefault is true, fall back to default percentage (for CSVs without fee columns).
  if (!applyDefault) {
    return { fee: new Decimal(0), source: 'CSV' }
  }

  // Fall back to default percentage of trade value
  const percent = toD(defaultFeePercent).div(100)
  const calculatedFee = toD(tradeValue).times(percent)

  if (calculatedFee.gt(0)) {
    return { fee: calculatedFee, source: 'DEFAULT' }
  }

  return { fee: new Decimal(0), source: 'DEFAULT' }
}

// ── Helper: Resolve TDS Source ─────────────────────────────

function resolveTds(
  csvTds: string,
  tradeValue: string,
  defaultTdsPercent: string,
  applyDefault: boolean = true,
): { tds: Decimal; source: 'CSV' | 'DEFAULT' } {
  const tds = toD(csvTds)

  if (tds.gt(0)) {
    return { tds, source: 'CSV' }
  }

  // If CSV TDS is 0, fall back to the configured default percentage.
  if (!applyDefault) {
    return { tds: new Decimal(0), source: 'CSV' }
  }

  const percent = toD(defaultTdsPercent).div(100)
  const calculatedTds = toD(tradeValue).times(percent)

  if (calculatedTds.gt(0)) {
    return { tds: calculatedTds, source: 'DEFAULT' }
  }

  return { tds: new Decimal(0), source: 'DEFAULT' }
}

// ── Main Tax Calculation Function ──────────────────────────

export function runTaxEngine(
  realizedTrades: RealizedTrade[],
  exchangeSettings: ExchangeSettingsInput,
): TaxEngineResult {
  const taxedTrades: TaxedRealizedTrade[] = []

  if (realizedTrades.length === 0) {
    return {
      taxedTrades: [],
      summary: createEmptySummary(),
    }
  }

  const gstPercent = toD(exchangeSettings.gstPercent).div(100)
  const cryptoTaxPercent = toD(exchangeSettings.cryptoTaxPercent).div(100)
  const cessPercent = toD(exchangeSettings.cessPercent).div(100)
  const feesIncludeGst = exchangeSettings.feesIncludeGst ?? false
  const applyDefaultFees = exchangeSettings.applyDefaultFees ?? false

  for (const trade of realizedTrades) {
    const buyValue = toD(trade.buyValue)
    const sellValue = toD(trade.sellValue)
    const grossProfit = toD(trade.grossProfit)

    // ── Fee Resolution ──
    // When applyDefaultFees is false, CSV fee = 0 means "no fee charged" (explicit).
    // When applyDefaultFees is true, CSV fee = 0 means "fee data missing, use default %".
    const buyFeeResult = resolveFee(
      trade.allocatedBuyFee,
      trade.buyValue,
      exchangeSettings.defaultBuyFeePercent,
      applyDefaultFees,
    )
    const sellFeeResult = resolveFee(
      trade.allocatedSellFee,
      trade.sellValue,
      exchangeSettings.defaultSellFeePercent,
      applyDefaultFees,
    )

    const resolvedBuyFee = buyFeeResult.fee
    const resolvedSellFee = sellFeeResult.fee
    const resolvedTotalFees = resolvedBuyFee.plus(resolvedSellFee)

    // ── GST on resolved fees ──
    // If feesIncludeGst is true, the CSV fee values already include 18% GST,
    // so we must NOT add GST on top (would be double-counting).
    // Exchanges like Delta India include GST in their "Trading Fees" column.
    const resolvedGstOnFees = feesIncludeGst
      ? new Decimal(0)
      : resolvedTotalFees.times(gstPercent)

    // ── TDS Resolution ──
    // TDS is a sell-side deduction. If the matched segment has no CSV TDS,
    // estimate it using the configured default percentage for the sell value.
    const sellTdsResult = resolveTds(
      trade.tds,
      trade.sellValue,
      exchangeSettings.defaultTdsPercent,
      true,
    )

    // The FIFO engine stores TDS as one combined value per matched segment.
    const totalTdsFromFifo = toD(trade.tds)
    const resolvedBuyTds = new Decimal(0)
    const resolvedSellTds = totalTdsFromFifo.gt(0) ? totalTdsFromFifo : sellTdsResult.tds
    const resolvedTotalTds = totalTdsFromFifo.gt(0) ? totalTdsFromFifo : resolvedSellTds

    const buyTdsSource: 'CSV' | 'DEFAULT' = totalTdsFromFifo.gt(0) ? 'CSV' : 'DEFAULT'
    const sellTdsSource: 'CSV' | 'DEFAULT' = totalTdsFromFifo.gt(0) ? 'CSV' : sellTdsResult.source

    // ── Direct Tax (only when grossProfit > 0) ──
    // NOTE: Surcharge is calculated at the AGGREGATE level in the summary,
    // not per-trade. Per-trade we compute base tax + cess only.
    let resolvedBaseCryptoTax: Decimal
    let resolvedCess: Decimal
    let resolvedTotalDirectTax: Decimal

    if (grossProfit.gt(0)) {
      resolvedBaseCryptoTax = grossProfit.times(cryptoTaxPercent)
      // Cess per-trade is 4% of base tax (surcharge applied later in summary)
      resolvedCess = resolvedBaseCryptoTax.times(cessPercent)
      resolvedTotalDirectTax = resolvedBaseCryptoTax.plus(resolvedCess)
    } else {
      resolvedBaseCryptoTax = new Decimal(0)
      resolvedCess = new Decimal(0)
      resolvedTotalDirectTax = new Decimal(0)
    }

    // ── Net Profit with resolved fees ──
    const resolvedNetProfitInHand = grossProfit
      .minus(resolvedTotalFees)
      .minus(resolvedGstOnFees)
      .minus(resolvedTotalTds)

    const resolvedFinalNetProfit = resolvedNetProfitInHand
      .minus(resolvedTotalDirectTax)
      .plus(resolvedTotalTds)

    const resolvedProfitLossStatus: 'PROFIT' | 'LOSS' = resolvedFinalNetProfit.gt(0) ? 'PROFIT' : 'LOSS'

    taxedTrades.push({
      ...trade,
      buyFeeSource: buyFeeResult.source,
      sellFeeSource: sellFeeResult.source,
      resolvedBuyFee: resolvedBuyFee.toString(),
      resolvedSellFee: resolvedSellFee.toString(),
      resolvedTotalFees: resolvedTotalFees.toString(),
      buyTdsSource,
      sellTdsSource,
      resolvedBuyTds: resolvedBuyTds.toString(),
      resolvedSellTds: resolvedSellTds.toString(),
      resolvedTotalTds: resolvedTotalTds.toString(),
      resolvedGstOnFees: resolvedGstOnFees.toString(),
      resolvedNetProfitInHand: resolvedNetProfitInHand.toString(),
      resolvedFinalNetProfit: resolvedFinalNetProfit.toString(),
      resolvedProfitLossStatus,
      resolvedBaseCryptoTax: resolvedBaseCryptoTax.toString(),
      resolvedCess: resolvedCess.toString(),
      resolvedTotalDirectTax: resolvedTotalDirectTax.toString(),
    })
  }

  const summary = buildTaxSummary(taxedTrades)

  return { taxedTrades, summary }
}

// ── Indian Surcharge Slabs (FY 2024-25 onwards) ──────────
// Surcharge is levied on the total income tax when total income exceeds
// certain thresholds. For VDA income under Section 115AD(1)(b)(ii):
//
//   Total Income           Surcharge Rate
//   Up to ₹50 lakh         0%
//   ₹50L – ₹1 Cr          10%
//   ₹1 Cr – ₹2 Cr         15%
//   ₹2 Cr – ₹5 Cr         25%
//   Above ₹5 Cr           37%  (capped at max surcharge + cess = 25% of income)
//
// For crypto (VDA) under Section 115AD, the marginal relief applies
// to ensure total tax + surcharge doesn't exceed the tax on the
// threshold + the income exceeding the threshold.

const SURCHARGE_SLABS: Array<{ threshold: string; rate: string }> = [
  { threshold: '5000000',  rate: '0'    },  // Up to ₹50 lakh: 0%
  { threshold: '10000000', rate: '0.10' },  // ₹50L–₹1Cr: 10%
  { threshold: '20000000', rate: '0.15' },  // ₹1Cr–₹2Cr: 15%
  { threshold: '50000000', rate: '0.25' },  // ₹2Cr–₹5Cr: 25%
  { threshold: 'Infinity',  rate: '0.37' },  // Above ₹5Cr: 37%
]

function calculateSurcharge(taxableIncome: Decimal, baseTax: Decimal): { surcharge: Decimal; surchargeRate: Decimal } {
  // Find the applicable surcharge rate based on total taxable income
  let applicableRate = new Decimal(0)
  for (const slab of SURCHARGE_SLABS) {
    const threshold = toD(slab.threshold)
    if (taxableIncome.gt(threshold)) continue
    applicableRate = toD(slab.rate)
    break
  }
  // If income exceeds all defined thresholds, use the highest rate
  if (taxableIncome.gt(toD('50000000'))) {
    applicableRate = toD('0.37')
  }

  if (applicableRate.isZero()) {
    return { surcharge: new Decimal(0), surchargeRate: applicableRate }
  }

  let surcharge = baseTax.times(applicableRate)

  // ── Marginal Relief ──
  // Ensure that total tax (base + surcharge) does not exceed:
  //   tax at previous slab threshold + (income - threshold) * max rate
  // This prevents a situation where earning slightly more results in less after-tax income.
  const incomeTaxOnPreviousSlab = baseTax  // Without surcharge

  // Find the threshold just below current income
  let previousThreshold = new Decimal(0)
  for (const slab of SURCHARGE_SLABS) {
    const threshold = toD(slab.threshold)
    if (taxableIncome.lte(threshold)) break
    previousThreshold = threshold
  }

  // Max payable = tax on previous threshold + (income - previous threshold) * 30%
  const maxPayable = incomeTaxOnPreviousSlab.plus(
    taxableIncome.minus(previousThreshold).times(toD('0.30'))
  )
  const totalWithSurcharge = baseTax.plus(surcharge)

  // If total with surcharge exceeds max payable, limit it
  if (totalWithSurcharge.gt(maxPayable)) {
    surcharge = maxPayable.minus(baseTax)
    if (surcharge.lt(0)) surcharge = new Decimal(0)
  }

  return { surcharge, surchargeRate: applicableRate }
}

// ── Build Tax Summary ──────────────────────────────────────

function buildTaxSummary(trades: TaxedRealizedTrade[]): TaxSummary {
  const profitableTrades = trades.filter(t => t.resolvedProfitLossStatus === 'PROFIT')
  const lossTrades = trades.filter(t => t.resolvedProfitLossStatus === 'LOSS')

  const totalBuyValue = sumD(trades.map(t => t.buyValue))
  const totalSellValue = sumD(trades.map(t => t.sellValue))

  // Taxable positive gain = sum of all positive gross profits
  const taxablePositiveGain = sumD(
    trades.map(t => t.grossProfit).filter(v => toD(v).gt(0))
  )
  const totalGrossProfit = sumD(trades.map(t => t.grossProfit).filter(v => toD(v).gt(0)))
  const totalGrossLoss = sumD(trades.map(t => t.grossProfit).filter(v => toD(v).lt(0)))

  const totalFees = sumD(trades.map(t => t.resolvedTotalFees))
  const totalGstOnFees = sumD(trades.map(t => t.resolvedGstOnFees))
  const totalTds = sumD(trades.map(t => t.resolvedTotalTds))

  // ── Aggregate Tax Calculation with Surcharge ──
  // Base tax: 30% of taxable positive gain
  const totalBaseCryptoTax = taxablePositiveGain.times(toD('0.30'))

  // Surcharge on base tax based on total taxable income
  const { surcharge: totalSurcharge } = calculateSurcharge(taxablePositiveGain, totalBaseCryptoTax)

  // Cess: 4% on (base tax + surcharge)
  const totalCess = totalBaseCryptoTax.plus(totalSurcharge).times(toD('0.04'))

  // Total direct tax = base + surcharge + cess
  const totalDirectTax = totalBaseCryptoTax.plus(totalSurcharge).plus(totalCess)

  const surchargeApplicable = totalSurcharge.gt(0)

  const totalNetProfit = sumD(trades.map(t => t.resolvedFinalNetProfit))

  const totalNetProfitFromProfitableTrades = sumD(
    profitableTrades.map(t => t.resolvedFinalNetProfit).filter(v => toD(v).gt(0))
  )
  const totalNetLossFromLossTrades = sumD(
    lossTrades.map(t => t.resolvedFinalNetProfit).filter(v => toD(v).lt(0))
  )

  let effectiveTaxRate = new Decimal(0)
  if (taxablePositiveGain.gt(0)) {
    effectiveTaxRate = totalDirectTax.div(taxablePositiveGain).times(100)
  }

  const avgProfitPerTrade = profitableTrades.length > 0
    ? totalNetProfitFromProfitableTrades.div(profitableTrades.length)
    : new Decimal(0)

  const avgLossPerTrade = lossTrades.length > 0
    ? totalNetLossFromLossTrades.div(lossTrades.length)
    : new Decimal(0)

  return {
    totalTrades: trades.length,
    profitableTrades: profitableTrades.length,
    lossTrades: lossTrades.length,
    totalBuyValue: totalBuyValue.toString(),
    totalSellValue: totalSellValue.toString(),
    totalGrossProfit: totalGrossProfit.toString(),
    totalGrossLoss: totalGrossLoss.toString(),
    taxablePositiveGain: taxablePositiveGain.toString(),
    totalFees: totalFees.toString(),
    totalGstOnFees: totalGstOnFees.toString(),
    totalTds: totalTds.toString(),
    totalBaseCryptoTax: totalBaseCryptoTax.toString(),
    totalSurcharge: totalSurcharge.toString(),
    totalCess: totalCess.toString(),
    totalDirectTax: totalDirectTax.toString(),
    totalNetProfit: totalNetProfit.toString(),
    totalNetProfitFromProfitableTrades: totalNetProfitFromProfitableTrades.toString(),
    totalNetLossFromLossTrades: totalNetLossFromLossTrades.toString(),
    effectiveTaxRate: effectiveTaxRate.toString(),
    avgProfitPerTrade: avgProfitPerTrade.toString(),
    avgLossPerTrade: avgLossPerTrade.toString(),
    surchargeApplicable,
  }
}

// ── Empty Summary ──────────────────────────────────────────

function createEmptySummary(): TaxSummary {
  return {
    totalTrades: 0,
    profitableTrades: 0,
    lossTrades: 0,
    totalBuyValue: '0',
    totalSellValue: '0',
    totalGrossProfit: '0',
    totalGrossLoss: '0',
    taxablePositiveGain: '0',
    totalFees: '0',
    totalGstOnFees: '0',
    totalTds: '0',
    totalBaseCryptoTax: '0',
    totalSurcharge: '0',
    totalCess: '0',
    totalDirectTax: '0',
    totalNetProfit: '0',
    totalNetProfitFromProfitableTrades: '0',
    totalNetLossFromLossTrades: '0',
    effectiveTaxRate: '0',
    avgProfitPerTrade: '0',
    avgLossPerTrade: '0',
    surchargeApplicable: false,
  }
}
