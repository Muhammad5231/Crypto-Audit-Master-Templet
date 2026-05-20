// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Single Exchange Config API (Update + Delete)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH  /api/workspaces/:workspaceId/settings/exchange-configs/:configId
// DELETE /api/workspaces/:workspaceId/settings/exchange-configs/:configId
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { toD } from '@/lib/decimal'

type RouteContext = { params: Promise<{ workspaceId: string; configId: string }> }

// ── Helper: verify config belongs to user's workspace ──
async function verifyConfigOwnership(configId: string, workspaceId: string, userId: string) {
  const config = await db.exchangeConfig.findFirst({
    where: { id: configId, workspaceId },
  })
  if (!config) {
    throw new Error('Exchange config not found')
  }
  if (config.userId !== userId) {
    throw new Error('You do not have access to this exchange config')
  }
  return config
}

// ── PATCH — Update an exchange config ──
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId, configId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)
    await verifyConfigOwnership(configId, workspaceId, userId)

    const body = await request.json()
    const { exchangeName, buyFeePercent, sellFeePercent } = body

    // ── Build update data ──
    const updateData: Record<string, unknown> = {}

    if (exchangeName !== undefined) {
      if (typeof exchangeName !== 'string' || exchangeName.trim() === '') {
        return errorResponse('Exchange name cannot be empty', 422)
      }
      // Check for duplicate name (excluding current config)
      const existing = await db.exchangeConfig.findFirst({
        where: { workspaceId, exchangeName: exchangeName.trim(), id: { not: configId } },
      })
      if (existing) {
        return errorResponse(`Exchange "${exchangeName.trim()}" already exists in this workspace`, 409)
      }
      updateData.exchangeName = exchangeName.trim()
    }

    if (buyFeePercent !== undefined) {
      if (isNaN(Number(buyFeePercent)) || Number(buyFeePercent) < 0) {
        return errorResponse('Buy Fee % must be a valid number >= 0', 422)
      }
      updateData.buyFeePercent = toD(buyFeePercent).toString()
    }

    if (sellFeePercent !== undefined) {
      if (isNaN(Number(sellFeePercent)) || Number(sellFeePercent) < 0) {
        return errorResponse('Sell Fee % must be a valid number >= 0', 422)
      }
      updateData.sellFeePercent = toD(sellFeePercent).toString()
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields provided to update', 422)
    }

    const updated = await db.exchangeConfig.update({
      where: { id: configId },
      data: updateData,
    })

    return successResponse(updated, 'Exchange settings updated successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCHANGE CONFIG PATCH ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── DELETE — Delete an exchange config ──
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId, configId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)
    await verifyConfigOwnership(configId, workspaceId, userId)

    await db.exchangeConfig.delete({
      where: { id: configId },
    })

    return successResponse(null, 'Exchange setting deleted successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCHANGE CONFIG DELETE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
