'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Workspaces Page (Premium Rebuild)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full workspace management: create, search, filter, sort, CRUD,
// open/switch, archive/unarchive, duplicate, delete with confirmation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useMemo } from 'react'
import { useWorkspaceStore, type Workspace } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  FolderOpen,
  Plus,
  Search,
  MoreVertical,
  Settings,
  Archive,
  ArchiveRestore,
  Copy,
  Trash2,
  Clock,
  Loader2,
  LayoutGrid,
  Briefcase,
  FolderClosed,
  Pencil,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Icon options for workspace ─────────────────────────────

const ICON_OPTIONS = [
  'briefcase', 'wallet', 'bitcoin', 'trending-up', 'shield',
  'chart-bar', 'gem', 'coins', 'landmark', 'banknote',
]

// ── Color options for workspace ────────────────────────────

const COLOR_OPTIONS = [
  '#14b8a6', '#f97316', '#8b5cf6', '#3b82f6', '#ef4444',
  '#22c55e', '#ec4899', '#f59e0b', '#06b6d4', '#6366f1',
]

// ── Filter & Sort types ────────────────────────────────────

type FilterType = 'all' | 'active' | 'archived'
type SortType = 'recently-opened' | 'newest-created' | 'oldest-created' | 'name-az'

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'recently-opened', label: 'Recently Opened' },
  { value: 'newest-created', label: 'Newest Created' },
  { value: 'oldest-created', label: 'Oldest Created' },
  { value: 'name-az', label: 'Name A–Z' },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN WORKSPACES PAGE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function WorkspacesPage() {
  const {
    workspaces,
    isLoading,
    currentWorkspace,
    createWorkspace,
    updateWorkspace,
    selectWorkspace,
    archiveWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    fetchWorkspaces,
  } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  // ── State ──
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('recently-opened')

  // Create dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Form state (shared for create & edit)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFY, setFormFY] = useState(new Date().getFullYear().toString())
  const [formColor, setFormColor] = useState('#14b8a6')
  const [formIcon, setFormIcon] = useState('briefcase')

  // ── Summary stats ──
  const totalWorkspaces = workspaces.length
  const activeWorkspaces = workspaces.filter((w) => !w.isArchived).length
  const archivedWorkspaces = workspaces.filter((w) => w.isArchived).length
  const recentlyOpened = workspaces
    .filter((w) => w.lastOpenedAt)
    .sort((a, b) => new Date(b.lastOpenedAt!).getTime() - new Date(a.lastOpenedAt!).getTime())[0]

  // ── Filter, search, and sort workspaces ──
  const filteredWorkspaces = useMemo(() => {
    let result = [...workspaces]

    // Apply filter
    if (filter === 'active') result = result.filter((w) => !w.isArchived)
    if (filter === 'archived') result = result.filter((w) => w.isArchived)

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          (w.description && w.description.toLowerCase().includes(q)) ||
          (w.financialYear && w.financialYear.toLowerCase().includes(q))
      )
    }

    // Apply sort
    switch (sort) {
      case 'recently-opened':
        result.sort((a, b) => {
          // Current workspace always first among active
          if (a.id === currentWorkspace?.id) return -1
          if (b.id === currentWorkspace?.id) return 1
          const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0
          const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0
          return dateB - dateA
        })
        break
      case 'newest-created':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest-created':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'name-az':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    return result
  }, [workspaces, filter, searchQuery, sort, currentWorkspace])

  // ── Create workspace handler ──
  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Workspace name is required')
      return
    }
    setIsCreating(true)
    try {
      const newWs = await createWorkspace({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        financialYear: formFY.trim() || undefined,
        color: formColor,
        icon: formIcon,
      })
      selectWorkspace(newWs.id)
      setCurrentPage('dashboard')
      toast.success('Workspace created successfully')
      setNewDialogOpen(false)
      resetForm()
    } catch {
      toast.error('Failed to create workspace')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Edit workspace handler ──
  const handleEdit = async () => {
    if (!editingWorkspace || !formName.trim()) {
      toast.error('Workspace name is required')
      return
    }
    setIsUpdating(true)
    try {
      await updateWorkspace(editingWorkspace.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        financialYear: formFY.trim() || undefined,
        color: formColor,
        icon: formIcon,
      })
      toast.success('Workspace updated successfully')
      setEditDialogOpen(false)
      setEditingWorkspace(null)
      resetForm()
    } catch {
      toast.error('Failed to update workspace')
    } finally {
      setIsUpdating(false)
    }
  }

  // ── Open edit dialog with pre-filled data ──
  const openEditDialog = (ws: Workspace) => {
    setEditingWorkspace(ws)
    setFormName(ws.name)
    setFormDescription(ws.description || '')
    setFormFY(ws.financialYear || new Date().getFullYear().toString())
    setFormColor(ws.color || '#14b8a6')
    setFormIcon(ws.icon || 'briefcase')
    setEditDialogOpen(true)
  }

  // ── Navigate to workspace dashboard ──
  const handleSelectWorkspace = (workspace: Workspace) => {
    selectWorkspace(workspace.id)
    setCurrentPage('dashboard')
  }

  // ── Archive / Unarchive ──
  const handleArchive = async (workspace: Workspace) => {
    try {
      await archiveWorkspace(workspace.id, !workspace.isArchived)
      toast.success(workspace.isArchived ? 'Workspace unarchived' : 'Workspace archived')
    } catch {
      toast.error('Failed to update workspace')
    }
  }

  // ── Duplicate ──
  const handleDuplicate = async (workspace: Workspace) => {
    try {
      await duplicateWorkspace(workspace.id)
      toast.success('Workspace duplicated')
    } catch {
      toast.error('Failed to duplicate workspace')
    }
  }

  // ── Delete with confirmation ──
  const handleDelete = async () => {
    if (!deletingWorkspace) return
    if (deleteConfirmName.trim() !== deletingWorkspace.name.trim()) {
      toast.error('Type the workspace name exactly to confirm deletion')
      return
    }
    setIsDeleting(true)
    try {
      await deleteWorkspace(deletingWorkspace.id)
      toast.success('Workspace deleted')
      setDeleteDialogOpen(false)
      setDeletingWorkspace(null)
      setDeleteConfirmName('')
    } catch {
      toast.error('Failed to delete workspace')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Open delete dialog ──
  const openDeleteDialog = (ws: Workspace) => {
    setDeletingWorkspace(ws)
    setDeleteConfirmName('')
    setDeleteDialogOpen(true)
  }

  // ── Reset form ──
  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormFY(new Date().getFullYear().toString())
    setFormColor('#14b8a6')
    setFormIcon('briefcase')
  }

  // ── Open create dialog ──
  const openCreateDialog = () => {
    resetForm()
    setNewDialogOpen(true)
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workspaces</h2>
          <p className="text-sm text-muted-foreground">
            Create, switch, and manage separate audit projects.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" /> New Workspace
        </Button>
      </div>

      {/* ── Summary Overview Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<FolderOpen className="h-4 w-4" />}
          label="Total Workspaces"
          value={totalWorkspaces}
          accent="teal"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Active"
          value={activeWorkspaces}
          accent="green"
        />
        <SummaryCard
          icon={<Archive className="h-4 w-4" />}
          label="Archived"
          value={archivedWorkspaces}
          accent="orange"
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="Recently Opened"
          value={recentlyOpened ? recentlyOpened.name : '—'}
          accent="blue"
          isText
        />
      </div>

      {/* ── Search, Filters & Sort Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or financial year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 shrink-0">
          {(['all', 'active', 'archived'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={`rounded-xl capitalize ${filter === f ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}`}
            >
              {f}
              {f === 'all' && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                  {workspaces.length}
                </Badge>
              )}
              {f === 'active' && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                  {activeWorkspaces}
                </Badge>
              )}
              {f === 'archived' && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                  {archivedWorkspaces}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Sort dropdown */}
        {!isMobile && (
          <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Workspaces Grid ── */}
      {isLoading ? (
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-4`}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        /* ── Empty States ── */
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              {filter === 'archived' ? (
                <Archive className="h-8 w-8 text-muted-foreground/50" />
              ) : (
                <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery
                ? 'No workspaces match your search'
                : filter === 'archived'
                ? 'Nothing archived yet'
                : 'Create your first workspace'}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {searchQuery
                ? 'Try adjusting your search terms.'
                : filter === 'archived'
                ? 'Archived workspaces will appear here.'
                : 'Start a separate crypto audit project for your exchange records.'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Button
                onClick={openCreateDialog}
                className="mt-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> New Workspace
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-4`}>
          {filteredWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === currentWorkspace?.id}
              onSelect={handleSelectWorkspace}
              onArchive={handleArchive}
              onDuplicate={handleDuplicate}
              onDelete={openDeleteDialog}
              onEdit={openEditDialog}
              onSettings={() => {
                selectWorkspace(workspace.id)
                setCurrentPage('workspace-settings')
              }}
            />
          ))}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CREATE WORKSPACE DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-full' : 'sm:max-w-[480px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal-500" />
              Create New Workspace
            </DialogTitle>
            <DialogDescription>
              Set up a new audit project for your crypto exchange records
            </DialogDescription>
          </DialogHeader>

          <WorkspaceForm
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formFY={formFY}
            setFormFY={setFormFY}
            formColor={formColor}
            setFormColor={setFormColor}
            formIcon={formIcon}
            setFormIcon={setFormIcon}
          />

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setNewDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !formName.trim()}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          EDIT / RENAME WORKSPACE DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className={`${isMobile ? 'max-w-full' : 'sm:max-w-[480px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-teal-500" />
              Edit Workspace
            </DialogTitle>
            <DialogDescription>
              Update workspace name, description, and settings
            </DialogDescription>
          </DialogHeader>

          <WorkspaceForm
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formFY={formFY}
            setFormFY={setFormFY}
            formColor={formColor}
            setFormColor={setFormColor}
            formIcon={formIcon}
            setFormIcon={setFormIcon}
          />

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setEditingWorkspace(null)
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isUpdating || !formName.trim()}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
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
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Workspace?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Deleting <strong>&quot;{deletingWorkspace?.name}&quot;</strong> will permanently remove
                  its CSV imports, FIFO reports, tax summaries, notes, and export history.
                  This action cannot be undone.
                </p>
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                  <Label className="text-xs font-medium text-red-600 dark:text-red-400">
                    Type the workspace name to confirm deletion
                  </Label>
                  <Input
                    placeholder={deletingWorkspace?.name}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="mt-2 rounded-xl border-red-500/30 focus:border-red-500"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeletingWorkspace(null)
                setDeleteConfirmName('')
              }}
              className="rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmName.trim() !== deletingWorkspace?.name.trim()}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-50"
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                'Delete Workspace'
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
            <p className={`text-sm font-bold ${isText ? 'text-sm truncate max-w-[120px]' : ''}`}>
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WORKSPACE CARD COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WorkspaceCard({
  workspace,
  isActive,
  onSelect,
  onArchive,
  onDuplicate,
  onDelete,
  onEdit,
  onSettings,
}: {
  workspace: Workspace
  isActive: boolean
  onSelect: (ws: Workspace) => void
  onArchive: (ws: Workspace) => void
  onDuplicate: (ws: Workspace) => void
  onDelete: (ws: Workspace) => void
  onEdit: (ws: Workspace) => void
  onSettings: () => void
}) {
  const isMobile = useIsMobile()
  const tradeCount = workspace._count?.trades ?? 0
  const csvCount = workspace._count?.csvFiles ?? 0
  const reportCount = workspace._count?.reports ?? 0
  const lastOpened = workspace.lastOpenedAt
    ? new Date(workspace.lastOpenedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Never'
  const createdDate = new Date(workspace.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <Card
      className={`rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group ${
        isActive ? 'border-teal-500/50 bg-teal-500/5' : 'border-border'
      }`}
    >
      <CardContent className="p-5">
        {/* ── Top: Workspace info + actions ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Color/Icon badge */}
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: workspace.color || '#14b8a6' }}
            >
              {(workspace.icon || 'briefcase').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate">{workspace.name}</h3>
              {/* Description */}
              {workspace.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{workspace.description}</p>
              )}
              {/* Badges row */}
              <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                {workspace.financialYear && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    FY {workspace.financialYear}
                  </Badge>
                )}
                {workspace.isArchived ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/30 text-orange-600">
                    Archived
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600 dark:text-green-400">
                    Active
                  </Badge>
                )}
                {isActive && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30">
                    Current
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* 3-dot actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(workspace) }}>
                <Pencil className="h-4 w-4 mr-2" /> Rename / Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings() }}>
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(workspace) }}>
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(workspace) }}>
                {workspace.isArchived ? (
                  <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</>
                ) : (
                  <><Archive className="h-4 w-4 mr-2" /> Archive</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onSelect={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); onDelete(workspace) }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Bottom: Stats row ── */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LayoutGrid className="h-3 w-3" />
            <span>{tradeCount} trades</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderOpen className="h-3 w-3" />
            <span>{csvCount} CSVs</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{lastOpened}</span>
          </div>
        </div>

        {/* ── Open Workspace button ── */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <Button
            onClick={(e) => { e.stopPropagation(); onSelect(workspace) }}
            className={`w-full rounded-xl ${
              isActive
                ? 'bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 dark:text-teal-400 border border-teal-500/30'
                : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
            variant={isActive ? 'outline' : 'default'}
            size="sm"
          >
            {isActive ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> Currently Active</>
            ) : (
              <><ArrowRight className="h-4 w-4 mr-2" /> Open Workspace</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED WORKSPACE FORM COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WorkspaceForm({
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formFY,
  setFormFY,
  formColor,
  setFormColor,
  formIcon,
  setFormIcon,
}: {
  formName: string
  setFormName: (v: string) => void
  formDescription: string
  setFormDescription: (v: string) => void
  formFY: string
  setFormFY: (v: string) => void
  formColor: string
  setFormColor: (v: string) => void
  formIcon: string
  setFormIcon: (v: string) => void
}) {
  return (
    <div className="space-y-4 py-2 max-h-[55vh] overflow-y-auto pr-1">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="ws-name">Workspace Name *</Label>
        <Input
          id="ws-name"
          placeholder="e.g., Binance FY 2025–26"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          className="rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="ws-desc">Description</Label>
        <Textarea
          id="ws-desc"
          placeholder="Optional description for this workspace"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          className="rounded-xl"
          rows={2}
        />
      </div>

      {/* Financial Year */}
      <div className="space-y-2">
        <Label htmlFor="ws-fy">Financial Year</Label>
        <Input
          id="ws-fy"
          placeholder="e.g., 2025-26"
          value={formFY}
          onChange={(e) => setFormFY(e.target.value)}
          className="rounded-xl"
        />
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormColor(color)}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                formColor === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Icon Selector */}
      <div className="space-y-2">
        <Label>Icon</Label>
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setFormIcon(icon)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                formIcon === icon
                  ? 'border-teal-500 bg-teal-500/10 text-teal-600'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {icon.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
