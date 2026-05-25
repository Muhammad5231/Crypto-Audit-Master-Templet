// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Premium Excel Export Service (exceljs)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generates professional, multi-sheet Excel workbooks for audit
// reports with full styling, conditional formatting, freeze panes,
// auto-filters, INR number formatting, and chart-ready data.
//
// Built on ExcelJS for premium formatting support:
//   - Professional teal/dark header styling
//   - INR number format (#,##0.00) for all financial columns
//   - Percentage format (0.00%) for rate columns
//   - Date format (DD-MMM-YYYY) for date columns
//   - Conditional formatting (green=profit, red=loss)
//   - Frozen header rows with freeze panes
//   - Auto-filters on data tables
//   - Auto-adjusted column widths
//   - Bold totals rows with top border
//   - Chart-ready data tables for embedded charting
//   - Sheet tab colors (teal=data, blue=summary, amber=warnings)
//
// 15-sheet workbook structure:
//   1.  Cover & Report Info
//   2.  Executive Summary
//   3.  Dashboard Overview
//   4.  Realized Trades
//   5.  Open Holdings
//   6.  Tax Summary
//   7.  Fees, GST & TDS Summary
//   8.  Pair-wise Performance
//   9.  Time-wise Profit Analysis
//   10. Charts & Graphs
//   11. CSV Upload Log
//   12. Warnings & Unmatched Sells
//   13. Exchange Details Used
//   14. Calculation Formulas
//   15. Notes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import ExcelJS, { type Workbook, type Worksheet, type Cell, type Column, type TableRow } from 'exceljs'
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
  /** Optional extended fields for premium upload log */
  exchange?: string
  buyFeePercent?: string
  sellFeePercent?: string
  fileSize?: number
  fileHash?: string
  mappingMode?: string
  processingStatus?: string
}

/** Exchange settings for the settings sheet */
export interface ExchangeSettingsForExport {
  defaultBuyFeePercent: string
  defaultSellFeePercent: string
  defaultTdsPercent: string
  gstPercent: string
  cryptoTaxPercent: string
  cessPercent: string
  /** Optional extended fields for exchange details sheet */
  exchangeName?: string
  source?: string
  usedInCsv?: boolean
  processedOn?: string
}

/** Note for the notes sheet */
export interface NoteForExport {
  id: string
  title: string
  content: string
  updatedAt: string
  createdAt?: string
}

/**
 * Generalised warning type that accommodates both skipped-row
 * warnings (from CSV parsing) and unmatched-sell warnings (from FIFO).
 */
export interface FifoWarning {
  type: string
  pair?: string
  message: string
  sellQty?: string
  availableQty?: string
  shortfallQty?: string
  // Skipped-row warning fields
  csvFile?: string
  rowNumber?: number
  severity?: string
  // UnmatchedSellWarning fields
  sellTradeId?: string
  sellDate?: Date | string
  originalSellQty?: string
  unmatchedQty?: string
  matchedQty?: string
  reason?: string
}

// ── Styling Constants ──────────────────────────────────────

/** AARRGGBB color constants for ExcelJS */
const COLORS = {
  TEAL:       'FF14B8A6',   // Primary teal header bg
  TEAL_DARK:  'FF0D9488',   // Darker teal for emphasis
  TEAL_LIGHT: 'CC14B8A6',   // Lighter teal for alternating rows
  WHITE:      'FFFFFFFF',
  BLACK:      'FF000000',
  GREEN:      'FF10B981',   // Profit background
  GREEN_FONT: 'FF059669',   // Profit font
  RED:        'FFEF4444',   // Loss background
  RED_FONT:   'FFDC2626',   // Loss font
  AMBER:      'FFF59E0B',   // Warning tab color
  BLUE:       'FF3B82F6',   // Summary tab color
  GRAY_BG:    'FFF3F4F6',   // Light gray for totals
  GRAY_FONT:  'FF6B7280',   // Muted text
  BORDER:     'FFD1D5DB',   // Light border
} as const

/** Number format strings for Excel */
const FORMATS = {
  INR:        '#,##0.00',
  INR_NEG:    '#,##0.00;[Red]-#,##0.00',
  PCT:        '0.00%',
  PCT_PLAIN:  '0.00"%"',
  DATE:       'DD-MMM-YYYY',
  DATETIME:   'DD-MMM-YYYY HH:MM',
  INT:        '#,##0',
  QTY:        '#,##0.00000000',
} as const

/** Sheet tab color assignments */
const TAB_COLORS = {
  DATA:     COLORS.TEAL,      // Data sheets (trades, holdings, etc.)
  SUMMARY:  COLORS.BLUE,      // Summary sheets (exec summary, tax, dashboard)
  WARNING:  COLORS.AMBER,     // Warning sheets
  INFO:     'FF6366F1',       // Info sheets (cover, formulas, notes)
} as const

// ── Helper Functions ────────────────────────────────────────

/** Convert a Decimal.js-compatible value to a JavaScript number */
function toNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0
  return toD(val).toNumber()
}

/** Convert a Decimal.js-compatible value to a Date object for Excel */
function toDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null
  const dt = typeof val === 'string' ? new Date(val) : val
  if (isNaN(dt.getTime())) return null
  return dt
}

/** Format a date as DD-MMM-YYYY string for display */
function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  const day = String(dt.getDate()).padStart(2, '0')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day}-${months[dt.getMonth()]}-${dt.getFullYear()}`
}

/** Format a date+time as DD-MMM-YYYY HH:MM string for display */
function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  const hrs = String(dt.getHours()).padStart(2, '0')
  const mins = String(dt.getMinutes()).padStart(2, '0')
  return `${fmtDate(dt)} ${hrs}:${mins}`
}

/** Generate a safe filename component */
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
}

// ── ExcelJS Style Helpers ───────────────────────────────────

/** Apply professional teal header style to a row */
function styleHeaderRow(row: TableRow, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.TEAL },
    }
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: COLORS.WHITE },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    }
    cell.border = {
      top:   { style: 'thin', color: { argb: COLORS.TEAL_DARK } },
      bottom:{ style: 'medium', color: { argb: COLORS.TEAL_DARK } },
      left:  { style: 'thin', color: { argb: COLORS.TEAL_DARK } },
      right: { style: 'thin', color: { argb: COLORS.TEAL_DARK } },
    }
  }
  row.height = 28
}

/** Apply data cell styling with alternating row shading */
function styleDataRow(
  row: TableRow,
  colCount: number,
  rowIdx: number,
  financialCols: number[] = [],
  pctCols: number[] = [],
  dateCols: number[] = [],
): void {
  const isEven = rowIdx % 2 === 0
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    // Alternating row background
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' },
      }
    }
    cell.font = { name: 'Calibri', size: 10 }
    cell.alignment = { vertical: 'middle' }
    cell.border = {
      bottom: { style: 'hair', color: { argb: COLORS.BORDER } },
    }
    // Apply number formats
    if (financialCols.includes(c)) {
      cell.numFmt = FORMATS.INR
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
    if (pctCols.includes(c)) {
      cell.numFmt = FORMATS.PCT
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
    }
    if (dateCols.includes(c)) {
      cell.numFmt = FORMATS.DATE
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  }
}

/** Style a totals row with bold font, top border, and gray background */
function styleTotalsRow(row: TableRow, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.GRAY_BG },
    }
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
    }
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.TEAL_DARK } },
      bottom: { style: 'double', color: { argb: COLORS.TEAL_DARK } },
    }
    cell.alignment = { vertical: 'middle' }
  }
}

/** Apply conditional formatting for profit/loss on a specific column range */
function addProfitLossConditionalFormatting(
  ws: Worksheet,
  colLetter: string,
  startRow: number,
  endRow: number,
): void {
  // Green fill for values > 0 (PROFIT)
  ws.addConditionalFormatting({
    ref: `${colLetter}${startRow}:${colLetter}${endRow}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: [0],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFD1FAE5' },
          },
          font: { color: { argb: COLORS.GREEN_FONT }, bold: true },
        },
      },
      {
        type: 'cellIs',
        operator: 'lessThan',
        formulae: [0],
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFEE2E2' },
          },
          font: { color: { argb: COLORS.RED_FONT }, bold: true },
        },
      },
    ],
  })
}

/** Add conditional formatting for Status column (PROFIT/LOSS text) */
function addStatusConditionalFormatting(
  ws: Worksheet,
  colLetter: string,
  startRow: number,
  endRow: number,
): void {
  ws.addConditionalFormatting({
    ref: `${colLetter}${startRow}:${colLetter}${endRow}`,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'PROFIT',
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFD1FAE5' },
          },
          font: { color: { argb: COLORS.GREEN_FONT }, bold: true },
        },
      },
      {
        type: 'containsText',
        operator: 'containsText',
        text: 'LOSS',
        style: {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            bgColor: { argb: 'FFFEE2E2' },
          },
          font: { color: { argb: COLORS.RED_FONT }, bold: true },
        },
      },
    ],
  })
}

