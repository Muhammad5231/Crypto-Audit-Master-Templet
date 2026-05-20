// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Files List API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/workspaces/:workspaceId/uploads
//   Returns all CSV files for a workspace ordered by upload date desc.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Fetch all CSV files for workspace ──
    const csvFiles = await db.csvFile.findMany({
      where: { workspaceId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        _count: {
          select: { trades: true },
        },
      },
    })

    // ── Format response ──
    const formatted = csvFiles.map(file => ({
      id: file.id,
      originalName: file.originalName,
      storedName: file.storedName,
      fileHash: file.fileHash,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      totalRows: file.totalRows,
      validRows: file.validRows,
      skippedRows: file.skippedRows,
      skipReasons: JSON.parse(file.skipReasons || '[]'),
      exchangeName: file.exchangeName,
      buyFeePercent: file.buyFeePercent,
      sellFeePercent: file.sellFeePercent,
      mappingMode: file.mappingMode,
      tradeCount: file._count.trades,
      uploadedAt: file.uploadedAt,
      createdAt: file.createdAt,
    }))

    return successResponse(formatted)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[CSV FILES LIST ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
