// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Export Download / Details API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/workspaces/:workspaceId/exports/:exportId
//   Returns export history record details.
//   Since exports are generated in-memory and not stored to disk,
//   this endpoint returns the metadata. For re-downloading, the
//   user should regenerate the export via the appropriate POST
//   endpoint (excel/full, realized-trades, etc.).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string; exportId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId, exportId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Fetch the export record ──
    const exportRecord = await db.exportHistory.findFirst({
      where: {
        id: exportId,
        workspaceId,
        userId,
      },
    })

    if (!exportRecord) {
      return errorResponse('Export record not found', 404)
    }

    // ── Return export metadata ──
    // Note: Files are generated in-memory, so there's no stored file to download.
    // To re-download, use the appropriate POST endpoint.
    return successResponse({
      id: exportRecord.id,
      exportType: exportRecord.exportType,
      filename: exportRecord.filename,
      exportScope: exportRecord.exportScope,
      status: exportRecord.status,
      generatedAt: exportRecord.generatedAt.toISOString(),
      createdAt: exportRecord.createdAt.toISOString(),
      note: 'Exports are generated on-demand. To re-download, use the appropriate POST export endpoint.',
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[EXPORT DETAILS ERROR]', err)
    return errorResponse('Failed to fetch export details', 500)
  }
}
