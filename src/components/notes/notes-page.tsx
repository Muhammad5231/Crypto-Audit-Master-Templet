'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Notes Page (Premium Rebuild)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Workspace-scoped audit notebook with search, sort, pin,
// premium card grid, create/edit dialogs, and delete confirmation.
// Mobile: single-column cards + full-screen editor.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Loader2,
  NotebookPen,
  FolderOpen,
  X,
  Search,
  Pin,
  PinOff,
  MoreVertical,
  FileText,
  ArrowUpDown,
  CalendarPlus,
  Calendar,
  SortAsc,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────

interface Note {
  id: string
  workspaceId: string
  userId: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

type SortOption = 'recently-updated' | 'newest-created' | 'oldest-created' | 'title-az'
type FilterOption = 'all' | 'pinned'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN NOTES PAGE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function NotesPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  // ── Data state ──
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Search & Filter state ──
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recently-updated')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')

  // ── Editor dialog state ──
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteIsPinned, setNoteIsPinned] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [titleError, setTitleError] = useState('')
  const [contentError, setContentError] = useState('')

  // ── Delete confirmation state ──
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA FETCHING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const fetchNotes = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ notes: Note[] } | Note[]>(
        `/api/workspaces/${currentWorkspace.id}/notes`
      )
      // API may return array directly or wrapped in { notes }
      const notesArray = Array.isArray(data) ? data : (data as { notes: Note[] }).notes || []
      setNotes(notesArray)
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMPUTED VALUES — Search, Filter, Sort
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const processedNotes = useMemo(() => {
    let result = [...notes]

    // ── Filter ──
    if (filterBy === 'pinned') {
      result = result.filter((n) => n.isPinned)
    }

    // ── Search ──
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      )
    }

    // ── Sort ──
    switch (sortBy) {
      case 'recently-updated':
        result.sort((a, b) => {
          // Pinned always first within sort
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
        break
      case 'newest-created':
        result.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        break
      case 'oldest-created':
        result.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })
        break
      case 'title-az':
        result.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return a.title.localeCompare(b.title)
        })
        break
    }

    return result
  }, [notes, searchQuery, sortBy, filterBy])

  // ── Counts ──
  const totalNotes = notes.length
  const pinnedCount = notes.filter((n) => n.isPinned).length

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Open editor for new note
  const handleCreateNote = () => {
    setEditingNote(null)
    setNoteTitle('')
    setNoteContent('')
    setNoteIsPinned(false)
    setTitleError('')
    setContentError('')
    setEditorOpen(true)
  }

  // Open editor for existing note
  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setNoteIsPinned(note.isPinned)
    setTitleError('')
    setContentError('')
    setEditorOpen(true)
  }

  // Save note (create or update)
  const handleSaveNote = async () => {
    if (!currentWorkspace) return

    // Validate
    let hasError = false
    if (!noteTitle.trim()) {
      setTitleError('Note title is required')
      hasError = true
    } else {
      setTitleError('')
    }
    if (!noteContent.trim()) {
      setContentError('Note content is required')
      hasError = true
    } else {
      setContentError('')
    }
    if (hasError) return

    setIsSaving(true)
    try {
      if (editingNote) {
        // Update existing note
        const data = await apiPatch<Note>(
          `/api/workspaces/${currentWorkspace.id}/notes/${editingNote.id}`,
          {
            title: noteTitle.trim(),
            content: noteContent.trim(),
            isPinned: noteIsPinned,
          }
        )
        setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? data : n)))
        toast.success('Note saved successfully.')
      } else {
        // Create new note
        const data = await apiPost<Note>(
          `/api/workspaces/${currentWorkspace.id}/notes`,
          {
            title: noteTitle.trim(),
            content: noteContent.trim(),
            isPinned: noteIsPinned,
          }
        )
        setNotes((prev) => [data, ...prev])
        toast.success('Note saved successfully.')
      }
      setEditorOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save note'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle pin on a note (direct, without opening editor)
  const handleTogglePin = async (note: Note) => {
    if (!currentWorkspace) return
    try {
      const data = await apiPatch<Note>(
        `/api/workspaces/${currentWorkspace.id}/notes/${note.id}`,
        { isPinned: !note.isPinned }
      )
      setNotes((prev) => prev.map((n) => (n.id === note.id ? data : n)))
      toast.success(note.isPinned ? 'Note unpinned' : 'Note pinned')
    } catch {
      toast.error('Failed to update pin status')
    }
  }

  // Delete note
  const handleDeleteNote = async () => {
    if (!currentWorkspace || !deleteTarget) return
    setIsDeleting(true)
    try {
      await apiDelete(`/api/workspaces/${currentWorkspace.id}/notes/${deleteTarget.id}`)
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id))
      toast.success('Note deleted.')
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
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get short preview of note content
  const getPreview = (content: string, maxLen = 160) => {
    if (!content) return ''
    const preview = content.length > maxLen ? content.slice(0, maxLen) + '...' : content
    return preview.replace(/\n/g, ' ')
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOADING STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (isLoading) {
    return <NotesSkeleton />
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NO WORKSPACE STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <StickyNote className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Select a workspace to view and manage your audit notes.
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Save audit observations, reminders, and workspace-specific notes.
          </p>
          <Badge variant="outline" className="mt-2 text-xs border-border font-medium">
            <StickyNote className="h-3 w-3 mr-1" />
            {currentWorkspace.name}
            {currentWorkspace.financialYear && <> &bull; FY {currentWorkspace.financialYear}</>}
          </Badge>
        </div>
        <Button
          onClick={handleCreateNote}
          className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" /> New Note
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCard
          icon={<FileText className="h-4 w-4" />}
          label="Total Notes"
          value={totalNotes}
          accent="teal"
        />
        <SummaryCard
          icon={<Pin className="h-4 w-4" />}
          label="Pinned Notes"
          value={pinnedCount}
          accent="amber"
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="Last Updated"
          value={
            notes.length > 0
              ? formatDate(
                  [...notes].sort(
                    (a, b) =>
                      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                  )[0].updatedAt
                )
              : '—'
          }
          accent="blue"
          isText
        />
      </div>

      {/* ── Error State ── */}
      {error && (
        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={fetchNotes} className="mt-3 rounded-xl">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Search / Filter / Sort Bar ── */}
      {notes.length > 0 && (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 rounded-xl"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filter Chips */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterBy('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    filterBy === 'all'
                      ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                      : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                  }`}
                >
                  All Notes
                </button>
                <button
                  onClick={() => setFilterBy('pinned')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                    filterBy === 'pinned'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted'
                  }`}
                >
                  <Pin className="h-3 w-3" /> Pinned
                </button>
              </div>

              {/* Sort Dropdown */}
              <Select
                value={sortBy}
                onValueChange={(val) => setSortBy(val as SortOption)}
              >
                <SelectTrigger className="w-[180px] rounded-xl">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="recently-updated">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3 w-3" /> Recently Updated
                    </span>
                  </SelectItem>
                  <SelectItem value="newest-created">
                    <span className="flex items-center gap-2">
                      <CalendarPlus className="h-3 w-3" /> Newest Created
                    </span>
                  </SelectItem>
                  <SelectItem value="oldest-created">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" /> Oldest Created
                    </span>
                  </SelectItem>
                  <SelectItem value="title-az">
                    <span className="flex items-center gap-2">
                      <SortAsc className="h-3 w-3" /> Title A–Z
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Notes Grid / Empty State ── */}
      {notes.length === 0 && !error ? (
        /* ── No Notes Empty State ── */
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <StickyNote className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No notes yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Create notes to save audit observations, upload reminders, or report explanations.
            </p>
            <Button
              onClick={handleCreateNote}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" /> New Note
            </Button>
          </CardContent>
        </Card>
      ) : processedNotes.length === 0 && searchQuery ? (
        /* ── No Search Results Empty State ── */
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No notes match your search.</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search terms or clear the search.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setFilterBy('all')
              }}
              className="rounded-xl"
            >
              <X className="h-4 w-4 mr-2" /> Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : processedNotes.length === 0 && filterBy === 'pinned' ? (
        /* ── No Pinned Notes Empty State ── */
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mx-auto mb-4">
              <Pin className="h-8 w-8 text-amber-500/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No pinned notes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Pin important notes so they always appear at the top.
            </p>
            <Button
              variant="outline"
              onClick={() => setFilterBy('all')}
              className="rounded-xl"
            >
              View All Notes
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* ── Notes Card Grid ── */
        <div
          className={`grid gap-4 ${
            isMobile
              ? 'grid-cols-1'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {processedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleEditNote}
              onDelete={setDeleteTarget}
              onTogglePin={handleTogglePin}
              getPreview={getPreview}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          NOTE EDITOR DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className={`${isMobile ? 'max-w-full h-full flex flex-col rounded-none' : 'sm:max-w-[540px]'} rounded-2xl`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-teal-500" />
              {editingNote ? 'Edit Note' : 'New Note'}
            </DialogTitle>
            <DialogDescription>
              {editingNote
                ? 'Update your audit observation or finding.'
                : 'Capture an audit observation, reminder, or explanation.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Note Title */}
            <div className="space-y-2">
              <Label htmlFor="note-title" className="text-sm font-medium">
                Note Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(e) => {
                  setNoteTitle(e.target.value)
                  if (e.target.value.trim()) setTitleError('')
                }}
                onBlur={() => {
                  if (!noteTitle.trim()) setTitleError('Note title is required')
                }}
                placeholder="e.g. Delta CSV unmatched sell observation"
                className={`rounded-xl ${titleError ? 'border-red-500 focus:border-red-500' : ''}`}
                maxLength={200}
              />
              {titleError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {titleError}
                </p>
              )}
            </div>

            {/* Note Content */}
            <div className="space-y-2">
              <Label htmlFor="note-content" className="text-sm font-medium">
                Content <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="note-content"
                value={noteContent}
                onChange={(e) => {
                  setNoteContent(e.target.value)
                  if (e.target.value.trim()) setContentError('')
                }}
                onBlur={() => {
                  if (!noteContent.trim()) setContentError('Note content is required')
                }}
                placeholder="Write your audit note, reminder, or explanation here..."
                className={`rounded-xl min-h-[180px] resize-y ${contentError ? 'border-red-500 focus:border-red-500' : ''}`}
                maxLength={5000}
              />
              <div className="flex items-center justify-between">
                {contentError ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {contentError}
                  </p>
                ) : (
                  <span />
                )}
                <p className="text-[10px] text-muted-foreground">
                  {noteContent.length}/5000
                </p>
              </div>
            </div>

            {/* Pin Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Pin className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Pin Note</p>
                  <p className="text-[10px] text-muted-foreground">
                    Pinned notes always appear at the top
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteIsPinned(!noteIsPinned)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                  noteIsPinned ? 'bg-amber-500' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    noteIsPinned ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => setEditorOpen(false)}
              className="rounded-xl"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={isSaving || !noteTitle.trim() || !noteContent.trim()}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : editingNote ? (
                'Save Changes'
              ) : (
                'Save Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          DELETE CONFIRMATION DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              Delete this note permanently?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete{' '}
                  <strong>&quot;{deleteTarget?.title}&quot;</strong>.
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Note
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTE CARD COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
  getPreview,
  formatDate,
  formatDateTime,
  isMobile,
}: {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
  onTogglePin: (note: Note) => void
  getPreview: (content: string, maxLen?: number) => string
  formatDate: (d: string) => string
  formatDateTime: (d: string) => string
  isMobile: boolean
}) {
  return (
    <Card
      className={`rounded-2xl border-border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group ${
        note.isPinned ? 'border-amber-500/30 bg-amber-500/[0.02] dark:bg-amber-500/[0.03]' : ''
      }`}
      onClick={() => onEdit(note)}
    >
      <CardContent className="p-5">
        {/* Header: Title + Pin + Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {note.isPinned && (
                <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 fill-amber-500" />
              )}
              <h3 className="text-sm font-semibold truncate">{note.title}</h3>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Mobile: show 3-dot menu; Desktop: show icon buttons + 3-dot */}
            {!isMobile ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-teal-500/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(note)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-teal-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-500/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    onTogglePin(note)
                  }}
                >
                  {note.isPinned ? (
                    <PinOff className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Pin className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => onEdit(note)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTogglePin(note)}>
                      {note.isPinned ? (
                        <><PinOff className="h-4 w-4 mr-2" /> Unpin</>
                      ) : (
                        <><Pin className="h-4 w-4 mr-2" /> Pin Note</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => onDelete(note)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => onEdit(note)}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTogglePin(note)}>
                    {note.isPinned ? (
                      <><PinOff className="h-4 w-4 mr-2" /> Unpin</>
                    ) : (
                      <><Pin className="h-4 w-4 mr-2" /> Pin Note</>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(note)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Content Preview */}
        {note.content && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
            {getPreview(note.content)}
          </p>
        )}

        {/* Footer: Dates */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Updated: {formatDate(note.updatedAt)}
          </span>
          {note.createdAt !== note.updatedAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created: {formatDate(note.createdAt)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUMMARY CARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SummaryCard({
  icon,
  label,
  value,
  accent,
  isText,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  accent: 'teal' | 'amber' | 'blue' | 'red' | 'green' | 'purple'
  isText?: boolean
}) {
  const accentClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  }

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
              accentClasses[accent] || accentClasses.teal
            }`}
          >
            {icon}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {label}
            </p>
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
// SKELETON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-xl" />
      </div>
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-2xl" />
        ))}
      </div>
      {/* Search bar skeleton */}
      <Skeleton className="h-[56px] rounded-2xl" />
      {/* Note cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
