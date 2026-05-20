// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Single Workspace API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET    /api/workspaces/:workspaceId  — Get one workspace with stats
// PATCH  /api/workspaces/:workspaceId  — Update workspace
// DELETE /api/workspaces/:workspaceId  — Delete workspace
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string }> }

// ── GET /api/workspaces/:workspaceId — Get one workspace with stats ──
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    const workspace = await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Fetch workspace stats ──
    const [tradeCount, csvFileCount, reportCount, exportCount, noteCount] = await Promise.all([
      db.trade.count({ where: { workspaceId } }),
      db.csvFile.count({ where: { workspaceId } }),
      db.report.count({ where: { workspaceId } }),
      db.exportHistory.count({ where: { workspaceId } }),
      db.note.count({ where: { workspaceId } }),
    ])

    return successResponse({
      ...workspace,
      stats: { tradeCount, csvFileCount, reportCount, exportCount, noteCount },
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[WORKSPACE GET ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── PATCH /api/workspaces/:workspaceId — Update workspace ──
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const body = await request.json()
    const { name, description, color, icon, financialYear, isArchived } = body

    // ── Build update data (only include provided fields) ──
    const updateData: Record<string, unknown> = {
      lastOpenedAt: new Date(), // Update lastOpenedAt on any edit
    }

    if (name !== undefined) updateData.name = String(name).trim()
    if (description !== undefined) updateData.description = String(description).trim()
    if (color !== undefined) updateData.color = String(color).trim()
    if (icon !== undefined) updateData.icon = String(icon).trim()
    if (financialYear !== undefined) updateData.financialYear = String(financialYear).trim()
    if (isArchived !== undefined) updateData.isArchived = Boolean(isArchived)

    // ── Validate name if provided ──
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return errorResponse('Workspace name cannot be empty', 422)
    }

    const updatedWorkspace = await db.workspace.update({
      where: { id: workspaceId },
      data: updateData,
    })

    return successResponse(updatedWorkspace, 'Workspace updated successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[WORKSPACE PATCH ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── DELETE /api/workspaces/:workspaceId — Delete workspace ──
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Delete workspace (cascade handles related data) ──
    await db.workspace.delete({
      where: { id: workspaceId },
    })

    return successResponse(null, 'Workspace deleted successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[WORKSPACE DELETE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