/** Auto-adjust column widths based on header text and data content */
function autoFitColumns(ws: Worksheet, minWidth: number = 10, maxWidth: number = 40): void {
  ws.columns.forEach((col: Partial<Column>) => {
    const headerLen = col.header ? String(col.header).length + 4 : minWidth
    const width = Math.min(Math.max(headerLen * 1.2, minWidth), maxWidth)
    col.width = width
  })
}

/** Create a KPI block (label + value) on a cover or summary sheet */
function writeKpiBlock(
  ws: Worksheet,
  startRow: number,
  startCol: number,
  label: string,
  value: string | number,
  fmt?: string,
): void {
  const labelCell = ws.getCell(startRow, startCol)
  labelCell.value = label
  labelCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.GRAY_FONT } }
  labelCell.alignment = { horizontal: 'right' }

  const valueCell = ws.getCell(startRow, startCol + 1)
  valueCell.value = typeof value === 'string' ? toNum(value) : value
  valueCell.font = { name: 'Calibri', size: 12, bold: true }
  if (fmt) {
    valueCell.numFmt = fmt
  }
}

/** Write a section title on cover/summary sheets */
function writeSectionTitle(
  ws: Worksheet,
  row: number,
  col: number,
  title: string,
  mergeEndCol?: number,
): void {
  const cell = ws.getCell(row, col)
  cell.value = title
  cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLORS.TEAL.replace('FF','') } }
  cell.border = { bottom: { style: 'medium', color: { argb: COLORS.TEAL } } }
  if (mergeEndCol) {
    ws.mergeCells(row, col, row, mergeEndCol)
  }
}

/** Add a data table to a worksheet with header, data, totals, and all styling */
function addDataTable(
  ws: Worksheet,
  headers: string[],
  dataRows: (string | number | Date | null | undefined)[][],
  options: {
    financialCols?: number[]     // 1-based column indices for INR formatting
    pctCols?: number[]           // 1-based column indices for percentage formatting
    dateCols?: number[]          // 1-based column indices for date formatting
    startRow?: number            // Starting row number (default 1)
    addTotals?: boolean          // Whether to add a totals row
    totalCols?: number[]         // 1-based columns to sum in totals row
    freezeHeader?: boolean       // Whether to freeze the header row
    addFilter?: boolean          // Whether to add auto-filter
    tabColor?: string            // Sheet tab color
  } = {},
): { headerRowNum: number; lastDataRow: number } {
  const {
    financialCols = [],
    pctCols = [],
    dateCols = [],
    startRow = 1,
    addTotals = false,
    totalCols = [],
    freezeHeader = true,
    addFilter = true,
    tabColor,
  } = options

  // Set tab color
  if (tabColor) {
    ws.properties.tabColor = { argb: tabColor }
  }

  const headerRowNum = startRow
  const colCount = headers.length

  // ── Write header row ──
  const headerRow = ws.getRow(headerRowNum)
  for (let c = 1; c <= colCount; c++) {
    headerRow.getCell(c).value = headers[c - 1]
  }
  styleHeaderRow(headerRow, colCount)

  // ── Write data rows ──
  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = headerRowNum + 1 + i
    const row = ws.getRow(rowNum)
    const dataRow = dataRows[i]

    for (let c = 1; c <= colCount; c++) {
      const val = dataRow[c - 1]
      if (val !== null && val !== undefined) {
        row.getCell(c).value = val
      }
    }

    styleDataRow(row, colCount, i, financialCols, pctCols, dateCols)
  }

  const lastDataRow = headerRowNum + dataRows.length

  // ── Totals row ──
  if (addTotals && dataRows.length > 0) {
    const totalsRowNum = lastDataRow + 1
    const totalsRow = ws.getRow(totalsRowNum)

    // Label the first column as "TOTAL"
    totalsRow.getCell(1).value = 'TOTAL'

    // Sum the specified columns
    for (const col of totalCols) {
      const colLetter = String.fromCharCode(64 + col) // A=1, B=2, etc.
      totalsRow.getCell(col).value = {
        formula: `SUM(${colLetter}${headerRowNum + 1}:${colLetter}${lastDataRow})`,
      }
      totalsRow.getCell(col).numFmt = FORMATS.INR
    }

    styleTotalsRow(totalsRow, colCount)
  }

  // ── Freeze panes ──
  if (freezeHeader) {
    ws.views = [{ state: 'frozen', ySplit: headerRowNum, xSplit: 0, topLeftCell: `A${headerRowNum + 1}` }]
  }

  // ── Auto-filter ──
  if (addFilter) {
    const endColLetter = colCount <= 26
      ? String.fromCharCode(64 + colCount)
      : String.fromCharCode(64 + Math.floor((colCount - 1) / 26)) + String.fromCharCode(65 + ((colCount - 1) % 26))
    ws.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to: { row: lastDataRow, column: colCount },
    }
  }

  // ── Auto-fit columns ──
  autoFitColumns(ws)

  return { headerRowNum, lastDataRow }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHEET BUILDERS — Each function creates one worksheet
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Sheet 1: Cover & Report Info ────────────────────────────

function buildCoverSheet(
  wb: Workbook,
  report: ReportDataForExport,
  workspace: WorkspaceForExport,
): void {
  const ws = wb.addWorksheet('Cover & Report Info', {
    properties: { tabColor: { argb: TAB_COLORS.INFO } },
  })

  const ts = report.summary.taxSummary
  let r = 1

  // ── Title block ──
  ws.mergeCells(r, 1, r, 6)
  const titleCell = ws.getCell(r, 1)
  titleCell.value = 'CRYPTO AUDIT MASTER — REPORT'
  titleCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: 'FF0D9488' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 45
  r++

  // Subtitle
  ws.mergeCells(r, 1, r, 6)
  const subCell = ws.getCell(r, 1)
  subCell.value = 'Comprehensive Crypto Tax Audit Report'
  subCell.font = { name: 'Calibri', size: 13, italic: true, color: { argb: COLORS.GRAY_FONT } }
  subCell.alignment = { horizontal: 'center' }
  r += 2

  // ── Report details ──
  writeSectionTitle(ws, r, 1, 'REPORT DETAILS', 6)
  r++

  const details = [
    ['Workspace Name', workspace.name],
    ['Financial Year', workspace.financialYear],
    ['Report Generated At', fmtDateTime(report.generatedAt)],
    ['Report ID', report.reportId],
  ]
  for (const [label, value] of details) {
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.GRAY_FONT } }
    ws.mergeCells(r, 2, r, 4)
    ws.getCell(r, 2).value = value
    ws.getCell(r, 2).font = { name: 'Calibri', size: 11 }
    r++
  }
  r++

  // ── Summary KPIs ──
  writeSectionTitle(ws, r, 1, 'KEY METRICS', 6)
  r++

  const kpis = [
    ['Total Trades', report.summary.totalTrades, FORMATS.INT],
    ['Realized Trades', report.summary.totalRealizedTrades, FORMATS.INT],
    ['Open Holdings', report.summary.totalOpenHoldings, FORMATS.INT],
    ['Unique Pairs', report.summary.uniquePairs, FORMATS.INT],
    ['Total Warnings', report.summary.totalWarnings, FORMATS.INT],
    ['Total Buy Value', toNum(ts.totalBuyValue), FORMATS.INR],
    ['Total Sell Value', toNum(ts.totalSellValue), FORMATS.INR],
    ['Total Gross Profit', toNum(ts.totalGrossProfit), FORMATS.INR],
    ['Total Fees', toNum(ts.totalFees), FORMATS.INR],
    ['Total GST on Fees', toNum(ts.totalGstOnFees), FORMATS.INR],
    ['Total TDS', toNum(ts.totalTds), FORMATS.INR],
    ['Total Direct Tax', toNum(ts.totalDirectTax), FORMATS.INR],
    ['Total Cess', toNum(ts.totalCess), FORMATS.INR],
    ['Final Net Profit', toNum(ts.totalNetProfit), FORMATS.INR],
    ['Effective Tax Rate', toNum(ts.effectiveTaxRate) / 100, FORMATS.PCT],
  ]
  for (const [label, value, fmt] of kpis) {
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, color: { argb: COLORS.GRAY_FONT } }
    ws.mergeCells(r, 2, r, 3)
    ws.getCell(r, 2).value = value
    ws.getCell(r, 2).font = { name: 'Calibri', size: 11, bold: true }
    if (fmt) ws.getCell(r, 2).numFmt = fmt
    r++
  }
  r++

  // ── Disclaimer ──
  writeSectionTitle(ws, r, 1, 'DISCLAIMER', 6)
  r++
  ws.mergeCells(r, 1, r, 6)
  const discCell = ws.getCell(r, 1)
  discCell.value = 'This report is generated for informational purposes only. It does not constitute professional tax advice. Please consult a qualified Chartered Accountant for filing purposes. Tax calculations are based on the VDAA (Virtual Digital Asset) provisions under Section 115BBH of the Income Tax Act, 1961.'
  discCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.GRAY_FONT } }
  discCell.alignment = { wrapText: true }
  ws.getRow(r).height = 50

  // Column widths
  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 20
  ws.getColumn(3).width = 15
  ws.getColumn(4).width = 15
  ws.getColumn(5).width = 15
  ws.getColumn(6).width = 15
}

