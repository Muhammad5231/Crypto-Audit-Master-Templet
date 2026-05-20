// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Login API Route
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/auth/login
// Authenticates a user with either email or username + password.
// The "login" field accepts either format for convenience.
// Returns a JWT token on successful authentication.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { login, password } = body

    // ── Validate required fields ──
    if (!login || typeof login !== 'string' || login.trim() === '') {
      return errorResponse('Email or username is required', 422)
    }
    if (!password || typeof password !== 'string' || password.trim() === '') {
      return errorResponse('Password is required', 422)
    }

    const normalizedLogin = login.trim().toLowerCase()

    // ── Find user by email or username ──
    // Try email first (contains '@'), then fall back to username
    const user = normalizedLogin.includes('@')
      ? await db.user.findUnique({ where: { email: normalizedLogin } })
      : await db.user.findUnique({ where: { username: normalizedLogin } })

    if (!user) {
      return errorResponse('Invalid credentials', 401)
    }

    // ── Compare password with stored hash ──
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return errorResponse('Invalid credentials', 401)
    }

    // ── Sign JWT ──
    const token = signToken(user.id)

    // ── Return response (never expose passwordHash) ──
    return successResponse(
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        token,
      },
      'Login successful'
    )
  } catch (err) {
    console.error('[LOGIN ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
