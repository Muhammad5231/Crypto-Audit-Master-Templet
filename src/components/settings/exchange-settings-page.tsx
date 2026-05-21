'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Exchange Settings Page (Premium Rebuild)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Per-exchange fee configuration manager + global tax/TDS/GST defaults.
// Users can add, edit, delete exchange-specific buy/sell fee settings
// that serve as defaults during CSV upload and trade calculations.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { TAX_DEFAULTS } from '@/lib/tax-defaults'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
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
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  Clock,
  Upload,
  HandCoins,
  CheckCircle2,
  RotateCcw,
  Building2,
  TrendingDown,
  TrendingUp,
  FolderOpen,
  AlertTriangle,
  Database,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────

interface ExchangeConfig {
  id: string
  workspaceId: string
  exchangeName: string
  buyFeePercent: string
  sellFeePercent: string
  source: string  // "manual" or "csv-upload"
  lastUsedAt: string
  createdAt: string
  updatedAt: string
}

interface GlobalSettings {
  id: string
  workspaceId: string
  defaultBuyFeePercent: string
  defaultSellFeePercent: string
  defaultTdsPercent: string
  gstPercent: string
  cryptoTaxPercent: string
  cessPercent: string
  createdAt: string
  updatedAt: string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXCHANGE SETTINGS COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ExchangeSettingsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  // ── Exchange Configs state ──
  const [configs, setConfigs] = useState<ExchangeConfig[]>([])
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true)

  // ── Global Settings state ──
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(true)
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)
  const [hasGlobalChanges, setHasGlobalChanges] = useState(false)

  // Global form state
  const [tdsPercent, setTdsPercent] = useState(TAX_DEFAULTS.TDS_PERCENT)
  const [cryptoTaxPercent, setCryptoTaxPercent] = useState(TAX_DEFAULTS.CRYPTO_TAX_PERCENT)
  const [cessPercent, setCessPercent] = useState(TAX_DEFAULTS.CESS_PERCENT)
  const [gstPercent, setGstPercent] = useState(TAX_DEFAULTS.GST_PERCENT)

  // ── Add/Edit dialog state ──
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editingConfig, setEditingConfig] = useState<ExchangeConfig | null>(null)
  const [formName, setFormName] = useState('')
  const [formBuyFee, setFormBuyFee] = useState('')
  const [formSellFee, setFormSellFee] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // ── Delete dialog state ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingConfig, setDeletingConfig] = useState<ExchangeConfig | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState('')

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA FETCHING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const fetchConfigs = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoadingConfigs(false)
      return
    }
    setIsLoadingConfigs(true)
    try {
      const data = await apiGet<ExchangeConfig[]>(
        `/api/workspaces/${currentWorkspace.id}/settings/exchange-configs`
      )
      setConfigs(Array.isArray(data) ? data : [])
    } catch {
      // Silently fail — configs are supplementary
    } finally {
      setIsLoadingConfigs(false)
    }
  }, [currentWorkspace])

  const fetchGlobalSettings = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoadingGlobal(false)
      return
    }
    setIsLoadingGlobal(true)
    try {
      const data = await apiGet<GlobalSettings>(
        `/api/workspaces/${currentWorkspace.id}/settings/exchange`
      )
      setGlobalSettings(data)
      setTdsPercent(data.defaultTdsPercent || '1')
      setCryptoTaxPercent(data.cryptoTaxPercent || '30')
      setCessPercent(data.cessPercent || '4')
      setGstPercent(data.gstPercent || '18')
      setHasGlobalChanges(false)
    } catch {
      // Silently fail
    } finally {
      setIsLoadingGlobal(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchConfigs()
    fetchGlobalSettings()
  }, [fetchConfigs, fetchGlobalSettings])

  // ── Track global settings changes ──
  useEffect(() => {
    if (!globalSettings) return
    const changed =
      tdsPercent !== (globalSettings.defaultTdsPercent || '1') ||
      cryptoTaxPercent !== (globalSettings.cryptoTaxPercent || '30') ||
      cessPercent !== (globalSettings.cessPercent || '4') ||
      gstPercent !== (globalSettings.gstPercent || '18')
    setHasGlobalChanges(changed)
  }, [tdsPercent, cryptoTaxPercent, cessPercent, gstPercent, globalSettings])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMPUTED VALUES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return configs
    const q = searchQuery.toLowerCase()
    return configs.filter((c) => c.exchangeName.toLowerCase().includes(q))
  }, [configs, searchQuery])

  const totalExchanges = configs.length
  const mostRecentlyUsed = configs.length > 0
    ? configs.reduce((a, b) => new Date(a.lastUsedAt).getTime() > new Date(b.lastUsedAt).getTime() ? a : b)
    : null
  const avgBuyFee = configs.length > 0
    ? (configs.reduce((sum, c) => sum + parseFloat(c.buyFeePercent), 0) / configs.length).toFixed(2)
    : '0.00'
  const avgSellFee = configs.length > 0
    ? (configs.reduce((sum, c) => sum + parseFloat(c.sellFeePercent), 0) / configs.length).toFixed(2)
    : '0.00'

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLERS — EXCHANGE CONFIGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const openAddDialog = () => {
    setDialogMode('add')
    setEditingConfig(null)
    setFormName('')
    setFormBuyFee('')
    setFormSellFee('')
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (config: ExchangeConfig) => {
    setDialogMode('edit')
    setEditingConfig(config)
    setFormName(config.exchangeName)
    setFormBuyFee(config.buyFeePercent)
    setFormSellFee(config.sellFeePercent)
    setFormErrors({})
    setDialogOpen(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formName.trim()) errors.name = 'Exchange name is required'
    if (formBuyFee === '' || isNaN(Number(formBuyFee)) || Number(formBuyFee) < 0) errors.buyFee = 'Must be a valid number >= 0'
    if (formSellFee === '' || isNaN(Number(formSellFee)) || Number(formSellFee) < 0) errors.sellFee = 'Must be a valid number >= 0'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveConfig = async () => {
    if (!currentWorkspace || !validateForm()) return
    setIsSavingConfig(true)
    try {
      if (dialogMode === 'add') {
        await apiPost<ExchangeConfig>(
          `/api/workspaces/${currentWorkspace.id}/settings/exchange-configs`,
          {
            exchangeName: formName.trim(),
            buyFeePercent: formBuyFee,
            sellFeePercent: formSellFee,
            source: 'manual',
          }
        )
        toast.success('Exchange settings saved.')
      } else if (editingConfig) {
        await apiPatch<ExchangeConfig>(
          `/api/workspaces/${currentWorkspace.id}/settings/exchange-configs/${editingConfig.id}`,
          {
            exchangeName: formName.trim(),
            buyFeePercent: formBuyFee,
            sellFeePercent: formSellFee,
          }
        )
        toast.success('Exchange settings updated.')
      }
      setDialogOpen(false)
      await fetchConfigs()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save exchange settings'
      toast.error(msg)
    } finally {
      setIsSavingConfig(false)
    }
  }

  const handleDeleteConfig = async () => {
    if (!currentWorkspace || !deletingConfig) return
    setIsDeleting(true)
    try {
      await apiDelete(`/api/workspaces/${currentWorkspace.id}/settings/exchange-configs/${deletingConfig.id}`)
      toast.success('Exchange setting deleted.')
      setDeleteDialogOpen(false)
      setDeletingConfig(null)
      await fetchConfigs()
    } catch {
      toast.error('Failed to delete exchange setting')
    } finally {
      setIsDeleting(false)
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLERS — GLOBAL SETTINGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const handleSaveGlobal = async () => {
    if (!currentWorkspace) return
    setIsSavingGlobal(true)
    try {
      const data = await apiPatch<GlobalSettings>(
        `/api/workspaces/${currentWorkspace.id}/settings/exchange`,
        {
          defaultTdsPercent: tdsPercent,
          cryptoTaxPercent,
          cessPercent,
          gstPercent,
        }
      )
      setGlobalSettings(data)
      setHasGlobalChanges(false)
      toast.success('Tax & TDS defaults saved successfully')
    } catch {
      toast.error('Failed to save global settings')
    } finally {
      setIsSavingGlobal(false)
    }
  }

  const handleResetDefaults = () => {
    setTdsPercent(TAX_DEFAULTS.TDS_PERCENT)
    setCryptoTaxPercent(TAX_DEFAULTS.CRYPTO_TAX_PERCENT)
    setCessPercent(TAX_DEFAULTS.CESS_PERCENT)
    setGstPercent(TAX_DEFAULTS.GST_PERCENT)
    setHasGlobalChanges(true)
  }

  // ── Format helpers ──
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NO WORKSPACE STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Select a workspace to configure exchange settings.
        </p>
        <Button
          onClick={() => setCurrentPage('workspaces')}
          className="mt-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
        >
          <FolderOpen className="h-4 w-4 mr-2" /> Go to Workspaces
        </Button>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAIN RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Exchange Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage exchange fee defaults and saved exchange configurations for the selected workspace.
          </p>
          <Badge variant="outline" className="mt-2 text-xs border-border font-medium">
            {currentWorkspace.name}
            {currentWorkspace.financialYear && <> &bull; FY {currentWorkspace.financialYear}</>}
          </Badge>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Exchange
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Building2 className="h-4 w-4" />}
          label="Saved Exchanges"
          value={totalExchanges}
          accent="teal"
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="Recently Used"
          value={mostRecentlyUsed ? mostRecentlyUsed.exchangeName : '—'}
          accent="blue"
          isText
        />
        <SummaryCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Avg Buy Fee %"
          value={`${avgBuyFee}%`}
          accent="green"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg Sell Fee %"
          value={`${avgSellFee}%`}
          accent="orange"
        />
      </div>

      {/* ── Fee Priority Info Banner ── */}
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-teal-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-teal-600 dark:text-teal-400">Fee Calculation Priority</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              <strong>1.</strong> If actual fee amount exists in CSV, use CSV fee amount.{' '}
              <strong>2.</strong> Otherwise, use Buy/Sell Fee % provided during CSV upload.{' '}
              <strong>3.</strong> Saved Exchange Settings can prefill those fee percentages during upload.{' '}
              Editing exchange settings does not change previously processed reports.
            </p>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      {configs.length > 0 && (
        <div className="relative max-w-sm">
          <Input
            placeholder="Search exchanges..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-4 rounded-xl"
          />
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          EXCHANGE CONFIGS TABLE (Desktop) / CARDS (Mobile)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {isLoadingConfigs ? (
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1'} gap-4`}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="rounded-2xl animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConfigs.length === 0 ? (
        /* ── Empty State ── */
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery ? 'No exchanges match your search' : 'No exchange settings saved yet.'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search terms.'
                : 'Upload a CSV or add exchange fee details manually to save reusable exchange settings.'}
            </p>
            {!searchQuery && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <Button
                  onClick={openAddDialog}
                  className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Exchange
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage('upload')}
                  className="rounded-xl"
                >
                  <Upload className="h-4 w-4 mr-2" /> Upload CSV
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* ── Mobile: Exchange Config Cards ── */
        <div className="space-y-3">
          {filteredConfigs.map((config) => (
            <Card key={config.id} className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                      <Building2 className="h-4 w-4 text-teal-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{config.exchangeName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Buy: {config.buyFeePercent}%
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Sell: {config.sellFeePercent}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(config)}
                      className="h-8 w-8 p-0 rounded-lg"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => openEditDialog(config)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => {
                            setDeletingConfig(config)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                  <SourceBadge source={config.source} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDate(config.lastUsedAt)}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600 dark:text-green-400">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ── Desktop: Exchange Config Table ── */
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4 w-10">#</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Exchange Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Buy Fee %</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Sell Fee %</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Usage Source</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Last Used</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConfigs.map((config, index) => (
                    <tr
                      key={config.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="p-4 text-xs text-muted-foreground">{index + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-teal-500" />
                          </div>
                          <span className="text-sm font-medium">{config.exchangeName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                          {config.buyFeePercent}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          {config.sellFeePercent}%
                        </span>
                      </td>
                      <td className="p-4">
                        <SourceBadge source={config.source} />
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {formatDate(config.lastUsedAt)}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 dark:text-green-400">
                          Active
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(config)}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-teal-500/10"
                          >
                            <Pencil className="h-3.5 w-3.5 text-teal-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingConfig(config)
                              setDeleteDialogOpen(true)
                            }}
                            className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          GLOBAL TAX & TDS DEFAULTS SECTION
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Separator className="my-2" />
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Tax & TDS Defaults
        </h3>
      </div>

      {/* ── TDS Defaults ── */}
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
            <div className="relative max-w-xs">
              <Input
                id="tds"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={tdsPercent}
                onChange={(e) => { setTdsPercent(e.target.value); setHasGlobalChanges(true) }}
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

      {/* ── Tax Defaults ── */}
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
            <div className="relative max-w-xs">
              <Input
                id="crypto-tax"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cryptoTaxPercent}
                onChange={(e) => { setCryptoTaxPercent(e.target.value); setHasGlobalChanges(true) }}
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
            <div className="relative max-w-xs">
              <Input
                id="cess"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cessPercent}
                onChange={(e) => { setCessPercent(e.target.value); setHasGlobalChanges(true) }}
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

      {/* ── GST Defaults ── */}
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
            <div className="relative max-w-xs">
              <Input
                id="gst"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={gstPercent}
                onChange={(e) => { setGstPercent(e.target.value); setHasGlobalChanges(true) }}
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

      {/* ── Global Save / Reset Buttons ── */}
      <div className="flex flex-col items-end gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleResetDefaults}
            className="rounded-xl"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reset to Indian Defaults
          </Button>
          <Button
            onClick={handleSaveGlobal}
            disabled={isSavingGlobal || !hasGlobalChanges}
            className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[140px]"
          >
            {isSavingGlobal ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save Defaults</>
            )}
          </Button>
        </div>
        {hasGlobalChanges && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Unsaved changes
          </p>
        )}
        <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-md">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>CSV-provided fees and TDS are always preferred over default fallback settings. Editing these defaults does not change previously processed reports.</span>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ADD / EDIT EXCHANGE DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-full' : 'sm:max-w-[440px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-500" />
              {dialogMode === 'add' ? 'Add Exchange Settings' : 'Edit Exchange Settings'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'add'
                ? 'Add fee defaults for a specific exchange'
                : 'Update fee percentages for this exchange'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Exchange Name */}
            <div className="space-y-2">
              <Label htmlFor="exchange-name" className="text-sm font-medium">
                Exchange Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="exchange-name"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value)
                  if (e.target.value.trim()) setFormErrors((prev) => ({ ...prev, name: '' }))
                }}
                className={`rounded-xl ${formErrors.name ? 'border-red-500' : ''}`}
                placeholder="e.g., Binance, Delta Exchange, CoinDCX"
              />
              {formErrors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {formErrors.name}
                </p>
              )}
            </div>

            {/* Buy Fee */}
            <div className="space-y-2">
              <Label htmlFor="buy-fee-input" className="text-sm font-medium">
                Buy Fee (%) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="buy-fee-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formBuyFee}
                  onChange={(e) => {
                    setFormBuyFee(e.target.value)
                    if (e.target.value !== '' && !isNaN(Number(e.target.value)) && Number(e.target.value) >= 0) {
                      setFormErrors((prev) => ({ ...prev, buyFee: '' }))
                    }
                  }}
                  className={`pr-8 rounded-xl ${formErrors.buyFee ? 'border-red-500' : ''}`}
                  placeholder="0.1"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {formErrors.buyFee && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {formErrors.buyFee}
                </p>
              )}
            </div>

            {/* Sell Fee */}
            <div className="space-y-2">
              <Label htmlFor="sell-fee-input" className="text-sm font-medium">
                Sell Fee (%) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="sell-fee-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formSellFee}
                  onChange={(e) => {
                    setFormSellFee(e.target.value)
                    if (e.target.value !== '' && !isNaN(Number(e.target.value)) && Number(e.target.value) >= 0) {
                      setFormErrors((prev) => ({ ...prev, sellFee: '' }))
                    }
                  }}
                  className={`pr-8 rounded-xl ${formErrors.sellFee ? 'border-red-500' : ''}`}
                  placeholder="0.1"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {formErrors.sellFee && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {formErrors.sellFee}
                </p>
              )}
            </div>

            {/* Info about CSV relation */}
            {dialogMode === 'add' && (
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                  <span>
                    Saved exchange settings can prefill fee percentages during future CSV uploads.
                    CSV-provided fee values always take priority over these defaults.
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl"
              disabled={isSavingConfig}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isSavingConfig ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                dialogMode === 'add' ? 'Save Exchange' : 'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          DELETE EXCHANGE CONFIG CONFIRMATION
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              Delete Exchange Setting?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Delete this exchange setting for <strong>&quot;{deletingConfig?.exchangeName}&quot;</strong>?
                </p>
                <p>
                  Existing processed reports will not be changed, but this setting will no longer be
                  available for future CSV imports.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeletingConfig(null)
              }}
              className="rounded-xl"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfig}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUMMARY CARD COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SummaryCard({
  icon,
  label,
  value,
  accent,
  isText = false,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  accent: 'teal' | 'green' | 'orange' | 'blue'
  isText?: boolean
}) {
  const accentStyles: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-500',
    green: 'bg-green-500/10 text-green-500',
    orange: 'bg-orange-500/10 text-orange-500',
    blue: 'bg-blue-500/10 text-blue-500',
  }

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentStyles[accent]}`}>
            {icon}
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-bold ${isText ? 'truncate max-w-[120px]' : ''}`}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOURCE BADGE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SourceBadge({ source }: { source: string }) {
  if (source === 'csv-upload') {
    return (
      <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400">
        <Upload className="h-3 w-3 mr-1" />
        Captured During CSV Upload
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-600 dark:text-teal-400">
      <HandCoins className="h-3 w-3 mr-1" />
      Added Manually
    </Badge>
  )
}
