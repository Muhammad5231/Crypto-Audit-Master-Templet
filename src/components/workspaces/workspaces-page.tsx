'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Workspaces Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full workspace management: create, search, filter, CRUD, navigate.
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FolderOpen,
  Plus,
  Search,
  MoreVertical,
  Settings,
  Archive,
  Copy,
  Trash2,
  Briefcase,
  Clock,
  ArrowUpDown,
  Loader2,
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

// ── Filter type ────────────────────────────────────────────

type FilterType = 'all' | 'active' | 'archived'

// ── Main Workspaces Component ──────────────────────────────

export default function WorkspacesPage() {
  const {
    workspaces,
    isLoading,
    currentWorkspace,
    createWorkspace,
    selectWorkspace,
    archiveWorkspace,
    duplicateWorkspace,
    deleteWorkspace,
    fetchWorkspaces,
  } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  // New workspace form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFY, setFormFY] = useState(new Date().getFullYear().toString())
  const [formColor, setFormColor] = useState('#14b8a6')
  const [formIcon, setFormIcon] = useState('briefcase')

  // Filter and search workspaces
  const filteredWorkspaces = useMemo(() => {
    let result = workspaces

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

    // Sort: current workspace first, then by lastOpenedAt desc
    return result.sort((a, b) => {
      if (a.id === currentWorkspace?.id) return -1
      if (b.id === currentWorkspace?.id) return 1
      const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0
      const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0
      return dateB - dateA
    })
  }, [workspaces, filter, searchQuery, currentWorkspace])

  // ── Create workspace handler ──
  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Workspace name is required')
      return
    }
    setIsCreating(true)
    try {
      await createWorkspace({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        financialYear: formFY.trim() || undefined,
        color: formColor,
        icon: formIcon,
      })
      toast.success('Workspace created successfully')
      setNewDialogOpen(false)
      resetForm()
    } catch {
      toast.error('Failed to create workspace')
    } finally {
      setIsCreating(false)
    }
  }

  // ── Reset form ──
  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormFY(new Date().getFullYear().toString())
    setFormColor('#14b8a6')
    setFormIcon('briefcase')
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

  // ── Delete ──
  const handleDelete = async (workspaceId: string) => {
    try {
      await deleteWorkspace(workspaceId)
      toast.success('Workspace deleted')
    } catch {
      toast.error('Failed to delete workspace')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workspaces</h2>
          <p className="text-sm text-muted-foreground">
            Manage your audit workspaces for different financial years and exchanges
          </p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl">
              <Plus className="h-4 w-4 mr-2" /> New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="ws-name">Name *</Label>
                <Input
                  id="ws-name"
                  placeholder="e.g., WazirX FY 2024-25"
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
                      onClick={() => setFormColor(color)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        formColor === color ? 'border-foreground scale-110' : 'border-transparent'
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
                      onClick={() => setFormIcon(icon)}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all ${
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
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="rounded-xl">Cancel</Button>
              </DialogClose>
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
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
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
            </Button>
          ))}
        </div>
      </div>

      {/* ── Workspaces Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">
              {searchQuery || filter !== 'all' ? 'No matching workspaces' : 'No workspaces yet'}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first workspace to start auditing your crypto trades.'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Button
                onClick={() => setNewDialogOpen(true)}
                className="mt-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> Create Workspace
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === currentWorkspace?.id}
              onSelect={handleSelectWorkspace}
              onArchive={handleArchive}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onSettings={() => {
                selectWorkspace(workspace.id)
                setCurrentPage('workspace-settings')
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Workspace Card Component ───────────────────────────────

function WorkspaceCard({
  workspace,
  isActive,
  onSelect,
  onArchive,
  onDuplicate,
  onDelete,
  onSettings,
}: {
  workspace: Workspace
  isActive: boolean
  onSelect: (ws: Workspace) => void
  onArchive: (ws: Workspace) => void
  onDuplicate: (ws: Workspace) => void
  onDelete: (id: string) => void
  onSettings: () => void
}) {
  const tradeCount = workspace._count?.trades ?? 0
  const lastOpened = workspace.lastOpenedAt
    ? new Date(workspace.lastOpenedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Never'

  return (
    <Card
      className={`rounded-2xl border-border shadow-sm hover:shadow-md transition-all cursor-pointer group ${
        isActive ? 'border-teal-500/50 bg-teal-500/5' : ''
      }`}
      onClick={() => onSelect(workspace)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          {/* Left side: info */}
          <div className="flex items-start gap-3 min-w-0">
            {/* Color dot */}
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: workspace.color || '#14b8a6' }}
            >
              {(workspace.icon || 'briefcase').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{workspace.name}</h3>
              <div className="flex items-center gap-2 mt-1">
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
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600">
                    Active
                  </Badge>
                )}
                {isActive && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    Current
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right side: actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSettings() }}>
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(workspace) }}>
                <Archive className="h-4 w-4 mr-2" />
                {workspace.isArchived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(workspace) }}>
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={(e) => e.preventDefault()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Workspace?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &quot;{workspace.name}&quot; and all its trades, CSV files, and reports.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(workspace.id)}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Bottom stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3 w-3" />
            <span>{tradeCount} trades</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{lastOpened}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