// ── Sheet 2: Executive Summary ──────────────────────────────

function buildExecutiveSummarySheet(
  wb: Workbook,
  report: ReportDataForExport,
): void {
  const ws = wb.addWorksheet('Executive Summary', {
    properties: { tabColor: { argb: TAB_COLORS.SUMMARY } },
  })

  const ts = report.summary.taxSummary
  let r = 1

  // Title
  ws.mergeCells(r, 1, r, 4)
  ws.getCell(r, 1).value = 'EXECUTIVE SUMMARY'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0D9488' } }
  ws.getRow(r).height = 30
  r += 2

  // ── Trade Overview Block ──
  writeSectionTitle(ws, r, 1, 'TRADE OVERVIEW', 4)
  r++

  const tradeKpis = [
    ['Total Trades', report.summary.totalTrades, FORMATS.INT],
    ['Profitable Trades', ts.profitableTrades, FORMATS.INT],
    ['Loss Trades', ts.lossTrades, FORMATS.INT],
    ['Win Rate', ts.totalTrades > 0 ? ts.profitableTrades / ts.totalTrades : 0, FORMATS.PCT],
  ]
  for (const [label, value, fmt] of tradeKpis) {
    writeKpiBlock(ws, r, 1, label, value as string | number, fmt)
    r++
  }
  r++

  // ── Financial Overview Block ──
  writeSectionTitle(ws, r, 1, 'FINANCIAL OVERVIEW', 4)
  r++

  const finKpis = [
    ['Total Buy Value (₹)', toNum(ts.totalBuyValue), FORMATS.INR],
    ['Total Sell Value (₹)', toNum(ts.totalSellValue), FORMATS.INR],
    ['Total Gross Profit (₹)', toNum(ts.totalGrossProfit), FORMATS.INR],
    ['Total Gross Loss (₹)', toNum(ts.totalGrossLoss), FORMATS.INR],
    ['Total Fees (₹)', toNum(ts.totalFees), FORMATS.INR],
    ['Total GST on Fees (₹)', toNum(ts.totalGstOnFees), FORMATS.INR],
    ['Total TDS (₹)', toNum(ts.totalTds), FORMATS.INR],
  ]
  for (const [label, value, fmt] of finKpis) {
    writeKpiBlock(ws, r, 1, label, value as string | number, fmt)
    r++
  }
  r++

  // ── Tax Overview Block ──
  writeSectionTitle(ws, r, 1, 'TAX OVERVIEW', 4)
  r++

  const taxKpis = [
    ['Base Crypto Tax @30% (₹)', toD(ts.totalDirectTax).minus(toD(ts.totalCess)).toNumber(), FORMATS.INR],
    ['Cess @4% (₹)', toNum(ts.totalCess), FORMATS.INR],
    ['Total Direct Tax (₹)', toNum(ts.totalDirectTax), FORMATS.INR],
    ['Effective Tax Rate', toNum(ts.effectiveTaxRate) / 100, FORMATS.PCT],
  ]
  for (const [label, value, fmt] of taxKpis) {
    writeKpiBlock(ws, r, 1, label, value as string | number, fmt)
    r++
  }
  r++

  // ── Net Profit Block ──
  writeSectionTitle(ws, r, 1, 'NET PROFIT ANALYSIS', 4)
  r++

  const profitKpis = [
    ['Total Net Profit (₹)', toNum(ts.totalNetProfit), FORMATS.INR],
    ['Profit from Profitable Trades (₹)', toNum(ts.totalNetProfitFromProfitableTrades), FORMATS.INR],
    ['Loss from Loss Trades (₹)', toNum(ts.totalNetLossFromLossTrades), FORMATS.INR],
    ['Avg Profit Per Trade (₹)', toNum(ts.avgProfitPerTrade), FORMATS.INR],
    ['Avg Loss Per Trade (₹)', toNum(ts.avgLossPerTrade), FORMATS.INR],
  ]
  for (const [label, value, fmt] of profitKpis) {
    writeKpiBlock(ws, r, 1, label, value as string | number, fmt)
    r++
  }
  r++

  // ── Holdings Block ──
  writeSectionTitle(ws, r, 1, 'OPEN HOLDINGS', 4)
  r++

  const holdKpis = [
    ['Total Open Holdings', report.summary.totalOpenHoldings, FORMATS.INT],
    ['Fully Unmatched Holdings', report.summary.fullyUnmatchedHoldings, FORMATS.INT],
    ['Partially Matched Holdings', report.summary.partiallyMatchedHoldings, FORMATS.INT],
    ['Total Holding Value (₹)', toNum(report.summary.totalHoldingValue), FORMATS.INR],
  ]
  for (const [label, value, fmt] of holdKpis) {
    writeKpiBlock(ws, r, 1, label, value as string | number, fmt)
    r++
  }

  // Column widths
  ws.getColumn(1).width = 38
  ws.getColumn(2).width = 22
  ws.getColumn(3).width = 15
  ws.getColumn(4).width = 15
}

// ── Sheet 3: Dashboard Overview ──────────────────────────────

