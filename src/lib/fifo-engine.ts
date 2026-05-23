// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — FIFO Matching Engine (v2 — Rebuilt)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Converts normalized BUY/SELL trade rows into:
//   1. Realized Trades  (each BUY–SELL matched segment)
//   2. Open Holdings    (remaining BUY lots)
//   3. Unmatched Sell Warnings
//
// CRITICAL RULES:
//   - All trades processed in strict chronological order
//   - A SELL is NEVER matched with a BUY that happens after it
//   - FIFO per pair: oldest BUY lots consumed first
//   - One realized trade row per matched BUY–SELL segment
//   - Partial matching fully supported
//   - All financial values use Decimal.js — NEVER JS arithmetic
//   - Deterministic: same input always produces same output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { toD, Decimal, sumD } from '@/lib/decimal'

// ── Constants ──────────────────────────────────────────────

const GST_RATE = toD('0.18')          // 18% GST on fees
const CRYPTO_TAX_RATE = toD('0.30')   // 30% base crypto tax
const CESS_RATE = toD('0.04')         // 4% cess on base tax

// ── Input Type ─────────────────────────────────────────────

/** Normalized trade record from the database */
export interface TradeInput {
  id: string
  tradeTime: Date
  pair: string
  asset: string
  side: string       // "BUY" or "SELL"
  qty: string        // Decimal.js string
  price: string      // Decimal.js string
  orderValue: string // Decimal.js string (optional usage)
  fee: string        // Decimal.js string
  tds: string        // Decimal.js string
  csvFileId: string
  originalRowIndex?: number
}

// ── Output Types ───────────────────────────────────────────

/** A single BUY–SELL matched segment */
export interface RealizedTrade {
  // Identification
  pair: string
  asset: string
  buyTradeId: string
  sellTradeId: string
  buyDate: Date
  sellDate: Date

  // Match details
  matchedQty: string       // Decimal.js string
  buyPrice: string         // Decimal.js string
  sellPrice: string        // Decimal.js string

  // Values
  buyValue: string         // matchedQty × buyPrice
  sellValue: string        // matchedQty × sellPrice
  grossProfit: string      // sellValue − buyValue

  // Fee allocation
  allocatedBuyFee: string  // proportionally allocated from buy trade
  allocatedSellFee: string // proportionally allocated from sell trade
  totalFees: string        // allocatedBuyFee + allocatedSellFee

  // Taxes
  gstOnFees: string        // 18% of totalFees
  tds: string              // total TDS (proportional buy + sell)
  baseCryptoTax: string    // 30% of grossProfit if > 0, else 0
  cess: string             // 4% of baseCryptoTax if > 0, else 0
  totalDirectTax: string   // baseCryptoTax + cess

  // Profit
  netProfitInHand: string  // grossProfit − totalFees − gstOnFees − tds
  finalNetProfit: string   // netProfitInHand − totalDirectTax + tds
  status: 'PROFIT' | 'LOSS'

  // Source tracking
  buyCsvFileId: string
  sellCsvFileId: string
}

/** An open holding (remaining BUY lot) */
export interface OpenHolding {
  pair: string
  asset: string
  buyTradeId: string
  buyDate: Date
  originalQty: string       // Decimal.js string
  remainingQty: string      // Decimal.js string
  buyPrice: string          // Decimal.js string
  remainingCostBasis: string  // remainingQty × buyPrice
  remainingAllocatedBuyFee: string // proportionally allocated fee for remaining portion
  sourceCsvId: string
  status: 'Fully Unmatched Buy Lot' | 'Partially Matched Remaining Lot'
}

/** Unmatched sell warning */
export interface UnmatchedSellWarning {
  pair: string
  sellTradeId: string
  sellDate: Date
  originalSellQty: string   // Decimal.js string
  unmatchedQty: string      // Decimal.js string
  reason: string
}

/** FIFO engine summary */
export interface FifoSummary {
  totalRealizedTrades: number
  totalOpenHoldings: number
  totalUnmatchedSells: number
  totalGrossProfit: string
  totalFees: string
  totalTds: string
  totalDirectTax: string
  finalNetProfit: string
}

/** Complete FIFO engine result */
export interface FifoResult {
  realizedTrades: RealizedTrade[]
  openHoldings: OpenHolding[]
  unmatchedSellWarnings: UnmatchedSellWarning[]
  summary: FifoSummary
}

// ── Internal: BUY Lot ──────────────────────────────────────

