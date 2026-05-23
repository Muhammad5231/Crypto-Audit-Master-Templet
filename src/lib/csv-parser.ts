// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Parser & Normalization Service
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Parses CSV content from various crypto exchanges, detects column
// names using alias mapping, validates each row, and returns
// normalized trade records ready for database insertion.
//
// Key Features:
//   - Case-insensitive column detection with alias mapping
//   - Graceful row skipping with detailed reason tracking
//   - Side normalization (buy/B/b → BUY, sell/S/s → SELL)
//   - Status-based row filtering (skip cancelled/rejected trades)
//   - Decimal.js string output for financial precision
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Papa from 'papaparse'
import { toD } from '@/lib/decimal'

// ── Column Alias Mappings ──────────────────────────────────
// Each normalized field has multiple possible column names across
// different exchanges. We do case-insensitive matching after
// stripping whitespace and special characters.

const COLUMN_ALIASES: Record<string, string[]> = {
  TIME: [
    'time', 'timestamp', 'date', 'trade time', 'tradedate',
    'trade_date', 'datetime',
  ],
  CONTRACT: [
    'contract', 'symbol', 'pair', 'market', 'instrument',
    'tradingpair', 'trading_pair',
  ],
  QTY: [
    'qty', 'quantity', 'filled qty', 'executed quantity',
    'filled', 'amount', 'filledquantity',
  ],
  SIDE: [
    'side', 'buy/sell', 'trade side', 'direction', 'type',
  ],
  PRICE: [
    'exec.price', 'price', 'executed price', 'average price',
    'avg price', 'tradeprice', 'trade_price', 'rate',
  ],
  FEES: [
    'fees', 'fee', 'fees paid', 'commission', 'trading fee',
    'trading fees', 'feeamount',
  ],
  TDS: [
    'tds', 'tax deducted', 'tds amount',
  ],
  ORDER_VALUE: [
    'order value', 'total', 'ordervalue', 'trade value',
  ],
  TRADE_STATUS: [
    'status', 'order status', 'trade status', 'state', 'orderstatus',
  ],
  ORDER_ID: [
    'order id', 'orderid', 'order_id', 'trade id', 'tradeid', 'trade_id',
  ],
}

// Required fields that MUST be present for a valid trade
const REQUIRED_FIELDS = ['TIME', 'CONTRACT', 'QTY', 'SIDE', 'PRICE']

// Status values that indicate a non-executed trade (should be skipped)
const SKIP_STATUS_VALUES = new Set([
  'cancelled', 'canceled', 'rejected', 'pending', 'failed',
])

// ── Side Normalization Map ─────────────────────────────────
// Maps various side representations to standard BUY/SELL
const SIDE_MAP: Record<string, 'BUY' | 'SELL'> = {
  buy: 'BUY',
  sell: 'SELL',
  b: 'BUY',
  s: 'SELL',
  long: 'BUY',
  short: 'SELL',
}

// ── Type Definitions ───────────────────────────────────────

/** A single normalized trade extracted from CSV */
export interface NormalizedTrade {
  tradeTime: Date
  pair: string
  asset: string
  side: 'BUY' | 'SELL'
  qty: string        // Decimal.js string
  price: string      // Decimal.js string
  orderValue: string // Decimal.js string
  fee: string        // Decimal.js string (0 if missing)
  tds: string        // Decimal.js string (0 if missing)
  rawRow: string     // JSON string of original row
}

/** Information about a skipped row */
export interface SkipReason {
  row: number
  reason: string
}

/** Complete result from CSV parsing */
export interface CsvParseResult {
  totalRows: number
  validRows: number
  skippedRows: number
  skipReasons: SkipReason[]
  trades: NormalizedTrade[]
  detectedColumns: Record<string, string>  // original → normalized mapping
  unmappedColumns: string[]                // columns that couldn't be auto-mapped
  requiredMapping: string[]                // required fields that weren't auto-detected
}

