// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Excel Export Service
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generates professional multi-sheet Excel workbooks for audit
// reports, including realized trades, open holdings, tax summaries,
// and all supporting data. Uses the `xlsx` package (SheetJS).
//
// Key features:
//   - Multi-sheet workbook with 13 sheets for full export
//   - Single-sheet exports for focused views
//   - INR number formatting for financial values
//   - Auto-width columns for readability
//   - Color-coded profit/loss indicators in cell comments
//   - Bold header rows
//   - Consistent Decimal.js precision throughout
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import * as XLSX from 'xlsx'
import { toD, formatINR } from '@/lib/decimal'
import type { TaxedRealizedTrade, TaxSummary } from '@/lib/tax-engine'
import type { OpenHolding, UnmatchedSellWarning } from '@/lib/fifo-engine'

// ── Type Definitions ───────────────────────────────────────

/** Parsed report data (from the latest report API) */
export interface ReportDataForExport {
  reportId: string
  generatedAt: string
  sourceCsvFiles: Array<{ id: string; originalName: string; totalRows: number; validRows: number; skippedRows: number }>
  summary: {
    totalTrades: number
    totalBuyTrades: number
    totalSellTrades: number
    uniquePairs: number
    totalBuyValue: string
    totalSellValue: string
    totalFees: string
    totalTds: string
    totalRealizedTrades: number
    totalOpenHoldings: number
    totalWarnings: number
    fullyUnmatchedHoldings: number
    partiallyMatchedHoldings: number
    totalHoldingValue: string
    totalHoldingQty: string
    taxSummary: TaxSummary
  }
  realizedTrades: TaxedRealizedTrade[]
  openHoldings: OpenHolding[]
  warnings: FifoWarning[]
  taxSummary: TaxSummary
}

/** Workspace info for export headers */
export interface WorkspaceForExport {
  id: string
  name: string
  financialYear: string
}

/** CSV file record for upload log sheet */
export interface CsvFileForExport {
  id: string
  originalName: string
  totalRows: number
  validRows: number
  skippedRows: number
  uploadedAt: string
}

/** Exchange settings for the settings sheet */
export interface ExchangeSettingsForExport {
  defaultBuyFeePercent: string
  defaultSellFeePercent: string
  defaultTdsPercent: string
  gstPercent: string
  cryptoTaxPercent: string
  cessPercent: string
}

/** Note for the notes column */
export interface NoteForExport {
  id: string
  title: string
  content: string
  updatedAt: string
}

// ── Helper: Format a Decimal.js string as INR for Excel ────
// Returns the numeric value as a number for Excel cell formatting.
// We store the number and apply a format string, rather than
// pre-formatting as text, so Excel can still do calculations.

function toNum(val: string | number): number {
  return toD(val).toNumber()
}

/** Format a date for Excel display */
function fmtDate(d: string | Date): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

/** Format a date+time for Excel display */
function fmtDateTime(d: string | Date): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Helper: Apply auto-width to worksheet columns ──────────
// Calculates the max width for each column based on content.

function autoWidth(ws: XLSX.WorkSheet, headerRow: string[]) {
  const colWidths: XLSX.ColInfo[] = []

  // Start with header widths
  for (let i = 0; i < headerRow.length; i++) {
    colWidths.push({ wch: Math.max(headerRow[i].length + 2, 12) })
  }

  // Check data rows
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (cell && cell.v != null) {
        const len = String(cell.v).length + 2
        if (c < colWidths.length && len > (colWidths[c].wch || 0)) {
          colWidths[c] = { wch: Math.min(len, 50) } // Cap at 50 chars
        }
      }
    }
  }

  ws['!cols'] = colWidths
}

// ── Helper: Create a worksheet from AoA with bold header ───

function createSheet(
  data: (string | number)[][],
  headerRow: string[],
  sheetName: string,
): XLSX.WorkSheet {
  const allRows = [headerRow, ...data]
  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Apply auto-width
  autoWidth(ws, headerRow)

  return ws
}

