// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV File DELETE API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELETE /api/workspaces/:workspaceId/uploads/:csvFileId
//   Deletes a CSV file record, all related trades, and the physical file.
//
// Flow:
//   1. Auth + workspace ownership check
//   2. Find CsvFile by ID, workspaceId, and userId
//   3. Delete all related Trade records
//   4. Delete the CsvFile record
//   5. Remove physical file from disk
//   6. Return success response
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import * as fs from 'fs'
import * as path from 'path'

type RouteContext = { params: Promise<{ workspaceId: string; csvFileId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // ── Step 1: Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId, csvFileId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Step 2: Find the CsvFile record ──
    const csvFile = await db.csvFile.findFirst({
      where: {
        id: csvFileId,
        workspaceId,
        userId,
      },
    })

    if (!csvFile) {
      return errorResponse('CSV file not found', 404)
    }

    // ── Step 3: Delete all related Trade records ──
    await db.trade.deleteMany({
      where: { csvFileId },
    })

    // ── Step 4: Delete the CsvFile record ──
    await db.csvFile.delete({
      where: { id: csvFileId },
    })

    // ── Step 5: Remove physical file from disk ──
    try {
      const filePath = path.join(process.cwd(), 'upload', csvFile.storedName)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (diskError) {
      console.error('[CSV DISK DELETE WARNING]', diskError)
      // Non-critical: failure to delete from disk shouldn't fail the request
    }

    // ── Step 6: Return success response ──
    return successResponse(null, 'CSV file deleted successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[CSV DELETE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
