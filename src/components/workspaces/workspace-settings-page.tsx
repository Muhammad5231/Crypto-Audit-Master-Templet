'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Workspace Settings Page (Premium Rebuild)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Settings for the CURRENTLY SELECTED workspace only.
// Two-column desktop layout: left = form/settings, right = summary + actions.
// Mobile: single-column stacked, danger zone at bottom.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore, type Workspace } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { generateFYOptions } from '@/lib/tax-defaults'
import {
  Settings,
  Save,
  Archive,
  ArchiveRestore,
  Copy,
  Trash2,
  Loader2,
  Briefcase,
  FolderOpen,
  Plus,
  Calendar,
  Clock,
  FileSpreadsheet,
  BarChart3,
  Download,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Color & Icon options ───────────────────────────────────

const COLOR_OPTIONS = [
  '#14b8a6', '#f97316', '#8b5cf6', '#3b82f6', '#ef4444',
  '#22c55e', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1',
]

const ICON_OPTIONS = [
  'briefcase', 'wallet', 'bitcoin', 'trending-up', 'shield',
  'chart-bar', 'gem', 'coins', 'landmark', 'banknote',
]

// ── Financial Year options ──────────────────────────────────

const FY_OPTIONS = generateFYOptions()

// ── Workspace Stats interface ──────────────────────────────

interface WorkspaceStats {
  tradeCount: number
  csvFileCount: number
  reportCount: number
  exportCount: number
  noteCount: number
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN WORKSPACE SETTINGS COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function WorkspaceSettingsPage() {
  const {
    currentWorkspace,
    updateWorkspace,
    archiveWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    fetchWorkspaces,
    workspaces,
  } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  // ── Form state — initialized from current workspace ──
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [financialYear, setFinancialYear] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('briefcase')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [nameError, setNameError] = useState('')

  // ── Workspace stats ──
  const [stats, setStats] = useState<WorkspaceStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // ── Action dialog states ──
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Sync form state with current workspace ──
  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setDescription(currentWorkspace.description || '')
      setFinancialYear(currentWorkspace.financialYear || '')
      setColor(currentWorkspace.color || '#14b8a6')
      setIcon(currentWorkspace.icon || 'briefcase')
      setHasChanges(false)
      setNameError('')
    }
  }, [currentWorkspace])

  // ── Track changes ──
  useEffect(() => {
    if (!currentWorkspace) return
    const changed =
      name !== currentWorkspace.name ||
      description !== (currentWorkspace.description || '') ||
      financialYear !== (currentWorkspace.financialYear || '') ||
      color !== (currentWorkspace.color || '#14b8a6') ||
      icon !== (currentWorkspace.icon || 'briefcase')
    setHasChanges(changed)
  }, [name, description, financialYear, color, icon, currentWorkspace])

  // ── Fetch workspace stats ──
  const fetchStats = useCallback(async () => {
    if (!currentWorkspace) return
    setIsLoadingStats(true)
    try {
      const data = await apiGet<Workspace & { stats: WorkspaceStats }>(
        `/api/workspaces/${currentWorkspace.id}`
      )
      if (data.stats) {
        setStats(data.stats)
      }
    } catch {
      // Silently fail — stats are supplementary info
    } finally {
      setIsLoadingStats(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // ── Save changes ──
  const handleSave = async () => {
    if (!currentWorkspace) return

    // Validate
    if (!name.trim()) {
      setNameError('Workspace name is required')
      return
    }
    setNameError('')

    setIsSaving(true)
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim(),
        financialYear: financialYear.trim(),
        color,
        icon,
      })
      toast.success('Workspace settings saved successfully')
      setHasChanges(false)
      // Refresh stats to reflect any changes
      fetchStats()
    } catch {
      toast.error('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Archive / Unarchive with confirmation ──
  const handleArchive = async () => {
    if (!currentWorkspace) return
    setIsArchiving(true)
    try {
      await archiveWorkspace(currentWorkspace.id, !currentWorkspace.isArchived)
      toast.success(currentWorkspace.isArchived ? 'Workspace restored successfully' : 'Workspace archived successfully')
      setArchiveDialogOpen(false)
      fetchStats()
    } catch {
      toast.error('Failed to update workspace status')
    } finally {
      setIsArchiving(false)
    }
  }

  // ── Duplicate with confirmation ──
  const handleDuplicate = async () => {
    if (!currentWorkspace) return
    setIsDuplicating(true)
    try {
      await duplicateWorkspace(currentWorkspace.id)
      toast.success('Workspace duplicated successfully')
      setDuplicateDialogOpen(false)
      await fetchWorkspaces()
    } catch {
      toast.error('Failed to duplicate workspace')
    } finally {
      setIsDuplicating(false)
    }
  }

  // ── Delete with type-to-confirm ──
  const handleDelete = async () => {
    if (!currentWorkspace) return
    if (deleteConfirmName.trim() !== currentWorkspace.name.trim()) {
      toast.error('Type the workspace name exactly to confirm deletion')
      return
    }
    setIsDeleting(true)
    try {
      await deleteWorkspace(currentWorkspace.id)
      toast.success('Workspace deleted permanently')
      setDeleteDialogOpen(false)
      setDeleteConfirmName('')
      // Navigate away since current workspace is deleted
      if (workspaces.length > 0) {
        setCurrentPage('workspaces')
      } else {
        setCurrentPage('dashboard')
      }
    } catch {
      toast.error('Failed to delete workspace')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Format date helper ──
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ── Get stats values ──
  const csvCount = stats?.csvFileCount ?? currentWorkspace?._count?.csvFiles ?? 0
  const reportCount = stats?.reportCount ?? currentWorkspace?._count?.reports ?? 0
  const exportCount = stats?.exportCount ?? currentWorkspace?._count?.exportHistory ?? 0

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NO WORKSPACE SELECTED STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Settings className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No workspace selected</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Select or create a workspace to manage its settings.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <Button
            onClick={() => setCurrentPage('workspaces')}
            className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
          >
            <FolderOpen className="h-4 w-4 mr-2" /> Go to Workspaces
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const { createWorkspace } = useWorkspaceStore.getState()
              try {
                const newWs = await createWorkspace({
                  name: `Workspace ${(useWorkspaceStore.getState().workspaces?.length ?? 0) + 1}`,
                  financialYear: new Date().getFullYear().toString(),
                })
                useWorkspaceStore.getState().selectWorkspace(newWs.id)
              } catch {
                toast.error('Failed to create workspace')
              }
            }}
            className="rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" /> New Workspace
          </Button>
        </div>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAIN RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-6">
      {/* ── Page Header with Context Badge ── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage details and actions for the currently selected workspace.
        </p>
        {/* Workspace Context Badge */}
        <div className="flex items-center gap-2 mt-3">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {(icon || 'briefcase').slice(0, 2).toUpperCase()}
          </div>
          <Badge variant="outline" className="text-xs font-medium border-border">
            {currentWorkspace.name}
            {currentWorkspace.financialYear && (
              <> &bull; FY {currentWorkspace.financialYear}</>
            )}
            <> &bull; </>
            {currentWorkspace.isArchived ? (
              <span className="text-orange-600 dark:text-orange-400">Archived</span>
            ) : (
              <span className="text-green-600 dark:text-green-400">Active</span>
            )}
          </Badge>
        </div>
      </div>

      {/* ── Two-Column Layout (desktop) / Single Column (mobile) ── */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'} gap-6`}>
        {/* ═══════════════════════════════════════════════════════
            LEFT COLUMN — Workspace Details & Settings (2/3 width)
            ═══════════════════════════════════════════════════════ */}
        <div className={`${isMobile ? '' : 'lg:col-span-2'} space-y-6`}>
          {/* ── Workspace Details Form ── */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-500" />
                Workspace Details
              </CardTitle>
              <CardDescription className="text-xs">
                Update the name, description, and appearance of this workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Workspace Name */}
              <div className="space-y-2">
                <Label htmlFor="ws-name" className="text-sm font-medium">
                  Workspace Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (e.target.value.trim()) setNameError('')
                  }}
                  onBlur={() => {
                    if (!name.trim()) setNameError('Workspace name is required')
                  }}
                  className={`rounded-xl ${nameError ? 'border-red-500 focus:border-red-500' : ''}`}
                  placeholder="e.g., Binance Audit FY 2025–26"
                />
                {nameError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {nameError}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="ws-desc" className="text-sm font-medium">
                  Description <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Textarea
                  id="ws-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl"
                  rows={3}
                  placeholder="e.g., Spot trade audit records for Binance exports."
                />
              </div>

              {/* Color Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Workspace Color</Label>
                <p className="text-xs text-muted-foreground">Used for workspace identity in dropdowns and cards</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full border-2 transition-all duration-200 ${
                        color === c
                          ? 'border-foreground scale-110 shadow-sm'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Workspace Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold transition-all duration-200 ${
                        icon === ic
                          ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 shadow-sm'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {ic.slice(0, 2).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {(icon || 'briefcase').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{name || 'Workspace Name'}</p>
                    <p className="text-xs text-muted-foreground">
                      FY {financialYear || 'Not set'}
                      {currentWorkspace.isArchived ? ' \u00B7 Archived' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between pt-2">
                {hasChanges && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Unsaved changes
                  </p>
                )}
                <div className="ml-auto">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges || !name.trim()}
                    className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[140px]"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Financial Year Settings ── */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-teal-500" />
                Financial Year
              </CardTitle>
              <CardDescription className="text-xs">
                Used to organize workspace audit records and exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-fy" className="text-sm font-medium">Financial Year</Label>
                <Select value={financialYear} onValueChange={setFinancialYear}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select financial year" />
                  </SelectTrigger>
                  <SelectContent>
                    {FY_OPTIONS.map((fy) => (
                      <SelectItem key={fy} value={fy}>
                        FY {fy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Changing financial year updates workspace metadata. It does not retroactively filter existing data.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── MOBILE ONLY: Summary Card + Quick Actions (moved to bottom on mobile) ── */}
          {isMobile && (
            <>
              <WorkspaceSummaryCard
                workspace={currentWorkspace}
                stats={stats}
                isLoadingStats={isLoadingStats}
                csvCount={csvCount}
                reportCount={reportCount}
                exportCount={exportCount}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
              />

              <QuickActionsCard
                workspace={currentWorkspace}
                onArchive={() => setArchiveDialogOpen(true)}
                onDuplicate={() => setDuplicateDialogOpen(true)}
                onDelete={() => {
                  setDeleteConfirmName('')
                  setDeleteDialogOpen(true)
                }}
              />

              <DangerZoneCard
                workspace={currentWorkspace}
                onDelete={() => {
                  setDeleteConfirmName('')
                  setDeleteDialogOpen(true)
                }}
              />
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            RIGHT COLUMN — Summary + Quick Actions + Danger Zone (1/3 width)
            ═══════════════════════════════════════════════════════ */}
        {!isMobile && (
          <div className="space-y-6">
            <WorkspaceSummaryCard
              workspace={currentWorkspace}
              stats={stats}
              isLoadingStats={isLoadingStats}
              csvCount={csvCount}
              reportCount={reportCount}
              exportCount={exportCount}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
            />

            <QuickActionsCard
              workspace={currentWorkspace}
              onArchive={() => setArchiveDialogOpen(true)}
              onDuplicate={() => setDuplicateDialogOpen(true)}
              onDelete={() => {
                setDeleteConfirmName('')
                setDeleteDialogOpen(true)
              }}
            />

            <DangerZoneCard
              workspace={currentWorkspace}
              onDelete={() => {
                setDeleteConfirmName('')
                setDeleteDialogOpen(true)
              }}
            />
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ARCHIVE / UNARCHIVE CONFIRMATION DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {currentWorkspace.isArchived ? (
                <><ArchiveRestore className="h-5 w-5 text-amber-500" /> Restore Workspace</>
              ) : (
                <><Archive className="h-5 w-5 text-amber-500" /> Archive Workspace</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {currentWorkspace.isArchived ? (
                  <p>
                    Restoring <strong>&quot;{currentWorkspace.name}&quot;</strong> will make it active again.
                    It will appear under the Active tab in your Workspaces page.
                  </p>
                ) : (
                  <p>
                    Archiving <strong>&quot;{currentWorkspace.name}&quot;</strong> will hide it from active lists
                    without deleting any data. It will appear under the Archived tab and can be restored at any time.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
            >
              {isArchiving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {currentWorkspace.isArchived ? 'Restoring...' : 'Archiving...'}</>
              ) : (
                currentWorkspace.isArchived ? 'Restore Workspace' : 'Archive Workspace'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          DUPLICATE WORKSPACE CONFIRMATION DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-full' : 'sm:max-w-[440px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-teal-500" />
              Duplicate Workspace
            </DialogTitle>
            <DialogDescription>
              Create a copy of this workspace with the same settings and exchange configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: currentWorkspace.color || '#14b8a6' }}
                >
                  {(currentWorkspace.icon || 'briefcase').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{currentWorkspace.name}</p>
                  <p className="text-xs text-muted-foreground">
                    FY {currentWorkspace.financialYear || 'Not set'} &bull; {currentWorkspace.isArchived ? 'Archived' : 'Active'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                <span>
                  The duplicate will be named <strong>&quot;{currentWorkspace.name} (Copy)&quot;</strong>.
                  CSV imports, trades, and reports will NOT be copied. Only workspace settings and exchange configuration are duplicated.
                </span>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
              className="rounded-xl"
              disabled={isDuplicating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isDuplicating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Duplicating...</>
              ) : (
                <><Copy className="h-4 w-4 mr-2" /> Duplicate Workspace</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          DELETE WORKSPACE CONFIRMATION DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              Delete Workspace?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Deleting <strong>&quot;{currentWorkspace.name}&quot;</strong> will permanently remove its
                  related CSV uploads, processed reports, realized trades, open holdings, notes, and export history.
                </p>
                <p className="text-red-600 dark:text-red-400 font-medium text-xs">
                  This action cannot be undone. All data will be permanently deleted.
                </p>
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                  <Label className="text-xs font-medium text-red-600 dark:text-red-400">
                    Type the workspace name to confirm deletion
                  </Label>
                  <Input
                    placeholder={currentWorkspace.name}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="rounded-xl border-red-500/30 focus:border-red-500"
                  />
                  {deleteConfirmName && deleteConfirmName.trim() !== currentWorkspace.name.trim() && (
                    <p className="text-[10px] text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Name does not match
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmName('')
              }}
              className="rounded-xl"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmName.trim() !== currentWorkspace.name.trim()}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-50"
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Delete Workspace</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE SUMMARY CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WorkspaceSummaryCard({
  workspace,
  stats,
  isLoadingStats,
  csvCount,
  reportCount,
  exportCount,
  formatDate,
  formatDateTime,
}: {
  workspace: Workspace
  stats: WorkspaceStats | null
  isLoadingStats: boolean
  csvCount: number
  reportCount: number
  exportCount: number
  formatDate: (d: string | null) => string
  formatDateTime: (d: string | null) => string
}) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-teal-500" />
          Workspace Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Workspace Identity */}
        <div className="flex items-center gap-3 pb-3 border-b border-border/50">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
            style={{ backgroundColor: workspace.color || '#14b8a6' }}
          >
            {(workspace.icon || 'briefcase').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{workspace.name}</p>
            <div className="flex items-center gap-1.5">
              {workspace.financialYear && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  FY {workspace.financialYear}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  workspace.isArchived
                    ? 'border-orange-500/30 text-orange-600 dark:text-orange-400'
                    : 'border-green-500/30 text-green-600 dark:text-green-400'
                }`}
              >
                {workspace.isArchived ? 'Archived' : 'Active'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Rows */}
        <div className="space-y-2.5">
          <SummaryRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Created"
            value={formatDate(workspace.createdAt)}
          />
          <SummaryRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Last Opened"
            value={formatDateTime(workspace.lastOpenedAt)}
          />
          <Separator className="my-1" />
          <SummaryRow
            icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
            label="CSV Files Uploaded"
            value={isLoadingStats ? '...' : String(csvCount)}
            accent={csvCount > 0 ? 'teal' : undefined}
          />
          <SummaryRow
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Reports Generated"
            value={isLoadingStats ? '...' : String(reportCount)}
            accent={reportCount > 0 ? 'blue' : undefined}
          />
          <SummaryRow
            icon={<Download className="h-3.5 w-3.5" />}
            label="Exports Created"
            value={isLoadingStats ? '...' : String(exportCount)}
            accent={exportCount > 0 ? 'purple' : undefined}
          />
        </div>

        {/* Status Indicator */}
        <div className={`rounded-xl p-3 mt-2 ${
          workspace.isArchived
            ? 'bg-orange-500/10 border border-orange-500/20'
            : 'bg-green-500/10 border border-green-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {workspace.isArchived ? (
              <Archive className="h-4 w-4 text-orange-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <span className={`text-xs font-medium ${
              workspace.isArchived
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {workspace.isArchived ? 'This workspace is archived' : 'This workspace is active'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUICK ACTIONS CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function QuickActionsCard({
  workspace,
  onArchive,
  onDuplicate,
  onDelete,
}: {
  workspace: Workspace
  onArchive: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-teal-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Duplicate */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
              <Copy className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Duplicate Workspace</p>
              <p className="text-[10px] text-muted-foreground">Create a copy with same settings</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            className="rounded-xl text-teal-600 hover:text-teal-700 dark:text-teal-400"
          >
            Duplicate
          </Button>
        </div>

        {/* Archive / Restore */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              {workspace.isArchived ? (
                <ArchiveRestore className="h-4 w-4 text-amber-500" />
              ) : (
                <Archive className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {workspace.isArchived ? 'Restore Workspace' : 'Archive Workspace'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {workspace.isArchived
                  ? 'Make this workspace active again'
                  : 'Hide from active lists without deleting'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onArchive}
            className="rounded-xl text-amber-600 hover:text-amber-700 dark:text-amber-400"
          >
            {workspace.isArchived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DANGER ZONE CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DangerZoneCard({
  workspace,
  onDelete,
}: {
  workspace: Workspace
  onDelete: () => void
}) {
  return (
    <Card className="rounded-2xl border-red-500/30 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-xs text-red-500/70">
          Irreversible and destructive actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Workspace</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deleting this workspace will permanently remove its related CSV uploads, processed reports,
                realized trades, open holdings, notes, and export history. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="rounded-xl shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUMMARY ROW HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SummaryRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: 'teal' | 'blue' | 'purple'
}) {
  const accentColor: Record<string, string> = {
    teal: 'text-teal-600 dark:text-teal-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs font-medium ${accent ? accentColor[accent] : ''}`}>
        {value}
      </span>
    </div>
  )
}
