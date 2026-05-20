'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Workspace Settings Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Settings for the currently selected workspace: edit name, desc,
// FY, color, icon. Also archive, duplicate, delete operations.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
  Settings,
  Save,
  Archive,
  Copy,
  Trash2,
  Loader2,
  Briefcase,
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

// ── Main Workspace Settings Component ──────────────────────

export default function WorkspaceSettingsPage() {
  const { currentWorkspace, updateWorkspace, archiveWorkspace, duplicateWorkspace, deleteWorkspace } = useWorkspaceStore()

  // Form state — initialized from current workspace
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [financialYear, setFinancialYear] = useState('')
  const [color, setColor] = useState('#14b8a6')
  const [icon, setIcon] = useState('briefcase')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Sync form state with current workspace
  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setDescription(currentWorkspace.description || '')
      setFinancialYear(currentWorkspace.financialYear || '')
      setColor(currentWorkspace.color || '#14b8a6')
      setIcon(currentWorkspace.icon || 'briefcase')
      setHasChanges(false)
    }
  }, [currentWorkspace])

  // Track changes
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

  // ── Save changes ──
  const handleSave = async () => {
    if (!currentWorkspace) return
    if (!name.trim()) {
      toast.error('Workspace name is required')
      return
    }
    setIsSaving(true)
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim(),
        financialYear: financialYear.trim(),
        color,
        icon,
      })
      toast.success('Workspace settings saved')
      setHasChanges(false)
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Archive / Unarchive ──
  const handleArchive = async () => {
    if (!currentWorkspace) return
    try {
      await archiveWorkspace(currentWorkspace.id, !currentWorkspace.isArchived)
      toast.success(currentWorkspace.isArchived ? 'Workspace unarchived' : 'Workspace archived')
    } catch {
      toast.error('Failed to update workspace')
    }
  }

  // ── Duplicate ──
  const handleDuplicate = async () => {
    if (!currentWorkspace) return
    try {
      await duplicateWorkspace(currentWorkspace.id)
      toast.success('Workspace duplicated')
    } catch {
      toast.error('Failed to duplicate workspace')
    }
  }

  // ── Delete ──
  const handleDelete = async () => {
    if (!currentWorkspace) return
    try {
      await deleteWorkspace(currentWorkspace.id)
      toast.success('Workspace deleted')
    } catch {
      toast.error('Failed to delete workspace')
    }
  }

  // ── No workspace selected ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Settings className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select or create a workspace to manage its settings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage settings for <span className="text-teal-500 font-medium">{currentWorkspace.name}</span>
        </p>
      </div>

      {/* ── General Settings Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription className="text-xs">Basic workspace configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="settings-name">Workspace Name *</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl"
              placeholder="e.g., WazirX FY 2024-25"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="settings-desc">Description</Label>
            <Textarea
              id="settings-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl"
              rows={3}
              placeholder="Optional description for this workspace"
            />
          </div>

          {/* Financial Year */}
          <div className="space-y-2">
            <Label htmlFor="settings-fy">Financial Year</Label>
            <Input
              id="settings-fy"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="rounded-xl"
              placeholder="e.g., 2025-26"
            />
          </div>

          {/* Color Selector */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-all ${
                    icon === ic
                      ? 'border-teal-500 bg-teal-500/10 text-teal-600'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {ic.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: color }}
            >
              {icon.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{name || 'Workspace Name'}</p>
              <p className="text-xs text-muted-foreground">
                FY {financialYear || 'Not set'}
                {currentWorkspace.isArchived ? ' · Archived' : ''}
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || !name.trim()}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Danger Zone Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Danger Zone</CardTitle>
          <CardDescription className="text-xs">Archive, duplicate, or delete this workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Archive */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <p className="text-sm font-medium">
                {currentWorkspace.isArchived ? 'Unarchive Workspace' : 'Archive Workspace'}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentWorkspace.isArchived
                  ? 'Restore this workspace to active status'
                  : 'Archive to hide from active lists without deleting'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleArchive}
              className="rounded-xl"
            >
              <Archive className="h-4 w-4 mr-2" />
              {currentWorkspace.isArchived ? 'Unarchive' : 'Archive'}
            </Button>
          </div>

          {/* Duplicate */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border">
            <div>
              <p className="text-sm font-medium">Duplicate Workspace</p>
              <p className="text-xs text-muted-foreground">
                Create a copy with the same settings (no trades or reports)
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDuplicate}
              className="rounded-xl"
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicate
            </Button>
          </div>

          <Separator />

          {/* Delete */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-red-500/30 bg-red-500/5">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete Workspace</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this workspace and all its data. This cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="rounded-xl">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &quot;{currentWorkspace.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the workspace and all its trades, CSV files, reports, and settings.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
                  >
                    Delete Workspace
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
