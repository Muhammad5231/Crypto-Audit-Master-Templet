// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — PDF Export Service (Server-Side PDFKit)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generates professional PDF audit reports using PDFKit.
// Visual chart images are optional so local setup does not depend
// on native canvas builds on Windows.
//
// Sections:
//   1.  Cover Page
//   2.  Report Metadata
//   3.  Executive Summary
//   4.  Profit Summary
//   5.  Tax Summary
//   6.  Deductions Breakdown
//   7.  Performance Charts (embedded PNG)
//   8.  Top Pair Performance
//   9.  Open Holdings Summary
//   10. Data Quality & Warnings
//   11. Exchange Details Used
//   12. Formula Explanation
//   13. Disclaimer
//
// Backward-compatible exports:
//   - generatePdfReportData() → PdfReportData (JSON, for API route)
//   - generatePdfReport()    → Promise<Buffer> (new, actual PDF)
//   - getPdfReportFilename() → string (new)
//   - All existing types preserved
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import PDFDocument from 'pdfkit'
import { toD, formatINR, formatQty } from '@/lib/decimal'
import type { TaxedRealizedTrade, TaxSummary } from '@/lib/tax-engine'
import type { OpenHolding, FifoWarning } from '@/lib/fifo-engine'

// ── Lazy-load chartjs (server-only) ────────────────────────

type ChartCanvasLike = {
  renderToBuffer(config: unknown): Promise<Buffer>
}

const CHARTS_DISABLED_REASON =
  'Visual chart rendering is disabled in this setup to avoid native canvas build requirements on Windows. ' +
  'The rest of the PDF report is still generated normally.'

async function getChartCanvas(): Promise<ChartCanvasLike | null> {
  return null
}

// ── Type Definitions (backward-compatible) ─────────────────

/** Workspace info for PDF headers */
export interface WorkspaceForPdf {
  id: string
  name: string
  financialYear: string
}

/** CSV file record for PDF upload log section */
export interface CsvFileForPdf {
  originalName: string
  totalRows: number
  validRows: number
  skippedRows: number
  uploadedAt: string
}

/** Exchange settings for PDF settings section */
export interface ExchangeSettingsForPdf {
  defaultBuyFeePercent: string
  defaultSellFeePercent: string
  defaultTdsPercent: string
  gstPercent: string
  cryptoTaxPercent: string
  cessPercent: string
}

/** A single formatted table row for PDF rendering */
export interface PdfTableRow {
  cells: string[]
  isProfit?: boolean
  isLoss?: boolean
  isHighlight?: boolean
  isSubtotal?: boolean
}

/** A section of the PDF report */
export interface PdfSection {
  title: string
  type: 'table' | 'key-value' | 'text' | 'formula-list'
  headers?: string[]
  rows?: PdfTableRow[]
  pairs?: Array<{ key: string; value: string; isHighlight?: boolean; isProfit?: boolean; isLoss?: boolean }>
  content?: string
  formulas?: Array<{ name: string; formula: string }>
}

/** Complete PDF report data */
export interface PdfReportData {
  workspaceName: string
  financialYear: string
  generatedAt: string
  reportId: string
  disclaimer: string
  sections: PdfSection[]
  styles: {
    profitColor: string
    lossColor: string
    accentColor: string
    headerBgColor: string
  }
}

// ── Report input type (used by generatePdfReport) ──────────

interface PdfReportInput {
  reportId: string
  generatedAt: string
  realizedTrades: TaxedRealizedTrade[]
  openHoldings: OpenHolding[]
  warnings: FifoWarning[]
  taxSummary: TaxSummary
}

// ── Color Constants ────────────────────────────────────────

const TEAL = '#14B8A6'
const TEAL_DARK = '#0D9488'
const TEAL_LIGHT = '#CCFBF1'
const GREEN = '#16A34A'
const RED = '#DC2626'
const GRAY_100 = '#F3F4F6'
const GRAY_400 = '#9CA3AF'
const GRAY_600 = '#4B5563'
const GRAY_800 = '#1F2937'
const WHITE = '#FFFFFF'

// ── PDF Layout Constants ───────────────────────────────────

const PAGE_WIDTH = 595.28   // A4 width in points
const PAGE_HEIGHT = 841.89  // A4 height in points
const MARGIN_LEFT = 50
const MARGIN_RIGHT = 50
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const MARGIN_TOP = 60
const MARGIN_BOTTOM = 70

// ── Formatting Helpers ─────────────────────────────────────

function fmtINR(val: string | number): string {
  return formatINR(toD(val))
}

function fmtQ(val: string): string {
  return formatQty(toD(val))
}

function fmtDate(d: string | Date): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function fmtDateTime(d: string | Date): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
}

/** Get the net profit/resolve value from a taxed trade */
function tradeFinalNetProfit(t: TaxedRealizedTrade): string {
  return t.resolvedFinalNetProfit || t.finalNetProfit
}

function tradeStatus(t: TaxedRealizedTrade): string {
  return t.resolvedProfitLossStatus || t.status
}

function tradeTotalFees(t: TaxedRealizedTrade): string {
  return t.resolvedTotalFees || t.totalFees
}

function tradeTotalTax(t: TaxedRealizedTrade): string {
  return t.resolvedTotalDirectTax || t.totalDirectTax
}

function tradeTds(t: TaxedRealizedTrade): string {
  return t.resolvedTotalTds || t.tds
}

function tradeGstOnFees(t: TaxedRealizedTrade): string {
  return t.resolvedGstOnFees || t.gstOnFees
}

// ── PDFKit Helper Functions ────────────────────────────────

/** Add page number footer to every page */
function addPageNumbers(doc: PDFKit.PDFDocument, workspaceName: string): void {
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)
    const pageNum = i + 1

    // Footer line
    doc
      .save()
      .moveTo(MARGIN_LEFT, PAGE_HEIGHT - 45)
      .lineTo(PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 45)
      .strokeColor(GRAY_400)
      .lineWidth(0.5)
      .stroke()

    // Left: Report title
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(GRAY_400)
      .text('Crypto Audit Master — Audit Report', MARGIN_LEFT, PAGE_HEIGHT - 38, {
        width: CONTENT_WIDTH / 2,
        align: 'left',
      })

    // Right: Page number
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(GRAY_400)
      .text(`Page ${pageNum} of ${pages.count}`, MARGIN_LEFT + CONTENT_WIDTH / 2, PAGE_HEIGHT - 38, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
      })

    doc.restore()
  }
}

/** Check if we need a new page, add one if so. Returns Y position after check. */
function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage()
    return MARGIN_TOP
  }
  return y
}

/** Draw a section heading with teal accent bar */
function drawSectionHeading(doc: PDFKit.PDFDocument, y: number, title: string): number {
  y = ensureSpace(doc, y, 35)
  // Accent bar
  doc
    .save()
    .rect(MARGIN_LEFT, y, 4, 22)
    .fill(TEAL)
    .restore()

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(TEAL_DARK)
    .text(title, MARGIN_LEFT + 12, y + 3, { width: CONTENT_WIDTH - 12 })

  // Underline
  const textHeight = doc.heightOfString(title, { width: CONTENT_WIDTH - 12 })
  doc
    .save()
    .moveTo(MARGIN_LEFT, y + textHeight + 8)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y + textHeight + 8)
    .strokeColor(TEAL)
    .lineWidth(0.5)
    .stroke()
    .restore()

  return y + textHeight + 16
}

