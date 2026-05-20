// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Exchange Settings API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET   /api/workspaces/:workspaceId/settings/exchange — Get settings
// PATCH /api/workspaces/:workspaceId/settings/exchange — Update settings
//
// If no settings exist for a workspace, GET creates defaults.
// All percentage values stored as Decimal.js strings for precision.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { toD } from '@/lib/decimal'

type RouteContext = { params: Promise<{ workspaceId: string }> }

// ── GET — Get or create exchange settings ──
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Find existing settings or create defaults ──
    let settings = await db.exchangeSettings.findFirst({
      where: { workspaceId },
    })

    if (!settings) {
      settings = await db.exchangeSettings.create({
        data: {
          userId,
          workspaceId,
        },
      })
    }

    return successResponse(settings)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCHANGE SETTINGS GET ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── PATCH — Update exchange settings ──
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const body = await request.json()
    const {
      defaultBuyFeePercent,
      defaultSellFeePercent,
      defaultTdsPercent,
      gstPercent,
      cryptoTaxPercent,
      cessPercent,
    } = body

    // ── Ensure settings exist first ──
    let settings = await db.exchangeSettings.findFirst({
      where: { workspaceId },
    })

    if (!settings) {
      settings = await db.exchangeSettings.create({
        data: { userId, workspaceId },
      })
    }

    // ── Build update data with Decimal.js string conversion ──
    const updateData: Record<string, string> = {}

    if (defaultBuyFeePercent !== undefined) {
      updateData.defaultBuyFeePercent = toD(defaultBuyFeePercent).toString()
    }
    if (defaultSellFeePercent !== undefined) {
      updateData.defaultSellFeePercent = toD(defaultSellFeePercent).toString()
    }
    if (defaultTdsPercent !== undefined) {
      updateData.defaultTdsPercent = toD(defaultTdsPercent).toString()
    }
    if (gstPercent !== undefined) {
      updateData.gstPercent = toD(gstPercent).toString()
    }
    if (cryptoTaxPercent !== undefined) {
      updateData.cryptoTaxPercent = toD(cryptoTaxPercent).toString()
    }
    if (cessPercent !== undefined) {
      updateData.cessPercent = toD(cessPercent).toString()
    }

    // ── Update only if there are fields to update ──
    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields provided to update', 422)
    }

    const updatedSettings = await db.exchangeSettings.update({
      where: { id: settings.id },
      data: updateData,
    })

    return successResponse(updatedSettings, 'Exchange settings updated successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCHANGE SETTINGS PATCH ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
