// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Auth Middleware Helper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Extracts and verifies Bearer tokens from Authorization headers.
// Used as the first gate in all protected API routes.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { verifyToken, JwtPayload } from '@/lib/auth'

/**
 * Authenticate a request by extracting and verifying the Bearer token.
 *
 * @param request - The incoming NextRequest object
 * @returns The decoded JWT payload containing { userId }
 * @throws Error if token is missing, malformed, or invalid
 *
 * @example
 *   const { userId } = authenticateRequest(request)
 *   // userId is now a validated string
 */
export function authenticateRequest(request: NextRequest): JwtPayload {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    throw new Error('Authorization header is required')
  }

  // Expect format: "Bearer <token>"
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Authorization header must use Bearer scheme')
  }

  const token = parts[1]

  if (!token || token.trim() === '') {
    throw new Error('Bearer token is required')
  }

  try {
    const payload = verifyToken(token)
    return payload
  } catch {
    throw new Error('Invalid or expired token')
  }
}
