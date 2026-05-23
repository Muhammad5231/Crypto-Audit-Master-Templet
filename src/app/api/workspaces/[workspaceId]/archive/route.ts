// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Archive Workspace API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH /api/workspaces/:workspaceId/archive — Toggle archive status
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const body = await request.json()
    const { isArchived } = body

    // ── Validate isArchived is a boolean ──
    if (typeof isArchived !== 'boolean') {
      return errorResponse('isArchived must be a boolean value', 422)
    }

    const updatedWorkspace = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        isArchived,
        lastOpenedAt: new Date(),
      },
    })

    return successResponse(
      updatedWorkspace,
      isArchived ? 'Workspace archived successfully' : 'Workspace unarchived successfully'
    )
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[WORKSPACE ARCHIVE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
