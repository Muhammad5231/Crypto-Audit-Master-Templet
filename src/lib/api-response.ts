// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — API Response Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provides consistent JSON response formatting across all API routes.
// Every API response follows the same structure for easy parsing:
//
// Success: { success: true, data: T, message?: string }
// Error:   { success: false, error: string, errors?: string[] }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { NextResponse } from 'next/server'

/** Standard success response shape */
interface SuccessResponse<T> {
  success: true
  data: T
  message?: string
}

/** Standard error response shape */
interface ErrorResponse {
  success: false
  error: string
  errors?: string[]
}

/**
 * Create a success JSON response.
 *
 * @param data - The response payload
 * @param message - Optional success message
 * @param statusCode - HTTP status code (default: 200)
 * @returns NextResponse with consistent success format
 *
 * @example
 *   return successResponse({ user, token }, 'Login successful')
 */
export function successResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse<SuccessResponse<T>> {
  const body: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  }
  return NextResponse.json(body, { status: statusCode })
}

/**
 * Create an error JSON response.
 *
 * @param message - Human-readable error description
 * @param statusCode - HTTP status code (default: 400)
 * @param errors - Optional array of detailed error messages
 * @returns NextResponse with consistent error format
 *
 * @example
 *   return errorResponse('Validation failed', 422, ['Email is required'])
 */
export function errorResponse(
  message: string,
  statusCode: number = 400,
  errors?: string[]
): NextResponse<ErrorResponse> {
  const body: ErrorResponse = {
    success: false,
    error: message,
    ...(errors && errors.length > 0 && { errors }),
  }
  return NextResponse.json(body, { status: statusCode })
}
