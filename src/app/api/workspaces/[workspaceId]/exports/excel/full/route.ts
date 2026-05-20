// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Full Excel Workbook Export API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/exports/excel/full
//   Generates a 13-sheet Excel workbook with the complete audit
//   report and returns it as a downloadable file.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { errorResponse } from '@/lib/api-response'
import {
  generateFullExcelWorkbook,
  getFullWorkbookFilename,
  type ReportDataForExport,
  type WorkspaceForExport,
  type CsvFileForExport,
  type ExchangeSettingsForExport,
} from '@/lib/excel-export'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    const workspace = await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Fetch the latest report ──
    const report = await db.report.findFirst({
      where: { workspaceId },
      orderBy: { generatedAt: 'desc' },
    })

    if (!report) {
      return errorResponse('No reports found for this workspace. Process trades first.', 404)
    }

    // ── Parse report data ──
    const parsedSummary = JSON.parse(report.summary || '{}')
    const parsedRealizedTrades = JSON.parse(report.realizedTrades || '[]')
    const parsedOpenHoldings = JSON.parse(report.openHoldings || '[]')
    const parsedWarnings = JSON.parse(report.warnings || '[]')
    const parsedTaxSummary = JSON.parse(report.taxSummary || '{}')

    const reportData: ReportDataForExport = {
      reportId: report.id,
      generatedAt: report.generatedAt.toISOString(),
      sourceCsvFiles: JSON.parse(report.sourceCsvFiles || '[]'),
      summary: {
        ...parsedSummary,
        taxSummary: parsedTaxSummary,
      },
      realizedTrades: parsedRealizedTrades,
      openHoldings: parsedOpenHoldings,
      warnings: parsedWarnings,
      taxSummary: parsedTaxSummary,
    }

    // ── Fetch CSV files for upload log sheet ──
    const csvFiles = await db.csvFile.findMany({
      where: { workspaceId },
      orderBy: { uploadedAt: 'desc' },
    })
    const csvFilesForExport: CsvFileForExport[] = csvFiles.map(f => ({
      id: f.id,
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
    const settingsForExport: ExchangeSettingsForExport = settings
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

    // ── Fetch notes ──
    const notes = await db.note.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    })

    const wsForExport: WorkspaceForExport = {
      id: workspace.id,
      name: workspace.name,
      financialYear: workspace.financialYear,
    }

    // ── Generate the Excel workbook ──
    const buffer = generateFullExcelWorkbook(
      reportData,
      wsForExport,
      csvFilesForExport,
      settingsForExport,
      notes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        updatedAt: n.updatedAt.toISOString(),
      })),
    )

    // ── Generate filename ──
    const filename = getFullWorkbookFilename(wsForExport)

    // ── Save export history ──
    await db.exportHistory.create({
      data: {
        userId,
        workspaceId,
        exportType: 'EXCEL_FULL',
        filename,
        filePath: '', // In-memory, no file path
        exportScope: 'full',
        status: 'generated',
      },
    })

    // ── Return Excel file as download ──
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCEL FULL EXPORT ERROR]', err)
    return errorResponse('Failed to generate Excel workbook', 500)
  }
}