interface BuyLot {
  buyTradeId: string
  pair: string
  asset: string
  buyTime: Date
  originalQty: Decimal
  remainingQty: Decimal
  buyPrice: Decimal
  totalBuyFee: Decimal
  remainingBuyFee: Decimal
  totalBuyTds: Decimal
  sourceCsvId: string
}

// ── Internal: SELL record ──────────────────────────────────

interface SellRecord {
  sellTradeId: string
  pair: string
  asset: string
  sellTime: Date
  originalQty: Decimal
  remainingQty: Decimal
  sellPrice: Decimal
  totalSellFee: Decimal
  totalSellTds: Decimal
  sourceCsvId: string
}

// ── FIFO Engine Options ────────────────────────────────────

export interface FifoEngineOptions {
  /** If true, CSV fee values already include GST — don't add GST on top */
  feesIncludeGst?: boolean
}

// ── Main FIFO Processing Function ──────────────────────────

export function runFifoEngine(trades: TradeInput[], options?: FifoEngineOptions): FifoResult {
  const realizedTrades: RealizedTrade[] = []
  const openHoldings: OpenHolding[] = []
  const unmatchedSellWarnings: UnmatchedSellWarning[] = []

  // ── Edge case: no trades ──
  if (trades.length === 0) {
    return {
      realizedTrades,
      openHoldings,
      unmatchedSellWarnings,
      summary: createEmptySummary(),
    }
  }

  // ── Step 1: Sort ALL trades by exact tradeTime ascending ──
  // If same timestamp, sort by originalRowIndex
  const sortedTrades = [...trades].sort((a, b) => {
    const timeDiff = new Date(a.tradeTime).getTime() - new Date(b.tradeTime).getTime()
    if (timeDiff !== 0) return timeDiff
    // Tie-break by originalRowIndex if available
    const rowA = a.originalRowIndex ?? 0
    const rowB = b.originalRowIndex ?? 0
    return rowA - rowB
  })

  // ── Step 2: Process trades in chronological order ──
  // Maintain per-pair FIFO queues of BUY lots
  const buyQueues = new Map<string, BuyLot[]>()

  for (const trade of sortedTrades) {
    const side = trade.side.toUpperCase().trim()
    const pairKey = trade.pair.toUpperCase().trim()

    if (side === 'BUY') {
      // ── BUY trade → push into pair's FIFO queue ──
      const qty = toD(trade.qty)
      const price = toD(trade.price)
      const fee = toD(trade.fee)
      const tds = toD(trade.tds)

      if (qty.lte(0) || price.lte(0)) continue // skip invalid

      if (!buyQueues.has(pairKey)) {
        buyQueues.set(pairKey, [])
      }

      buyQueues.get(pairKey)!.push({
        buyTradeId: trade.id,
        pair: trade.pair,
        asset: trade.asset,
        buyTime: trade.tradeTime,
        originalQty: qty,
        remainingQty: qty,
        buyPrice: price,
        totalBuyFee: fee,
        remainingBuyFee: fee,
        totalBuyTds: tds,
        sourceCsvId: trade.csvFileId,
      })
    } else if (side === 'SELL') {
      // ── SELL trade → match against available BUY lots ──
      const sellQty = toD(trade.qty)
      const sellPrice = toD(trade.price)
      const sellFee = toD(trade.fee)
      const sellTds = toD(trade.tds)

      if (sellQty.lte(0) || sellPrice.lte(0)) continue // skip invalid

      const buyLots = buyQueues.get(pairKey)
      let remainingSellQty = sellQty

      // Track total matched qty from this sell for proportional sell-fee allocation
      let totalMatchedFromSell = new Decimal(0)

      // Collect matches for this SELL
      const matches: Array<{
        buyLot: BuyLot
        matchedQty: Decimal
      }> = []

      if (buyLots && buyLots.length > 0) {
        // ── Match against BUY lots in FIFO order ──
        for (const buyLot of buyLots) {
          // Skip fully consumed BUY lots
          if (buyLot.remainingQty.lte(0)) continue

          // If SELL is fully matched, stop
          if (remainingSellQty.lte(0)) break

          // CRITICAL: Never match with a BUY that happens AFTER this SELL
          // Since buy lots are in chronological order, once we hit a future
          // buy, all remaining lots are also future → break immediately
          if (buyLot.buyTime.getTime() > new Date(trade.tradeTime).getTime()) {
            break
          }

          const matchedQty = Decimal.min(remainingSellQty, buyLot.remainingQty)

          matches.push({ buyLot, matchedQty })

          // Update BUY lot remaining
          buyLot.remainingQty = buyLot.remainingQty.minus(matchedQty)

          // Update BUY lot remaining fee (proportional)
          buyLot.remainingBuyFee = buyLot.totalBuyFee.times(
            buyLot.remainingQty.div(buyLot.originalQty)
          )

          // Update remaining SELL qty
          remainingSellQty = remainingSellQty.minus(matchedQty)
          totalMatchedFromSell = totalMatchedFromSell.plus(matchedQty)
        }
      }

      // ── Create Realized Trade for each matched segment ──
      for (const match of matches) {
        const { buyLot, matchedQty } = match

        // ── Proportional fee allocation ──
        // Buy fee: allocatedBuyFee = totalBuyFee × (matchedQty / originalBuyQty)
        const allocatedBuyFee = buyLot.totalBuyFee.times(
          matchedQty.div(buyLot.originalQty)
        )

        // Sell fee: allocatedSellFee = totalSellFee × (matchedQty / originalSellQty)
        const allocatedSellFee = sellFee.times(
          matchedQty.div(sellQty)
        )

        // ── Proportional TDS allocation ──
        const allocatedBuyTds = buyLot.totalBuyTds.times(
          matchedQty.div(buyLot.originalQty)
        )
        const allocatedSellTds = sellTds.times(
          matchedQty.div(sellQty)
        )
        const totalTds = allocatedBuyTds.plus(allocatedSellTds)

        // ── Compute values ──
        const buyValue = matchedQty.times(buyLot.buyPrice)
        const sellValue = matchedQty.times(sellPrice)
        const grossProfit = sellValue.minus(buyValue)
        const totalFees = allocatedBuyFee.plus(allocatedSellFee)

        // ── Tax calculations per realized match ──
        // If feesIncludeGst is true, fees already include GST — don't add GST on top.
        // Exchanges like Delta India include 18% GST in their "Trading Fees" column.
        const gstOnFees = (options?.feesIncludeGst)
          ? new Decimal(0)
          : totalFees.times(GST_RATE)

        let baseCryptoTax: Decimal
        let cess: Decimal
        let totalDirectTax: Decimal

        if (grossProfit.gt(0)) {
          baseCryptoTax = grossProfit.times(CRYPTO_TAX_RATE)
          cess = baseCryptoTax.times(CESS_RATE)
          totalDirectTax = baseCryptoTax.plus(cess)
        } else {
          baseCryptoTax = new Decimal(0)
          cess = new Decimal(0)
          totalDirectTax = new Decimal(0)
        }

        // ── Net profit calculation ──
        // Net Profit in Hand = Gross Profit − Total Fees − GST on Fees − TDS
        const netProfitInHand = grossProfit
          .minus(totalFees)
          .minus(gstOnFees)
          .minus(totalTds)

        // Final Net Profit = Net Profit in Hand − Total Direct Tax + TDS
        const finalNetProfit = netProfitInHand
          .minus(totalDirectTax)
          .plus(totalTds)

        const status: 'PROFIT' | 'LOSS' = finalNetProfit.gt(0) ? 'PROFIT' : 'LOSS'

        realizedTrades.push({
          pair: trade.pair,
          asset: buyLot.asset || trade.asset,
          buyTradeId: buyLot.buyTradeId,
          sellTradeId: trade.id,
          buyDate: buyLot.buyTime,
          sellDate: trade.tradeTime,
          matchedQty: matchedQty.toString(),
          buyPrice: buyLot.buyPrice.toString(),
          sellPrice: sellPrice.toString(),
          buyValue: buyValue.toString(),
          sellValue: sellValue.toString(),
          grossProfit: grossProfit.toString(),
          allocatedBuyFee: allocatedBuyFee.toString(),
          allocatedSellFee: allocatedSellFee.toString(),
          totalFees: totalFees.toString(),
          gstOnFees: gstOnFees.toString(),
          tds: totalTds.toString(),
          baseCryptoTax: baseCryptoTax.toString(),
          cess: cess.toString(),
          totalDirectTax: totalDirectTax.toString(),
          netProfitInHand: netProfitInHand.toString(),
          finalNetProfit: finalNetProfit.toString(),
          status,
          buyCsvFileId: buyLot.sourceCsvId,
          sellCsvFileId: trade.csvFileId,
        })
      }

      // ── Unmatched SELL quantity → Warning ──
      if (remainingSellQty.gt(0)) {
        unmatchedSellWarnings.push({
          pair: trade.pair,
          sellTradeId: trade.id,
          sellDate: trade.tradeTime,
          originalSellQty: sellQty.toString(),
          unmatchedQty: remainingSellQty.toString(),
          reason: 'No earlier available BUY lot found for this SELL quantity.',
        })
      }

      // ── Clean up fully consumed BUY lots ──
      if (buyLots) {
        // Remove lots with zero remaining qty
        for (let i = buyLots.length - 1; i >= 0; i--) {
          if (buyLots[i].remainingQty.lte(0)) {
            buyLots.splice(i, 1)
          }
        }
      }
    }
    // Ignore unknown side values
  }

  // ── Step 3: Build Open Holdings from remaining BUY lots ──
  for (const [_pairKey, lots] of buyQueues) {
    for (const lot of lots) {
      if (lot.remainingQty.gt(0)) {
        const remainingCostBasis = lot.remainingQty.times(lot.buyPrice)
        const remainingAllocatedBuyFee = lot.remainingBuyFee
        const isFullyUnmatched = lot.remainingQty.equals(lot.originalQty)

        openHoldings.push({
          pair: lot.pair,
          asset: lot.asset,
          buyTradeId: lot.buyTradeId,
          buyDate: lot.buyTime,
          originalQty: lot.originalQty.toString(),
          remainingQty: lot.remainingQty.toString(),
          buyPrice: lot.buyPrice.toString(),
          remainingCostBasis: remainingCostBasis.toString(),
          remainingAllocatedBuyFee: remainingAllocatedBuyFee.toString(),
          sourceCsvId: lot.sourceCsvId,
          status: isFullyUnmatched
            ? 'Fully Unmatched Buy Lot'
            : 'Partially Matched Remaining Lot',
        })
      }
    }
  }

  // ── Sort open holdings by pair then buy date ──
  openHoldings.sort((a, b) => {
    const pairCompare = a.pair.localeCompare(b.pair)
    if (pairCompare !== 0) return pairCompare
    return new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
  })

  // ── Build Summary ──
  const summary = buildSummary(realizedTrades, openHoldings, unmatchedSellWarnings)

  return { realizedTrades, openHoldings, unmatchedSellWarnings, summary }
}