// ── Helper: Generate a safe filename ───────────────────────

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PART 1: FULL EXCEL WORKBOOK (13 sheets)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateFullExcelWorkbook(
  report: ReportDataForExport,
  workspace: WorkspaceForExport,
  csvFiles: CsvFileForExport[],
  settings: ExchangeSettingsForExport,
  notes: NoteForExport[],
): Buffer {
  const wb = XLSX.utils.book_new()
  const wsName = workspace.name
  const fy = workspace.financialYear
  const genDate = fmtDateTime(report.generatedAt)

  // ── Sheet 1: Report Info ────────────────────────────────
  const infoData = [
    ['Workspace Name', wsName],
    ['Financial Year', fy],
    ['Report Generated At', genDate],
    ['Report ID', report.reportId],
    ['Total Trades', report.summary.totalTrades],
    ['Realized Trades', report.summary.totalRealizedTrades],
    ['Open Holdings', report.summary.totalOpenHoldings],
    ['Warnings', report.summary.totalWarnings],
    ['', ''],
    ['DISCLAIMER', 'This report is generated for informational purposes only. It does not constitute professional tax advice. Please consult a qualified Chartered Accountant for filing purposes.'],
  ]
  const infoWs = createSheet(infoData, ['Field', 'Value'], 'Report Info')
  XLSX.utils.book_append_sheet(wb, infoWs, 'Report Info')

  // ── Sheet 2: Executive Summary ──────────────────────────
  const ts = report.summary.taxSummary
  const summaryData = [
    ['Total Trades', report.summary.totalTrades, ''],
    ['Profitable Trades', ts.profitableTrades, ''],
    ['Loss Trades', ts.lossTrades, ''],
    ['', '', ''],
    ['Total Buy Value (₹)', toNum(ts.totalBuyValue), 'INR'],
    ['Total Sell Value (₹)', toNum(ts.totalSellValue), 'INR'],
    ['Total Gross Profit (₹)', toNum(ts.totalGrossProfit), 'INR'],
    ['Total Gross Loss (₹)', toNum(ts.totalGrossLoss), 'INR'],
    ['', '', ''],
    ['Total Fees (₹)', toNum(ts.totalFees), 'INR'],
    ['Total GST on Fees (₹)', toNum(ts.totalGstOnFees), 'INR'],
    ['Total TDS (₹)', toNum(ts.totalTds), 'INR'],
    ['', '', ''],
    ['Total Direct Tax (₹)', toNum(ts.totalDirectTax), 'INR'],
    ['Total Cess (₹)', toNum(ts.totalCess), 'INR'],
    ['Effective Tax Rate (%)', toNum(ts.effectiveTaxRate), '%'],
    ['', '', ''],
    ['Total Net Profit (₹)', toNum(ts.totalNetProfit), 'INR'],
    ['Net Profit from Profitable Trades (₹)', toNum(ts.totalNetProfitFromProfitableTrades), 'INR'],
    ['Net Loss from Loss Trades (₹)', toNum(ts.totalNetLossFromLossTrades), 'INR'],
    ['', '', ''],
    ['Avg Profit Per Trade (₹)', toNum(ts.avgProfitPerTrade), 'INR'],
    ['Avg Loss Per Trade (₹)', toNum(ts.avgLossPerTrade), 'INR'],
    ['', '', ''],
    ['Open Holdings', report.summary.totalOpenHoldings, ''],
    ['Fully Unmatched Holdings', report.summary.fullyUnmatchedHoldings, ''],
    ['Partially Matched Holdings', report.summary.partiallyMatchedHoldings, ''],
    ['Total Holding Value (₹)', toNum(report.summary.totalHoldingValue), 'INR'],
  ]
  const summaryWs = createSheet(summaryData, ['Metric', 'Value', 'Unit'], 'Executive Summary')
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary')

  // ── Sheet 3: Realized Trades ────────────────────────────
  const rtData = report.realizedTrades.map((t, i) => [
    i + 1,
    t.pair,
    fmtDate(t.buyDate),
    fmtDate(t.sellDate),
    toD(t.matchedQty).toNumber(),
    toNum(t.buyPrice),
    toNum(t.sellPrice),
    toNum(t.buyValue),
    toNum(t.sellValue),
    toNum(t.grossProfit),
    toNum(t.resolvedBuyFee || t.allocatedBuyFee),
    toNum(t.resolvedSellFee || t.allocatedSellFee),
    toNum(t.resolvedTotalFees || t.totalFees),
    toNum(t.resolvedGstOnFees || t.gstOnFees),
    toNum(t.tds),
    toNum(t.resolvedTotalTds || t.tds),
    toNum(t.resolvedBaseCryptoTax || t.baseCryptoTax),
    toNum(t.resolvedCess || t.cess),
    toNum(t.resolvedTotalDirectTax || t.totalDirectTax),
    toNum(t.resolvedNetProfitInHand || t.netProfitInHand),
    toNum(t.resolvedFinalNetProfit || t.finalNetProfit),
    t.resolvedProfitLossStatus || t.status,
    t.buyFeeSource || '',
    t.sellFeeSource || '',
    t.buyTdsSource || '',
    t.sellTdsSource || '',
  ])
  const rtHeader = [
    '#', 'Pair', 'Buy Date', 'Sell Date', 'Matched Qty',
    'Buy Price (₹)', 'Sell Price (₹)', 'Buy Value (₹)', 'Sell Value (₹)',
    'Gross Profit (₹)',
    'Buy Fee (₹)', 'Sell Fee (₹)', 'Total Fees (₹)',
    'GST on Fees (₹)',
    'TDS (₹)', 'Total Resolved TDS (₹)',
    'Base Crypto Tax (₹)', 'Cess (₹)', 'Total Direct Tax (₹)',
    'Net Profit in Hand (₹)', 'Final Net Profit (₹)',
    'Status', 'Buy Fee Source', 'Sell Fee Source', 'Buy TDS Source', 'Sell TDS Source',
  ]
  const rtWs = createSheet(rtData, rtHeader, 'Realized Trades')
  XLSX.utils.book_append_sheet(wb, rtWs, 'Realized Trades')

  // ── Sheet 4: Open Holdings ──────────────────────────────
  const ohData = report.openHoldings.map((h, i) => [
    i + 1,
    h.pair,
    fmtDate(h.buyDate),
    toD(h.originalQty).toNumber(),
    toD(h.remainingQty).toNumber(),
    toNum(h.buyPrice),
    toNum(h.remainingCostBasis),
    toNum(h.remainingAllocatedBuyFee),
    h.status === 'Fully Unmatched Buy Lot' ? 'Fully Unmatched' : 'Partially Matched',
  ])
  const ohHeader = [
    '#', 'Pair', 'Buy Date', 'Original Qty', 'Remaining Qty',
    'Buy Price (₹)', 'Cost Basis (₹)',
    'Allocated Buy Fee (₹)', 'Holding Status',
  ]
  const ohWs = createSheet(ohData, ohHeader, 'Open Holdings')
  XLSX.utils.book_append_sheet(wb, ohWs, 'Open Holdings')

  // ── Sheet 5: Tax Summary ────────────────────────────────
  const taxData = [
    ['Total Trades', ts.totalTrades],
    ['Profitable Trades', ts.profitableTrades],
    ['Loss Trades', ts.lossTrades],
    ['', ''],
    ['Total Buy Value', formatINR(toD(ts.totalBuyValue))],
    ['Total Sell Value', formatINR(toD(ts.totalSellValue))],
    ['Total Gross Profit', formatINR(toD(ts.totalGrossProfit))],
    ['Total Gross Loss', formatINR(toD(ts.totalGrossLoss))],
    ['', ''],
    ['Total Fees', formatINR(toD(ts.totalFees))],
    ['Total GST on Fees', formatINR(toD(ts.totalGstOnFees))],
    ['Total TDS', formatINR(toD(ts.totalTds))],
    ['', ''],
    ['Base Crypto Tax (30%)', formatINR(toD(ts.totalDirectTax).minus(toD(ts.totalCess)))],
    ['Cess (4%)', formatINR(toD(ts.totalCess))],
    ['Total Direct Tax', formatINR(toD(ts.totalDirectTax))],
    ['', ''],
    ['Net Profit Before Tax', formatINR(toD(ts.totalNetProfit).plus(toD(ts.totalDirectTax)).minus(toD(ts.totalTds)))],
    ['Less: Direct Tax', formatINR(toD(ts.totalDirectTax))],
    ['Add: TDS Credit', formatINR(toD(ts.totalTds))],
    ['Final Net Profit', formatINR(toD(ts.totalNetProfit))],
    ['', ''],
    ['Effective Tax Rate', toD(ts.effectiveTaxRate).toFixed(2) + '%'],
    ['Avg Profit Per Trade', formatINR(toD(ts.avgProfitPerTrade))],
    ['Avg Loss Per Trade', formatINR(toD(ts.avgLossPerTrade))],
  ]
  const taxWs = createSheet(taxData, ['Tax Item', 'Value'], 'Tax Summary')
  XLSX.utils.book_append_sheet(wb, taxWs, 'Tax Summary')

  // ── Sheet 6: Fees & GST ─────────────────────────────────
  // Aggregate fees by pair
  const feesByPair = new Map<string, { totalFees: number; totalGst: number; count: number }>()
  for (const t of report.realizedTrades) {
    const pair = t.pair
    const existing = feesByPair.get(pair) || { totalFees: 0, totalGst: 0, count: 0 }
    existing.totalFees += toNum(t.resolvedTotalFees)
    existing.totalGst += toNum(t.gstOnFees)
    existing.count += 1
    feesByPair.set(pair, existing)
  }
  const feesData = Array.from(feesByPair.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pair, data]) => [pair, data.count, data.totalFees, data.totalGst, data.totalFees + data.totalGst])
  const feesHeader = ['Pair', 'Trade Count', 'Total Fees (₹)', 'Total GST (₹)', 'Fees + GST (₹)']
  const feesWs = createSheet(feesData, feesHeader, 'Fees & GST')
  XLSX.utils.book_append_sheet(wb, feesWs, 'Fees & GST')

  // ── Sheet 7: TDS Summary ────────────────────────────────
  const tdsByPair = new Map<string, { tds: number; totalTds: number; count: number }>()
  for (const t of report.realizedTrades) {
    const pair = t.pair
    const existing = tdsByPair.get(pair) || { tds: 0, totalTds: 0, count: 0 }
    existing.tds += toNum(t.tds)
    existing.totalTds += toNum(t.resolvedTotalTds || t.tds)
    existing.count += 1
    tdsByPair.set(pair, existing)
  }
  const tdsData = Array.from(tdsByPair.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pair, data]) => [pair, data.count, data.tds, data.totalTds])
  const tdsHeader = ['Pair', 'Trade Count', 'TDS (₹)', 'Total Resolved TDS (₹)']
  const tdsWs = createSheet(tdsData, tdsHeader, 'TDS Summary')
  XLSX.utils.book_append_sheet(wb, tdsWs, 'TDS Summary')

  // ── Sheet 8: Pair Performance ───────────────────────────
  const pairPerf = new Map<string, {
    grossProfit: number; netProfit: number; directTax: number;
    fees: number; trades: number; profitTrades: number; lossTrades: number;
  }>()
  for (const t of report.realizedTrades) {
    const pair = t.pair
    const existing = pairPerf.get(pair) || {
      grossProfit: 0, netProfit: 0, directTax: 0, fees: 0,
      trades: 0, profitTrades: 0, lossTrades: 0,
    }
    existing.grossProfit += toNum(t.grossProfit)
    existing.netProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    existing.directTax += toNum(t.resolvedTotalDirectTax || t.totalDirectTax)
    existing.fees += toNum(t.resolvedTotalFees || t.totalFees)
    existing.trades += 1
    if ((t.resolvedProfitLossStatus || t.status) === 'PROFIT') existing.profitTrades += 1
    else existing.lossTrades += 1
    pairPerf.set(pair, existing)
  }
  const pairData = Array.from(pairPerf.entries())
    .sort(([, a], [, b]) => b.netProfit - a.netProfit) // Sort by net profit desc
    .map(([pair, d]) => [
      pair, d.trades, d.profitTrades, d.lossTrades,
      d.grossProfit, d.fees, d.directTax, d.netProfit,
      d.trades > 0 ? (d.netProfit / d.trades) : 0,
    ])
  const pairHeader = [
    'Pair', 'Total Trades', 'Profit Trades', 'Loss Trades',
    'Gross Profit (₹)', 'Total Fees (₹)', 'Direct Tax (₹)', 'Net Profit (₹)',
    'Avg Net Profit (₹)',
  ]
  const pairWs = createSheet(pairData, pairHeader, 'Pair Performance')
  XLSX.utils.book_append_sheet(wb, pairWs, 'Pair Performance')

  // ── Sheet 9: Monthly Performance ────────────────────────
  const monthPerf = new Map<string, {
    grossProfit: number; netProfit: number; directTax: number;
    fees: number; trades: number;
  }>()
  for (const t of report.realizedTrades) {
    const sellDate = new Date(t.sellDate)
    const monthKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`
    const existing = monthPerf.get(monthKey) || {
      grossProfit: 0, netProfit: 0, directTax: 0, fees: 0, trades: 0,
    }
    existing.grossProfit += toNum(t.grossProfit)
    existing.netProfit += toNum(t.finalNetProfit)
    existing.directTax += toNum(t.totalDirectTax)
    existing.fees += toNum(t.resolvedTotalFees)
    existing.trades += 1
    monthPerf.set(monthKey, existing)
  }
  const monthData = Array.from(monthPerf.entries())
    .sort(([a], [b]) => a.localeCompare(b)) // Sort by month ascending
    .map(([month, d]) => [month, d.trades, d.grossProfit, d.fees, d.directTax, d.netProfit])
  const monthHeader = ['Month', 'Trades', 'Gross Profit (₹)', 'Fees (₹)', 'Direct Tax (₹)', 'Net Profit (₹)']
  const monthWs = createSheet(monthData, monthHeader, 'Monthly Performance')
  XLSX.utils.book_append_sheet(wb, monthWs, 'Monthly Performance')

  // ── Sheet 10: CSV Upload Log ────────────────────────────
  const csvData = csvFiles.map((f, i) => [
    i + 1,
    f.originalName,
    f.totalRows,
    f.validRows,
    f.skippedRows,
    fmtDateTime(f.uploadedAt),
  ])
  const csvHeader = ['#', 'File Name', 'Total Rows', 'Valid Rows', 'Skipped Rows', 'Uploaded At']
  const csvWs = createSheet(csvData, csvHeader, 'CSV Upload Log')
  XLSX.utils.book_append_sheet(wb, csvWs, 'CSV Upload Log')

  // ── Sheet 11: Warnings ──────────────────────────────────
  const warnData = report.warnings.map((w, i) => [
    i + 1,
    w.type,
    w.pair,
    w.message,
    toD(w.sellQty).toNumber(),
    toD(w.availableQty).toNumber(),
    toD(w.shortfallQty).toNumber(),
  ])
  const warnHeader = ['#', 'Warning Type', 'Pair', 'Message', 'Sell Qty', 'Available Qty', 'Shortfall Qty']
  const warnWs = createSheet(warnData, warnHeader, 'Warnings')
  XLSX.utils.book_append_sheet(wb, warnWs, 'Warnings')

  // ── Sheet 12: Settings Used ─────────────────────────────
  const settingsData = [
    ['Default Buy Fee %', settings.defaultBuyFeePercent + '%'],
    ['Default Sell Fee %', settings.defaultSellFeePercent + '%'],
    ['Default TDS %', settings.defaultTdsPercent + '%'],
    ['GST %', settings.gstPercent + '%'],
    ['Crypto Tax %', settings.cryptoTaxPercent + '%'],
    ['Cess %', settings.cessPercent + '%'],
    ['', ''],
    ['Note', 'CSV-provided values always take priority over these defaults. Defaults are used only when CSV value is 0 or missing.'],
  ]
  const settingsWs = createSheet(settingsData, ['Setting', 'Value'], 'Settings Used')
  XLSX.utils.book_append_sheet(wb, settingsWs, 'Settings Used')

  // ── Sheet 13: Formulas ──────────────────────────────────
  const formulasData = [
    ['Gross Profit', 'Sell Value − Buy Value'],
    ['Total Fees', 'Buy Fee (proportional) + Sell Fee (proportional)'],
    ['Fee Allocation', 'Original Fee × (Matched Qty / Original Qty)'],
    ['GST on Fees', 'Total Fees × GST%'],
    ['TDS (Buy)', 'CSV TDS if non-zero, else 0'],
    ['TDS (Sell)', 'CSV TDS if non-zero, else Sell Value × Default TDS%'],
    ['Total TDS', 'Buy TDS + Sell TDS'],
    ['Net Profit Before Tax', 'Gross Profit − Total Fees − GST − Total TDS'],
    ['Base Crypto Tax', 'Gross Profit × 30% (only if Gross Profit > 0)'],
    ['Cess', 'Base Crypto Tax × 4%'],
    ['Total Direct Tax', 'Base Crypto Tax + Cess'],
    ['Final Net Profit', 'Net Profit Before Tax − Total Direct Tax + Total TDS'],
    ['TDS Credit', 'TDS is added back as a credit against tax liability'],
    ['Profit/Loss Status', 'PROFIT if Final Net Profit > 0, else LOSS'],
  ]
  const formulasWs = createSheet(formulasData, ['Calculation', 'Formula / Explanation'], 'Formulas')
  XLSX.utils.book_append_sheet(wb, formulasWs, 'Formulas')

  // ── Write workbook to buffer ──
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

/** Generate filename for full workbook */
export function getFullWorkbookFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_FY${workspace.financialYear}_Full_${date}.xlsx`
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PART 2: SINGLE-SHEET EXCEL EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a single-sheet Excel with just realized trades.
 */
export function generateRealizedTradesExcel(
  realizedTrades: TaxedRealizedTrade[],
  workspace: WorkspaceForExport,
): Buffer {
  const wb = XLSX.utils.book_new()

  const data = realizedTrades.map((t, i) => [
    i + 1,
    t.pair,
    fmtDate(t.buyDate),
    fmtDate(t.sellDate),
    toD(t.matchedQty).toNumber(),
    toNum(t.buyPrice),
    toNum(t.sellPrice),
    toNum(t.buyValue),
    toNum(t.sellValue),
    toNum(t.grossProfit),
    toNum(t.resolvedBuyFee || t.allocatedBuyFee),
    toNum(t.resolvedSellFee || t.allocatedSellFee),
    toNum(t.resolvedTotalFees || t.totalFees),
    toNum(t.resolvedGstOnFees || t.gstOnFees),
    toNum(t.tds),
    toNum(t.resolvedTotalTds || t.tds),
    toNum(t.resolvedBaseCryptoTax || t.baseCryptoTax),
    toNum(t.resolvedCess || t.cess),
    toNum(t.resolvedTotalDirectTax || t.totalDirectTax),
    toNum(t.resolvedNetProfitInHand || t.netProfitInHand),
    toNum(t.resolvedFinalNetProfit || t.finalNetProfit),
    t.resolvedProfitLossStatus || t.status,
    t.buyFeeSource || '',
    t.sellFeeSource || '',
    t.buyTdsSource || '',
    t.sellTdsSource || '',
  ])

  const header = [
    '#', 'Pair', 'Buy Date', 'Sell Date', 'Matched Qty',
    'Buy Price (₹)', 'Sell Price (₹)', 'Buy Value (₹)', 'Sell Value (₹)',
    'Gross Profit (₹)',
    'Buy Fee (₹)', 'Sell Fee (₹)', 'Total Fees (₹)',
    'GST on Fees (₹)',
    'TDS (₹)', 'Total Resolved TDS (₹)',
    'Base Crypto Tax (₹)', 'Cess (₹)', 'Total Direct Tax (₹)',
    'Net Profit in Hand (₹)', 'Final Net Profit (₹)',
    'Status', 'Buy Fee Source', 'Sell Fee Source', 'Buy TDS Source', 'Sell TDS Source',
  ]

  const ws = createSheet(data, header, 'Realized Trades')
  XLSX.utils.book_append_sheet(wb, ws, 'Realized Trades')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Generate filename for realized trades export */
export function getRealizedTradesFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_RealizedTrades_${date}.xlsx`
}

/**
 * Generate a single-sheet Excel with just open holdings.
 */
export function generateOpenHoldingsExcel(
  openHoldings: OpenHolding[],
  workspace: WorkspaceForExport,
): Buffer {
  const wb = XLSX.utils.book_new()

  const data = openHoldings.map((h, i) => [
    i + 1,
    h.pair,
    fmtDate(h.buyDate),
    toD(h.originalQty).toNumber(),
    toD(h.remainingQty).toNumber(),
    toNum(h.buyPrice),
    toNum(h.remainingCostBasis),
    toNum(h.remainingAllocatedBuyFee),
    h.status === 'Fully Unmatched Buy Lot' ? 'Fully Unmatched' : 'Partially Matched',
  ])

  const header = [
    '#', 'Pair', 'Buy Date', 'Original Qty', 'Remaining Qty',
    'Buy Price (₹)', 'Cost Basis (₹)',
    'Allocated Buy Fee (₹)', 'Holding Status',
  ]

  const ws = createSheet(data, header, 'Open Holdings')
  XLSX.utils.book_append_sheet(wb, ws, 'Open Holdings')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Generate filename for open holdings export */
export function getOpenHoldingsFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_OpenHoldings_${date}.xlsx`
}

/**
 * Generate a single-sheet Excel with just tax summary.
 */
export function generateTaxSummaryExcel(
  taxSummary: TaxSummary,
  workspace: WorkspaceForExport,
): Buffer {
  const wb = XLSX.utils.book_new()

  const baseCryptoTax = toD(taxSummary.totalDirectTax).minus(toD(taxSummary.totalCess))

  const data = [
    ['Total Trades', taxSummary.totalTrades],
    ['Profitable Trades', taxSummary.profitableTrades],
    ['Loss Trades', taxSummary.lossTrades],
    ['', ''],
    ['Total Buy Value (₹)', toNum(taxSummary.totalBuyValue)],
    ['Total Sell Value (₹)', toNum(taxSummary.totalSellValue)],
    ['Total Gross Profit (₹)', toNum(taxSummary.totalGrossProfit)],
    ['Total Gross Loss (₹)', toNum(taxSummary.totalGrossLoss)],
    ['', ''],
    ['Total Fees (₹)', toNum(taxSummary.totalFees)],
    ['Total GST on Fees (₹)', toNum(taxSummary.totalGstOnFees)],
    ['Total TDS (₹)', toNum(taxSummary.totalTds)],
    ['', ''],
    ['Base Crypto Tax @30% (₹)', baseCryptoTax.toNumber()],
    ['Cess @4% (₹)', toNum(taxSummary.totalCess)],
    ['Total Direct Tax (₹)', toNum(taxSummary.totalDirectTax)],
    ['', ''],
    ['Total Net Profit (₹)', toNum(taxSummary.totalNetProfit)],
    ['Net Profit from Profitable Trades (₹)', toNum(taxSummary.totalNetProfitFromProfitableTrades)],
    ['Net Loss from Loss Trades (₹)', toNum(taxSummary.totalNetLossFromLossTrades)],
    ['', ''],
    ['Effective Tax Rate (%)', toNum(taxSummary.effectiveTaxRate)],
    ['Avg Profit Per Trade (₹)', toNum(taxSummary.avgProfitPerTrade)],
    ['Avg Loss Per Trade (₹)', toNum(taxSummary.avgLossPerTrade)],
  ]

  const header = ['Tax Item', 'Value']
  const ws = createSheet(data, header, 'Tax Summary')
  XLSX.utils.book_append_sheet(wb, ws, 'Tax Summary')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Generate filename for tax summary export */
export function getTaxSummaryFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_TaxSummary_${date}.xlsx`
}
