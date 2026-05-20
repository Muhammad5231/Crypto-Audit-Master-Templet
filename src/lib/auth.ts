// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — JWT Authentication Utility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provides JWT signing and verification for the auth system.
// Token payload contains { userId } and expires after 7 days.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import jwt from 'jsonwebtoken'

/** JWT secret — sourced from environment variable, with a dev fallback */
const JWT_SECRET = process.env.JWT_SECRET || 'crypto-audit-master-dev-secret-change-in-prod'

/** Token expiry duration */
const JWT_EXPIRY = '7d'

/** Shape of the JWT payload */
export interface JwtPayload {
  userId: string
}

/**
 * Sign a JWT token for an authenticated user.
 * @param userId - The user's unique database ID
 * @returns Signed JWT string
 */
export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  })
}

/**
 * Verify a JWT token and extract the payload.
 * @param token - The JWT string to verify
 * @returns Decoded payload with userId
 * @throws JsonWebTokenError if token is invalid or expired
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}
