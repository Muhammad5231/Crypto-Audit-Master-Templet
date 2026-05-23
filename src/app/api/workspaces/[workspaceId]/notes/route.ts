// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Notes API (List & Create)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/workspaces/:workspaceId/notes — Create a note
// GET  /api/workspaces/:workspaceId/notes — List all notes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string }> }

// ── POST — Create a note ──
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const body = await request.json()
    const { title, content, isPinned } = body

    // ── Validate required fields ──
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return errorResponse('Note title is required', 422)
    }

    const note = await db.note.create({
      data: {
        userId,
        workspaceId,
        title: title.trim(),
        content: content ? String(content) : '',
        isPinned: typeof isPinned === 'boolean' ? isPinned : false,
      },
    })

    return successResponse(note, 'Note created successfully', 201)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[NOTES POST ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── GET — List all notes for workspace ──
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    const notes = await db.note.findMany({
      where: { workspaceId, userId },
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' },
      ],
    })

    return successResponse(notes)
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[NOTES GET ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
