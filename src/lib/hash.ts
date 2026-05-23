// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Hash Utility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provides SHA-256 hashing for CSV file duplicate detection.
// When a CSV is uploaded, its content is hashed and compared against
// existing file hashes in the database to prevent duplicate imports.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createHash } from 'crypto'

/**
 * Generate a SHA-256 hash of a string (typically CSV file content).
 *
 * @param content - The string content to hash
 * @returns Hex-encoded SHA-256 hash string
 *
 * @example
 *   const hash = sha256(csvText)
 *   // "a1b2c3d4e5..."
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