function buildDashboardOverviewSheet(
  wb: Workbook,
  report: ReportDataForExport,
): void {
  const ws = wb.addWorksheet('Dashboard Overview', {
    properties: { tabColor: { argb: TAB_COLORS.SUMMARY } },
  })

  const ts = report.summary.taxSummary
  let r = 1

  // Title
  ws.mergeCells(r, 1, r, 6)
  ws.getCell(r, 1).value = 'DASHBOARD — CHART-READY DATA'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0D9488' } }
  ws.getRow(r).height = 30
  r += 2

  // ── Section A: Profit Over Time (monthly data for line chart) ──
  writeSectionTitle(ws, r, 1, 'PROFIT OVER TIME (Monthly)', 6)
  r++

  const monthPerf = new Map<string, {
    grossProfit: number; netProfit: number; directTax: number;
    fees: number; trades: number;
  }>()
  for (const t of report.realizedTrades) {
    const sellDate = new Date(t.sellDate)
    const monthKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`
    const existing = monthPerf.get(monthKey) || { grossProfit: 0, netProfit: 0, directTax: 0, fees: 0, trades: 0 }
    existing.grossProfit += toNum(t.grossProfit)
    existing.netProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    existing.directTax += toNum(t.resolvedTotalDirectTax || t.totalDirectTax)
    existing.fees += toNum(t.resolvedTotalFees || t.totalFees)
    existing.trades += 1
    monthPerf.set(monthKey, existing)
  }

  const monthHeaders = ['Period', 'Trade Count', 'Gross Profit (₹)', 'Fees (₹)', 'Total Tax (₹)', 'Final Net Profit (₹)']
  const monthData = Array.from(monthPerf.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => [month, d.trades, d.grossProfit, d.fees, d.directTax, d.netProfit])

  const monthStartRow = r
  const headerRow = ws.getRow(r)
  monthHeaders.forEach((h, i) => { headerRow.getCell(i + 1).value = h })
  styleHeaderRow(headerRow, 6)
  r++

  for (let i = 0; i < monthData.length; i++) {
    const row = ws.getRow(r)
    monthData[i].forEach((v, c) => { row.getCell(c + 1).value = v })
    styleDataRow(row, 6, i, [3, 4, 5, 6], [], [])
    r++
  }

  // Auto-filter
  ws.autoFilter = {
    from: { row: monthStartRow, column: 1 },
    to: { row: r - 1, column: 6 },
  }
  r += 2

  // ── Section B: Pair-wise Profit (for bar chart) ──
  writeSectionTitle(ws, r, 1, 'PAIR-WISE PROFIT (Bar Chart Data)', 6)
  r++

  const pairPerf = new Map<string, {
    grossProfit: number; netProfit: number; directTax: number;
    fees: number; trades: number; profitTrades: number; lossTrades: number;
    buyValue: number; sellValue: number; tds: number; cess: number;
  }>()
  for (const t of report.realizedTrades) {
    const pair = t.pair
    const existing = pairPerf.get(pair) || {
      grossProfit: 0, netProfit: 0, directTax: 0, fees: 0,
      trades: 0, profitTrades: 0, lossTrades: 0,
      buyValue: 0, sellValue: 0, tds: 0, cess: 0,
    }
    existing.grossProfit += toNum(t.grossProfit)
    existing.netProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    existing.directTax += toNum(t.resolvedTotalDirectTax || t.totalDirectTax)
    existing.fees += toNum(t.resolvedTotalFees || t.totalFees)
    existing.buyValue += toNum(t.buyValue)
    existing.sellValue += toNum(t.sellValue)
    existing.tds += toNum(t.resolvedTotalTds || t.tds)
    existing.cess += toNum(t.resolvedCess || t.cess)
    existing.trades += 1
    if ((t.resolvedProfitLossStatus || t.status) === 'PROFIT') existing.profitTrades += 1
    else existing.lossTrades += 1
    pairPerf.set(pair, existing)
  }

  const pairHeaders = ['Pair', 'Trade Count', 'Buy Value (₹)', 'Sell Value (₹)', 'Gross Profit (₹)', 'Final Net Profit (₹)']
  const pairData = Array.from(pairPerf.entries())
    .sort(([, a], [, b]) => b.netProfit - a.netProfit)
    .map(([pair, d]) => [pair, d.trades, d.buyValue, d.sellValue, d.grossProfit, d.netProfit])

  const pairStartRow = r
  const pairHeaderRow = ws.getRow(r)
  pairHeaders.forEach((h, i) => { pairHeaderRow.getCell(i + 1).value = h })
  styleHeaderRow(pairHeaderRow, 6)
  r++

  for (let i = 0; i < pairData.length; i++) {
    const row = ws.getRow(r)
    pairData[i].forEach((v, c) => { row.getCell(c + 1).value = v })
    styleDataRow(row, 6, i, [3, 4, 5, 6], [], [])
    r++
  }

  ws.autoFilter = {
    from: { row: pairStartRow, column: 1 },
    to: { row: r - 1, column: 6 },
  }
  r += 2

  // ── Section C: Deductions Breakdown (for pie chart) ──
  writeSectionTitle(ws, r, 1, 'DEDUCTIONS BREAKDOWN (Pie Chart Data)', 4)
  r++

  const deductionHeaders = ['Deduction Type', 'Amount (₹)']
  const deductionData = [
    ['Total Fees (ex GST)', toNum(ts.totalFees)],
    ['GST on Fees', toNum(ts.totalGstOnFees)],
    ['TDS', toNum(ts.totalTds)],
    ['Base Crypto Tax', toD(ts.totalDirectTax).minus(toD(ts.totalCess)).toNumber()],
    ['Cess', toNum(ts.totalCess)],
  ]

  const dedHeaderRow = ws.getRow(r)
  deductionHeaders.forEach((h, i) => { dedHeaderRow.getCell(i + 1).value = h })
  styleHeaderRow(dedHeaderRow, 2)
  r++

  for (let i = 0; i < deductionData.length; i++) {
    const row = ws.getRow(r)
    row.getCell(1).value = deductionData[i][0]
    row.getCell(2).value = deductionData[i][1]
    row.getCell(2).numFmt = FORMATS.INR
    r++
  }
  r += 1

  // ── Section D: Holdings Allocation (for pie chart) ──
  writeSectionTitle(ws, r, 1, 'HOLDINGS ALLOCATION (Pie Chart Data)', 4)
  r++

  const holdAllocMap = new Map<string, number>()
  for (const h of report.openHoldings) {
    const current = holdAllocMap.get(h.pair) || 0
    holdAllocMap.set(h.pair, current + toNum(h.remainingCostBasis))
  }

  const holdHeaders = ['Pair', 'Remaining Cost Basis (₹)']
  const holdData = Array.from(holdAllocMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([pair, val]) => [pair, val])

  const holdHeaderRow = ws.getRow(r)
  holdHeaders.forEach((h, i) => { holdHeaderRow.getCell(i + 1).value = h })
  styleHeaderRow(holdHeaderRow, 2)
  r++

  for (let i = 0; i < holdData.length; i++) {
    const row = ws.getRow(r)
    row.getCell(1).value = holdData[i][0]
    row.getCell(2).value = holdData[i][1]
    row.getCell(2).numFmt = FORMATS.INR
    r++
  }
  r += 1

  // ── Section E: Win vs Loss (for pie chart) ──
  writeSectionTitle(ws, r, 1, 'WIN VS LOSS DISTRIBUTION (Pie Chart Data)', 4)
  r++

  const wlHeaders = ['Category', 'Count']
  const wlData = [
    ['Profitable Trades', ts.profitableTrades],
    ['Loss Trades', ts.lossTrades],
  ]

  const wlHeaderRow = ws.getRow(r)
  wlHeaders.forEach((h, i) => { wlHeaderRow.getCell(i + 1).value = h })
  styleHeaderRow(wlHeaderRow, 2)
  r++

  for (let i = 0; i < wlData.length; i++) {
    const row = ws.getRow(r)
    row.getCell(1).value = wlData[i][0]
    row.getCell(2).value = wlData[i][1]
    r++
  }

  // Column widths
  ws.getColumn(1).width = 30
  ws.getColumn(2).width = 18
  ws.getColumn(3).width = 20
  ws.getColumn(4).width = 20
  ws.getColumn(5).width = 20
  ws.getColumn(6).width = 22
}

// ── Sheet 4: Realized Trades ────────────────────────────────

function buildRealizedTradesSheet(
  wb: Workbook,
  realizedTrades: TaxedRealizedTrade[],
): void {
  const ws = wb.addWorksheet('Realized Trades', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  const headers = [
    '#', 'Pair', 'Exchange', 'Buy Date', 'Sell Date', 'Qty',
    'Buy Price (₹)', 'Sell Price (₹)', 'Buy Value (₹)', 'Sell Value (₹)',
    'Gross Profit (₹)', 'Fees ex GST (₹)', 'GST on Fees (₹)',
    'Fees Inc GST (₹)', 'TDS (₹)', 'Tax (₹)', 'Cess (₹)',
    'Total Tax (₹)', 'Net Profit (₹)', 'Final Net Profit (₹)',
    'Status', 'Source Buy CSV', 'Source Sell CSV',
  ]

  // 1-based column indices for formatting
  const financialCols = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  const dateCols = [4, 5]

  const dataRows = realizedTrades.map((t, i) => [
    i + 1,                                          // #
    t.pair,                                          // Pair
    '',                                              // Exchange (not available in TaxedRealizedTrade)
    toDate(t.buyDate),                               // Buy Date
    toDate(t.sellDate),                              // Sell Date
    toD(t.matchedQty).toNumber(),                    // Qty
    toNum(t.buyPrice),                               // Buy Price
    toNum(t.sellPrice),                              // Sell Price
    toNum(t.buyValue),                               // Buy Value
    toNum(t.sellValue),                              // Sell Value
    toNum(t.grossProfit),                            // Gross Profit
    toNum(t.resolvedTotalFees || t.totalFees),       // Fees ex GST
    toNum(t.resolvedGstOnFees || t.gstOnFees),       // GST on Fees
    toNum(t.resolvedTotalFees || t.totalFees) + toNum(t.resolvedGstOnFees || t.gstOnFees), // Fees Inc GST
    toNum(t.resolvedTotalTds || t.tds),              // TDS
    toNum(t.resolvedBaseCryptoTax || t.baseCryptoTax), // Tax
    toNum(t.resolvedCess || t.cess),                 // Cess
    toNum(t.resolvedTotalDirectTax || t.totalDirectTax), // Total Tax
    toNum(t.resolvedNetProfitInHand || t.netProfitInHand), // Net Profit
    toNum(t.resolvedFinalNetProfit || t.finalNetProfit),   // Final Net Profit
    (t.resolvedProfitLossStatus || t.status),        // Status
    t.buyCsvFileId || '',                            // Source Buy CSV
    t.sellCsvFileId || '',                           // Source Sell CSV
  ])

  const { headerRowNum, lastDataRow } = addDataTable(ws, headers, dataRows, {
    financialCols,
    dateCols,
    addTotals: true,
    totalCols: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    freezeHeader: true,
    addFilter: true,
  })

  // Conditional formatting for Net Profit & Final Net Profit columns (K and T)
  addProfitLossConditionalFormatting(ws, 'K', headerRowNum + 1, lastDataRow)
  addProfitLossConditionalFormatting(ws, 'S', headerRowNum + 1, lastDataRow)
  addProfitLossConditionalFormatting(ws, 'T', headerRowNum + 1, lastDataRow)

  // Conditional formatting for Status column (U)
  addStatusConditionalFormatting(ws, 'U', headerRowNum + 1, lastDataRow)
}

// ── Sheet 5: Open Holdings ──────────────────────────────────

function buildOpenHoldingsSheet(
  wb: Workbook,
  openHoldings: OpenHolding[],
): void {
  const ws = wb.addWorksheet('Open Holdings', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  const headers = [
    '#', 'Pair', 'Exchange', 'Buy Date', 'Original Qty', 'Remaining Qty',
    'Buy Price (₹)', 'Original Value (₹)', 'Remaining Cost Basis (₹)',
    'Remaining Fee (₹)', 'Holding Status', 'Source CSV', 'Trade Ref',
  ]

  const financialCols = [7, 8, 9, 10]
  const dateCols = [4]

  const dataRows = openHoldings.map((h, i) => [
    i + 1,                                          // #
    h.pair,                                          // Pair
    '',                                              // Exchange (not available)
    toDate(h.buyDate),                               // Buy Date
    toD(h.originalQty).toNumber(),                   // Original Qty
    toD(h.remainingQty).toNumber(),                  // Remaining Qty
    toNum(h.buyPrice),                               // Buy Price
    toD(h.originalQty).times(toD(h.buyPrice)).toNumber(), // Original Value
    toNum(h.remainingCostBasis),                     // Remaining Cost Basis
    toNum(h.remainingAllocatedBuyFee),               // Remaining Fee
    h.status === 'Fully Unmatched Buy Lot' ? 'Fully Unmatched' : 'Partially Matched', // Holding Status
    h.sourceCsvId || '',                             // Source CSV
    h.buyTradeId || '',                              // Trade Ref
  ])

  addDataTable(ws, headers, dataRows, {
    financialCols,
    dateCols,
    addTotals: true,
    totalCols: [5, 6, 8, 9, 10],
    freezeHeader: true,
    addFilter: true,
  })
}

// ── Sheet 6: Tax Summary ────────────────────────────────────

function buildTaxSummarySheet(
  wb: Workbook,
  taxSummary: TaxSummary,
): void {
  const ws = wb.addWorksheet('Tax Summary', {
    properties: { tabColor: { argb: TAB_COLORS.SUMMARY } },
  })

  let r = 1

  // Title
  ws.mergeCells(r, 1, r, 3)
  ws.getCell(r, 1).value = 'TAX SUMMARY — CALCULATION BREAKDOWN'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0D9488' } }
  ws.getRow(r).height = 28
  r += 2

  // ── Section A: Tax Overview ──
  writeSectionTitle(ws, r, 1, 'TAX OVERVIEW', 3)
  r++

  const overviewItems = [
    ['Total Trades', taxSummary.totalTrades, FORMATS.INT],
    ['Profitable Trades', taxSummary.profitableTrades, FORMATS.INT],
    ['Loss Trades', taxSummary.lossTrades, FORMATS.INT],
    ['Win Rate', taxSummary.totalTrades > 0 ? taxSummary.profitableTrades / taxSummary.totalTrades : 0, FORMATS.PCT],
  ]
  for (const [label, value, fmt] of overviewItems) {
    writeKpiBlock(ws, r, 1, label, value as string | number, fmt)
    r++
  }
  r++

  // ── Section B: Calculation Breakdown ──
  writeSectionTitle(ws, r, 1, 'CALCULATION BREAKDOWN', 3)
  r++

  const breakdownHeaders = ['Step', 'Item', 'Amount (₹)']
  const headerRow = ws.getRow(r)
  breakdownHeaders.forEach((h, i) => { headerRow.getCell(i + 1).value = h })
  styleHeaderRow(headerRow, 3)
  r++

  const baseCryptoTax = toD(taxSummary.totalDirectTax).minus(toD(taxSummary.totalCess))

  const breakdownData = [
    ['A', 'Total Buy Value', toNum(taxSummary.totalBuyValue)],
    ['B', 'Total Sell Value', toNum(taxSummary.totalSellValue)],
    ['C = B − A', 'Total Gross Profit', toNum(taxSummary.totalGrossProfit)],
    ['', 'Total Gross Loss', toNum(taxSummary.totalGrossLoss)],
    ['D', 'Total Fees (Buy + Sell)', toNum(taxSummary.totalFees)],
    ['E = D × 18%', 'GST on Fees', toNum(taxSummary.totalGstOnFees)],
    ['F', 'Total TDS', toNum(taxSummary.totalTds)],
    ['G', 'Base Crypto Tax @30% (on Gross Profit if > 0)', baseCryptoTax.toNumber()],
    ['H = G × 4%', 'Cess', toNum(taxSummary.totalCess)],
    ['I = G + H', 'Total Direct Tax', toNum(taxSummary.totalDirectTax)],
    ['J = C − D − E − F', 'Net Profit Before Tax', toD(taxSummary.totalNetProfit).plus(toD(taxSummary.totalDirectTax)).minus(toD(taxSummary.totalTds)).toNumber()],
    ['K = J − I + F', 'Final Net Profit', toNum(taxSummary.totalNetProfit)],
  ]

  for (let i = 0; i < breakdownData.length; i++) {
    const row = ws.getRow(r)
    row.getCell(1).value = breakdownData[i][0]
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: !!breakdownData[i][0] }
    row.getCell(2).value = breakdownData[i][1]
    row.getCell(3).value = breakdownData[i][2]
    row.getCell(3).numFmt = FORMATS.INR
    r++
  }
  r += 1

  // ── Section C: Pair-wise Tax Contribution ──
  writeSectionTitle(ws, r, 1, 'PAIR-WISE TAX CONTRIBUTION', 3)
  r++

  // Collect pair-wise tax data from trades
  const pairTaxMap = new Map<string, { directTax: number; tds: number; trades: number }>()
  // Note: We'd need realizedTrades here, but this sheet only gets taxSummary.
  // We'll provide the aggregate data instead.
  const contribHeaders = ['Metric', 'Value (₹)']
  const contribRow = ws.getRow(r)
  contribHeaders.forEach((h, i) => { contribRow.getCell(i + 1).value = h })
  styleHeaderRow(contribRow, 2)
  r++

  const contribData = [
    ['Effective Tax Rate', toNum(taxSummary.effectiveTaxRate) / 100],
    ['Avg Profit Per Trade', toNum(taxSummary.avgProfitPerTrade)],
    ['Avg Loss Per Trade', toNum(taxSummary.avgLossPerTrade)],
    ['Profit from Profitable Trades', toNum(taxSummary.totalNetProfitFromProfitableTrades)],
    ['Loss from Loss Trades', toNum(taxSummary.totalNetLossFromLossTrades)],
  ]
  for (const [label, value] of contribData) {
    const row = ws.getRow(r)
    row.getCell(1).value = label
    row.getCell(2).value = value
    row.getCell(2).numFmt = FORMATS.INR
    r++
  }
  r += 1

  // ── Section D: Formula Notes ──
  writeSectionTitle(ws, r, 1, 'FORMULA NOTES', 3)
  r++
  const formulaNotes = [
    '• Crypto tax is computed at 30% on Gross Profit (only when Gross Profit > 0)',
    '• Losses CANNOT be offset against profits under Section 115BBH',
    '• Cess is 4% on the Base Crypto Tax amount',
    '• TDS is credited back in the final net profit calculation',
    '• Fees and GST are deducted before computing net profit',
  ]
  for (const note of formulaNotes) {
    ws.getCell(r, 1).value = note
    ws.getCell(r, 1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.GRAY_FONT } }
    ws.mergeCells(r, 1, r, 3)
    r++
  }

  // Column widths
  ws.getColumn(1).width = 18
  ws.getColumn(2).width = 45
  ws.getColumn(3).width = 22
}

// ── Sheet 7: Fees, GST & TDS Summary ────────────────────────

function buildFeesGstTdsSheet(
  wb: Workbook,
  realizedTrades: TaxedRealizedTrade[],
): void {
  const ws = wb.addWorksheet('Fees, GST & TDS', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  let r = 1

  // Title
  ws.mergeCells(r, 1, r, 6)
  ws.getCell(r, 1).value = 'FEES, GST & TDS SUMMARY'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0D9488' } }
  ws.getRow(r).height = 28
  r += 2

  // ── Section A: Overall Totals ──
  writeSectionTitle(ws, r, 1, 'OVERALL TOTALS', 6)
  r++

  let totalBuyFee = 0
  let totalSellFee = 0
  let totalGst = 0
  let totalTds = 0
  let totalFeesIncGst = 0

  for (const t of realizedTrades) {
    totalBuyFee += toNum(t.resolvedBuyFee || t.allocatedBuyFee)
    totalSellFee += toNum(t.resolvedSellFee || t.allocatedSellFee)
    totalGst += toNum(t.resolvedGstOnFees || t.gstOnFees)
    totalTds += toNum(t.resolvedTotalTds || t.tds)
    totalFeesIncGst += toNum(t.resolvedTotalFees || t.totalFees) + toNum(t.resolvedGstOnFees || t.gstOnFees)
  }

  const totalsData = [
    ['Total Buy Fees (₹)', totalBuyFee],
    ['Total Sell Fees (₹)', totalSellFee],
    ['Total Fees ex GST (₹)', totalBuyFee + totalSellFee],
    ['Total GST on Fees (₹)', totalGst],
    ['Total Fees Inc GST (₹)', totalFeesIncGst],
    ['Total TDS (₹)', totalTds],
  ]

  for (const [label, value] of totalsData) {
    writeKpiBlock(ws, r, 1, label, value, FORMATS.INR)
    r++
  }
  r += 1

  // ── Section B: Fee Source Split by Pair ──
  writeSectionTitle(ws, r, 1, 'FEE SOURCE SPLIT BY PAIR', 6)
  r++

  const feesByPair = new Map<string, {
    buyFee: number; sellFee: number; gst: number; tds: number; count: number;
    feesIncGst: number;
  }>()
  for (const t of realizedTrades) {
    const pair = t.pair
    const existing = feesByPair.get(pair) || { buyFee: 0, sellFee: 0, gst: 0, tds: 0, count: 0, feesIncGst: 0 }
    existing.buyFee += toNum(t.resolvedBuyFee || t.allocatedBuyFee)
    existing.sellFee += toNum(t.resolvedSellFee || t.allocatedSellFee)
    existing.gst += toNum(t.resolvedGstOnFees || t.gstOnFees)
    existing.tds += toNum(t.resolvedTotalTds || t.tds)
    existing.feesIncGst += toNum(t.resolvedTotalFees || t.totalFees) + toNum(t.resolvedGstOnFees || t.gstOnFees)
    existing.count += 1
    feesByPair.set(pair, existing)
  }

  const feeHeaders = ['Pair', 'Trade Count', 'Buy Fee (₹)', 'Sell Fee (₹)', 'Fees Inc GST (₹)', 'GST (₹)', 'TDS (₹)']
  const feeData = Array.from(feesByPair.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pair, d]) => [pair, d.count, d.buyFee, d.sellFee, d.feesIncGst, d.gst, d.tds])

  addDataTable(ws, feeHeaders, feeData, {
    financialCols: [3, 4, 5, 6, 7],
    startRow: r,
    addTotals: true,
    totalCols: [3, 4, 5, 6, 7],
    freezeHeader: false,
    addFilter: true,
  })
}

// ── Sheet 8: Pair-wise Performance ──────────────────────────

function buildPairWisePerformanceSheet(
  wb: Workbook,
  realizedTrades: TaxedRealizedTrade[],
): void {
  const ws = wb.addWorksheet('Pair-wise Performance', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  const headers = [
    'Pair', 'Trade Count', 'Buy Value (₹)', 'Sell Value (₹)',
    'Gross Profit (₹)', 'Fees Inc GST (₹)', 'TDS (₹)',
    'Total Tax (₹)', 'Net Profit (₹)', 'Final Net Profit (₹)',
    'Win Count', 'Loss Count', 'Win Rate%',
  ]

  const financialCols = [3, 4, 5, 6, 7, 8, 9, 10]
  const pctCols = [13]

  // Aggregate pair-wise data
  const pairMap = new Map<string, {
    buyValue: number; sellValue: number; grossProfit: number;
    feesIncGst: number; tds: number; directTax: number;
    netProfit: number; finalNetProfit: number;
    trades: number; profitTrades: number; lossTrades: number;
  }>()

  for (const t of realizedTrades) {
    const pair = t.pair
    const existing = pairMap.get(pair) || {
      buyValue: 0, sellValue: 0, grossProfit: 0,
      feesIncGst: 0, tds: 0, directTax: 0,
      netProfit: 0, finalNetProfit: 0,
      trades: 0, profitTrades: 0, lossTrades: 0,
    }
    existing.buyValue += toNum(t.buyValue)
    existing.sellValue += toNum(t.sellValue)
    existing.grossProfit += toNum(t.grossProfit)
    existing.feesIncGst += toNum(t.resolvedTotalFees || t.totalFees) + toNum(t.resolvedGstOnFees || t.gstOnFees)
    existing.tds += toNum(t.resolvedTotalTds || t.tds)
    existing.directTax += toNum(t.resolvedTotalDirectTax || t.totalDirectTax)
    existing.netProfit += toNum(t.resolvedNetProfitInHand || t.netProfitInHand)
    existing.finalNetProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    existing.trades += 1
    if ((t.resolvedProfitLossStatus || t.status) === 'PROFIT') existing.profitTrades += 1
    else existing.lossTrades += 1
    pairMap.set(pair, existing)
  }

  const dataRows = Array.from(pairMap.entries())
    .sort(([, a], [, b]) => b.finalNetProfit - a.finalNetProfit)
    .map(([pair, d]) => [
      pair, d.trades, d.buyValue, d.sellValue, d.grossProfit,
      d.feesIncGst, d.tds, d.directTax, d.netProfit, d.finalNetProfit,
      d.profitTrades, d.lossTrades,
      d.trades > 0 ? d.profitTrades / d.trades : 0,
    ])

  const { headerRowNum, lastDataRow } = addDataTable(ws, headers, dataRows, {
    financialCols,
    pctCols,
    addTotals: true,
    totalCols: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    freezeHeader: true,
    addFilter: true,
  })

  // Conditional formatting on Final Net Profit column (J)
  addProfitLossConditionalFormatting(ws, 'J', headerRowNum + 1, lastDataRow)
}

// ── Sheet 9: Time-wise Profit Analysis ──────────────────────

function buildTimeWiseProfitSheet(
  wb: Workbook,
  realizedTrades: TaxedRealizedTrade[],
): void {
  const ws = wb.addWorksheet('Time-wise Profit', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  const headers = [
    'Period', 'Trade Count', 'Gross Profit (₹)', 'Fees (₹)',
    'GST (₹)', 'TDS (₹)', 'Total Tax (₹)', 'Final Net Profit (₹)',
  ]

  const financialCols = [3, 4, 5, 6, 7, 8]

  // Aggregate monthly data
  const monthMap = new Map<string, {
    grossProfit: number; fees: number; gst: number; tds: number;
    directTax: number; finalNetProfit: number; trades: number;
  }>()

  for (const t of realizedTrades) {
    const sellDate = new Date(t.sellDate)
    const monthKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`
    const existing = monthMap.get(monthKey) || {
      grossProfit: 0, fees: 0, gst: 0, tds: 0,
      directTax: 0, finalNetProfit: 0, trades: 0,
    }
    existing.grossProfit += toNum(t.grossProfit)
    existing.fees += toNum(t.resolvedTotalFees || t.totalFees)
    existing.gst += toNum(t.resolvedGstOnFees || t.gstOnFees)
    existing.tds += toNum(t.resolvedTotalTds || t.tds)
    existing.directTax += toNum(t.resolvedTotalDirectTax || t.totalDirectTax)
    existing.finalNetProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    existing.trades += 1
    monthMap.set(monthKey, existing)
  }

  const dataRows = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => [
      month, d.trades, d.grossProfit, d.fees, d.gst, d.tds, d.directTax, d.finalNetProfit,
    ])

  const { headerRowNum, lastDataRow } = addDataTable(ws, headers, dataRows, {
    financialCols,
    addTotals: true,
    totalCols: [2, 3, 4, 5, 6, 7, 8],
    freezeHeader: true,
    addFilter: true,
  })

  // Conditional formatting on Final Net Profit column (H)
  addProfitLossConditionalFormatting(ws, 'H', headerRowNum + 1, lastDataRow)
}

