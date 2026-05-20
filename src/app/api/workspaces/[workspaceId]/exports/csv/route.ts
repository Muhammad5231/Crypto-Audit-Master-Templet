// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Export API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/exports/csv?scope=<scope>
//   Generates a CSV file export for the given scope and returns
//   it as a downloadable file.
//
// Available scopes:
//   - realized-trades
//   - open-holdings
//   - tax-summary
//   - pair-summary
//   - monthly-summary
//   - upload-history
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { errorResponse } from '@/lib/api-response'
import { toD, formatINR } from '@/lib/decimal'
import type { TaxedRealizedTrade, TaxSummary } from '@/lib/tax-engine'
import type { OpenHolding } from '@/lib/fifo-engine'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    const workspace = await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Parse scope from query params ──
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'realized-trades'

    // ── Fetch the latest report ──
    const report = await db.report.findFirst({
      where: { workspaceId },
      orderBy: { generatedAt: 'desc' },
    })

    if (!report) {
      return errorResponse('No reports found for this workspace. Process trades first.', 404)
    }

    // ── Parse report data ──
    const realizedTrades: TaxedRealizedTrade[] = JSON.parse(report.realizedTrades || '[]')
    const openHoldings: OpenHolding[] = JSON.parse(report.openHoldings || '[]')
    const taxSummary: TaxSummary = JSON.parse(report.taxSummary || '{}')

    let csvContent: string
    let filename: string

    switch (scope) {
      case 'realized-trades':
        csvContent = generateRealizedTradesCsv(realizedTrades)
        filename = `CryptoAudit_${workspace.name}_RealizedTrades_${getDateStamp()}.csv`
        break

      case 'open-holdings':
        csvContent = generateOpenHoldingsCsv(openHoldings)
        filename = `CryptoAudit_${workspace.name}_OpenHoldings_${getDateStamp()}.csv`
        break

      case 'tax-summary':
        csvContent = generateTaxSummaryCsv(taxSummary)
        filename = `CryptoAudit_${workspace.name}_TaxSummary_${getDateStamp()}.csv`
        break

      case 'pair-summary':
        csvContent = generatePairSummaryCsv(realizedTrades)
        filename = `CryptoAudit_${workspace.name}_PairSummary_${getDateStamp()}.csv`
        break

      case 'monthly-summary':
        csvContent = generateMonthlySummaryCsv(realizedTrades)
        filename = `CryptoAudit_${workspace.name}_MonthlySummary_${getDateStamp()}.csv`
        break

      case 'upload-history': {
        const csvFiles = await db.csvFile.findMany({
          where: { workspaceId },
          orderBy: { uploadedAt: 'desc' },
        })
        csvContent = generateUploadLogCsv(csvFiles)
        filename = `CryptoAudit_${workspace.name}_UploadLog_${getDateStamp()}.csv`
        break
      }

      default:
        return errorResponse(`Unknown CSV export scope: ${scope}`, 400)
    }

    // ── Save export history ──
    await db.exportHistory.create({
      data: {
        userId,
        workspaceId,
        exportType: 'CSV',
        filename,
        filePath: '',
        exportScope: scope,
        status: 'generated',
      },
    })

    // ── Return CSV file as download ──
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(csvContent, 'utf-8')),
      },
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[CSV EXPORT ERROR]', err)
    return errorResponse('Failed to generate CSV export', 500)
  }
}

// ── Helper: Date stamp for filename ──────────────────────────

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

// ── Helper: CSV escape ──────────────────────────────────────

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ── Helper: CSV row ─────────────────────────────────────────

