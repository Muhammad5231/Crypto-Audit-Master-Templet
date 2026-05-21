// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Report Builder (v2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Orchestrates the FIFO engine and tax engine to produce a
// complete audit report for a workspace:
//
//   1. Fetches all trades for a workspace
//   2. Runs the FIFO matching engine
//   3. Fetches ExchangeSettings for the workspace
//   4. Runs the tax calculation engine
//   5. Builds summary metrics
//   6. Returns a complete report ready for storage/display
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { db } from '@/lib/db'
import { toD, Decimal, sumD } from '@/lib/decimal'
import { runFifoEngine, type TradeInput, type FifoResult, type RealizedTrade, type OpenHolding, type UnmatchedSellWarning } from '@/lib/fifo-engine'
import { runTaxEngine, type TaxEngineResult, type TaxSummary, type TaxedRealizedTrade } from '@/lib/tax-engine'

// ── Type Definitions ───────────────────────────────────────

/** Summary metrics for the complete report */
export interface ReportSummary {
  // Trade counts
  totalTrades: number
  totalBuyTrades: number
  totalSellTrades: number
  uniquePairs: number

  // Trade values
  totalBuyValue: string
  totalSellValue: string
  totalFees: string
  totalTds: string

  // FIFO results
  totalRealizedTrades: number
  totalOpenHoldings: number
  totalWarnings: number
  fullyUnmatchedHoldings: number
  partiallyMatchedHoldings: number

  // Holding values
  totalHoldingValue: string
  totalHoldingQty: string

  // Tax results
  taxSummary: TaxSummary
}

/** Complete report object */
export interface CompleteReport {
  summary: ReportSummary
  realizedTrades: TaxedRealizedTrade[]
  openHoldings: OpenHolding[]
  warnings: UnmatchedSellWarning[]
  fifoResult: FifoResult
  taxResult: TaxEngineResult
}

// ── Main Report Generation Function ────────────────────────

export async function generateReport(workspaceId: string, userId: string): Promise<CompleteReport> {
  // ── Step 1: Fetch all trades for the workspace ──
  const trades = await db.trade.findMany({
    where: { workspaceId },
    orderBy: { tradeTime: 'asc' },
  })

  // ── Step 2: Fetch exchange settings ──
  let exchangeSettings = await db.exchangeSettings.findFirst({
    where: { workspaceId },
  })

  if (!exchangeSettings) {
    exchangeSettings = await db.exchangeSettings.create({
      data: { userId, workspaceId },
    })
  }

  // ── Step 3: Run FIFO engine ──
  // Use database ID-based ordering as a stable tiebreaker for same-timestamp trades.
  // CUIDs are lexicographically ordered by creation time, so earlier-created
  // trades have "smaller" IDs, maintaining insertion order from CSV parsing.
  const tradeInputs: TradeInput[] = trades.map((trade, index) => ({
    id: trade.id,
    tradeTime: trade.tradeTime,
    pair: trade.pair,
    asset: trade.asset,
    side: trade.side,
    qty: trade.qty,
    price: trade.price,
    orderValue: trade.orderValue,
    fee: trade.fee,
    tds: trade.tds,
    csvFileId: trade.csvFileId,
    originalRowIndex: index,  // Use array index from DB query (already sorted by tradeTime ASC)
  }))

  const fifoResult = runFifoEngine(tradeInputs)

  // ── Step 4: Run tax engine ──
  const taxResult = runTaxEngine(fifoResult.realizedTrades, {
    defaultBuyFeePercent: exchangeSettings.defaultBuyFeePercent,
    defaultSellFeePercent: exchangeSettings.defaultSellFeePercent,
    defaultTdsPercent: exchangeSettings.defaultTdsPercent,
    gstPercent: exchangeSettings.gstPercent,
    cryptoTaxPercent: exchangeSettings.cryptoTaxPercent,
    cessPercent: exchangeSettings.cessPercent,
  })

  // ── Step 5: Build summary metrics ──
  const summary = buildReportSummary(tradeInputs, fifoResult, taxResult)

  return {
    summary,
    realizedTrades: taxResult.taxedTrades,
    openHoldings: fifoResult.openHoldings,
    warnings: fifoResult.unmatchedSellWarnings,
    fifoResult,
    taxResult,
  }
}

// ── Build Report Summary ───────────────────────────────────

function buildReportSummary(
  trades: TradeInput[],
  fifoResult: FifoResult,
  taxResult: TaxEngineResult,
): ReportSummary {
  const buyTrades = trades.filter(t => t.side.toUpperCase() === 'BUY')
  const sellTrades = trades.filter(t => t.side.toUpperCase() === 'SELL')
  const uniquePairs = new Set(trades.map(t => t.pair.toUpperCase())).size

  const totalBuyValue = sumD(buyTrades.map(t => t.orderValue))
  const totalSellValue = sumD(sellTrades.map(t => t.orderValue))
  const totalFees = sumD(trades.map(t => t.fee))
  const totalTds = sumD(trades.map(t => t.tds))

  const fullyUnmatchedHoldings = fifoResult.openHoldings.filter(
    h => h.status === 'Fully Unmatched Buy Lot'
  ).length
  const partiallyMatchedHoldings = fifoResult.openHoldings.filter(
    h => h.status === 'Partially Matched Remaining Lot'
  ).length

  const totalHoldingValue = sumD(
    fifoResult.openHoldings.map(h => h.remainingCostBasis)
  )
  const totalHoldingQty = sumD(
    fifoResult.openHoldings.map(h => h.remainingQty)
  )

  return {
    totalTrades: trades.length,
    totalBuyTrades: buyTrades.length,
    totalSellTrades: sellTrades.length,
    uniquePairs,
    totalBuyValue: totalBuyValue.toString(),
    totalSellValue: totalSellValue.toString(),
    totalFees: totalFees.toString(),
    totalTds: totalTds.toString(),
    totalRealizedTrades: fifoResult.realizedTrades.length,
    totalOpenHoldings: fifoResult.openHoldings.length,
    totalWarnings: fifoResult.unmatchedSellWarnings.length,
    fullyUnmatchedHoldings,
    partiallyMatchedHoldings,
    totalHoldingValue: totalHoldingValue.toString(),
    totalHoldingQty: totalHoldingQty.toString(),
    taxSummary: taxResult.summary,
  }
}