// ── Sheet 10: Charts & Graphs ───────────────────────────────

function buildChartsSheet(
  wb: Workbook,
  report: ReportDataForExport,
): void {
  const ws = wb.addWorksheet('Charts & Graphs', {
    properties: { tabColor: { argb: TAB_COLORS.SUMMARY } },
  })

  const ts = report.summary.taxSummary
  let r = 1

  // Title
  ws.mergeCells(r, 1, r, 8)
  ws.getCell(r, 1).value = 'CHARTS & GRAPHS — DATA TABLES'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0D9488' } }
  ws.getRow(r).height = 30
  r++

  ws.mergeCells(r, 1, r, 8)
  ws.getCell(r, 1).value = 'Select each data table below and insert an Excel chart (Insert → Chart) for instant visualization.'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.GRAY_FONT } }
  r += 2

  // ── Chart 1: Profit Over Time (Line Chart Data) ──
  writeSectionTitle(ws, r, 1, '1. PROFIT OVER TIME — Line Chart', 8)
  r++

  const monthPerf = new Map<string, { grossProfit: number; netProfit: number; trades: number }>()
  for (const t of report.realizedTrades) {
    const sellDate = new Date(t.sellDate)
    const monthKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`
    const existing = monthPerf.get(monthKey) || { grossProfit: 0, netProfit: 0, trades: 0 }
    existing.grossProfit += toNum(t.grossProfit)
    existing.netProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    existing.trades += 1
    monthPerf.set(monthKey, existing)
  }

  const ch1Headers = ['Period', 'Gross Profit (₹)', 'Final Net Profit (₹)']
  const ch1Data = Array.from(monthPerf.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => [month, d.grossProfit, d.netProfit])

  addDataTable(ws, ch1Headers, ch1Data, {
    financialCols: [2, 3],
    startRow: r,
    freezeHeader: false,
    addFilter: false,
  })
  r += ch1Data.length + 3

  // ── Chart 2: Monthly Final Net Profit (Bar Chart Data) ──
  writeSectionTitle(ws, r, 1, '2. MONTHLY FINAL NET PROFIT — Bar Chart', 8)
  r++

  const ch2Headers = ['Period', 'Final Net Profit (₹)']
  const ch2Data = Array.from(monthPerf.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => [month, d.netProfit])

  addDataTable(ws, ch2Headers, ch2Data, {
    financialCols: [2],
    startRow: r,
    freezeHeader: false,
    addFilter: false,
  })
  r += ch2Data.length + 3

  // ── Chart 3: Pair-wise Final Net Profit (Horizontal Bar) ──
  writeSectionTitle(ws, r, 1, '3. PAIR-WISE FINAL NET PROFIT — Horizontal Bar', 8)
  r++

  const pairPerf = new Map<string, { netProfit: number }>()
  for (const t of report.realizedTrades) {
    const existing = pairPerf.get(t.pair) || { netProfit: 0 }
    existing.netProfit += toNum(t.resolvedFinalNetProfit || t.finalNetProfit)
    pairPerf.set(t.pair, existing)
  }

  const ch3Headers = ['Pair', 'Final Net Profit (₹)']
  const ch3Data = Array.from(pairPerf.entries())
    .sort(([, a], [, b]) => b.netProfit - a.netProfit)
    .map(([pair, d]) => [pair, d.netProfit])

  addDataTable(ws, ch3Headers, ch3Data, {
    financialCols: [2],
    startRow: r,
    freezeHeader: false,
    addFilter: false,
  })
  r += ch3Data.length + 3

  // ── Chart 4: Deductions Breakdown (Pie Chart Data) ──
  writeSectionTitle(ws, r, 1, '4. DEDUCTIONS BREAKDOWN — Pie Chart', 8)
  r++

  const ch4Headers = ['Deduction Type', 'Amount (₹)']
  const ch4Data = [
    ['Fees (ex GST)', toNum(ts.totalFees)],
    ['GST on Fees', toNum(ts.totalGstOnFees)],
    ['TDS', toNum(ts.totalTds)],
    ['Base Crypto Tax', toD(ts.totalDirectTax).minus(toD(ts.totalCess)).toNumber()],
    ['Cess', toNum(ts.totalCess)],
  ]

  addDataTable(ws, ch4Headers, ch4Data, {
    financialCols: [2],
    startRow: r,
    freezeHeader: false,
    addFilter: false,
  })
  r += ch4Data.length + 3

  // ── Chart 5: Open Holdings Allocation (Pie Chart Data) ──
  writeSectionTitle(ws, r, 1, '5. OPEN HOLDINGS ALLOCATION — Pie Chart', 8)
  r++

  const holdMap = new Map<string, number>()
  for (const h of report.openHoldings) {
    const current = holdMap.get(h.pair) || 0
    holdMap.set(h.pair, current + toNum(h.remainingCostBasis))
  }

  const ch5Headers = ['Pair', 'Cost Basis (₹)']
  const ch5Data = Array.from(holdMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([pair, val]) => [pair, val])

  addDataTable(ws, ch5Headers, ch5Data, {
    financialCols: [2],
    startRow: r,
    freezeHeader: false,
    addFilter: false,
  })
  r += ch5Data.length + 3

  // ── Chart 6: Win vs Loss (Pie Chart Data) ──
  writeSectionTitle(ws, r, 1, '6. WIN VS LOSS — Pie Chart', 8)
  r++

  const ch6Headers = ['Category', 'Count']
  const ch6Data = [
    ['Profitable Trades', ts.profitableTrades],
    ['Loss Trades', ts.lossTrades],
  ]

  addDataTable(ws, ch6Headers, ch6Data, {
    startRow: r,
    freezeHeader: false,
    addFilter: false,
  })

  // Column widths
  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 22
  ws.getColumn(3).width = 22
}

// ── Sheet 11: CSV Upload Log ────────────────────────────────

function buildCsvUploadLogSheet(
  wb: Workbook,
  csvFiles: CsvFileForExport[],
): void {
  const ws = wb.addWorksheet('CSV Upload Log', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  const headers = [
    '#', 'File Name', 'Exchange', 'Buy Fee%', 'Sell Fee%',
    'Upload Date', 'File Size', 'File Hash', 'Total Rows',
    'Imported Rows', 'Skipped Rows', 'Mapping Mode', 'Processing Status',
  ]

  const dataRows = csvFiles.map((f, i) => [
    i + 1,
    f.originalName,
    f.exchange || '',
    f.buyFeePercent || '',
    f.sellFeePercent || '',
    toDate(f.uploadedAt),
    f.fileSize || '',
    f.fileHash || '',
    f.totalRows,
    f.validRows,
    f.skippedRows,
    f.mappingMode || '',
    f.processingStatus || 'Completed',
  ])

  addDataTable(ws, headers, dataRows, {
    dateCols: [6],
    addTotals: false,
    freezeHeader: true,
    addFilter: true,
  })
}

// ── Sheet 12: Warnings & Unmatched Sells ────────────────────

function buildWarningsSheet(
  wb: Workbook,
  warnings: FifoWarning[],
  realizedTrades: TaxedRealizedTrade[],
): void {
  const ws = wb.addWorksheet('Warnings & Unmatched', {
    properties: { tabColor: { argb: TAB_COLORS.WARNING } },
  })

  let r = 1

  // Title
  ws.mergeCells(r, 1, r, 7)
  ws.getCell(r, 1).value = 'WARNINGS & UNMATCHED SELLS'
  ws.getCell(r, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.AMBER.replace('FF','') } }
  ws.getRow(r).height = 28
  r += 2

  // ── Section A: Skipped Rows / Warnings ──
  writeSectionTitle(ws, r, 1, 'SECTION A: SKIPPED ROWS & WARNINGS', 7)
  r++

  // Filter warnings that are NOT unmatched sells
  const skippedWarnings = warnings.filter(w =>
    w.type && w.type !== 'UNMATCHED_SELL' && w.type !== 'UnmatchedSellWarning'
  )

  const skipHeaders = ['Type', 'CSV File', 'Row Number', 'Pair', 'Reason / Message', 'Severity']
  const skipData = skippedWarnings.map(w => [
    w.type || 'WARNING',
    w.csvFile || '',
    w.rowNumber || '',
    w.pair || '',
    w.message || w.reason || '',
    w.severity || 'Medium',
  ])

  if (skipData.length === 0) {
    ws.getCell(r, 1).value = 'No skipped row warnings found.'
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.GRAY_FONT } }
    r += 2
  } else {
    const { lastDataRow } = addDataTable(ws, skipHeaders, skipData, {
      startRow: r,
      freezeHeader: false,
      addFilter: true,
    })
    r = lastDataRow + 3
  }

  // ── Section B: Unmatched Sells ──
  writeSectionTitle(ws, r, 1, 'SECTION B: UNMATCHED SELLS', 7)
  r++

  // Filter unmatched sell warnings
  const unmatchedSells = warnings.filter(w =>
    !w.type || w.type === 'UNMATCHED_SELL' || w.type === 'UnmatchedSellWarning'
  )

  const unmatchedHeaders = ['Pair', 'Exchange', 'Sell Date', 'Sell Qty', 'Matched Qty', 'Unmatched Qty', 'Reason']
  const unmatchedData = unmatchedSells.map(w => [
    w.pair || '',
    '',  // Exchange not available
    w.sellDate ? toDate(w.sellDate) : '',
    toD(w.originalSellQty || w.sellQty || '0').toNumber(),
    toD(w.matchedQty || '0').toNumber(),
    toD(w.unmatchedQty || w.shortfallQty || '0').toNumber(),
    w.reason || w.message || '',
  ])

  if (unmatchedData.length === 0) {
    ws.getCell(r, 1).value = 'No unmatched sells found.'
    ws.getCell(r, 1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.GRAY_FONT } }
  } else {
    addDataTable(ws, unmatchedHeaders, unmatchedData, {
      financialCols: [4, 5, 6],
      dateCols: [3],
      startRow: r,
      freezeHeader: false,
      addFilter: true,
    })
  }

  // Column widths
  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 18
  ws.getColumn(3).width = 16
  ws.getColumn(4).width = 16
  ws.getColumn(5).width = 18
  ws.getColumn(6).width = 18
  ws.getColumn(7).width = 35
}

// ── Sheet 13: Exchange Details Used ─────────────────────────

function buildExchangeDetailsSheet(
  wb: Workbook,
  settings: ExchangeSettingsForExport,
): void {
  const ws = wb.addWorksheet('Exchange Details', {
    properties: { tabColor: { argb: TAB_COLORS.DATA } },
  })

  const headers = [
    'Exchange Name', 'Buy Fee%', 'Sell Fee%', 'Source', 'Used in CSV', 'Processed On',
  ]

  const dataRows = [
    [
      settings.exchangeName || 'Default Exchange',
      toNum(settings.defaultBuyFeePercent) / 100,
      toNum(settings.defaultSellFeePercent) / 100,
      settings.source || 'Workspace Settings',
      settings.usedInCsv !== undefined ? (settings.usedInCsv ? 'Yes' : 'No') : 'N/A',
      settings.processedOn || fmtDateTime(new Date()),
    ],
  ]

  addDataTable(ws, headers, dataRows, {
    pctCols: [2, 3],
    addTotals: false,
    freezeHeader: true,
    addFilter: false,
  })

  // Add a note below the table
  const noteRow = 4
  ws.getCell(noteRow, 1).value = 'Note: CSV-provided fee/TDS values always take priority over these defaults. Defaults are used only when CSV value is 0 or missing.'
  ws.getCell(noteRow, 1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.GRAY_FONT } }
  ws.mergeCells(noteRow, 1, noteRow, 6)
  ws.getCell(noteRow, 1).alignment = { wrapText: true }
}

// ── Sheet 14: Calculation Formulas ──────────────────────────

function buildFormulasSheet(wb: Workbook): void {
  const ws = wb.addWorksheet('Calculation Formulas', {
    properties: { tabColor: { argb: TAB_COLORS.INFO } },
  })

  const headers = ['#', 'Calculation', 'Formula / Explanation', 'Notes']

  const dataRows = [
    [1, 'Gross Profit', 'Sell Value − Buy Value', 'Can be negative (indicates a loss at the gross level)'],
    [2, 'Buy Fee (Allocated)', 'Original Buy Fee × (Matched Qty / Original Buy Qty)', 'Proportional allocation for partial matches'],
    [3, 'Sell Fee (Allocated)', 'Original Sell Fee × (Matched Qty / Original Sell Qty)', 'Proportional allocation for partial matches'],
    [4, 'Total Fees', 'Allocated Buy Fee + Allocated Sell Fee', 'Excludes GST'],
    [5, 'GST on Fees', 'Total Fees × GST% (18%)', 'Applied on total fees'],
    [6, 'TDS (Buy)', 'CSV TDS if non-zero, else 0', 'Buy-side TDS from CSV or default'],
    [7, 'TDS (Sell)', 'CSV TDS if non-zero, else Sell Value × Default TDS%', 'Sell-side TDS from CSV or default'],
    [8, 'Total TDS', 'Buy TDS + Sell TDS (proportional)', 'Combined TDS from both sides'],
    [9, 'Net Profit Before Tax', 'Gross Profit − Total Fees − GST − Total TDS', 'Pre-tax profit after all deductions'],
    [10, 'Base Crypto Tax', 'Gross Profit × 30% (only if Gross Profit > 0)', 'VDAA Section 115BBH — no offset for losses'],
    [11, 'Cess', 'Base Crypto Tax × 4%', 'Health & Education Cess on crypto tax'],
    [12, 'Total Direct Tax', 'Base Crypto Tax + Cess', 'Total tax payable on crypto gains'],
    [13, 'Final Net Profit', 'Net Profit Before Tax − Total Direct Tax + Total TDS', 'TDS is credited back as it is already deducted at source'],
    [14, 'TDS Credit', 'TDS is added back as a credit against tax liability', 'Claimed while filing ITR'],
    [15, 'Profit/Loss Status', 'PROFIT if Final Net Profit > 0, else LOSS', 'Binary classification for each trade'],
    [16, 'Fee Source Resolution', 'CSV fee used if > 0, else Default Fee% × Trade Value', 'CSV always takes priority'],
    [17, 'TDS Source Resolution', 'CSV TDS used if > 0, else Default TDS% × Trade Value', 'CSV always takes priority'],
    [18, 'FIFO Matching', 'Oldest BUY lots consumed first per pair', 'Strict chronological order maintained'],
    [19, 'Partial Match Handling', 'BUY lot split into matched and remaining portions', 'Remaining portion becomes open holding'],
    [20, 'Loss Offset Rule', 'Losses CANNOT be offset against profits', 'Per Section 115BBH of Income Tax Act'],
  ]

  addDataTable(ws, headers, dataRows, {
    addTotals: false,
    freezeHeader: true,
    addFilter: true,
  })

  // Widen the formula and notes columns
  ws.getColumn(3).width = 55
  ws.getColumn(4).width = 50
}

// ── Sheet 15: Notes ─────────────────────────────────────────

function buildNotesSheet(
  wb: Workbook,
  notes: NoteForExport[],
): void {
  const ws = wb.addWorksheet('Notes', {
    properties: { tabColor: { argb: TAB_COLORS.INFO } },
  })

  const headers = ['#', 'Note Title', 'Content', 'Created Date', 'Updated Date']
  const dateCols = [4, 5]

  const dataRows = notes.map((n, i) => [
    i + 1,
    n.title,
    n.content,
    n.createdAt ? toDate(n.createdAt) : '',
    n.updatedAt ? toDate(n.updatedAt) : '',
  ])

  if (dataRows.length === 0) {
    // Add placeholder row
    dataRows.push([1, 'No notes yet', 'Add notes from the Crypto Audit Master interface to see them here.', '', ''])
  }

  addDataTable(ws, headers, dataRows, {
    dateCols,
    addTotals: false,
    freezeHeader: true,
    addFilter: true,
  })

  // Widen content column
  ws.getColumn(3).width = 60
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PART 1: FULL EXCEL WORKBOOK (15 sheets)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a comprehensive 15-sheet Excel workbook with professional styling.
 * Returns a Buffer containing the XLSX file.
 *
 * NOTE: This function is async because ExcelJS writes buffers asynchronously.
 */
export async function generateFullExcelWorkbook(
  report: ReportDataForExport,
  workspace: WorkspaceForExport,
  csvFiles: CsvFileForExport[],
  settings: ExchangeSettingsForExport,
  notes: NoteForExport[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crypto Audit Master'
  wb.lastModifiedBy = 'Crypto Audit Master'
  wb.created = new Date()
  wb.modified = new Date()

  // ── Build all 15 sheets ──
  try {
    // Sheet 1: Cover & Report Info
    buildCoverSheet(wb, report, workspace)

    // Sheet 2: Executive Summary
    buildExecutiveSummarySheet(wb, report)

    // Sheet 3: Dashboard Overview
    buildDashboardOverviewSheet(wb, report)

    // Sheet 4: Realized Trades
    buildRealizedTradesSheet(wb, report.realizedTrades)

    // Sheet 5: Open Holdings
    buildOpenHoldingsSheet(wb, report.openHoldings)

    // Sheet 6: Tax Summary
    buildTaxSummarySheet(wb, report.taxSummary)

    // Sheet 7: Fees, GST & TDS Summary
    buildFeesGstTdsSheet(wb, report.realizedTrades)

    // Sheet 8: Pair-wise Performance
    buildPairWisePerformanceSheet(wb, report.realizedTrades)

    // Sheet 9: Time-wise Profit Analysis
    buildTimeWiseProfitSheet(wb, report.realizedTrades)

    // Sheet 10: Charts & Graphs
    buildChartsSheet(wb, report)

    // Sheet 11: CSV Upload Log
    buildCsvUploadLogSheet(wb, csvFiles)

    // Sheet 12: Warnings & Unmatched Sells
    buildWarningsSheet(wb, report.warnings, report.realizedTrades)

    // Sheet 13: Exchange Details Used
    buildExchangeDetailsSheet(wb, settings)

    // Sheet 14: Calculation Formulas
    buildFormulasSheet(wb)

    // Sheet 15: Notes
    buildNotesSheet(wb, notes)
  } catch (err) {
    console.error('[EXCEL EXPORT] Error building workbook sheets:', err)
    throw new Error('Failed to build Excel workbook sheets')
  }

  // ── Write to buffer ──
  try {
    const buffer = await wb.xlsx.writeBuffer() as Buffer
    return buffer
  } catch (err) {
    console.error('[EXCEL EXPORT] Error writing workbook to buffer:', err)
    throw new Error('Failed to write Excel workbook to buffer')
  }
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
 * Professional styling with conditional formatting.
 */
export async function generateRealizedTradesExcel(
  realizedTrades: TaxedRealizedTrade[],
  workspace: WorkspaceForExport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crypto Audit Master'
  wb.created = new Date()

  try {
    buildRealizedTradesSheet(wb, realizedTrades)
  } catch (err) {
    console.error('[EXCEL EXPORT] Error building realized trades sheet:', err)
    throw new Error('Failed to build realized trades Excel sheet')
  }

  try {
    const buffer = await wb.xlsx.writeBuffer() as Buffer
    return buffer
  } catch (err) {
    console.error('[EXCEL EXPORT] Error writing realized trades to buffer:', err)
    throw new Error('Failed to write realized trades Excel to buffer')
  }
}

/** Generate filename for realized trades export */
export function getRealizedTradesFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_RealizedTrades_${date}.xlsx`
}

