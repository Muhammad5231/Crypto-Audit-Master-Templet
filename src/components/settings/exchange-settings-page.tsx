'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Exchange Settings Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Clean stacked form cards for configuring fee, TDS, tax, and GST
// default percentages. These serve as fallbacks when CSV values
// are missing or zero.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Settings2,
  Percent,
  Receipt,
  ShieldCheck,
  IndianRupee,
  Save,
  Loader2,
  Info,
  Wallet,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types for exchange settings ────────────────────────────

interface ExchangeSettings {
  id: string
  workspaceId: string
  buyFeePercent: string
  sellFeePercent: string
  defaultTdsPercent: string
  cryptoTaxPercent: string
  cessPercent: string
  gstPercent: string
  createdAt: string
  updatedAt: string
}

// ── Main Exchange Settings Component ───────────────────────

export default function ExchangeSettingsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const [settings, setSettings] = useState<ExchangeSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Form state — initialized from API data
  const [buyFeePercent, setBuyFeePercent] = useState('0.1')
  const [sellFeePercent, setSellFeePercent] = useState('0.1')
  const [defaultTdsPercent, setDefaultTdsPercent] = useState('1')
  const [cryptoTaxPercent, setCryptoTaxPercent] = useState('30')
  const [cessPercent, setCessPercent] = useState('4')
  const [gstPercent, setGstPercent] = useState('18')

  // Fetch exchange settings
  const fetchSettings = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<ExchangeSettings>(
        `/api/workspaces/${currentWorkspace.id}/settings/exchange`
      )
      setSettings(data)
      // Initialize form with API values
      setBuyFeePercent(data.buyFeePercent || '0.1')
      setSellFeePercent(data.sellFeePercent || '0.1')
      setDefaultTdsPercent(data.defaultTdsPercent || '1')
      setCryptoTaxPercent(data.cryptoTaxPercent || '30')
      setCessPercent(data.cessPercent || '4')
      setGstPercent(data.gstPercent || '18')
      setHasChanges(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load settings'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Track changes
  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value)
    setHasChanges(true)
  }

  // Save settings
  const handleSave = async () => {
    if (!currentWorkspace) return
    setIsSaving(true)
    try {
      const data = await apiPatch<ExchangeSettings>(
        `/api/workspaces/${currentWorkspace.id}/settings/exchange`,
        {
          buyFeePercent,
          sellFeePercent,
          defaultTdsPercent,
          cryptoTaxPercent,
          cessPercent,
          gstPercent,
        }
      )
      setSettings(data)
      setHasChanges(false)
      toast.success('Exchange settings saved successfully')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Loading state
  if (isLoading) {
    return <ExchangeSettingsSkeleton />
  }

  // No workspace
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select a workspace to configure exchange settings.
        </p>
        <Button
          onClick={() => setCurrentPage('workspaces')}
          className="mt-4 bg-teal-500 hover:bg-teal-600 text-white"
        >
          Go to Workspaces
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
              <Settings2 className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Exchange Settings</h2>
              <p className="text-sm text-muted-foreground">
                Default percentages for {currentWorkspace.name}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Error State ── */}
      {error && (
        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={fetchSettings} className="mt-3">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Fee Defaults Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-base">Fee Defaults</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Applied when CSV does not provide fee values
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buy-fee" className="text-sm font-medium">Buy Fee %</Label>
            <div className="relative">
              <Input
                id="buy-fee"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={buyFeePercent}
                onChange={handleChange(setBuyFeePercent)}
                className="pr-8 rounded-xl"
                placeholder="0.1"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Trading fee percentage applied on buy orders when not provided in CSV
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sell-fee" className="text-sm font-medium">Sell Fee %</Label>
            <div className="relative">
              <Input
                id="sell-fee"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={sellFeePercent}
                onChange={handleChange(setSellFeePercent)}
                className="pr-8 rounded-xl"
                placeholder="0.1"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Trading fee percentage applied on sell orders when not provided in CSV
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── TDS Defaults Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-base">TDS Defaults</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Fallback TDS when not available in CSV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="tds" className="text-sm font-medium">Default TDS %</Label>
            <div className="relative">
              <Input
                id="tds"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={defaultTdsPercent}
                onChange={handleChange(setDefaultTdsPercent)}
                className="pr-8 rounded-xl"
                placeholder="1"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              TDS deducted at source on sell trades (currently 1% per Indian tax law)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Tax Defaults Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base">Tax Defaults</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Income tax rates on crypto gains
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crypto-tax" className="text-sm font-medium">Crypto Tax %</Label>
            <div className="relative">
              <Input
                id="crypto-tax"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cryptoTaxPercent}
                onChange={handleChange(setCryptoTaxPercent)}
                className="pr-8 rounded-xl"
                placeholder="30"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Flat tax rate on positive realized gains (30% per Section 115BBH)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cess" className="text-sm font-medium">Cess %</Label>
            <div className="relative">
              <Input
                id="cess"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cessPercent}
                onChange={handleChange(setCessPercent)}
                className="pr-8 rounded-xl"
                placeholder="4"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Health & Education Cess on top of base crypto tax (4%)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── GST Defaults Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-base">GST Defaults</CardTitle>
          </div>
          <CardDescription className="text-xs">
            GST applied on trading fees only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="gst" className="text-sm font-medium">GST %</Label>
            <div className="relative">
              <Input
                id="gst"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={gstPercent}
                onChange={handleChange(setGstPercent)}
                className="pr-8 rounded-xl"
                placeholder="18"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              GST levied on exchange trading fees (18% standard rate)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Save / Reset Buttons & Note ── */}
      <div className="flex flex-col items-end gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setBuyFeePercent('0.1')
              setSellFeePercent('0.1')
              setDefaultTdsPercent('1')
              setCryptoTaxPercent('30')
              setCessPercent('4')
              setGstPercent('18')
              setHasChanges(true)
            }}
            className="rounded-xl"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reset to Indian Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[140px]"
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Settings</>
            )}
          </Button>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-md">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>CSV-provided fees and TDS are always preferred over default fallback settings.</span>
        </div>
      </div>

      {/* ── Last Updated ── */}
      {settings?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(settings.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────

function ExchangeSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  )
}
