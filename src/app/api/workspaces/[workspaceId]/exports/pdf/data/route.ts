// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — PDF Report Export API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/exports/pdf/data
//   Generates a professional PDF audit report and returns it
//   as a downloadable file. Uses pdfkit for server-side PDF
//   generation with embedded charts.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { errorResponse } from '@/lib/api-response'
import {
  generatePdfReport,
  getPdfReportFilename,
  generatePdfReportData,
  type WorkspaceForPdf,
  type CsvFileForPdf,
  type ExchangeSettingsForPdf,
} from '@/lib/pdf-export'
import type { TaxedRealizedTrade, TaxSummary } from '@/lib/tax-engine'
import type { OpenHolding, FifoWarning } from '@/lib/fifo-engine'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    const workspace = await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Check if JSON data is requested (backward compat) ──
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'pdf' // 'pdf' for file, 'json' for data

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
    const warnings: FifoWarning[] = JSON.parse(report.warnings || '[]')
    const taxSummary: TaxSummary = JSON.parse(report.taxSummary || '{}')

    // ── Fetch CSV files ──
    const csvFiles = await db.csvFile.findMany({
      where: { workspaceId },
      orderBy: { uploadedAt: 'desc' },
    })
    const csvFilesForPdf: CsvFileForPdf[] = csvFiles.map(f => ({
      originalName: f.originalName,
      totalRows: f.totalRows,
      validRows: f.validRows,
      skippedRows: f.skippedRows,
      uploadedAt: f.uploadedAt.toISOString(),
    }))

    // ── Fetch exchange settings ──
    const settings = await db.exchangeSettings.findFirst({
      where: { workspaceId },
    })
    const settingsForPdf: ExchangeSettingsForPdf = settings
      ? {
          defaultBuyFeePercent: settings.defaultBuyFeePercent,
          defaultSellFeePercent: settings.defaultSellFeePercent,
          defaultTdsPercent: settings.defaultTdsPercent,
          gstPercent: settings.gstPercent,
          cryptoTaxPercent: settings.cryptoTaxPercent,
          cessPercent: settings.cessPercent,
        }
      : {
          defaultBuyFeePercent: '0.1',
          defaultSellFeePercent: '0.1',
          defaultTdsPercent: '1.0',
          gstPercent: '18.0',
          cryptoTaxPercent: '30.0',
          cessPercent: '4.0',
        }

    const wsForPdf: WorkspaceForPdf = {
      id: workspace.id,
      name: workspace.name,
      financialYear: workspace.financialYear,
    }

    const reportInput = {
      reportId: report.id,
      generatedAt: report.generatedAt.toISOString(),
      realizedTrades,
      openHoldings,
      warnings,
      taxSummary,
    }

    // ── JSON format (backward compat) ──
    if (format === 'json') {
      const pdfData = generatePdfReportData(reportInput, wsForPdf, csvFilesForPdf, settingsForPdf)
      await db.exportHistory.create({
        data: {
          userId,
          workspaceId,
          exportType: 'PDF_DATA',
          filename: `CryptoAudit_${workspace.name}_PDF_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`,
          filePath: '',
          exportScope: 'pdf',
          status: 'generated',
        },
      })
      const { successResponse } = await import('@/lib/api-response')
      return successResponse(pdfData, 'PDF report data generated successfully')
    }

    // ── PDF file generation ──
    const filename = getPdfReportFilename(wsForPdf)
    const pdfBuffer = await generatePdfReport(reportInput, wsForPdf, csvFilesForPdf, settingsForPdf)

    // ── Save export history ──
    await db.exportHistory.create({
      data: {
        userId,
        workspaceId,
        exportType: 'PDF',
        filename,
        filePath: '',
        exportScope: 'full',
        status: 'generated',
      },
    })

    // ── Return PDF file as download ──
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[PDF EXPORT ERROR]', err)
    return errorResponse('Failed to generate PDF report', 500)
  }
}
