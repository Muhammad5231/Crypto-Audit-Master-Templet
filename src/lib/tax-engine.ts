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

  totalFees: string
  totalGstOnFees: string
  totalTds: string
  totalDirectTax: string
  totalCess: string

  totalNetProfit: string
  totalNetProfitFromProfitableTrades: string
  totalNetLossFromLossTrades: string

  effectiveTaxRate: string
  avgProfitPerTrade: string
  avgLossPerTrade: string
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
): { fee: Decimal; source: 'CSV' | 'DEFAULT' } {
  const fee = toD(csvFee)

  // If CSV provides a non-zero fee, always use it
  if (fee.gt(0)) {
    return { fee, source: 'CSV' }
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
): { tds: Decimal; source: 'CSV' | 'DEFAULT' } {
  const tds = toD(csvTds)

  if (tds.gt(0)) {
    return { tds, source: 'CSV' }
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

  for (const trade of realizedTrades) {
    const buyValue = toD(trade.buyValue)
    const sellValue = toD(trade.sellValue)
    const grossProfit = toD(trade.grossProfit)

    // ── Fee Resolution ──
    const buyFeeResult = resolveFee(
      trade.allocatedBuyFee,
      trade.buyValue,
      exchangeSettings.defaultBuyFeePercent,
    )
    const sellFeeResult = resolveFee(
      trade.allocatedSellFee,
      trade.sellValue,
      exchangeSettings.defaultSellFeePercent,
    )

    const resolvedBuyFee = buyFeeResult.fee
    const resolvedSellFee = sellFeeResult.fee
    const resolvedTotalFees = resolvedBuyFee.plus(resolvedSellFee)

    // ── GST on resolved fees ──
    const resolvedGstOnFees = resolvedTotalFees.times(gstPercent)

    // ── TDS Resolution ──
    const buyTdsResult = resolveTds(
      trade.tds, // The FIFO engine already combined buy+sell TDS into one field
      trade.buyValue,
      '0',
    )
    const sellTdsResult = resolveTds(
      trade.tds,
      trade.sellValue,
      exchangeSettings.defaultTdsPercent,
    )

    // Since FIFO engine's `tds` field is combined, we use it as-is for resolved
    // but still track source based on whether CSV had values
    const totalTdsFromFifo = toD(trade.tds)
    const resolvedBuyTds = totalTdsFromFifo.gt(0) ? totalTdsFromFifo : buyTdsResult.tds
    const resolvedSellTds = totalTdsFromFifo.gt(0) ? new Decimal(0) : sellTdsResult.tds
    const resolvedTotalTds = totalTdsFromFifo.gt(0) ? totalTdsFromFifo : resolvedBuyTds.plus(resolvedSellTds)

    const buyTdsSource: 'CSV' | 'DEFAULT' = totalTdsFromFifo.gt(0) ? 'CSV' : buyTdsResult.source
    const sellTdsSource: 'CSV' | 'DEFAULT' = totalTdsFromFifo.gt(0) ? 'CSV' : sellTdsResult.source

    // ── Direct Tax (only when grossProfit > 0) ──
    let resolvedBaseCryptoTax: Decimal
    let resolvedCess: Decimal
    let resolvedTotalDirectTax: Decimal

    if (grossProfit.gt(0)) {
      resolvedBaseCryptoTax = grossProfit.times(cryptoTaxPercent)
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

// ── Build Tax Summary ──────────────────────────────────────

function buildTaxSummary(trades: TaxedRealizedTrade[]): TaxSummary {
  const profitableTrades = trades.filter(t => t.resolvedProfitLossStatus === 'PROFIT')
  const lossTrades = trades.filter(t => t.resolvedProfitLossStatus === 'LOSS')

  const totalBuyValue = sumD(trades.map(t => t.buyValue))
  const totalSellValue = sumD(trades.map(t => t.sellValue))
  const totalGrossProfit = sumD(trades.map(t => t.grossProfit).filter(v => toD(v).gt(0)))
  const totalGrossLoss = sumD(trades.map(t => t.grossProfit).filter(v => toD(v).lt(0)))

  const totalFees = sumD(trades.map(t => t.resolvedTotalFees))
  const totalGstOnFees = sumD(trades.map(t => t.resolvedGstOnFees))
  const totalTds = sumD(trades.map(t => t.resolvedTotalTds))
  const totalDirectTax = sumD(trades.map(t => t.resolvedTotalDirectTax))
  const totalCess = sumD(trades.map(t => t.resolvedCess))
  const totalNetProfit = sumD(trades.map(t => t.resolvedFinalNetProfit))

  const totalNetProfitFromProfitableTrades = sumD(
    profitableTrades.map(t => t.resolvedFinalNetProfit).filter(v => toD(v).gt(0))
  )
  const totalNetLossFromLossTrades = sumD(
    lossTrades.map(t => t.resolvedFinalNetProfit).filter(v => toD(v).lt(0))
  )

  let effectiveTaxRate = new Decimal(0)
  if (totalGrossProfit.gt(0)) {
    effectiveTaxRate = totalDirectTax.div(totalGrossProfit).times(100)
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
    totalFees: totalFees.toString(),
    totalGstOnFees: totalGstOnFees.toString(),
    totalTds: totalTds.toString(),
    totalDirectTax: totalDirectTax.toString(),
    totalCess: totalCess.toString(),
    totalNetProfit: totalNetProfit.toString(),
    totalNetProfitFromProfitableTrades: totalNetProfitFromProfitableTrades.toString(),
    totalNetLossFromLossTrades: totalNetLossFromLossTrades.toString(),
    effectiveTaxRate: effectiveTaxRate.toString(),
    avgProfitPerTrade: avgProfitPerTrade.toString(),
    avgLossPerTrade: avgLossPerTrade.toString(),
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
    totalFees: '0',
    totalGstOnFees: '0',
    totalTds: '0',
    totalDirectTax: '0',
    totalCess: '0',
    totalNetProfit: '0',
    totalNetProfitFromProfitableTrades: '0',
    totalNetLossFromLossTrades: '0',
    effectiveTaxRate: '0',
    avgProfitPerTrade: '0',
    avgLossPerTrade: '0',
  }
}
