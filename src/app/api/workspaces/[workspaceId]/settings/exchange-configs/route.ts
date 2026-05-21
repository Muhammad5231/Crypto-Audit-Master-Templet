// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Exchange Config API (List + Create)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET  /api/workspaces/:workspaceId/settings/exchange-configs — List all
// POST /api/workspaces/:workspaceId/settings/exchange-configs — Create new
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { toD } from '@/lib/decimal'

type RouteContext = { params: Promise<{ workspaceId: string }> }

// ── GET — List all exchange configs for a workspace ──
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const configs = await db.exchangeConfig.findMany({
      where: { workspaceId },
      orderBy: { lastUsedAt: 'desc' },
    })

    return successResponse(configs)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCHANGE CONFIG LIST ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── POST — Create a new exchange config ──
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const body = await request.json()
    const { exchangeName, buyFeePercent, sellFeePercent, source } = body

    // ── Validate required fields ──
    if (!exchangeName || typeof exchangeName !== 'string' || exchangeName.trim() === '') {
      return errorResponse('Exchange name is required', 422)
    }

    if (buyFeePercent === undefined || buyFeePercent === null || isNaN(Number(buyFeePercent)) || Number(buyFeePercent) < 0) {
      return errorResponse('Buy Fee % must be a valid number >= 0', 422)
    }

    if (sellFeePercent === undefined || sellFeePercent === null || isNaN(Number(sellFeePercent)) || Number(sellFeePercent) < 0) {
      return errorResponse('Sell Fee % must be a valid number >= 0', 422)
    }

    // ── Check for duplicate exchange name in this workspace ──
    const existing = await db.exchangeConfig.findFirst({
      where: { workspaceId, exchangeName: exchangeName.trim() },
    })

    if (existing) {
      return errorResponse(`Exchange "${exchangeName.trim()}" already exists in this workspace`, 409)
    }

    // ── Create the exchange config ──
    const config = await db.exchangeConfig.create({
      data: {
        userId,
        workspaceId,
        exchangeName: exchangeName.trim(),
        buyFeePercent: toD(buyFeePercent).toString(),
        sellFeePercent: toD(sellFeePercent).toString(),
        source: source === 'csv-upload' ? 'csv-upload' : 'manual',
      },
    })

    return successResponse(config, 'Exchange settings saved successfully', 201)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXCHANGE CONFIG CREATE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
