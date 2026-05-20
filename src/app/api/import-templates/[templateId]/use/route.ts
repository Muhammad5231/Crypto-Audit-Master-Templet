// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Mark Import Template As Used API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH /api/import-templates/:templateId/use — Update lastUsedAt to now
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ templateId: string }> }

// ── Helper: Parse JSON fields on a template record ──
function parseTemplateFields(template: Record<string, unknown>) {
  return {
    id: template.id,
    userId: template.userId,
    templateName: template.templateName,
    originalColumns: JSON.parse(String(template.originalColumns) || '[]'),
    mappingConfig: JSON.parse(String(template.mappingConfig) || '{}'),
    sideValueMap: JSON.parse(String(template.sideValueMap) || '{}'),
    dateFormat: template.dateFormat,
    exchangeName: template.exchangeName,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    lastUsedAt: template.lastUsedAt,
  }
}

// ── PATCH /api/import-templates/:templateId/use — Mark template as used ──
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { templateId } = await context.params

    // ── Verify template exists and belongs to user ──
    const template = await db.importTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return errorResponse('Import template not found', 404)
    }

    if (template.userId !== userId) {
      return errorResponse('You do not have access to this import template', 403)
    }

    // ── Update lastUsedAt ──
    const updatedTemplate = await db.importTemplate.update({
      where: { id: templateId },
      data: { lastUsedAt: new Date() },
    })

    return successResponse(parseTemplateFields(updatedTemplate as unknown as Record<string, unknown>), 'Template marked as used')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    console.error('[IMPORT TEMPLATE USE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