function csvRow(...fields: (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(',')
}

// ── Helper: Format date for CSV ─────────────────────────────

function fmtDate(d: string | Date): string {
  if (!d) return ''
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
}

// ── Generate Realized Trades CSV ─────────────────────────────

function generateRealizedTradesCsv(trades: TaxedRealizedTrade[]): string {
  const header = csvRow(
    '#', 'Pair', 'Buy Date', 'Sell Date', 'Matched Qty',
    'Buy Price (INR)', 'Sell Price (INR)', 'Buy Value (INR)', 'Sell Value (INR)',
    'Gross Profit (INR)', 'Buy Fee (INR)', 'Sell Fee (INR)', 'Total Fees (INR)',
    'GST on Fees (INR)', 'TDS (INR)', 'Base Crypto Tax (INR)', 'Cess (INR)',
    'Total Direct Tax (INR)', 'Net Profit in Hand (INR)', 'Final Net Profit (INR)',
    'Status'
  )

  const rows = trades.map((t, i) => csvRow(
    i + 1,
    t.pair,
    fmtDate(t.buyDate),
    fmtDate(t.sellDate),
    toD(t.matchedQty).toNumber(),
    toD(t.buyPrice).toNumber(),
    toD(t.sellPrice).toNumber(),
    toD(t.buyValue).toNumber(),
    toD(t.sellValue).toNumber(),
    toD(t.grossProfit).toNumber(),
    toD(t.allocatedBuyFee).toNumber(),
    toD(t.allocatedSellFee).toNumber(),
    toD(t.totalFees).toNumber(),
    toD(t.gstOnFees).toNumber(),
    toD(t.tds).toNumber(),
    toD(t.baseCryptoTax).toNumber(),
    toD(t.cess).toNumber(),
    toD(t.totalDirectTax).toNumber(),
    toD(t.netProfitInHand).toNumber(),
    toD(t.finalNetProfit).toNumber(),
    t.status
  ))

  return [header, ...rows].join('\n')
}

// ── Generate Open Holdings CSV ───────────────────────────────

function generateOpenHoldingsCsv(holdings: OpenHolding[]): string {
  const header = csvRow(
    '#', 'Pair', 'Buy Date', 'Original Qty', 'Remaining Qty',
    'Buy Price (INR)', 'Cost Basis (INR)', 'Allocated Buy Fee (INR)', 'Status'
  )

  const rows = holdings.map((h, i) => csvRow(
    i + 1,
    h.pair,
    fmtDate(h.buyDate),
    toD(h.originalQty).toNumber(),
    toD(h.remainingQty).toNumber(),
    toD(h.buyPrice).toNumber(),
    toD(h.remainingCostBasis).toNumber(),
    toD(h.remainingAllocatedBuyFee).toNumber(),
    h.status === 'Fully Unmatched Buy Lot' ? 'Fully Unmatched' : 'Partially Matched'
  ))

  return [header, ...rows].join('\n')
}

// ── Generate Tax Summary CSV ─────────────────────────────────

function generateTaxSummaryCsv(ts: TaxSummary): string {
  const baseCryptoTax = toD(ts.totalDirectTax).minus(toD(ts.totalCess))

  const rows = [
    csvRow('Total Trades', ts.totalTrades),
    csvRow('Profitable Trades', ts.profitableTrades),
    csvRow('Loss Trades', ts.lossTrades),
    csvRow(''),
    csvRow('Total Buy Value (INR)', toD(ts.totalBuyValue).toNumber()),
    csvRow('Total Sell Value (INR)', toD(ts.totalSellValue).toNumber()),
    csvRow('Total Gross Profit (INR)', toD(ts.totalGrossProfit).toNumber()),
    csvRow('Total Gross Loss (INR)', toD(ts.totalGrossLoss).toNumber()),
    csvRow(''),
    csvRow('Total Fees (INR)', toD(ts.totalFees).toNumber()),
    csvRow('Total GST on Fees (INR)', toD(ts.totalGstOnFees).toNumber()),
    csvRow('Total TDS (INR)', toD(ts.totalTds).toNumber()),
    csvRow(''),
    csvRow('Base Crypto Tax @30% (INR)', baseCryptoTax.toNumber()),
    csvRow('Cess @4% (INR)', toD(ts.totalCess).toNumber()),
    csvRow('Total Direct Tax (INR)', toD(ts.totalDirectTax).toNumber()),
    csvRow(''),
    csvRow('Total Net Profit (INR)', toD(ts.totalNetProfit).toNumber()),
    csvRow('Effective Tax Rate (%)', toD(ts.effectiveTaxRate).toNumber()),
    csvRow('Avg Profit Per Trade (INR)', toD(ts.avgProfitPerTrade).toNumber()),
    csvRow('Avg Loss Per Trade (INR)', toD(ts.avgLossPerTrade).toNumber()),
  ]

  return [csvRow('Tax Item', 'Value'), ...rows].join('\n')
}

// ── Generate Pair-wise Summary CSV ───────────────────────────

function generatePairSummaryCsv(trades: TaxedRealizedTrade[]): string {
  const pairPerf = new Map<string, {
    grossProfit: number; netProfit: number; directTax: number;
    fees: number; trades: number; profitTrades: number; lossTrades: number;
  }>()

  for (const t of trades) {
    const pair = t.pair
    const existing = pairPerf.get(pair) || {
      grossProfit: 0, netProfit: 0, directTax: 0, fees: 0,
      trades: 0, profitTrades: 0, lossTrades: 0,
    }
    existing.grossProfit += toD(t.grossProfit).toNumber()
    existing.netProfit += toD(t.finalNetProfit).toNumber()
    existing.directTax += toD(t.totalDirectTax).toNumber()
    existing.fees += toD(t.totalFees).toNumber()
    existing.trades += 1
    if (t.status === 'PROFIT') existing.profitTrades += 1
    else existing.lossTrades += 1
    pairPerf.set(pair, existing)
  }

  const header = csvRow(
    'Pair', 'Total Trades', 'Profit Trades', 'Loss Trades',
    'Gross Profit (INR)', 'Total Fees (INR)', 'Direct Tax (INR)',
    'Net Profit (INR)', 'Avg Net Profit (INR)'
  )

  const rows = Array.from(pairPerf.entries())
    .sort(([, a], [, b]) => b.netProfit - a.netProfit)
    .map(([pair, d]) => csvRow(
      pair, d.trades, d.profitTrades, d.lossTrades,
      d.grossProfit, d.fees, d.directTax, d.netProfit,
      d.trades > 0 ? (d.netProfit / d.trades) : 0
    ))

  return [header, ...rows].join('\n')
}

// ── Generate Monthly Summary CSV ─────────────────────────────

function generateMonthlySummaryCsv(trades: TaxedRealizedTrade[]): string {
  const monthPerf = new Map<string, {
    grossProfit: number; netProfit: number; directTax: number;
    fees: number; trades: number;
  }>()

  for (const t of trades) {
    const sellDate = new Date(t.sellDate)
    const monthKey = `${sellDate.getFullYear()}-${String(sellDate.getMonth() + 1).padStart(2, '0')}`
    const existing = monthPerf.get(monthKey) || {
      grossProfit: 0, netProfit: 0, directTax: 0, fees: 0, trades: 0,
    }
    existing.grossProfit += toD(t.grossProfit).toNumber()
    existing.netProfit += toD(t.finalNetProfit).toNumber()
    existing.directTax += toD(t.totalDirectTax).toNumber()
    existing.fees += toD(t.totalFees).toNumber()
    existing.trades += 1
    monthPerf.set(monthKey, existing)
  }

  const header = csvRow(
    'Month', 'Trades', 'Gross Profit (INR)', 'Fees (INR)',
    'Direct Tax (INR)', 'Net Profit (INR)'
  )

  const rows = Array.from(monthPerf.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => csvRow(month, d.trades, d.grossProfit, d.fees, d.directTax, d.netProfit))

  return [header, ...rows].join('\n')
}

// ── Generate Upload Log CSV ──────────────────────────────────

function generateUploadLogCsv(csvFiles: Array<{ originalName: string; totalRows: number; validRows: number; skippedRows: number; uploadedAt: Date }>): string {
  const header = csvRow('#', 'File Name', 'Total Rows', 'Valid Rows', 'Skipped Rows', 'Uploaded At')

  const rows = csvFiles.map((f, i) => csvRow(
    i + 1,
    f.originalName,
    f.totalRows,
    f.validRows,
    f.skippedRows,
    f.uploadedAt ? new Date(f.uploadedAt).toLocaleString('en-IN') : ''
  ))

  return [header, ...rows].join('\n')
}
