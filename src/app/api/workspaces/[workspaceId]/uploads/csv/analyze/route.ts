// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Column Analysis API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/uploads/csv/analyze
//   Parses just the headers and first 5 rows of a CSV file.
//   Returns detected columns, sample rows, auto-suggested mappings,
//   unmapped columns, and required fields status.
//   Does NOT process or save trades yet.
//
// This is used for the Column Mapping UI feature, where users can
// review auto-detected mappings and adjust them before processing.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { analyzeCsvHeaders } from '@/lib/csv-parser'

type RouteContext = { params: Promise<{ workspaceId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // ── Authentication & Authorization ──
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Read file from form data ──
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('No file uploaded', 400)
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer())
    const content = buffer.toString('utf-8')

    if (!content || content.trim().length === 0) {
      return errorResponse('CSV file is empty', 422)
    }

    // ── Analyze headers and sample rows ──
    const analysis = analyzeCsvHeaders(content)

    return successResponse({
      fileName: file.name,
      headers: analysis.headers,
      sampleRows: analysis.sampleRows,
      detectedColumns: analysis.detectedColumns,
      unmappedColumns: analysis.unmappedColumns,
      requiredMapping: analysis.requiredMapping,
      totalRows: analysis.totalRows,
      // All available normalized fields for the mapping UI
      availableFields: ['TIME', 'CONTRACT', 'QTY', 'SIDE', 'PRICE', 'FEES', 'TDS', 'ORDER_VALUE'],
      // Required fields list for the mapping UI
      requiredFields: ['TIME', 'CONTRACT', 'QTY', 'SIDE', 'PRICE'],
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[CSV ANALYZE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
