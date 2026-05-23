// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Duplicate Workspace API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/duplicate — Duplicate workspace
// Creates a copy of the workspace with " (Copy)" suffix.
// Copies ExchangeSettings but NOT trades, CSVs, or reports.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    const workspace = await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Create duplicated workspace with "(Copy)" suffix ──
    const newWorkspace = await db.workspace.create({
      data: {
        userId,
        name: `${workspace.name} (Copy)`,
        description: workspace.description,
        color: workspace.color,
        icon: workspace.icon,
        financialYear: workspace.financialYear,
        isArchived: false,
      },
    })

    // ── Copy ExchangeSettings if they exist ──
    const existingSettings = await db.exchangeSettings.findFirst({
      where: { workspaceId },
    })

    if (existingSettings) {
      await db.exchangeSettings.create({
        data: {
          userId,
          workspaceId: newWorkspace.id,
          defaultBuyFeePercent: existingSettings.defaultBuyFeePercent,
          defaultSellFeePercent: existingSettings.defaultSellFeePercent,
          defaultTdsPercent: existingSettings.defaultTdsPercent,
          gstPercent: existingSettings.gstPercent,
          cryptoTaxPercent: existingSettings.cryptoTaxPercent,
          cessPercent: existingSettings.cessPercent,
        },
      })
    }

    // ── Note: Trades, CSVs, and reports are NOT copied ──

    return successResponse(newWorkspace, 'Workspace duplicated successfully', 201)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[WORKSPACE DUPLICATE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
