'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Notes Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Lightweight audit notebook with note cards, floating add button,
// dialog editor for create/edit, and delete confirmation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Loader2,
  NotebookPen,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────

interface Note {
  id: string
  workspaceId: string
  userId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

// ── Main Notes Page Component ──────────────────────────────

export default function NotesPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editor dialog state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ notes: Note[] }>(
        `/api/workspaces/${currentWorkspace.id}/notes`
      )
      setNotes(data.notes || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load notes'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Open editor for new note
  const handleCreateNote = () => {
    setEditingNote(null)
    setNoteTitle('')
    setNoteContent('')
    setEditorOpen(true)
  }

  // Open editor for existing note
  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setEditorOpen(true)
  }

  // Save note (create or update)
  const handleSaveNote = async () => {
    if (!currentWorkspace) return
    if (!noteTitle.trim()) {
      toast.error('Please enter a title for your note')
      return
    }
    setIsSaving(true)
    try {
      if (editingNote) {
        // Update existing note
        const data = await apiPatch<Note>(
          `/api/workspaces/${currentWorkspace.id}/notes/${editingNote.id}`,
          { title: noteTitle.trim(), content: noteContent.trim() }
        )
        setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? data : n)))
        toast.success('Note updated')
      } else {
        // Create new note
        const data = await apiPost<Note>(
          `/api/workspaces/${currentWorkspace.id}/notes`,
          { title: noteTitle.trim(), content: noteContent.trim() }
        )
        setNotes((prev) => [data, ...prev])
        toast.success('Note created')
      }
      setEditorOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save note'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete note
  const handleDeleteNote = async () => {
    if (!currentWorkspace || !deleteTarget) return
    setIsDeleting(true)
    try {
      await apiDelete(`/api/workspaces/${currentWorkspace.id}/notes/${deleteTarget.id}`)
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id))
      toast.success('Note deleted')
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete note'
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get short preview of note content
  const getPreview = (content: string, maxLen = 80) => {
    if (!content) return 'No content'
    const preview = content.length > maxLen ? content.slice(0, maxLen) + '...' : content
    return preview.replace(/\n/g, ' ')
  }

  // Loading state
  if (isLoading) {
    return <NotesSkeleton />
  }

  // No workspace
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <StickyNote className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select a workspace to view your audit notes.
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
    <div className="space-y-6 relative pb-20">
      {/* ── Header Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <NotebookPen className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Audit Notes</h2>
                <p className="text-sm text-muted-foreground">
                  {notes.length} note{notes.length !== 1 ? 's' : ''} in {currentWorkspace.name}
                </p>
              </div>
            </div>
            <Button
              onClick={handleCreateNote}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" /> New Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Error State ── */}
      {error && (
        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={fetchNotes} className="mt-3">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Notes List / Empty State ── */}
      {notes.length === 0 && !error ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <StickyNote className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No notes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first audit note to keep track of observations and findings.
            </p>
            <Button
              onClick={handleCreateNote}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" /> Create Your First Audit Note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {notes.map((note) => (
            <Card
              key={note.id}
              className="rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleEditNote(note)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">{note.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {getPreview(note.content)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(note.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditNote(note)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(note)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Floating Add Button (mobile-friendly) ── */}
      {notes.length > 0 && (
        <Button
          onClick={handleCreateNote}
          className="fixed bottom-24 right-6 md:bottom-8 md:right-8 h-14 w-14 rounded-full bg-teal-500 hover:bg-teal-600 text-white shadow-lg hover:shadow-xl transition-all"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* ── Note Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-teal-500" />
              {editingNote ? 'Edit Note' : 'New Audit Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote ? 'Update your audit observation or finding.' : 'Capture an audit observation or finding.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g., Discrepancy in WazirX TDS records"
                className="rounded-xl"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write your note here..."
                className="rounded-xl min-h-[160px] resize-y"
                maxLength={5000}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {noteContent.length}/5000
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={isSaving || !noteTitle.trim()}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                'Save Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
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

// ── Skeleton ───────────────────────────────────────────────

function NotesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