/** Result from header-only analysis (for column mapping UI) */
export interface CsvAnalyzeResult {
  headers: string[]
  sampleRows: Record<string, string>[]
  detectedColumns: Record<string, string>  // original → normalized mapping
  unmappedColumns: string[]
  requiredMapping: string[]                // required fields missing auto-detection
  totalRows: number
}

// ── Helper: Normalize a Column Header ──────────────────────
// Strips whitespace, special characters, and converts to lowercase
// for comparison against our alias lists.

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\-\.]/g, ' ')    // Replace underscores, hyphens, dots with spaces
    .replace(/\s+/g, ' ')        // Collapse multiple spaces
    .trim()
}

// ── Helper: Detect Column Mapping ─────────────────────────
// Compares each CSV header against all known aliases and builds
// a mapping from the original column name to the normalized field.

export function detectColumnMapping(headers: string[]): {
  detectedColumns: Record<string, string>
  unmappedColumns: string[]
  requiredMapping: string[]
} {
  const detectedColumns: Record<string, string> = {}
  const mappedNormalizedFields = new Set<string>()

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header)

    // Check against all alias groups
    for (const [normalizedField, aliases] of Object.entries(COLUMN_ALIASES)) {
      // Skip if this normalized field is already mapped
      if (mappedNormalizedFields.has(normalizedField)) continue

      if (aliases.some(alias => normalizeHeader(alias) === normalizedHeader)) {
        detectedColumns[header] = normalizedField
        mappedNormalizedFields.add(normalizedField)
        break
      }
    }
  }

  // Columns that weren't mapped to any known field
  const unmappedColumns = headers.filter(h => !(h in detectedColumns))

  // Required fields that weren't auto-detected
  const requiredMapping = REQUIRED_FIELDS.filter(f => !mappedNormalizedFields.has(f))

  return { detectedColumns, unmappedColumns, requiredMapping }
}

// ── Helper: Parse Date from Various Formats ────────────────
// Handles common date formats from crypto exchanges

function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null

  let trimmed = value.trim()

  // ── Strip non-standard timezone suffixes ──
  // Delta Exchange: "2026-05-17 15:26:10.284446+05:30 IST Asia/Kolkata"
  // The "IST Asia/Kolkata" part is not parseable by JS Date.
  // Strategy: extract the offset (+05:30) and strip everything after it.
  trimmed = trimmed.replace(/\s+(IST|UTC|GMT|KST|JST|PST|EST|CST|MST|PDT|EDT|CDT|MDT)\s+.*/i, '')

  // Also handle: "2026-05-17 15:26:10+05:30" (no space before offset, with trailing text)
  // Keep everything up to and including the timezone offset like +05:30 or -07:00
  const offsetMatch = trimmed.match(/^(.*?[+\-]\d{2}:?\d{2})\s/)
  if (offsetMatch) {
    trimmed = offsetMatch[1]
  }

  // Try native Date parsing (handles ISO 8601, RFC 2822, etc.)
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d

  // Try without milliseconds: "2026-05-17 15:26:10.284446+05:30" → "2026-05-17T15:26:10+05:30"
  const noMillis = trimmed.replace(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\.\d+/, '$1')
  const d3 = new Date(noMillis)
  if (!isNaN(d3.getTime())) return d3

  // Try with T separator: "2026-05-17 15:26:10+05:30" → "2026-05-17T15:26:10+05:30"
  const withT = noMillis.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')
  const d4 = new Date(withT)
  if (!isNaN(d4.getTime())) return d4

  // Try common exchange formats: DD/MM/YYYY HH:mm:ss, DD-MM-YYYY etc.
  const normalized = trimmed.replace(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/, '$3-$2-$1')
  const d2 = new Date(normalized)
  if (!isNaN(d2.getTime())) return d2

  // ── Additional fallback patterns for edge cases ──

  // Handle epoch timestamps (seconds or milliseconds)
  const asNumber = Number(trimmed)
  if (!isNaN(asNumber) && asNumber > 0) {
    // If > 1e12, treat as milliseconds; otherwise seconds
    const epochMs = asNumber > 1e12 ? asNumber : asNumber * 1000
    const epochDate = new Date(epochMs)
    if (!isNaN(epochDate.getTime()) && epochDate.getFullYear() > 1970 && epochDate.getFullYear() < 2100) {
      return epochDate
    }
  }

  // Handle "YYYY/MM/DD HH:mm:ss" — some exchanges use / in ISO-like format
  const slashIso = trimmed.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3')
  if (slashIso !== trimmed) {
    const dSlash = new Date(slashIso)
    if (!isNaN(dSlash.getTime())) return dSlash
    // Also try with T separator
    const slashIsoT = slashIso.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')
    const dSlashT = new Date(slashIsoT)
    if (!isNaN(dSlashT.getTime())) return dSlashT
  }

  // Handle "MMM DD, YYYY HH:mm:ss" or "DD MMM YYYY HH:mm:ss" formats
  const monthNameDate = new Date(trimmed)
  if (!isNaN(monthNameDate.getTime())) return monthNameDate

  // Handle date-only formats like "YYYY-MM-DD" without time
  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (dateOnly) {
    const dDateOnly = new Date(`${dateOnly[1]}T00:00:00`)
    if (!isNaN(dDateOnly.getTime())) return dDateOnly
  }

  return null
}

