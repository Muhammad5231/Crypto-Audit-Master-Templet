// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Report Processing API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/reports/process
//   Generates a complete audit report for the workspace:
//   1. Fetches all trades
//   2. Runs FIFO matching engine
//   3. Runs tax calculation engine
//   4. Saves report to database
//   5. Returns full report
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { generateReport } from '@/lib/report-builder'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Check if there are any trades to process ──
    const tradeCount = await db.trade.count({
      where: { workspaceId },
    })

    if (tradeCount === 0) {
      return errorResponse('No trades found in this workspace. Upload CSV files first.', 422)
    }

    // ── Generate the complete report ──
    const report = await generateReport(workspaceId, userId)

    // ── Get source CSV file IDs ──
    const csvFiles = await db.csvFile.findMany({
      where: { workspaceId },
      select: { id: true },
    })

    // ── Save report to database ──
    const savedReport = await db.report.create({
      data: {
        userId,
        workspaceId,
        sourceCsvFiles: JSON.stringify(csvFiles.map(f => f.id)),
        summary: JSON.stringify(report.summary),
        realizedTrades: JSON.stringify(report.realizedTrades),
        openHoldings: JSON.stringify(report.openHoldings),
        warnings: JSON.stringify(report.warnings),
        taxSummary: JSON.stringify(report.taxResult.summary),
      },
    })

    // ── Return the complete report ──
    return successResponse(
      {
        reportId: savedReport.id,
        generatedAt: savedReport.generatedAt,
        summary: report.summary,
        realizedTrades: report.realizedTrades,
        openHoldings: report.openHoldings,
        warnings: report.warnings,
        taxSummary: report.taxResult.summary,
      },
      `Report generated successfully. ${report.summary.totalRealizedTrades} realized trades, ${report.summary.totalOpenHoldings} open holdings, ${report.summary.totalWarnings} warnings.`,
      201,
    )
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[REPORT PROCESS ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
