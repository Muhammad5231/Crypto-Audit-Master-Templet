// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Register API Route
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/auth/register
// Creates a new user account with username, email, and password.
// Validates uniqueness of username and email, hashes password,
// creates the user record, and returns a JWT token.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password } = body

    // ── Validate required fields ──
    const missingFields: string[] = []
    if (!username || typeof username !== 'string' || username.trim() === '') missingFields.push('username')
    if (!email || typeof email !== 'string' || email.trim() === '') missingFields.push('email')
    if (!password || typeof password !== 'string' || password.trim() === '') missingFields.push('password')

    if (missingFields.length > 0) {
      return errorResponse(
        `Missing required fields: ${missingFields.join(', ')}`,
        422,
        missingFields.map((f) => `${f} is required`)
      )
    }

    // Normalize inputs
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedEmail = email.trim().toLowerCase()

    // Validate username length
    if (normalizedUsername.length < 3) {
      return errorResponse('Username must be at least 3 characters', 422)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse('Invalid email format', 422)
    }

    // Validate password length
    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 422)
    }

    // ── Check username uniqueness ──
    const existingUsername = await db.user.findUnique({
      where: { username: normalizedUsername },
    })
    if (existingUsername) {
      return errorResponse('Username is already taken', 409)
    }

    // ── Check email uniqueness ──
    const existingEmail = await db.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existingEmail) {
      return errorResponse('Email is already registered', 409)
    }

    // ── Hash password ──
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // ── Create user ──
    const user = await db.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
      },
    })

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
      'Registration successful',
      201
    )
  } catch (err) {
    console.error('[REGISTER ERROR]', err)
    return errorResponse('Internal server error', 500)
  }
}
