// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Import Templates List & Create API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET  /api/import-templates  — List all templates for authenticated user
// POST /api/import-templates  — Create a new import template
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'

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

// ── GET /api/import-templates — List all templates for user ──
export async function GET(request: NextRequest) {
  try {
    const { userId } = authenticateRequest(request)

    const templates = await db.importTemplate.findMany({
      where: { userId },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    })

    const formatted = templates.map(t => parseTemplateFields(t as unknown as Record<string, unknown>))

    return successResponse(formatted)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    console.error('[IMPORT TEMPLATES LIST ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── POST /api/import-templates — Create a new import template ──
export async function POST(request: NextRequest) {
  try {
    const { userId } = authenticateRequest(request)
    const body = await request.json()

    const { templateName, originalColumns, mappingConfig, sideValueMap, dateFormat, exchangeName } = body

    // ── Validation ──
    if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
      return errorResponse('Template name is required', 422)
    }

    if (!originalColumns || !Array.isArray(originalColumns)) {
      return errorResponse('originalColumns must be a non-empty array', 422)
    }

    if (!mappingConfig || typeof mappingConfig !== 'object' || Array.isArray(mappingConfig)) {
      return errorResponse('mappingConfig must be a valid object', 422)
    }

    // ── Create template ──
    const template = await db.importTemplate.create({
      data: {
        userId,
        templateName: templateName.trim(),
        originalColumns: JSON.stringify(originalColumns),
        mappingConfig: JSON.stringify(mappingConfig),
        sideValueMap: JSON.stringify(sideValueMap || {}),
        dateFormat: dateFormat || '',
        exchangeName: exchangeName || '',
      },
    })

    return successResponse(parseTemplateFields(template as unknown as Record<string, unknown>), 'Import template created successfully', 201)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    console.error('[IMPORT TEMPLATE CREATE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
