// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Realized Trades Excel Export API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/exports/excel/realized-trades
//   Generates a single-sheet Excel with just realized trades
//   and returns it as a downloadable file.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { errorResponse } from '@/lib/api-response'
import {
  generateRealizedTradesExcel,
  getRealizedTradesFilename,
  type WorkspaceForExport,
} from '@/lib/excel-export'
import type { TaxedRealizedTrade } from '@/lib/tax-engine'

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

    // ── Parse realized trades from report ──
    const realizedTrades: TaxedRealizedTrade[] = JSON.parse(report.realizedTrades || '[]')

    if (realizedTrades.length === 0) {
      return errorResponse('No realized trades found in the latest report.', 404)
    }

    const wsForExport: WorkspaceForExport = {
      id: workspace.id,
      name: workspace.name,
      financialYear: workspace.financialYear,
    }

    // ── Generate the Excel workbook ──
    const buffer = await generateRealizedTradesExcel(realizedTrades, wsForExport)

    // ── Generate filename ──
    const filename = getRealizedTradesFilename(wsForExport)

    // ── Save export history ──
    await db.exportHistory.create({
      data: {
        userId,
        workspaceId,
        exportType: 'EXCEL_REALIZED_TRADES',
        filename,
        filePath: '',
        exportScope: 'realized-trades',
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
    console.error('[EXCEL REALIZED TRADES EXPORT ERROR]', err)
    return errorResponse('Failed to generate realized trades Excel', 500)
  }
}
