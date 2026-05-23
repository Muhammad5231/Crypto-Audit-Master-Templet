// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Shared Tax & FY Defaults
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Centralized configuration for Indian crypto tax rates and
// financial year calculations. Single source of truth for
// both frontend and backend.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Default Indian crypto tax rates as per Income Tax Act */
export const TAX_DEFAULTS = {
  /** TDS rate under Section 194S (1% on crypto transfers above ₹10,000) */
  TDS_PERCENT: '1',
  /** Flat tax rate on VDA income under Section 115AD(1)(b)(ii) */
  CRYPTO_TAX_PERCENT: '30',
  /** Health & Education Cess rate (4% on tax + surcharge) */
  CESS_PERCENT: '4',
  /** GST rate on exchange fees */
  GST_PERCENT: '18',
  /** Default buy-side fee percent (exchange trading fee) */
  DEFAULT_BUY_FEE_PERCENT: '0.1',
  /** Default sell-side fee percent (exchange trading fee) */
  DEFAULT_SELL_FEE_PERCENT: '0.1',
} as const

/** Surcharge slabs for Indian income tax (FY 2024-25 onwards) */
export const SURCHARGE_SLABS = [
  { threshold: 5_000_000,  rate: 0    },  // Up to ₹50 lakh: 0%
  { threshold: 10_000_000, rate: 0.10 },  // ₹50L–₹1Cr: 10%
  { threshold: 20_000_000, rate: 0.15 },  // ₹1Cr–₹2Cr: 15%
  { threshold: 50_000_000, rate: 0.25 },  // ₹2Cr–₹5Cr: 25%
  { threshold: Infinity,   rate: 0.37 },  // Above ₹5Cr: 37%
] as const

/**
 * Get the current Indian Financial Year string.
 * Indian FY runs April 1 – March 31.
 * E.g., May 2026 → "2026-27", January 2026 → "2025-26"
 */
export function getCurrentFinancialYear(): string {
  const now = new Date()
  const month = now.getMonth() // 0-indexed: March = 2, April = 3
  const year = now.getFullYear()
  // FY starts in April (month index 3)
  const fyStartYear = month >= 3 ? year : year - 1
  return `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`
}

/**
 * Generate a list of financial year options centered around the current FY.
 * @param count Number of FY options to generate (default 5)
 * @returns Array of FY strings like ["2023-24", "2024-25", "2025-26", "2026-27", "2027-28"]
 */
export function generateFYOptions(count: number = 5): string[] {
  const currentFY = getCurrentFinancialYear()
  const [startStr] = currentFY.split('-')
  const currentStartYear = parseInt(startStr, 10)

  return Array.from({ length: count }, (_, i) => {
    const y = currentStartYear - 2 + i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}