// ── Helper: Normalize Side Value ───────────────────────────
// Converts various side representations to BUY or SELL

function normalizeSide(value: string): 'BUY' | 'SELL' | null {
  if (!value || value.trim() === '') return null
  const normalized = value.trim().toLowerCase()
  return SIDE_MAP[normalized] ?? null
}

// ── Helper: Extract Asset from Pair ────────────────────────
// For pairs like "BTCINR", "BTC-INR", "BTC/INR", "BTC_USDT"
// Extract the base asset (everything before the quote currency)

function extractAsset(pair: string): string {
  if (!pair) return ''

  // If pair contains a separator, take the first part
  const separators = ['/', '-', '_']
  for (const sep of separators) {
    if (pair.includes(sep)) {
      return pair.split(sep)[0].trim()
    }
  }

  // No separator — try to strip common quote currencies from the end
  const quoteCurrencies = ['INR', 'USDT', 'USDC', 'USD', 'BUSD', 'BTC', 'ETH', 'WBNB']
  const upperPair = pair.toUpperCase()
  for (const quote of quoteCurrencies) {
    if (upperPair.endsWith(quote) && upperPair.length > quote.length) {
      return pair.slice(0, pair.length - quote.length).trim()
    }
  }

  // Fallback: return the whole pair as asset
  return pair.trim()
}

// ── Helper: Check if a Row Should Be Skipped Based on Status ──

function shouldSkipByStatus(
  row: Record<string, string>,
  headers: string[],
  statusColumnOverride?: string,  // If mapping includes TRADE_STATUS, this is the original column name
): boolean {
  // If a TRADE_STATUS mapping was provided, use that specific column
  if (statusColumnOverride) {
    const statusValue = (row[statusColumnOverride] || '').trim().toLowerCase()
    if (SKIP_STATUS_VALUES.has(statusValue)) {
      return true
    }
    return false
  }

  // Fallback: auto-detect status column by looking at header names
  const statusAliases = ['status', 'order status', 'trade status', 'state', 'orderstatus']
  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header)
    if (statusAliases.some(alias => normalizeHeader(alias) === normalizedHeader)) {
      const statusValue = (row[header] || '').trim().toLowerCase()
      if (SKIP_STATUS_VALUES.has(statusValue)) {
        return true
      }
    }
  }
  return false
}

// ── Main: Parse CSV Content ────────────────────────────────
// Parses full CSV content and returns normalized trades with
// validation results and skip reasons.

