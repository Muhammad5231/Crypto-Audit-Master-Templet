'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Exchange Details Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mandatory step in the CSV upload flow. Opens AFTER column
// mapping is complete (or auto-detection succeeds) and BEFORE
// the CSV is finally processed.
//
// Collects: Exchange Name, Buy Fee %, Sell Fee %
// These are required for accurate trading fee calculation.
//
// Form state resets on each open via a key-driven remount of
// the inner ExchangeDetailsForm component (same pattern as
// ColumnMappingWizard uses with its parent key).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Percent, ArrowRight, Loader2, Info } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface ExchangeDetailsModalProps {
  open: boolean
  onClose: () => void // Cancel — return to pending
  onSubmit: (details: {
    exchangeName: string
    buyFeePercent: string
    sellFeePercent: string
  }) => void
  isProcessing: boolean
  fileName?: string
}

// ── Exchange suggestions for datalist ──

const EXCHANGE_SUGGESTIONS = [
  'Binance',
  'Delta Exchange',
  'CoinDCX',
  'WazirX',
  'KuCoin',
  'Custom',
]

// ── Validation helpers ──

function validateExchangeName(value: string): string | null {
  if (!value || value.trim().length === 0) {
    return 'Exchange name is required'
  }
  return null
}

function validateFeePercent(value: string, label: string): string | null {
  if (!value || value.trim().length === 0) {
    return `${label} is required`
  }
  const num = parseFloat(value)
  if (isNaN(num)) {
    return `${label} must be a valid number`
  }
  if (num < 0) {
    return `${label} cannot be negative`
  }
  return null
}

// ── Inner Form Component ──────────────────────────────────────
// Remounted via `key` when the modal reopens so state is fresh.

interface ExchangeDetailsFormProps {
  onSubmit: (details: {
    exchangeName: string
    buyFeePercent: string
    sellFeePercent: string
  }) => void
  onCancel: () => void
  isProcessing: boolean
  fileName?: string
}

