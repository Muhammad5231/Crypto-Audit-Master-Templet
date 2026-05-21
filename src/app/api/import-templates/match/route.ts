// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Import Template Match API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/import-templates/match — Find a matching template for CSV headers
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

// ── POST /api/import-templates/match — Find matching template ──
export async function POST(request: NextRequest) {
  try {
    const { userId } = authenticateRequest(request)
    const body = await request.json()

    const { headers } = body

    // ── Validation ──
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return errorResponse('headers must be a non-empty array of column names', 422)
    }

    // ── Fetch all templates for user ──
    const templates = await db.importTemplate.findMany({
      where: { userId },
    })

    // ── No templates exist ──
    if (templates.length === 0) {
      return successResponse({
        matched: false,
        template: null,
        matchScore: 0,
      })
    }

    // ── Normalize headers for comparison ──
    const incomingSet = new Set(headers.map((h: string) => String(h).trim().toLowerCase()))

    let bestMatch: Record<string, unknown> | null = null
    let bestScore = 0

    for (const template of templates) {
      const templateColumns: string[] = JSON.parse(template.originalColumns || '[]')
      const templateSet = new Set(templateColumns.map(c => c.trim().toLowerCase()))

      // ── Calculate match score ──
      // How many of the incoming headers exist in the template
      let matchCount = 0
      for (const header of incomingSet) {
        if (templateSet.has(header)) {
          matchCount++
        }
      }

      // Score = intersection size / max(incoming size, template size)
      // This penalizes partial matches and ensures full coverage
      const maxColumns = Math.max(incomingSet.size, templateSet.size)
      const score = maxColumns > 0 ? matchCount / maxColumns : 0

      if (score > bestScore) {
        bestScore = score
        bestMatch = template as unknown as Record<string, unknown>
      }
    }

    // ── Determine if match is good enough ──
    // A perfect match means both sets are identical
    const isMatch = bestScore >= 1.0

    return successResponse({
      matched: isMatch,
      template: isMatch && bestMatch ? parseTemplateFields(bestMatch) : null,
      matchScore: bestScore,
    })
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    console.error('[IMPORT TEMPLATE MATCH ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