export function parseCsvContent(
  content: string,
  mappingOverride?: Record<string, string>,  // User-provided mapping: originalCol → normalizedField
  sideValueMap?: Record<string, string>,     // Custom side mapping: e.g. { "1": "BUY", "0": "SELL" }
): CsvParseResult {
  // ── Step 1: Parse CSV using PapaParse ──
  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(), // Keep original but trim
  })

  if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
    // If there are parse errors and no data, return empty result
    return {
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
      skipReasons: [{ row: 0, reason: `CSV parse error: ${parseResult.errors[0].message}` }],
      trades: [],
      detectedColumns: {},
      unmappedColumns: parseResult.meta.fields ?? [],
      requiredMapping: REQUIRED_FIELDS,
    }
  }

  const headers = parseResult.meta.fields ?? []
  const rows = parseResult.data

  // ── Step 2: Detect or use provided column mapping ──
  let detectedColumns: Record<string, string>

  if (mappingOverride && Object.keys(mappingOverride).length > 0) {
    // User has provided explicit mapping — use it directly
    detectedColumns = mappingOverride
  } else {
    // Auto-detect column mapping
    const mappingResult = detectColumnMapping(headers)
    detectedColumns = mappingResult.detectedColumns
  }

  // Build reverse mapping: normalizedField → originalColumnName
  const reverseMapping: Record<string, string> = {}
  for (const [originalCol, normalizedField] of Object.entries(detectedColumns)) {
    reverseMapping[normalizedField] = originalCol
  }

  // Determine unmapped and required columns
  const mappedNormalizedFields = new Set(Object.values(detectedColumns))
  const unmappedColumns = headers.filter(h => !(h in detectedColumns))
  const requiredMapping = REQUIRED_FIELDS.filter(f => !mappedNormalizedFields.has(f))

  // ── Step 3: Process Each Row ──
  const trades: NormalizedTrade[] = []
  const skipReasons: SkipReason[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +2 because row 1 is header, data starts at row 2

    // Skip rows that are entirely empty
    const hasData = Object.values(row).some(v => v && v.trim() !== '')
    if (!hasData) continue

    // Check status-based skip — if TRADE_STATUS is mapped, use that column specifically
    const statusColumnOverride = reverseMapping['TRADE_STATUS']
    if (shouldSkipByStatus(row, headers, statusColumnOverride)) {
      skipReasons.push({
        row: rowNum,
        reason: 'Trade status indicates non-executed order (cancelled/rejected/pending)',
      })
      continue
    }

    // ── Extract fields using mapping ──
    const getTime = (): Date | null => {
      const col = reverseMapping['TIME']
      if (!col) return null
      return parseDate(row[col] || '')
    }

    const getContract = (): string => {
      const col = reverseMapping['CONTRACT']
      if (!col) return ''
      return (row[col] || '').trim()
    }

    const getQty = (): string => {
      const col = reverseMapping['QTY']
      if (!col) return ''
      return (row[col] || '').trim()
    }

    const getSide = (): 'BUY' | 'SELL' | null => {
      const col = reverseMapping['SIDE']
      if (!col) return null
      const rawValue = (row[col] || '').trim()

      // First try custom side value map (user-provided)
      if (sideValueMap && sideValueMap[rawValue]) {
        const mapped = sideValueMap[rawValue]
        if (mapped === 'BUY' || mapped === 'SELL') return mapped
      }

      // Then try standard normalization
      return normalizeSide(rawValue)
    }

    const getPrice = (): string => {
      const col = reverseMapping['PRICE']
      if (!col) return ''
      return (row[col] || '').trim()
    }

    const getFees = (): string => {
      const col = reverseMapping['FEES']
      if (!col) return '0'
      const val = (row[col] || '').trim()
      return val || '0'
    }

    const getTds = (): string => {
      const col = reverseMapping['TDS']
      if (!col) return '0'
      const val = (row[col] || '').trim()
      return val || '0'
    }

    const getOrderValue = (): string => {
      // Try ORDER_VALUE column first
      const col = reverseMapping['ORDER_VALUE']
      if (col) {
        const val = (row[col] || '').trim()
        if (val && val.trim() !== '') return val
      }
      // Fallback: calculate from qty * price
      return ''
    }

    // ── Validate required fields ──
    const tradeTime = getTime()
    if (!tradeTime) {
      skipReasons.push({ row: rowNum, reason: 'Missing or invalid date/time' })
      continue
    }

    const pair = getContract()
    if (!pair) {
      skipReasons.push({ row: rowNum, reason: 'Missing contract/symbol/pair' })
      continue
    }

    const rawQty = getQty()
    if (!rawQty) {
      skipReasons.push({ row: rowNum, reason: 'Missing quantity' })
      continue
    }

    const qty = toD(rawQty.replace(/,/g, '')) // Remove thousand separators
    if (qty.lte(0)) {
      skipReasons.push({ row: rowNum, reason: `Quantity must be positive, got: ${rawQty}` })
      continue
    }

    const side = getSide()
    if (!side) {
      skipReasons.push({ row: rowNum, reason: 'Missing or invalid side (must be BUY or SELL)' })
      continue
    }

    const rawPrice = getPrice()
    if (!rawPrice) {
      skipReasons.push({ row: rowNum, reason: 'Missing price' })
      continue
    }

    const price = toD(rawPrice.replace(/,/g, '')) // Remove thousand separators
    if (price.lte(0)) {
      skipReasons.push({ row: rowNum, reason: `Price must be positive, got: ${rawPrice}` })
      continue
    }

    // ── Build normalized trade ──
    const rawOrderValue = getOrderValue()
    let orderValue: ReturnType<typeof toD>

    if (rawOrderValue && rawOrderValue.trim() !== '') {
      // Use CSV-provided order value
      orderValue = toD(rawOrderValue.replace(/,/g, ''))
    } else {
      // Calculate: qty * price
      orderValue = qty.times(price)
    }

    // Parse fee — remove currency symbols and parenthesis (negative notation)
    const rawFee = getFees()
    const feeValue = toD(
      rawFee.replace(/,/g, '').replace(/[₹$€]/g, '').replace(/\((.+)\)/, '-$1')
    )

    // Parse TDS — same cleaning
    const rawTds = getTds()
    const tdsValue = toD(
      rawTds.replace(/,/g, '').replace(/[₹$€]/g, '').replace(/\((.+)\)/, '-$1')
    )

    const asset = extractAsset(pair)

    // Store the original row as JSON for audit trail
    const rawRow = JSON.stringify(row)

    trades.push({
      tradeTime,
      pair,
      asset,
      side,
      qty: qty.toString(),
      price: price.toString(),
      orderValue: orderValue.toString(),
      fee: feeValue.abs().toString(),  // Fees are always positive
      tds: tdsValue.abs().toString(),   // TDS is always positive
      rawRow,
    })
  }

  return {
    totalRows: rows.length,
    validRows: trades.length,
    skippedRows: skipReasons.length,
    skipReasons,
    trades,
    detectedColumns,
    unmappedColumns,
    requiredMapping,
  }
}

// ── Analyze CSV Headers Only ───────────────────────────────
// Used for the column mapping feature — returns header info
// and sample data without processing all trades.

export function analyzeCsvHeaders(content: string): CsvAnalyzeResult {
  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  })

  const headers = parseResult.meta.fields ?? []
  const rows = parseResult.data

  // Take first 5 rows as samples
  const sampleRows = rows.slice(0, 5)

  // Auto-detect column mapping
  const { detectedColumns, unmappedColumns, requiredMapping } = detectColumnMapping(headers)

  return {
    headers,
    sampleRows,
    detectedColumns,
    unmappedColumns,
    requiredMapping,
    totalRows: rows.length,
  }
}