function ExchangeDetailsForm({
  onSubmit,
  onCancel,
  isProcessing,
  fileName,
}: ExchangeDetailsFormProps) {
  const [exchangeName, setExchangeName] = useState('')
  const [buyFeePercent, setBuyFeePercent] = useState('')
  const [sellFeePercent, setSellFeePercent] = useState('')

  // ── Touched state (show errors only after interaction) ──
  const [touched, setTouched] = useState({
    exchangeName: false,
    buyFeePercent: false,
    sellFeePercent: false,
  })

  // ── Computed validation ──
  const exchangeNameError = validateExchangeName(exchangeName)
  const buyFeeError = validateFeePercent(buyFeePercent, 'Buy fee')
  const sellFeeError = validateFeePercent(sellFeePercent, 'Sell fee')

  const isFormValid =
    exchangeNameError === null &&
    buyFeeError === null &&
    sellFeeError === null

  // ── Handlers ──
  const handleSubmit = () => {
    // Mark all as touched to show any remaining errors
    setTouched({
      exchangeName: true,
      buyFeePercent: true,
      sellFeePercent: true,
    })

    if (!isFormValid) return

    onSubmit({
      exchangeName: exchangeName.trim(),
      buyFeePercent,
      sellFeePercent,
    })
  }

  return (
    <>
      {/* ── Header ── */}
      <DialogHeader className="px-6 pt-6 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 shrink-0">
            <Building2 className="h-5 w-5 text-teal-500" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-bold leading-tight">
              Add Exchange Details
            </DialogTitle>
            {fileName && (
              <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                {fileName}
              </p>
            )}
          </div>
        </div>
        <DialogDescription className="text-sm text-muted-foreground">
          These details are required to correctly calculate trading fees and
          process your audit report.
        </DialogDescription>
      </DialogHeader>

      {/* ── Form Body ── */}
      <div className="px-6 pb-4 space-y-5">
        {/* Exchange Name */}
        <div className="space-y-2">
          <Label
            htmlFor="exchange-name"
            className="text-sm font-medium flex items-center gap-1.5"
          >
            <Building2 className="h-3.5 w-3.5 text-teal-500" />
            Exchange Name
            <span className="text-red-500 text-xs">*</span>
          </Label>
          <Input
            id="exchange-name"
            type="text"
            placeholder="e.g. Delta Exchange, Binance, CoinDCX"
            className="rounded-xl h-11 text-sm"
            value={exchangeName}
            onChange={(e) => {
              setExchangeName(e.target.value)
              if (!touched.exchangeName) {
                setTouched((prev) => ({ ...prev, exchangeName: true }))
              }
            }}
            onBlur={() =>
              setTouched((prev) => ({ ...prev, exchangeName: true }))
            }
            aria-invalid={touched.exchangeName && !!exchangeNameError}
            disabled={isProcessing}
            list="exchange-suggestions"
          />
          <datalist id="exchange-suggestions">
            {EXCHANGE_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {touched.exchangeName && exchangeNameError ? (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <span className="inline-block h-1 w-1 rounded-full bg-red-500 shrink-0" />
              {exchangeNameError}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Select from suggestions or type a custom exchange name
            </p>
          )}
        </div>

        {/* Fee inputs — side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Buy Fee */}
          <div className="space-y-2">
            <Label
              htmlFor="buy-fee"
              className="text-sm font-medium flex items-center gap-1.5"
            >
              <Percent className="h-3.5 w-3.5 text-teal-500" />
              Buy Fees (%)
              <span className="text-red-500 text-xs">*</span>
            </Label>
            <div className="relative">
              <Input
                id="buy-fee"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 0.10"
                className="rounded-xl h-11 text-sm pr-8"
                value={buyFeePercent}
                onChange={(e) => {
                  setBuyFeePercent(e.target.value)
                  if (!touched.buyFeePercent) {
                    setTouched((prev) => ({ ...prev, buyFeePercent: true }))
                  }
                }}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, buyFeePercent: true }))
                }
                aria-invalid={touched.buyFeePercent && !!buyFeeError}
                disabled={isProcessing}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                %
              </span>
            </div>
            {touched.buyFeePercent && buyFeeError ? (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-red-500 shrink-0" />
                {buyFeeError}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Fee charged on buy orders
              </p>
            )}
          </div>

          {/* Sell Fee */}
          <div className="space-y-2">
            <Label
              htmlFor="sell-fee"
              className="text-sm font-medium flex items-center gap-1.5"
            >
              <Percent className="h-3.5 w-3.5 text-teal-500" />
              Sell Fees (%)
              <span className="text-red-500 text-xs">*</span>
            </Label>
            <div className="relative">
              <Input
                id="sell-fee"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 0.10"
                className="rounded-xl h-11 text-sm pr-8"
                value={sellFeePercent}
                onChange={(e) => {
                  setSellFeePercent(e.target.value)
                  if (!touched.sellFeePercent) {
                    setTouched((prev) => ({ ...prev, sellFeePercent: true }))
                  }
                }}
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, sellFeePercent: true }))
                }
                aria-invalid={touched.sellFeePercent && !!sellFeeError}
                disabled={isProcessing}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                %
              </span>
            </div>
            {touched.sellFeePercent && sellFeeError ? (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-red-500 shrink-0" />
                {sellFeeError}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Fee charged on sell orders
              </p>
            )}
          </div>
        </div>

        {/* Info note */}
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            These fees will be used to calculate trading costs. If your CSV
            includes fee amounts, those will take priority.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <DialogFooter className="px-6 py-4 border-t flex-row justify-between sm:justify-between">
        <Button
          variant="outline"
          onClick={onCancel}
          className="rounded-xl"
          disabled={isProcessing}
        >
          Cancel Import
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isProcessing}
          className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Continue &amp; Process CSV
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────
// Wraps the form in a Dialog and uses a `key` counter to remount
// the inner form whenever the modal reopens, giving a fresh state.

export function ExchangeDetailsModal({
  open,
  onClose,
  onSubmit,
  isProcessing,
  fileName,
}: ExchangeDetailsModalProps) {
  // Incremented each time the modal opens so the inner form remounts
  // with fresh state (avoids setState-in-effect lint issue).
  const [formKey, setFormKey] = useState(0)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isProcessing) {
      // Bump key so next open starts with a clean form
      setFormKey((k) => k + 1)
      onClose()
    }
    if (isOpen) {
      // Fresh key for new open
      setFormKey((k) => k + 1)
    }
  }

  const handleCancel = () => {
    if (!isProcessing) {
      setFormKey((k) => k + 1)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] rounded-2xl p-0 gap-0 overflow-hidden"
        showCloseButton={!isProcessing}
      >
        <ExchangeDetailsForm
          key={formKey}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          isProcessing={isProcessing}
          fileName={fileName}
        />
      </DialogContent>
    </Dialog>
  )
}
