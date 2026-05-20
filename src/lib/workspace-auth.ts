// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Workspace Ownership Authorization
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ensures a workspace belongs to the authenticated user.
// Used in all workspace-scoped API routes to prevent cross-user access.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { db } from '@/lib/db'

/**
 * Verify that a workspace belongs to the authenticated user.
 *
 * @param workspaceId - The workspace ID to check
 * @param userId - The authenticated user's ID
 * @returns The workspace object if ownership is confirmed
 * @throws Error if workspace not found or does not belong to the user
 *
 * @example
 *   const workspace = await verifyWorkspaceOwnership(wsId, userId)
 *   // workspace is now a validated Prisma Workspace object
 */
export async function verifyWorkspaceOwnership(workspaceId: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
  })

  if (!workspace) {
    throw new Error('Workspace not found')
  }

  if (workspace.userId !== userId) {
    throw new Error('You do not have access to this workspace')
  }

  return workspace
}
