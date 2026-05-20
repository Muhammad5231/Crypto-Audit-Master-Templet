// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Decimal.js Utility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provides high-precision decimal arithmetic for financial calculations.
// All crypto trade values (qty, price, fee, TDS, etc.) use Decimal.js
// to avoid floating-point rounding errors inherent in JavaScript numbers.
//
// Prisma stores these as String, and we parse/format with Decimal.js.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Decimal from 'decimal.js'

// Configure Decimal.js for financial precision (20 significant digits)
Decimal.set({ precision: 20 })

// Re-export the configured Decimal class
export { Decimal }
export type D = Decimal

/**
 * Convert a value to Decimal safely.
 * Handles strings, numbers, and existing Decimal instances.
 * Returns Decimal(0) for nullish/empty values.
 *
 * @param value - The value to convert
 * @returns A Decimal instance
 */
export function toD(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0)
  }
  return new Decimal(value)
}

/**
 * Sum an array of Decimal-convertible values.
 *
 * @param arr - Array of values to sum
 * @returns The total as a Decimal
 */
export function sumD(arr: (string | number | Decimal)[]): Decimal {
  return arr.reduce((acc, val) => acc.plus(toD(val)), new Decimal(0))
}

/**
 * Check if a Decimal value is positive (> 0).
 *
 * @param d - The Decimal to check
 * @returns true if value is greater than zero
 */
export function isPositiveD(d: Decimal): boolean {
  return d.greaterThan(0)
}

/**
 * Check if a Decimal value is zero.
 *
 * @param d - The Decimal to check
 * @returns true if value equals zero
 */
export function isZeroD(d: Decimal): boolean {
  return d.isZero()
}

/**
 * Format a Decimal as an INR currency string.
 * Uses Indian numbering system (e.g., 1,23,456.78).
 *
 * @param d - The Decimal to format
 * @returns Formatted string like "₹1,23,456.78"
 */
export function formatINR(d: Decimal): string {
  const numStr = d.toFixed(2)
  const [intPart, decPart] = numStr.split('.')

  // Indian number formatting: rightmost 3 digits, then groups of 2
  const isNegative = intPart.startsWith('-')
  const absInt = isNegative ? intPart.slice(1) : intPart

  let formatted: string
  if (absInt.length <= 3) {
    formatted = absInt
  } else {
    const lastThree = absInt.slice(-3)
    const rest = absInt.slice(0, -3)
    formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  }

  const sign = isNegative ? '-' : ''
  return `₹${sign}${formatted}.${decPart}`
}

/**
 * Format a Decimal as a quantity string with appropriate precision.
 * Strips trailing zeros for clean display.
 *
 * @param d - The Decimal to format
 * @param maxDecimals - Maximum decimal places (default: 8 for crypto)
 * @returns Formatted quantity string like "0.0015"
 */
export function formatQty(d: Decimal, maxDecimals: number = 8): string {
  return d.toDecimalPlaces(maxDecimals, Decimal.ROUND_DOWN).toString()
}
