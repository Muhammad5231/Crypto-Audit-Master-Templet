// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — PDF Export Service
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Generates structured JSON data that the frontend can use to
// render a print-ready PDF view. Since we can't use puppeteer
// in this environment, the frontend will use the browser's
// built-in print-to-PDF or a client-side library (like jsPDF
// or react-to-print) to generate the actual PDF.
//
// The structured data includes:
//   - Report metadata and workspace info
//   - All financial data pre-formatted for display
//   - Section ordering and layout hints
//   - Color/style hints for profit/loss indicators
//   - Disclaimer text
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { toD, formatINR, formatQty } from '@/lib/decimal'
import type { TaxedRealizedTrade, TaxSummary } from '@/lib/tax-engine'
import type { OpenHolding, FifoWarning } from '@/lib/fifo-engine'

// ── Type Definitions ───────────────────────────────────────

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
  // For table type
  headers?: string[]
  rows?: PdfTableRow[]
  // For key-value type
  pairs?: Array<{ key: string; value: string; isHighlight?: boolean; isProfit?: boolean; isLoss?: boolean }>
  // For text type
  content?: string
  // For formula-list type
  formulas?: Array<{ name: string; formula: string }>
}

/** Complete PDF report data */
export interface PdfReportData {
  // Metadata
  workspaceName: string
  financialYear: string
  generatedAt: string
  reportId: string
  disclaimer: string

  // Pre-formatted sections in order
  sections: PdfSection[]

  // Color/style configuration for the frontend
  styles: {
    profitColor: string   // e.g., "#16a34a" green
    lossColor: string     // e.g., "#dc2626" red
    accentColor: string   // e.g., "#14b8a6" teal
    headerBgColor: string // e.g., "#f1f5f9" light gray
  }
}

// ── Helper: Format a Decimal.js string as INR ──────────────

function fmtINR(val: string): string {
  return formatINR(toD(val))
}

/** Format a Decimal.js string as a quantity */
function fmtQ(val: string): string {
  return formatQty(toD(val))
}

/** Format date for PDF display */
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

/** Format date+time for PDF display */
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN FUNCTION: Generate PDF Report Data
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
  const netProfitInHand = toD(ts.totalGrossProfit).minus(toD(ts.totalFees)).minus(toD(ts.totalGstOnFees)).minus(toD(ts.totalTds))
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
          fmtINR(t.resolvedFinalNetProfit || t.finalNetProfit),
          t.resolvedProfitLossStatus || t.status,
        ],
        isProfit: (t.resolvedProfitLossStatus || t.status) === 'PROFIT',
        isLoss: (t.resolvedProfitLossStatus || t.status) === 'LOSS',
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
          w.pair,
          w.sellTradeId ? w.sellTradeId.slice(-8) : '',
          fmtDate(w.sellDate),
          fmtQ(w.unmatchedQty),
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