/** Draw a key-value pair row */
function drawKeyValue(
  doc: PDFKit.PDFDocument,
  y: number,
  key: string,
  value: string,
  opts?: { isHighlight?: boolean; isProfit?: boolean; isLoss?: boolean; keyWidth?: number },
): number {
  const keyWidth = opts?.keyWidth || 220
  y = ensureSpace(doc, y, 20)

  // Key
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(GRAY_600)
    .text(key, MARGIN_LEFT + 10, y, { width: keyWidth, align: 'left' })

  // Value
  let valueColor = GRAY_800
  if (opts?.isProfit) valueColor = GREEN
  if (opts?.isLoss) valueColor = RED
  if (opts?.isHighlight) valueColor = TEAL_DARK

  doc
    .font(opts?.isHighlight || opts?.isProfit || opts?.isLoss ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(10)
    .fillColor(valueColor)
    .text(value, MARGIN_LEFT + keyWidth + 10, y, { width: CONTENT_WIDTH - keyWidth - 20, align: 'right' })

  return y + 18
}

/** Draw a horizontal rule */
function drawHr(doc: PDFKit.PDFDocument, y: number): number {
  doc
    .save()
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(GRAY_400)
    .lineWidth(0.3)
    .stroke()
    .restore()
  return y + 6
}

/** Draw a simple table */
function drawTable(
  doc: PDFKit.PDFDocument,
  y: number,
  headers: string[],
  rows: string[][],
  opts?: {
    colWidths?: number[]
    headerBg?: string
    rowColors?: Array<{ isProfit?: boolean; isLoss?: boolean; isHighlight?: boolean }>
    fontSize?: number
  },
): number {
  const fontSize = opts?.fontSize || 8
  const colWidths = opts?.colWidths || distributeColumns(headers.length, CONTENT_WIDTH)
  const headerBg = opts?.headerBg || TEAL_LIGHT
  const rowHeight = fontSize + 10
  const headerHeight = fontSize + 14

  // Header
  y = ensureSpace(doc, y, headerHeight + rowHeight)
  let x = MARGIN_LEFT

  // Header background
  doc.save().rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerHeight).fill(headerBg).restore()

  for (let i = 0; i < headers.length; i++) {
    doc
      .font('Helvetica-Bold')
      .fontSize(fontSize)
      .fillColor(TEAL_DARK)
      .text(headers[i], x + 4, y + 4, { width: colWidths[i] - 8, align: i === 0 ? 'left' : 'right' })
    x += colWidths[i]
  }

  y += headerHeight

  // Rows
  for (let r = 0; r < rows.length; r++) {
    y = ensureSpace(doc, y, rowHeight + 2)
    const row = rows[r]
    const rowOpts = opts?.rowColors?.[r]
    x = MARGIN_LEFT

    // Alternating row background
    if (r % 2 === 1) {
      doc.save().rect(MARGIN_LEFT, y, CONTENT_WIDTH, rowHeight).fill(GRAY_100).restore()
    }

    for (let i = 0; i < row.length; i++) {
      let cellColor = GRAY_800
      if (rowOpts?.isProfit) cellColor = GREEN
      if (rowOpts?.isLoss) cellColor = RED

      const isFirst = i === 0
      doc
        .font(rowOpts?.isProfit || rowOpts?.isLoss ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .fillColor(cellColor)
        .text(row[i] || '', x + 4, y + 3, { width: colWidths[i] - 8, align: isFirst ? 'left' : 'right' })
      x += colWidths[i]
    }
    y += rowHeight
  }

  // Bottom border
  doc
    .save()
    .moveTo(MARGIN_LEFT, y)
    .lineTo(MARGIN_LEFT + CONTENT_WIDTH, y)
    .strokeColor(TEAL)
    .lineWidth(0.5)
    .stroke()
    .restore()

  return y + 10
}

/** Distribute column widths proportionally */
function distributeColumns(count: number, totalWidth: number): number[] {
  if (count <= 0) return []
  const base = totalWidth / count
  return Array(count).fill(base)
}

// ── Chart Generation ───────────────────────────────────────

async function generateProfitOverTimeChart(trades: TaxedRealizedTrade[]): Promise<Buffer> {
  const monthPerf = new Map<string, { grossProfit: number; netProfit: number }>()
  for (const t of trades) {
    const sellDate = new Date(t.sellDate)
    const monthKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`
    const existing = monthPerf.get(monthKey) || { grossProfit: 0, netProfit: 0 }
    existing.grossProfit += toD(t.grossProfit).toNumber()
    existing.netProfit += toD(tradeFinalNetProfit(t)).toNumber()
    monthPerf.set(monthKey, existing)
  }

  const sorted = Array.from(monthPerf.entries()).sort(([a], [b]) => a.localeCompare(b))
  const labels = sorted.map(([m]) => m)
  const grossData = sorted.map(([, d]) => d.grossProfit)
  const netData = sorted.map(([, d]) => d.netProfit)

  const canvas = await getChartCanvas()
  if (!canvas) return Buffer.alloc(0)
  return canvas.renderToBuffer({
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Gross Profit',
          data: grossData,
          borderColor: TEAL,
          backgroundColor: 'rgba(20,184,166,0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Final Net Profit',
          data: netData,
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: 'Profit Over Time', font: { size: 16, family: 'Helvetica' } },
        legend: { position: 'top' },
      },
      scales: {
        y: { title: { display: true, text: 'Amount (INR)' } },
      },
    },
  })
}

async function generateNetProfitByPairChart(trades: TaxedRealizedTrade[]): Promise<Buffer> {
  const pairPerf = new Map<string, number>()
  for (const t of trades) {
    const existing = pairPerf.get(t.pair) || 0
    pairPerf.set(t.pair, existing + toD(tradeFinalNetProfit(t)).toNumber())
  }

  const sorted = Array.from(pairPerf.entries()).sort(([, a], [, b]) => b - a).slice(0, 15)
  const labels = sorted.map(([p]) => p)
  const data = sorted.map(([, v]) => v)
  const bgColors = data.map(v => v >= 0 ? 'rgba(20,184,166,0.7)' : 'rgba(239,68,68,0.7)')

  const canvas = await getChartCanvas()
  if (!canvas) return Buffer.alloc(0)
  return canvas.renderToBuffer({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Final Net Profit',
        data,
        backgroundColor: bgColors,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: false,
      plugins: {
        title: { display: true, text: 'Final Net Profit by Pair', font: { size: 16, family: 'Helvetica' } },
        legend: { display: false },
      },
      scales: {
        x: { title: { display: true, text: 'Amount (INR)' } },
      },
    },
  })
}

async function generateDeductionsPieChart(ts: TaxSummary): Promise<Buffer> {
  const labels = ['Fees (ex GST)', 'GST on Fees', 'TDS', 'Base Crypto Tax', 'Cess']
  const baseCryptoTax = toD(ts.totalDirectTax).minus(toD(ts.totalCess))
  const data = [
    toD(ts.totalFees).toNumber(),
    toD(ts.totalGstOnFees).toNumber(),
    toD(ts.totalTds).toNumber(),
    baseCryptoTax.toNumber(),
    toD(ts.totalCess).toNumber(),
  ]
  const bgColors = ['#14B8A6', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6']

  const canvas = await getChartCanvas()
  if (!canvas) return Buffer.alloc(0)
  return canvas.renderToBuffer({
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: 'Deductions Breakdown', font: { size: 16, family: 'Helvetica' } },
        legend: { position: 'right' },
      },
    },
  })
}

async function generateHoldingsAllocationChart(openHoldings: OpenHolding[]): Promise<Buffer> {
  const holdAlloc = new Map<string, number>()
  for (const h of openHoldings) {
    const existing = holdAlloc.get(h.pair) || 0
    holdAlloc.set(h.pair, existing + toD(h.remainingCostBasis).toNumber())
  }

  const sorted = Array.from(holdAlloc.entries()).sort(([, a], [, b]) => b - a).slice(0, 10)
  const labels = sorted.map(([p]) => p)
  const data = sorted.map(([, v]) => v)
  const palette = ['#14B8A6', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#F97316', '#EC4899', '#06B6D4', '#84CC16']
  const bgColors = labels.map((_, i) => palette[i % palette.length])

  const canvas = await getChartCanvas()
  if (!canvas) return Buffer.alloc(0)
  return canvas.renderToBuffer({
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: 'Open Holdings Allocation', font: { size: 16, family: 'Helvetica' } },
        legend: { position: 'right' },
      },
    },
  })
}

async function generateWinLossChart(ts: TaxSummary): Promise<Buffer> {
  const canvas = await getChartCanvas()
  if (!canvas) return Buffer.alloc(0)
  return canvas.renderToBuffer({
    type: 'doughnut',
    data: {
      labels: ['Profitable Trades', 'Loss Trades'],
      datasets: [{
        data: [ts.profitableTrades, ts.lossTrades],
        backgroundColor: ['rgba(16,163,74,0.8)', 'rgba(220,38,38,0.8)'],
        borderWidth: 2,
        borderColor: [GREEN, RED],
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: 'Win vs Loss Ratio', font: { size: 16, family: 'Helvetica' } },
        legend: { position: 'bottom' },
      },
    },
  })
}

// ── Pair Performance Aggregation ───────────────────────────

interface PairPerformance {
  pair: string
  tradeCount: number
  grossProfit: number
  totalTax: number
  finalNetProfit: number
  profitTrades: number
  lossTrades: number
  winRate: string
}

function aggregatePairPerformance(trades: TaxedRealizedTrade[]): PairPerformance[] {
  const map = new Map<string, {
    grossProfit: number; totalTax: number; finalNetProfit: number;
    trades: number; profitTrades: number; lossTrades: number;
  }>()
  for (const t of trades) {
    const existing = map.get(t.pair) || { grossProfit: 0, totalTax: 0, finalNetProfit: 0, trades: 0, profitTrades: 0, lossTrades: 0 }
    existing.grossProfit += toD(t.grossProfit).toNumber()
    existing.totalTax += toD(tradeTotalTax(t)).toNumber()
    existing.finalNetProfit += toD(tradeFinalNetProfit(t)).toNumber()
    existing.trades += 1
    if (tradeStatus(t) === 'PROFIT') existing.profitTrades += 1
    else existing.lossTrades += 1
    map.set(t.pair, existing)
  }

  return Array.from(map.entries()).map(([pair, d]) => ({
    pair,
    tradeCount: d.trades,
    grossProfit: d.grossProfit,
    totalTax: d.totalTax,
    finalNetProfit: d.finalNetProfit,
    profitTrades: d.profitTrades,
    lossTrades: d.lossTrades,
    winRate: d.trades > 0 ? ((d.profitTrades / d.trades) * 100).toFixed(1) + '%' : '0%',
  }))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION BUILDERS — Each builds one section of the PDF
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Section 1: Cover Page */
function buildCoverPage(
  doc: PDFKit.PDFDocument,
  workspace: WorkspaceForPdf,
  report: PdfReportInput,
): void {
  // Centered cover page
  const centerY = PAGE_HEIGHT / 2

  // Top decorative bar
  doc.save().rect(0, 0, PAGE_WIDTH, 8).fill(TEAL).restore()

  // Title
  doc
    .font('Helvetica-Bold')
    .fontSize(32)
    .fillColor(TEAL_DARK)
    .text('Crypto Audit Master', MARGIN_LEFT, centerY - 120, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

  // Subtitle
  doc
    .font('Helvetica')
    .fontSize(14)
    .fillColor(GRAY_600)
    .text('Crypto Spot Trade Audit & Tax Review Report', MARGIN_LEFT, centerY - 70, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

  // Decorative line
  doc
    .save()
    .moveTo(MARGIN_LEFT + 100, centerY - 35)
    .lineTo(PAGE_WIDTH - MARGIN_RIGHT - 100, centerY - 35)
    .strokeColor(TEAL)
    .lineWidth(1)
    .stroke()
    .restore()

  // Professional subtitle
  doc
    .font('Helvetica-Oblique')
    .fontSize(10)
    .fillColor(GRAY_400)
    .text(
      'Based on FIFO (First-In-First-Out) Matching Method\nas per Section 115BBH of the Indian Income Tax Act',
      MARGIN_LEFT,
      centerY - 20,
      { width: CONTENT_WIDTH, align: 'center' },
    )

  // Workspace name
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(GRAY_800)
    .text(workspace.name, MARGIN_LEFT, centerY + 40, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

  // Financial Year
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor(GRAY_600)
    .text(`Financial Year: ${workspace.financialYear}`, MARGIN_LEFT, centerY + 65, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

  // Generated date
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(GRAY_400)
    .text(`Generated: ${fmtDateTime(report.generatedAt)}`, MARGIN_LEFT, centerY + 90, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

  // Bottom decorative bar
  doc.save().rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8).fill(TEAL).restore()
}

/** Section 2: Report Metadata */
function buildReportMetadata(
  doc: PDFKit.PDFDocument,
  y: number,
  report: PdfReportInput,
  workspace: WorkspaceForPdf,
  csvFiles: CsvFileForPdf[],
): number {
  y = drawSectionHeading(doc, y, 'Report Metadata')

  const totalSkipped = csvFiles.reduce((s, f) => s + f.skippedRows, 0)
  const exchangesUsed = [...new Set(csvFiles.map(f => {
    const name = f.originalName.toLowerCase()
    if (name.includes('wazirx') || name.includes('wazir')) return 'WazirX'
    if (name.includes('coindcx') || name.includes('dcx')) return 'CoinDCX'
    if (name.includes('binance')) return 'Binance'
    if (name.includes('kucoin')) return 'KuCoin'
    return 'Other'
  }))]
  const totalImported = csvFiles.reduce((s, f) => s + f.validRows, 0)

  y = drawKeyValue(doc, y, 'Workspace Name', workspace.name)
  y = drawKeyValue(doc, y, 'Financial Year', workspace.financialYear)
  y = drawKeyValue(doc, y, 'Total CSV Files', String(csvFiles.length))
  y = drawKeyValue(doc, y, 'Exchanges Used', exchangesUsed.join(', ') || 'N/A')
  y = drawKeyValue(doc, y, 'Generated On', fmtDateTime(report.generatedAt))
  y = drawKeyValue(doc, y, 'Total Imported Trades', String(totalImported))
  y = drawKeyValue(doc, y, 'Total Realized Trade Segments', String(report.realizedTrades.length))
  y = drawKeyValue(doc, y, 'Total Open Holdings', String(report.openHoldings.length))
  y = drawKeyValue(doc, y, 'Total Warnings', String(report.warnings.length))

  return y + 8
}

/** Section 3: Executive Summary */
function buildExecutiveSummary(
  doc: PDFKit.PDFDocument,
  y: number,
  report: PdfReportInput,
  openHoldings: OpenHolding[],
): number {
  y = drawSectionHeading(doc, y, 'Executive Summary')
  const ts = report.taxSummary

  // Financial overview
  y = drawKeyValue(doc, y, 'Total Buy Value', fmtINR(ts.totalBuyValue))
  y = drawKeyValue(doc, y, 'Total Sell Value', fmtINR(ts.totalSellValue))
  y = drawKeyValue(doc, y, 'Gross Profit', fmtINR(ts.totalGrossProfit), { isProfit: toD(ts.totalGrossProfit).gt(0) })
  y = drawKeyValue(doc, y, 'Fees Inc GST', fmtINR(toD(ts.totalFees).plus(toD(ts.totalGstOnFees)).toString()))
  y = drawKeyValue(doc, y, 'TDS Withheld', fmtINR(ts.totalTds))
  y = drawKeyValue(doc, y, 'Total Direct Tax (30% + 4% Cess)', fmtINR(ts.totalDirectTax), { isLoss: true })
  y = drawHr(doc, y)
  y = drawKeyValue(doc, y, 'Net Profit', fmtINR(ts.totalNetProfit), { isHighlight: true })
  y += 4

  // Final Net Profit explanation
  const finalNetProfit = toD(ts.totalNetProfit)
  y = drawKeyValue(doc, y, 'Final Net Profit', fmtINR(finalNetProfit.toString()), {
    isHighlight: true,
    isProfit: finalNetProfit.gt(0),
    isLoss: finalNetProfit.lt(0),
  })

  // Open Holdings Cost Basis
  const totalCostBasis = openHoldings.reduce((s, h) => s.plus(toD(h.remainingCostBasis)), toD('0'))
  y = drawKeyValue(doc, y, 'Open Holdings Cost Basis', fmtINR(totalCostBasis.toString()))

  // Win Rate
  const winRate = ts.totalTrades > 0 ? ((ts.profitableTrades / ts.totalTrades) * 100).toFixed(1) + '%' : '0%'
  y = drawKeyValue(doc, y, 'Win Rate', winRate)

  // Best / Worst Pair
  const pairPerf = aggregatePairPerformance(report.realizedTrades)
  if (pairPerf.length > 0) {
    const best = pairPerf.reduce((a, b) => b.finalNetProfit > a.finalNetProfit ? b : a)
    const worst = pairPerf.reduce((a, b) => b.finalNetProfit < a.finalNetProfit ? b : a)
    y = drawKeyValue(doc, y, 'Best Pair', `${best.pair} (${fmtINR(String(best.finalNetProfit))})`, { isProfit: true })
    y = drawKeyValue(doc, y, 'Worst Pair', `${worst.pair} (${fmtINR(String(worst.finalNetProfit))})`, { isLoss: true })
  }

  return y + 8
}

/** Section 4: Profit Summary */
function buildProfitSummary(
  doc: PDFKit.PDFDocument,
  y: number,
  ts: TaxSummary,
): number {
  y = drawSectionHeading(doc, y, 'Profit Summary')

  const headers = ['Metric', 'Amount', 'Explanation']
  const colWidths = [150, 150, CONTENT_WIDTH - 300]
  const rows = [
    ['Gross Profit', fmtINR(ts.totalGrossProfit), 'Sell Value minus Buy Value for all matched trades'],
    ['Net Profit', fmtINR(ts.totalNetProfit), 'After deducting fees, GST, TDS, and direct tax; TDS credit added back'],
    ['Final Net Profit', fmtINR(ts.totalNetProfit), 'Same as Net Profit — the bottom line after all deductions'],
  ]
  const rowColors = [
    { isProfit: toD(ts.totalGrossProfit).gt(0), isLoss: toD(ts.totalGrossProfit).lt(0) },
    { isProfit: toD(ts.totalNetProfit).gt(0), isLoss: toD(ts.totalNetProfit).lt(0) },
    { isHighlight: true, isProfit: toD(ts.totalNetProfit).gt(0), isLoss: toD(ts.totalNetProfit).lt(0) },
  ]

  y = drawTable(doc, y, headers, rows, { colWidths, rowColors, fontSize: 9 })
  return y + 4
}

/** Section 5: Tax Summary */
function buildTaxSummary(
  doc: PDFKit.PDFDocument,
  y: number,
  ts: TaxSummary,
): number {
  y = drawSectionHeading(doc, y, 'Tax Summary')

  const baseCryptoTax = toD(ts.totalDirectTax).minus(toD(ts.totalCess))
  const taxableGain = toD(ts.totalGrossProfit).gt(0) ? ts.totalGrossProfit : '0'

  y = drawKeyValue(doc, y, 'Taxable Positive Gain', fmtINR(String(taxableGain)), { isHighlight: true })
  y = drawKeyValue(doc, y, 'Base Crypto Tax @30%', fmtINR(baseCryptoTax.toString()))
  y = drawKeyValue(doc, y, 'Cess @4% on Base Tax', fmtINR(ts.totalCess))
  y = drawKeyValue(doc, y, 'Total Direct Tax', fmtINR(ts.totalDirectTax), { isHighlight: true })
  y = drawKeyValue(doc, y, 'TDS Withheld (Credit)', fmtINR(ts.totalTds))
  y = drawKeyValue(doc, y, 'GST on Fees', fmtINR(ts.totalGstOnFees))
  y = drawHr(doc, y)

  // Explanatory note
  y = ensureSpace(doc, y, 50)
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(GRAY_400)
    .text(
      'Note: TDS is withheld at source (Section 194S) and can be claimed as a credit against your total tax liability. ' +
      'The "Final Net Profit" calculation adds back TDS because it is not an actual cost — it is a pre-payment of tax. ' +
      'Crypto tax @30% + 4% cess applies only on positive gains per Section 115BBH.',
      MARGIN_LEFT + 10,
      y,
      { width: CONTENT_WIDTH - 20 },
    )

  return y + 30
}

/** Section 6: Deductions Breakdown */
function buildDeductionsBreakdown(
  doc: PDFKit.PDFDocument,
  y: number,
  ts: TaxSummary,
): number {
  y = drawSectionHeading(doc, y, 'Deductions Breakdown')

  const baseCryptoTax = toD(ts.totalDirectTax).minus(toD(ts.totalCess))
  const totalDeductions = toD(ts.totalFees)
    .plus(toD(ts.totalGstOnFees))
    .plus(toD(ts.totalTds))
    .plus(toD(ts.totalDirectTax))
  const finalNetProfit = toD(ts.totalGrossProfit).minus(totalDeductions).plus(toD(ts.totalTds))

  const headers = ['Step', 'Item', 'Amount', 'Running Total']
  const colWidths = [40, 170, 140, CONTENT_WIDTH - 350]
  const rows = [
    ['A', 'Gross Profit', fmtINR(ts.totalGrossProfit), fmtINR(ts.totalGrossProfit)],
    ['B', 'Less: Fees (ex GST)', '− ' + fmtINR(ts.totalFees), fmtINR(toD(ts.totalGrossProfit).minus(toD(ts.totalFees)).toString())],
    ['C', 'Less: GST on Fees', '− ' + fmtINR(ts.totalGstOnFees), fmtINR(toD(ts.totalGrossProfit).minus(toD(ts.totalFees)).minus(toD(ts.totalGstOnFees)).toString())],
    ['D', 'Less: TDS', '− ' + fmtINR(ts.totalTds), fmtINR(toD(ts.totalGrossProfit).minus(toD(ts.totalFees)).minus(toD(ts.totalGstOnFees)).minus(toD(ts.totalTds)).toString())],
    ['E', 'Less: Total Direct Tax', '− ' + fmtINR(ts.totalDirectTax), fmtINR(toD(ts.totalGrossProfit).minus(totalDeductions).toString())],
    ['F', 'Add: TDS Credit', '+ ' + fmtINR(ts.totalTds), fmtINR(finalNetProfit.toString())],
  ]

  const rowColors: Array<{ isProfit?: boolean; isLoss?: boolean; isHighlight?: boolean }> = [
    { isProfit: toD(ts.totalGrossProfit).gt(0) },
    { isLoss: true },
    { isLoss: true },
    { isLoss: true },
    { isLoss: true },
    { isProfit: true },
  ]

  y = drawTable(doc, y, headers, rows, { colWidths, rowColors, fontSize: 9 })

  // Final answer highlight
  y = ensureSpace(doc, y, 30)
  doc
    .save()
    .rect(MARGIN_LEFT + 10, y, CONTENT_WIDTH - 20, 24)
    .fill(TEAL_LIGHT)
    .restore()
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(TEAL_DARK)
    .text(`Final Net Profit: ${fmtINR(finalNetProfit.toString())}`, MARGIN_LEFT + 20, y + 6, {
      width: CONTENT_WIDTH - 40,
      align: 'center',
    })

  return y + 40
}

/** Section 7: Performance Charts */
async function buildPerformanceCharts(
  doc: PDFKit.PDFDocument,
  y: number,
  report: PdfReportInput,
  openHoldings: OpenHolding[],
): Promise<number> {
  y = drawSectionHeading(doc, y, 'Performance Charts')
  const ts = report.taxSummary

  const charts: Array<{ title: string; buffer: Buffer }> = []

  try {
    // Generate all charts in parallel
    const [
      profitOverTimeBuf,
      netProfitByPairBuf,
      deductionsPieBuf,
      holdingsAllocBuf,
      winLossBuf,
    ] = await Promise.all([
      report.realizedTrades.length > 0
        ? generateProfitOverTimeChart(report.realizedTrades)
        : Promise.resolve(Buffer.alloc(0)),
      report.realizedTrades.length > 0
        ? generateNetProfitByPairChart(report.realizedTrades)
        : Promise.resolve(Buffer.alloc(0)),
      generateDeductionsPieChart(ts),
      openHoldings.length > 0
        ? generateHoldingsAllocationChart(openHoldings)
        : Promise.resolve(Buffer.alloc(0)),
      generateWinLossChart(ts),
    ])

    if (profitOverTimeBuf.length > 0) charts.push({ title: 'Profit Over Time', buffer: profitOverTimeBuf })
    if (netProfitByPairBuf.length > 0) charts.push({ title: 'Net Profit by Pair', buffer: netProfitByPairBuf })
    if (deductionsPieBuf.length > 0) charts.push({ title: 'Deductions Breakdown', buffer: deductionsPieBuf })
    if (holdingsAllocBuf.length > 0) charts.push({ title: 'Open Holdings Allocation', buffer: holdingsAllocBuf })
    if (winLossBuf.length > 0) charts.push({ title: 'Win vs Loss Ratio', buffer: winLossBuf })
  } catch (err) {
    // If chart generation fails, log and continue
    console.error('[PDF CHART ERROR]', err)
  }

  if (charts.length === 0) {
    y = ensureSpace(doc, y, 70)
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(GRAY_500)
      .text(CHARTS_DISABLED_REASON, MARGIN_LEFT + 10, y, {
        width: CONTENT_WIDTH - 20,
      })
    return y + 40
  }

  // Embed each chart image
  const chartWidth = CONTENT_WIDTH
  const chartHeight = 300 // Scale down from 380

  for (const chart of charts) {
    if (chart.buffer.length === 0) continue
    y = ensureSpace(doc, y, chartHeight + 20)
    try {
      doc.image(chart.buffer, MARGIN_LEFT, y, { width: chartWidth, height: chartHeight })
      y += chartHeight + 10
    } catch (err) {
      console.error('[PDF IMAGE EMBED ERROR]', err)
      y += 20
    }
  }

  return y + 8
}

/** Section 8: Top Pair Performance */
function buildTopPairPerformance(
  doc: PDFKit.PDFDocument,
  y: number,
  trades: TaxedRealizedTrade[],
): number {
  if (trades.length === 0) return y

  y = drawSectionHeading(doc, y, 'Top Pair Performance')

  const pairPerf = aggregatePairPerformance(trades)
  const top5Profit = [...pairPerf].sort((a, b) => b.finalNetProfit - a.finalNetProfit).slice(0, 5)
  const top5Loss = [...pairPerf].sort((a, b) => a.finalNetProfit - b.finalNetProfit).slice(0, 5)

  // Top 5 Profitable
  if (top5Profit.length > 0) {
    y = ensureSpace(doc, y, 20)
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(GREEN)
      .text('Top 5 Profitable Pairs', MARGIN_LEFT + 10, y)
    y += 16

    const headers = ['Pair', 'Trades', 'Gross Profit', 'Total Tax', 'Final Net Profit', 'Win Rate']
    const colWidths = [100, 55, 95, 95, 110, CONTENT_WIDTH - 455]
    const rows = top5Profit.map(p => [
      p.pair,
      String(p.tradeCount),
      fmtINR(String(p.grossProfit)),
      fmtINR(String(p.totalTax)),
      fmtINR(String(p.finalNetProfit)),
      p.winRate,
    ])
    const rowColors = top5Profit.map(() => ({ isProfit: true }))
    y = drawTable(doc, y, headers, rows, { colWidths, rowColors, fontSize: 8 })
  }

  // Top 5 Loss-Making
  if (top5Loss.length > 0 && top5Loss[0].finalNetProfit < 0) {
    y = ensureSpace(doc, y, 20)
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(RED)
      .text('Top 5 Loss-Making Pairs', MARGIN_LEFT + 10, y)
    y += 16

    const headers = ['Pair', 'Trades', 'Gross Profit', 'Total Tax', 'Final Net Profit', 'Win Rate']
    const colWidths = [100, 55, 95, 95, 110, CONTENT_WIDTH - 455]
    const rows = top5Loss.map(p => [
      p.pair,
      String(p.tradeCount),
      fmtINR(String(p.grossProfit)),
      fmtINR(String(p.totalTax)),
      fmtINR(String(p.finalNetProfit)),
      p.winRate,
    ])
    const rowColors = top5Loss.map(() => ({ isLoss: true }))
    y = drawTable(doc, y, headers, rows, { colWidths, rowColors, fontSize: 8 })
  }

  return y + 8
}

/** Section 9: Open Holdings Summary */
function buildOpenHoldingsSummary(
  doc: PDFKit.PDFDocument,
  y: number,
  openHoldings: OpenHolding[],
): number {
  y = drawSectionHeading(doc, y, 'Open Holdings Summary')

  const totalCostBasis = openHoldings.reduce((s, h) => s.plus(toD(h.remainingCostBasis)), toD('0'))

  y = drawKeyValue(doc, y, 'Total Open Lots', String(openHoldings.length))
  y = drawKeyValue(doc, y, 'Total Cost Basis', fmtINR(totalCostBasis.toString()), { isHighlight: true })

  if (openHoldings.length > 0) {
    y += 6

    // Top 5 holdings by cost basis
    const top5 = [...openHoldings]
      .sort((a, b) => toD(b.remainingCostBasis).cmp(toD(a.remainingCostBasis)))
      .slice(0, 5)

    const headers = ['Pair', 'Remaining Qty', 'Buy Price', 'Cost Basis', 'Status']
    const colWidths = [100, 90, 100, 120, CONTENT_WIDTH - 410]
    const rows = top5.map(h => [
      h.pair,
      fmtQ(h.remainingQty),
      fmtINR(h.buyPrice),
      fmtINR(h.remainingCostBasis),
      h.status === 'Fully Unmatched Buy Lot' ? 'Fully Unmatched' : 'Partially Matched',
    ])
    y = drawTable(doc, y, headers, rows, { colWidths, fontSize: 8 })
  }

  return y + 8
}

/** Section 10: Data Quality & Warnings */
function buildDataQualityWarnings(
  doc: PDFKit.PDFDocument,
  y: number,
  report: PdfReportInput,
  csvFiles: CsvFileForPdf[],
): number {
  y = drawSectionHeading(doc, y, 'Data Quality & Warnings')

  const totalSkipped = csvFiles.reduce((s, f) => s + f.skippedRows, 0)
  const unmatchedSells = report.warnings.filter(w => w.reason)
  const otherWarnings = report.warnings.filter(w => !w.reason)

  y = drawKeyValue(doc, y, 'Total Skipped Rows', String(totalSkipped), { isLoss: totalSkipped > 0 })
  y = drawKeyValue(doc, y, 'Unmatched Sell Warnings', String(unmatchedSells.length), { isLoss: unmatchedSells.length > 0 })
  y = drawKeyValue(doc, y, 'Other Warnings', String(otherWarnings.length))

  // Warning type/count table
  if (report.warnings.length > 0) {
    y += 4
    const warningTypes = new Map<string, number>()
    for (const w of report.warnings) {
      const wType = 'Unmatched Sell'
      warningTypes.set(wType, (warningTypes.get(wType) || 0) + 1)
    }

    const headers = ['Warning Type', 'Count']
    const colWidths = [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3]
    const rows = Array.from(warningTypes.entries()).map(([type, count]) => [type, String(count)])
    y = drawTable(doc, y, headers, rows, { colWidths, fontSize: 9 })
  }

  // Small unmatched sells table
  if (unmatchedSells.length > 0) {
    y = ensureSpace(doc, y, 20)
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(RED)
      .text('Unmatched Sell Details', MARGIN_LEFT + 10, y)
    y += 14

    const topUnmatched = unmatchedSells.slice(0, 10)
    const headers = ['Pair', 'Sell Date', 'Unmatched Qty', 'Reason']
    const colWidths = [100, 90, 100, CONTENT_WIDTH - 290]
    const rows = topUnmatched.map(w => [
      w.pair || '—',
      w.sellDate ? fmtDate(w.sellDate) : '—',
      w.unmatchedQty ? fmtQ(w.unmatchedQty) : '—',
      w.reason || 'No earlier BUY lot found',
    ])
    const rowColors = topUnmatched.map(() => ({ isLoss: true }))
    y = drawTable(doc, y, headers, rows, { colWidths, rowColors, fontSize: 8 })
  }

  return y + 8
}

/** Section 11: Exchange Details Used */
function buildExchangeDetails(
  doc: PDFKit.PDFDocument,
  y: number,
  csvFiles: CsvFileForPdf[],
  settings: ExchangeSettingsForPdf,
): number {
  y = drawSectionHeading(doc, y, 'Exchange Details Used')

  // Detect exchange from CSV filenames
  const exchangeDetails: Array<{
    name: string
    buyFeePercent: string
    sellFeePercent: string
    source: string
  }> = []

  const exchangeMap = new Map<string, { name: string; buyFeePercent: string; sellFeePercent: string; source: string }>()
  for (const f of csvFiles) {
    const name = f.originalName.toLowerCase()
    let exchangeName = 'Unknown'
    if (name.includes('wazirx') || name.includes('wazir')) exchangeName = 'WazirX'
    else if (name.includes('coindcx') || name.includes('dcx')) exchangeName = 'CoinDCX'
    else if (name.includes('binance')) exchangeName = 'Binance'
    else if (name.includes('kucoin')) exchangeName = 'KuCoin'

    if (!exchangeMap.has(exchangeName)) {
      exchangeMap.set(exchangeName, {
        name: exchangeName,
        buyFeePercent: settings.defaultBuyFeePercent,
        sellFeePercent: settings.defaultSellFeePercent,
        source: 'CSV + Setting',
      })
    }
  }

  if (exchangeMap.size === 0) {
    exchangeMap.set('Default', {
      name: 'Default',
      buyFeePercent: settings.defaultBuyFeePercent,
      sellFeePercent: settings.defaultSellFeePercent,
      source: 'Setting Only',
    })
  }

  for (const detail of exchangeMap.values()) {
    exchangeDetails.push(detail)
  }

  const headers = ['Exchange Name', 'Buy Fee %', 'Sell Fee %', 'Source']
  const colWidths = [140, 100, 100, CONTENT_WIDTH - 340]
  const rows = exchangeDetails.map(d => [d.name, d.buyFeePercent + '%', d.sellFeePercent + '%', d.source])
  y = drawTable(doc, y, headers, rows, { colWidths, fontSize: 9 })

  // Also show full settings
  y += 6
  y = drawKeyValue(doc, y, 'Default TDS %', settings.defaultTdsPercent + '%')
  y = drawKeyValue(doc, y, 'GST %', settings.gstPercent + '%')
  y = drawKeyValue(doc, y, 'Crypto Tax %', settings.cryptoTaxPercent + '%')
  y = drawKeyValue(doc, y, 'Cess %', settings.cessPercent + '%')

  return y + 8
}

/** Section 12: Formula Explanation */
function buildFormulaExplanation(doc: PDFKit.PDFDocument, y: number): number {
  y = drawSectionHeading(doc, y, 'Formula Explanation')

  const formulas = [
    { name: 'Gross Profit', formula: 'Sell Value − Buy Value (per matched segment)' },
    { name: 'Fee Allocation', formula: 'Original Fee × (Matched Qty / Original Qty)' },
    { name: 'Total Fees', formula: 'Allocated Buy Fee + Allocated Sell Fee' },
    { name: 'GST on Fees', formula: 'Total Fees × GST%' },
    { name: 'TDS (Buy)', formula: 'CSV TDS if non-zero, else 0' },
    { name: 'TDS (Sell)', formula: 'CSV TDS if non-zero, else Sell Value × Default TDS%' },
    { name: 'Base Crypto Tax', formula: 'Gross Profit × 30% (only if Gross Profit > 0)' },
    { name: 'Cess', formula: 'Base Crypto Tax × 4%' },
    { name: 'Total Direct Tax', formula: 'Base Crypto Tax + Cess' },
    { name: 'Net Profit in Hand', formula: 'Gross Profit − Fees − GST on Fees − TDS' },
    { name: 'Final Net Profit', formula: 'Net Profit in Hand − Total Direct Tax + TDS' },
    { name: 'Win Rate', formula: 'Profitable Trades / Total Trades × 100%' },
  ]

  const headers = ['Calculation', 'Formula']
  const colWidths = [180, CONTENT_WIDTH - 180]
  const rows = formulas.map(f => [f.name, f.formula])
  y = drawTable(doc, y, headers, rows, { colWidths, fontSize: 9 })

  return y + 8
}

/** Section 13: Disclaimer */
function buildDisclaimer(doc: PDFKit.PDFDocument, y: number): number {
  y = drawSectionHeading(doc, y, 'Disclaimer')

  y = ensureSpace(doc, y, 120)
  const disclaimerText =
    'This report is generated for informational purposes only and does not constitute professional tax advice, ' +
    'legal advice, or a recommendation of any kind. The calculations are based on the FIFO (First-In-First-Out) ' +
    'method as per Indian Income Tax Act provisions for Virtual Digital Assets (Section 115BBH). TDS rates follow ' +
    'Section 194S of the Income Tax Act, 1961.\n\n' +
    'Tax laws and regulations are subject to change, and the accuracy of this report depends entirely on the ' +
    'quality and completeness of the CSV data provided. Crypto Audit Master is not liable for any discrepancies, ' +
    'errors, or omissions arising from incorrect CSV data, misconfigured exchange settings, or changes in tax law.\n\n' +
    'Please consult a qualified Chartered Accountant or tax professional for tax filing purposes. This report ' +
    'should be used as a supplementary tool and not as the sole basis for any tax or financial decision.'

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(GRAY_600)
    .text(disclaimerText, MARGIN_LEFT + 10, y, {
      width: CONTENT_WIDTH - 20,
      lineGap: 3,
    })

  // Signature area
  const textHeight = doc.heightOfString(disclaimerText, { width: CONTENT_WIDTH - 20 })
  y += textHeight + 30
  y = ensureSpace(doc, y, 40)
  drawHr(doc, y)
  y += 4
  doc
    .font('Helvetica-Oblique')
    .fontSize(7)
    .fillColor(GRAY_400)
    .text('Generated by Crypto Audit Master — https://cryptoaudit.app', MARGIN_LEFT, y, {
      width: CONTENT_WIDTH,
      align: 'center',
    })

  return y + 20
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT: generatePdfReport (returns PDF Buffer)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function generatePdfReport(
  report: PdfReportInput,
  workspace: WorkspaceForPdf,
  csvFiles: CsvFileForPdf[],
  settings: ExchangeSettingsForPdf,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = []

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
        bufferPages: true,
        info: {
          Title: `Crypto Audit Master — ${workspace.name}`,
          Author: 'Crypto Audit Master',
          Subject: `Crypto Tax Audit Report — FY ${workspace.financialYear}`,
          Keywords: 'crypto, audit, tax, FIFO, India, VDA',
          CreationDate: new Date(),
        },
      })

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err: Error) => reject(err))

      // ── Section 1: Cover Page ──
      buildCoverPage(doc, workspace, report)

      // ── Section 2: Report Metadata ──
      doc.addPage()
      let y = MARGIN_TOP
      y = buildReportMetadata(doc, y, report, workspace, csvFiles)

      // ── Section 3: Executive Summary ──
      y = ensureSpace(doc, y, 100)
      y += 10
      y = buildExecutiveSummary(doc, y, report, report.openHoldings)

      // ── Section 4: Profit Summary ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildProfitSummary(doc, y, report.taxSummary)

      // ── Section 5: Tax Summary ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildTaxSummary(doc, y, report.taxSummary)

      // ── Section 6: Deductions Breakdown ──
      y = ensureSpace(doc, y, 100)
      y += 10
      y = buildDeductionsBreakdown(doc, y, report.taxSummary)

      // ── Section 7: Performance Charts ──
      doc.addPage()
      y = MARGIN_TOP
      y = await buildPerformanceCharts(doc, y, report, report.openHoldings)

      // ── Section 8: Top Pair Performance ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildTopPairPerformance(doc, y, report.realizedTrades)

      // ── Section 9: Open Holdings Summary ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildOpenHoldingsSummary(doc, y, report.openHoldings)

      // ── Section 10: Data Quality & Warnings ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildDataQualityWarnings(doc, y, report, csvFiles)

      // ── Section 11: Exchange Details Used ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildExchangeDetails(doc, y, csvFiles, settings)

      // ── Section 12: Formula Explanation ──
      y = ensureSpace(doc, y, 80)
      y += 10
      y = buildFormulaExplanation(doc, y)

      // ── Section 13: Disclaimer ──
      y = ensureSpace(doc, y, 120)
      y += 10
      y = buildDisclaimer(doc, y)

      // ── Add page numbers to all pages ──
      addPageNumbers(doc, workspace.name)

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKWARD-COMPATIBLE: generatePdfReportData (returns JSON)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generatePdfReportData(
  report: {
    reportId: string
    generatedAt: string
    realizedTrades: TaxedRealizedTrade[]
    openHoldings: OpenHolding[]
    warnings: FifoWarning[]
    taxSummary: TaxSummary
  },
  workspace: WorkspaceForPdf,
  _csvFiles: CsvFileForPdf[],
  settings: ExchangeSettingsForPdf,
): PdfReportData {
  const sections: PdfSection[] = []
  const ts = report.taxSummary

  // ── Section 1: Report Info ──────────────────────────────
  sections.push({
    title: 'Report Information',
    type: 'key-value',
    pairs: [
      { key: 'Workspace', value: workspace.name },
      { key: 'Financial Year', value: workspace.financialYear },
      { key: 'Report Generated At', value: fmtDateTime(report.generatedAt) },
      { key: 'Total Trades Processed', value: String(ts.totalTrades) },
    ],
  })

  // ── Section 2: Executive Summary ────────────────────────
  sections.push({
    title: 'Executive Summary',
    type: 'key-value',
    pairs: [
      { key: 'Profitable Trades', value: String(ts.profitableTrades), isProfit: true },
      { key: 'Loss Trades', value: String(ts.lossTrades), isLoss: true },
      { key: 'Total Buy Value', value: fmtINR(ts.totalBuyValue) },
      { key: 'Total Sell Value', value: fmtINR(ts.totalSellValue) },
      { key: 'Total Gross Profit', value: fmtINR(ts.totalGrossProfit), isHighlight: true },
      { key: 'Total Gross Loss', value: fmtINR(ts.totalGrossLoss) },
      { key: 'Total Fees', value: fmtINR(ts.totalFees) },
      { key: 'Total GST on Fees', value: fmtINR(ts.totalGstOnFees) },
      { key: 'Total TDS', value: fmtINR(ts.totalTds) },
      { key: 'Total Direct Tax (30% + 4% Cess)', value: fmtINR(ts.totalDirectTax), isLoss: true },
      { key: 'Total Net Profit', value: fmtINR(ts.totalNetProfit), isHighlight: true },
      { key: 'Effective Tax Rate', value: toD(ts.effectiveTaxRate).toFixed(2) + '%' },
    ],
  })

  // ── Section 3: Tax Summary ──────────────────────────────
  const baseCryptoTax = toD(ts.totalDirectTax).minus(toD(ts.totalCess))
  sections.push({
    title: 'Tax Summary',
    type: 'key-value',
    pairs: [
      { key: 'Base Crypto Tax @30%', value: fmtINR(baseCryptoTax.toString()) },
      { key: 'Cess @4%', value: fmtINR(ts.totalCess) },
      { key: 'Total Direct Tax', value: fmtINR(ts.totalDirectTax), isHighlight: true },
      { key: 'TDS Withheld (Credit)', value: fmtINR(ts.totalTds) },
      { key: 'GST on Fees', value: fmtINR(ts.totalGstOnFees) },
    ],
  })

  // ── Section 4: Profit Flow ─────────────────────────────
  const netProfitBeforeTax = toD(ts.totalNetProfit).plus(toD(ts.totalDirectTax)).minus(toD(ts.totalTds))
  sections.push({
    title: 'Profit Calculation Flow',
    type: 'key-value',
    pairs: [
      { key: 'Gross Profit', value: fmtINR(ts.totalGrossProfit) },
      { key: 'Less: Fees', value: '− ' + fmtINR(ts.totalFees) },
      { key: 'Less: GST on Fees', value: '− ' + fmtINR(ts.totalGstOnFees) },
      { key: 'Less: TDS', value: '− ' + fmtINR(ts.totalTds) },
      { key: 'Net Profit Before Tax', value: fmtINR(netProfitBeforeTax.toString()) },
      { key: 'Less: Direct Tax', value: '− ' + fmtINR(ts.totalDirectTax) },
      { key: 'Add: TDS Credit', value: '+ ' + fmtINR(ts.totalTds) },
      { key: 'Final Net Profit', value: fmtINR(ts.totalNetProfit), isHighlight: true },
    ],
  })

  // ── Section 5: Realized Trades Table ────────────────────
  if (report.realizedTrades.length > 0) {
    sections.push({
      title: 'Realized Trades',
      type: 'table',
      headers: ['#', 'Pair', 'Buy Date', 'Sell Date', 'Qty', 'Gross Profit', 'Net Profit', 'Status'],
      rows: report.realizedTrades.map((t, i) => ({
        cells: [
          String(i + 1),
          t.pair,
          fmtDate(t.buyDate),
          fmtDate(t.sellDate),
          fmtQ(t.matchedQty),
          fmtINR(t.grossProfit),
          fmtINR(tradeFinalNetProfit(t)),
          tradeStatus(t),
        ],
        isProfit: tradeStatus(t) === 'PROFIT',
        isLoss: tradeStatus(t) === 'LOSS',
      })),
    })
  }

  // ── Section 6: Open Holdings Table ──────────────────────
  if (report.openHoldings.length > 0) {
    sections.push({
      title: 'Open Holdings',
      type: 'table',
      headers: ['#', 'Pair', 'Buy Date', 'Remaining Qty', 'Buy Price', 'Cost Basis', 'Status'],
      rows: report.openHoldings.map((h, i) => ({
        cells: [
          String(i + 1),
          h.pair,
          fmtDate(h.buyDate),
          fmtQ(h.remainingQty),
          fmtINR(h.buyPrice),
          fmtINR(h.remainingCostBasis),
          h.status === 'Fully Unmatched Buy Lot' ? 'Fully Unmatched' : 'Partially Matched',
        ],
      })),
    })
  }

  // ── Section 7: Warnings ────────────────────────────────
  if (report.warnings.length > 0) {
    sections.push({
      title: 'Warnings',
      type: 'table',
      headers: ['#', 'Pair', 'Sell Trade', 'Sell Date', 'Unmatched Qty', 'Reason'],
      rows: report.warnings.map((w, i) => ({
        cells: [
          String(i + 1),
          w.pair || '',
          w.sellTradeId ? w.sellTradeId.slice(-8) : '',
          w.sellDate ? fmtDate(w.sellDate) : '',
          w.unmatchedQty ? fmtQ(w.unmatchedQty) : '',
          w.reason || '',
        ],
        isLoss: true,
      })),
    })
  }

  // ── Section 8: Formulas & Explanations ──────────────────
  sections.push({
    title: 'Calculation Formulas',
    type: 'formula-list',
    formulas: [
      { name: 'Gross Profit', formula: 'Sell Value − Buy Value' },
      { name: 'Total Fees', formula: 'Buy Fee (proportional) + Sell Fee (proportional)' },
      { name: 'Fee Allocation', formula: 'Original Fee × (Matched Qty / Original Qty)' },
      { name: 'GST on Fees', formula: 'Total Fees × GST%' },
      { name: 'TDS (Buy)', formula: 'CSV TDS if non-zero, else 0' },
      { name: 'TDS (Sell)', formula: 'CSV TDS if non-zero, else Sell Value × Default TDS%' },
      { name: 'Base Crypto Tax', formula: 'Gross Profit × 30% (only if Gross Profit > 0)' },
      { name: 'Cess', formula: 'Base Crypto Tax × 4%' },
      { name: 'Total Direct Tax', formula: 'Base Crypto Tax + Cess' },
      { name: 'Final Net Profit', formula: 'Gross Profit − Fees − GST − TDS − Direct Tax + TDS' },
    ],
  })

  // ── Section 9: Exchange Settings ────────────────────────
  sections.push({
    title: 'Exchange Settings Used',
    type: 'key-value',
    pairs: [
      { key: 'Default Buy Fee %', value: settings.defaultBuyFeePercent + '%' },
      { key: 'Default Sell Fee %', value: settings.defaultSellFeePercent + '%' },
      { key: 'Default TDS %', value: settings.defaultTdsPercent + '%' },
      { key: 'GST %', value: settings.gstPercent + '%' },
      { key: 'Crypto Tax %', value: settings.cryptoTaxPercent + '%' },
      { key: 'Cess %', value: settings.cessPercent + '%' },
    ],
  })

  // ── Section 10: Disclaimer ─────────────────────────────
  sections.push({
    title: 'Disclaimer',
    type: 'text',
    content: 'This report is generated for informational purposes only and does not constitute professional tax advice. The calculations are based on the FIFO (First-In-First-Out) method as per Indian Income Tax Act provisions for Virtual Digital Assets (Section 115BBH). TDS rates follow Section 194S. Please consult a qualified Chartered Accountant for tax filing purposes. Crypto Audit Master is not liable for any discrepancies arising from incorrect CSV data or misconfigured exchange settings.',
  })

  return {
    workspaceName: workspace.name,
    financialYear: workspace.financialYear,
    generatedAt: fmtDateTime(report.generatedAt),
    reportId: report.reportId,
    disclaimer: 'This report is for informational purposes only. Please consult a qualified CA for tax filing.',
    sections,
    styles: {
      profitColor: '#16a34a',
      lossColor: '#dc2626',
      accentColor: '#14b8a6',
      headerBgColor: '#f1f5f9',
    },
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Generate PDF filename
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getPdfReportFilename(workspace: WorkspaceForPdf): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `CryptoAudit_${safeFilename(workspace.name)}_FY${safeFilename(workspace.financialYear)}_${dateStr}.pdf`
}
