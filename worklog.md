---
Task ID: 1
Agent: Main
Task: Fix build error - missing upload-page component

Work Log:
- Discovered that `src/components/upload/upload-page.tsx` was imported in page.tsx but didn't exist
- Created the full UploadPage component with drag-and-drop, file listing, process report action
- Supports both mobile and desktop layouts following existing design patterns
- Uses existing API endpoints: POST /uploads/csv, GET /uploads, DELETE /uploads/:id

Stage Summary:
- Build error resolved - project compiles successfully
- New file: /home/z/my-project/src/components/upload/upload-page.tsx

---
Task ID: 2
Agent: Main
Task: Fix incorrect FIFO matching engine and tax calculations

Work Log:
- Fixed FIFO engine: changed `continue` to `break` when encountering future buy lots (all subsequent lots are also future)
- Fixed report builder: added `originalRowIndex` pass-through from array index for stable tiebreaking
- Added surcharge calculation to tax engine per Indian tax law slabs (10%/15%/25%/37% above ₹50L/1Cr/2Cr/5Cr)
- Added marginal relief logic to surcharge calculation
- Added `taxablePositiveGain`, `totalBaseCryptoTax`, `totalSurcharge` fields to TaxSummary
- Fixed `surchargeApplicable` boolean flag in TaxSummary

Stage Summary:
- FIFO engine: future-lot break optimization applied
- Tax engine: surcharge calculation added with marginal relief
- Report builder: stable tiebreaker for same-timestamp trades

---
Task ID: 3
Agent: Main
Task: Remove mock/hardcoded data from all pages

Work Log:
- Audited all 13 page components for mock/hardcoded data
- Found that data-driven pages already use API endpoints properly
- Created shared /src/lib/tax-defaults.ts with TAX_DEFAULTS, getCurrentFinancialYear(), generateFYOptions()
- Created shared /src/lib/workspace-options.ts with ICON_OPTIONS and COLOR_OPTIONS
- Fixed export-center-page.tsx: replaced hardcoded 'FY2025-26' with dynamic getCurrentFinancialYear()
- Fixed workspace-settings-page.tsx: replaced static FY_OPTIONS with generateFYOptions()
- Fixed exchange-settings-page.tsx: replaced hardcoded tax rates with TAX_DEFAULTS constants

Stage Summary:
- All data pages already API-driven (no mock trade/financial data found)
- Extracted shared constants for maintainability
- Fixed hardcoded FY fallbacks and tax defaults
