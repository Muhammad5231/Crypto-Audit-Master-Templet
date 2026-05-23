// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Single Import Template API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET    /api/import-templates/:templateId  — Get a single template
// PATCH  /api/import-templates/:templateId  — Update a template
// DELETE /api/import-templates/:templateId  — Delete a template
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

// ── Helper: Verify template belongs to user ──
async function verifyTemplateOwnership(templateId: string, userId: string) {
  const template = await db.importTemplate.findUnique({
    where: { id: templateId },
  })

  if (!template) {
    throw new Error('Import template not found')
  }

  if (template.userId !== userId) {
    throw new Error('You do not have access to this import template')
  }

  return template
}

// ── GET /api/import-templates/:templateId — Get single template ──
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { templateId } = await context.params
    const template = await verifyTemplateOwnership(templateId, userId)

    return successResponse(parseTemplateFields(template as unknown as Record<string, unknown>))
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[IMPORT TEMPLATE GET ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── PATCH /api/import-templates/:templateId — Update template ──
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { templateId } = await context.params
    await verifyTemplateOwnership(templateId, userId)

    const body = await request.json()
    const { templateName, originalColumns, mappingConfig, sideValueMap, dateFormat, exchangeName } = body

    // ── Validate templateName if provided ──
    if (templateName !== undefined && (typeof templateName !== 'string' || templateName.trim() === '')) {
      return errorResponse('Template name cannot be empty', 422)
    }

    // ── Validate originalColumns if provided ──
    if (originalColumns !== undefined && !Array.isArray(originalColumns)) {
      return errorResponse('originalColumns must be an array', 422)
    }

    // ── Validate mappingConfig if provided ──
    if (mappingConfig !== undefined && (typeof mappingConfig !== 'object' || Array.isArray(mappingConfig))) {
      return errorResponse('mappingConfig must be a valid object', 422)
    }

    // ── Build update data (only include provided fields) ──
    const updateData: Record<string, unknown> = {
      lastUsedAt: new Date(), // Update lastUsedAt on any edit
    }

    if (templateName !== undefined) updateData.templateName = templateName.trim()
    if (originalColumns !== undefined) updateData.originalColumns = JSON.stringify(originalColumns)
    if (mappingConfig !== undefined) updateData.mappingConfig = JSON.stringify(mappingConfig)
    if (sideValueMap !== undefined) updateData.sideValueMap = JSON.stringify(sideValueMap)
    if (dateFormat !== undefined) updateData.dateFormat = String(dateFormat)
    if (exchangeName !== undefined) updateData.exchangeName = String(exchangeName)

    const updatedTemplate = await db.importTemplate.update({
      where: { id: templateId },
      data: updateData,
    })

    return successResponse(parseTemplateFields(updatedTemplate as unknown as Record<string, unknown>), 'Import template updated successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[IMPORT TEMPLATE PATCH ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── DELETE /api/import-templates/:templateId — Delete template ──
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { templateId } = await context.params
    await verifyTemplateOwnership(templateId, userId)

    await db.importTemplate.delete({
      where: { id: templateId },
    })

    return successResponse(null, 'Import template deleted successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[IMPORT TEMPLATE DELETE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
