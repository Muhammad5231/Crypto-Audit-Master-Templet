// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Single Note API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH  /api/workspaces/:workspaceId/notes/:noteId — Update note
// DELETE /api/workspaces/:workspaceId/notes/:noteId — Delete note
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { verifyWorkspaceOwnership } from '@/lib/workspace-auth'
import { successResponse, errorResponse } from '@/lib/api-response'

type RouteContext = { params: Promise<{ workspaceId: string; noteId: string }> }

// ── PATCH — Update a note ──
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId, noteId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Verify note belongs to this workspace and user ──
    const existingNote = await db.note.findFirst({
      where: { id: noteId, workspaceId, userId },
    })

    if (!existingNote) {
      return errorResponse('Note not found', 404)
    }

    const body = await request.json()
    const { title, content } = body

    // ── Validate title if provided ──
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return errorResponse('Note title cannot be empty', 422)
    }

    // ── Build update data ──
    const updateData: Record<string, string> = {}
    if (title !== undefined) updateData.title = String(title).trim()
    if (content !== undefined) updateData.content = String(content)

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields provided to update', 422)
    }

    const updatedNote = await db.note.update({
      where: { id: noteId },
      data: updateData,
    })

    return successResponse(updatedNote, 'Note updated successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[NOTE PATCH ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}

// ── DELETE — Delete a note ──
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = authenticateRequest(request)
    const { workspaceId, noteId } = await context.params
    await verifyWorkspaceOwnership(workspaceId, userId)

    // ── Verify note belongs to this workspace and user ──
    const existingNote = await db.note.findFirst({
      where: { id: noteId, workspaceId, userId },
    })

    if (!existingNote) {
      return errorResponse('Note not found', 404)
    }

    await db.note.delete({
      where: { id: noteId },
    })

    return successResponse(null, 'Note deleted successfully')
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Authorization') || err.message.includes('token'))) {
      return errorResponse(err.message, 401)
    }
    if (err instanceof Error && (err.message.includes('Workspace not found') || err.message.includes('access'))) {
      return errorResponse(err.message, 403)
    }
    console.error('[NOTE DELETE ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
