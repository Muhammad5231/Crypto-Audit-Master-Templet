// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Workspaces API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces  — Create a new workspace
// GET  /api/workspaces  — List all workspaces for authenticated user
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'

// ── POST /api/workspaces — Create workspace ──
export async function POST(request: NextRequest) {
  try {
    const { userId } = authenticateRequest(request)
    const body = await request.json()
    const { name, description, color, icon, financialYear } = body

    // ── Validate required fields ──
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return errorResponse('Workspace name is required', 422)
    }

    // ── Create workspace ──
    const workspace = await db.workspace.create({
      data: {
        userId,
        name: name.trim(),
        description: description ? String(description).trim() : '',
        color: color ? String(color).trim() : '#14b8a6',
        icon: icon ? String(icon).trim() : 'briefcase',
        financialYear: financialYear ? String(financialYear).trim() : '2025-26',
      },
    })

    // ── If this is the user's first workspace, create default ExchangeSettings ──
    const workspaceCount = await db.workspace.count({
      where: { userId },
    })

    if (workspaceCount === 1) {
      await db.exchangeSettings.create({
        data: {
          userId,
          workspaceId: workspace.id,
        },
      })
    }

    return successResponse(workspace, 'Workspace created successfully', 201)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    console.error('[WORKSPACES POST ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── GET /api/workspaces — List all user workspaces ──
export async function GET(request: NextRequest) {
  try {
    const { userId } = authenticateRequest(request)

    // ── Fetch all workspaces ordered by lastOpenedAt desc ──
    const workspaces = await db.workspace.findMany({
      where: { userId },
      orderBy: { lastOpenedAt: 'desc' },
    })

    // ── Fetch stats for each workspace ──
    const workspacesWithStats = await Promise.all(
      workspaces.map(async (ws) => {
        const [tradeCount, csvFileCount, reportCount] = await Promise.all([
          db.trade.count({ where: { workspaceId: ws.id } }),
          db.csvFile.count({ where: { workspaceId: ws.id } }),
          db.report.count({ where: { workspaceId: ws.id } }),
        ])

        return {
          ...ws,
          stats: {
            tradeCount,
            csvFileCount,
            reportCount,
          },
        }
      })
    )

    return successResponse(workspacesWithStats)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    console.error('[WORKSPACES GET ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