// ── Build Summary ──────────────────────────────────────────

function buildSummary(
  realizedTrades: RealizedTrade[],
  openHoldings: OpenHolding[],
  unmatchedSellWarnings: UnmatchedSellWarning[],
): FifoSummary {
  const totalGrossProfit = sumD(realizedTrades.map(t => t.grossProfit))
  const totalFees = sumD(realizedTrades.map(t => t.totalFees))
  const totalTds = sumD(realizedTrades.map(t => t.tds))
  const totalDirectTax = sumD(realizedTrades.map(t => t.totalDirectTax))
  const finalNetProfit = sumD(realizedTrades.map(t => t.finalNetProfit))

  return {
    totalRealizedTrades: realizedTrades.length,
    totalOpenHoldings: openHoldings.length,
    totalUnmatchedSells: unmatchedSellWarnings.length,
    totalGrossProfit: totalGrossProfit.toString(),
    totalFees: totalFees.toString(),
    totalTds: totalTds.toString(),
    totalDirectTax: totalDirectTax.toString(),
    finalNetProfit: finalNetProfit.toString(),
  }
}

// ── Empty Summary ──────────────────────────────────────────

function createEmptySummary(): FifoSummary {
  return {
    totalRealizedTrades: 0,
    totalOpenHoldings: 0,
    totalUnmatchedSells: 0,
    totalGrossProfit: '0',
    totalFees: '0',
    totalTds: '0',
    totalDirectTax: '0',
    finalNetProfit: '0',
  }
}

// ── Backward-Compatible Type Aliases ────────────────────────
// These aliases ensure that existing consumers (tax-engine,
// report-builder, frontend pages) continue to compile.

/** @deprecated Use UnmatchedSellWarning instead */
export type FifoWarning = UnmatchedSellWarning

/** @deprecated Use OpenHolding.remainingCostBasis instead of remainingInvestedValue */
// OpenHolding already uses remainingCostBasis; frontend consumers
// that read .remainingInvestedValue will need to update their key.
