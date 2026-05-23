// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Current User API Route
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/auth/me
// Returns the authenticated user's profile.
// Requires a valid Bearer token in the Authorization header.
// Used by the frontend to validate tokens and get user info.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    // ── Authenticate the request ──
    const { userId } = authenticateRequest(request)

    // ── Find user by ID ──
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        // Explicitly exclude passwordHash
      },
    })

    if (!user) {
      return errorResponse('User not found', 404)
    }

    // ── Return user profile (never expose passwordHash) ──
    return successResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        },
      },
      'User profile retrieved'
    )
  } catch (err) {
    // Handle authentication errors with appropriate status codes
    if (err instanceof Error && (
      err.message.includes('Authorization header') ||
      err.message.includes('Bearer') ||
      err.message.includes('token')
    )) {
      return errorResponse(err.message, 401)
    }

    console.error('[ME ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