/**
 * Generate a single-sheet Excel with just open holdings.
 * Professional styling with freeze panes and auto-filter.
 */
export async function generateOpenHoldingsExcel(
  openHoldings: OpenHolding[],
  workspace: WorkspaceForExport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crypto Audit Master'
  wb.created = new Date()

  try {
    buildOpenHoldingsSheet(wb, openHoldings)
  } catch (err) {
    console.error('[EXCEL EXPORT] Error building open holdings sheet:', err)
    throw new Error('Failed to build open holdings Excel sheet')
  }

  try {
    const buffer = await wb.xlsx.writeBuffer() as Buffer
    return buffer
  } catch (err) {
    console.error('[EXCEL EXPORT] Error writing open holdings to buffer:', err)
    throw new Error('Failed to write open holdings Excel to buffer')
  }
}

/** Generate filename for open holdings export */
export function getOpenHoldingsFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_OpenHoldings_${date}.xlsx`
}

/**
 * Generate a single-sheet Excel with just tax summary.
 * Professional styling with calculation breakdown.
 */
export async function generateTaxSummaryExcel(
  taxSummary: TaxSummary,
  workspace: WorkspaceForExport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Crypto Audit Master'
  wb.created = new Date()

  try {
    buildTaxSummarySheet(wb, taxSummary)
  } catch (err) {
    console.error('[EXCEL EXPORT] Error building tax summary sheet:', err)
    throw new Error('Failed to build tax summary Excel sheet')
  }

  try {
    const buffer = await wb.xlsx.writeBuffer() as Buffer
    return buffer
  } catch (err) {
    console.error('[EXCEL EXPORT] Error writing tax summary to buffer:', err)
    throw new Error('Failed to write tax summary Excel to buffer')
  }
}

/** Generate filename for tax summary export */
export function getTaxSummaryFilename(workspace: WorkspaceForExport): string {
  const safeName = safeFilename(workspace.name)
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeName}_TaxSummary_${date}.xlsx`
}
