'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Upload CSV Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Premium CSV upload page with:
//   1. Drag-and-drop file upload zone
//   2. Upload progress and status tracking
//   3. Previously uploaded files list with details
//   4. Column mapping feedback
//   5. Process report action
//
// Desktop: Side-by-side upload zone + file list
// Mobile: Stacked layout with compact cards
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost, apiUpload } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Zap,
  Wallet,
  ChevronRight,
  AlertTriangle,
  FileUp,
  Files,
  HardDrive,
  Hash,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface CsvFileRecord {
  id: string
  originalName: string
  storedName: string
  fileHash: string
  fileSize: number
  mimeType: string
  totalRows: number
  validRows: number
  skippedRows: number
  skipReasons: Array<{ row: number; reason: string }>
  exchangeName: string
  buyFeePercent: string
  sellFeePercent: string
  mappingMode: string
  tradeCount: number
  uploadedAt: string
  createdAt: string
}

interface UploadResult {
  csvFileId: string
  originalName: string
  fileHash: string
  totalRows: number
  validRows: number
  skippedRows: number
  skipReasons: Array<{ row: number; reason: string }>
  detectedColumns: Record<string, string>
  unmappedColumns: string[]
  requiredMapping: string[]
  isDuplicate: boolean
  message?: string
}

// ── Helpers ────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Main Component ─────────────────────────────────────────

export default function UploadPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  // ── State ──
  const [csvFiles, setCsvFiles] = useState<CsvFileRecord[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lastUploadResult, setLastUploadResult] = useState<UploadResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch uploaded CSV files ──
  const fetchCsvFiles = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoadingFiles(false)
      return
    }
    setIsLoadingFiles(true)
    try {
      const data = await apiGet<CsvFileRecord[]>(
        `/api/workspaces/${currentWorkspace.id}/uploads`
      )
      setCsvFiles(Array.isArray(data) ? data : [])
    } catch {
      setCsvFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchCsvFiles()
  }, [fetchCsvFiles])

  // ── Handle file upload ──
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!currentWorkspace) return
    if (files.length === 0) return

    setIsUploading(true)
    setUploadError(null)
    setLastUploadResult(null)

    try {
      for (const file of Array.from(files)) {
        const result = await apiUpload<UploadResult>(
          `/api/workspaces/${currentWorkspace.id}/uploads/csv`,
          file,
          'file'
        )
        setLastUploadResult(result)

        if (result.isDuplicate) {
          toast({
            title: 'Duplicate file detected',
            description: result.message || 'This CSV was already uploaded to this workspace.',
            variant: 'default',
          })
        } else {
          toast({
            title: 'CSV uploaded successfully',
            description: `${result.validRows} trades imported, ${result.skippedRows} rows skipped.`,
          })
        }
      }
      await fetchCsvFiles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setUploadError(msg)
      toast({
        title: 'Upload failed',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // ── Drag and drop handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files)
    }
  }

  // ── Delete CSV file ──
  const handleDeleteFile = async (csvFileId: string) => {
    if (!currentWorkspace) return
    try {
      const token = localStorage.getItem('crypto_audit_token')
      await fetch(
        `/api/workspaces/${currentWorkspace.id}/uploads/${csvFileId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      toast({
        title: 'CSV file deleted',
        description: 'The file and its trades have been removed.',
      })
      await fetchCsvFiles()
    } catch {
      toast({
        title: 'Delete failed',
        description: 'Could not delete the CSV file.',
        variant: 'destructive',
      })
    }
  }

  // ── Process report ──
  const handleProcessReport = async () => {
    if (!currentWorkspace) return
    setIsProcessing(true)
    try {
      await apiPost(`/api/workspaces/${currentWorkspace.id}/reports/process`)
      toast({
        title: 'Report processed',
        description: 'Your FIFO report has been generated. Check the Dashboard.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process report'
      toast({
        title: 'Processing failed',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Loading state ──
  if (isLoadingFiles) {
    return <UploadPageSkeleton />
  }

  // ── No workspace ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select or create a workspace to upload CSV files.
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

  // ── Computed ──
  const totalTrades = csvFiles.reduce((sum, f) => sum + f.validRows, 0)
  const totalFiles = csvFiles.length
  const hasFiles = totalFiles > 0

  // ══════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════════

  if (isMobile) {
    return (
      <div className="space-y-4 px-4 pb-6">
        {/* Mobile Header */}
        <div>
          <h1 className="text-xl font-bold">Upload CSV</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload your exchange trade history CSV files for FIFO matching and tax calculation.
          </p>
        </div>

        {/* Mobile Summary Chips */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg text-teal-500 bg-teal-500/10">
              <Files className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Files</p>
              <p className="text-xs font-bold">{totalFiles}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg text-green-500 bg-green-500/10">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Trades</p>
              <p className="text-xs font-bold">{totalTrades}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg text-purple-500 bg-purple-500/10">
              <HardDrive className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">Size</p>
              <p className="text-xs font-bold">
                {formatFileSize(csvFiles.reduce((sum, f) => sum + f.fileSize, 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Upload Zone */}
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-teal-500 bg-teal-500/5 scale-[1.02]'
                  : 'border-border hover:border-teal-500/50 hover:bg-muted/30'
              } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              {isUploading ? (
                <>
                  <Loader2 className="h-8 w-8 text-teal-500 animate-spin mb-3" />
                  <p className="text-sm font-medium text-teal-600 dark:text-teal-400">Uploading...</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 mb-3">
                    <FileUp className="h-6 w-6 text-teal-500" />
                  </div>
                  <p className="text-sm font-medium text-center">
                    {isDragging ? 'Drop your CSV here' : 'Tap to upload CSV'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Drag & drop or tap to browse
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    .csv files only
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mobile Upload Error */}
        {uploadError && (
          <Card className="rounded-xl border-red-500/30 bg-red-500/5">
            <CardContent className="p-3 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Upload Error</p>
                <p className="text-xs text-muted-foreground mt-0.5">{uploadError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mobile Upload Result */}
        {lastUploadResult && !lastUploadResult.isDuplicate && (
          <Card className="rounded-xl border-green-500/30 bg-green-500/5">
            <CardContent className="p-3">
              <div className="flex items-start gap-2.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    {lastUploadResult.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lastUploadResult.validRows} trades imported, {lastUploadResult.skippedRows} skipped
                  </p>
                </div>
              </div>
              {lastUploadResult.requiredMapping.length > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Missing column mappings: {lastUploadResult.requiredMapping.join(', ')}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Use column mapping to map these fields manually.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mobile Process Report Button */}
        {hasFiles && (
          <Button
            onClick={handleProcessReport}
            disabled={isProcessing}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-11"
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing Report...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> Process FIFO Report</>
            )}
          </Button>
        )}

        {/* Mobile Uploaded Files List */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Uploaded Files</h3>
          {csvFiles.length === 0 ? (
            <Card className="rounded-xl border-dashed border-border">
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No CSV files uploaded yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {csvFiles.map((file) => (
                <Card key={file.id} className="rounded-xl border-border shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.originalName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {file.validRows} trades
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {formatFileSize(file.fileSize)}
                          </Badge>
                          {file.skippedRows > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600">
                              {file.skippedRows} skipped
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload CSV</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload your exchange trade history CSV files for FIFO matching and tax calculation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasFiles && (
            <Button
              onClick={handleProcessReport}
              disabled={isProcessing}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Process FIFO Report</>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={fetchCsvFiles}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-teal-500 bg-teal-500/10">
              <Files className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Files</p>
              <p className="text-sm font-bold">{totalFiles}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-green-500 bg-green-500/10">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Trades</p>
              <p className="text-sm font-bold">{totalTrades}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-purple-500 bg-purple-500/10">
              <HardDrive className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Size</p>
              <p className="text-sm font-bold">{formatFileSize(csvFiles.reduce((sum, f) => sum + f.fileSize, 0))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-orange-500 bg-orange-500/10">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Skipped Rows</p>
              <p className="text-sm font-bold">{csvFiles.reduce((sum, f) => sum + f.skippedRows, 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Content: Upload Zone + File List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Upload Zone */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Upload CSV File</CardTitle>
              <CardDescription className="text-xs">
                Drag and drop or click to select CSV trade history files
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-teal-500 bg-teal-500/5 scale-[1.01]'
                    : 'border-border hover:border-teal-500/50 hover:bg-muted/30'
                } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {isUploading ? (
                  <>
                    <Loader2 className="h-10 w-10 text-teal-500 animate-spin mb-3" />
                    <p className="text-sm font-medium text-teal-600 dark:text-teal-400">Uploading file...</p>
                    <p className="text-xs text-muted-foreground mt-1">Please wait while we process your CSV</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
                      <Upload className="h-7 w-7 text-teal-500" />
                    </div>
                    <p className="text-base font-semibold text-center">
                      {isDragging ? 'Drop your CSV here' : 'Drop CSV files here'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 text-center">
                      or click to browse from your computer
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                      <Badge variant="outline" className="text-[10px]">
                        .csv
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Multiple files
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upload Error */}
          {uploadError && (
            <Card className="rounded-xl border-red-500/30 bg-red-500/5">
              <CardContent className="p-3.5 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Upload Error</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{uploadError}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Result */}
          {lastUploadResult && !lastUploadResult.isDuplicate && (
            <Card className="rounded-xl border-green-500/30 bg-green-500/5">
              <CardContent className="p-3.5">
                <div className="flex items-start gap-2.5 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Upload Successful</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{lastUploadResult.originalName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-lg bg-muted/40 p-2 text-center">
                    <p className="text-xs font-bold">{lastUploadResult.validRows}</p>
                    <p className="text-[10px] text-muted-foreground">Imported</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2 text-center">
                    <p className="text-xs font-bold">{lastUploadResult.skippedRows}</p>
                    <p className="text-[10px] text-muted-foreground">Skipped</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2 text-center">
                    <p className="text-xs font-bold">{lastUploadResult.totalRows}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                </div>
                {lastUploadResult.requiredMapping.length > 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Missing column mappings: {lastUploadResult.requiredMapping.join(', ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Use the column mapping feature to manually map these fields.
                    </p>
                  </div>
                )}
                {lastUploadResult.unmappedColumns.length > 0 && lastUploadResult.requiredMapping.length === 0 && (
                  <div className="mt-3 p-2.5 rounded-lg bg-muted/40">
                    <p className="text-[10px] text-muted-foreground">
                      Unmapped columns: {lastUploadResult.unmappedColumns.join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Uploaded Files List */}
        <div className="lg:col-span-3">
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Uploaded Files</CardTitle>
                  <CardDescription className="text-xs">
                    {csvFiles.length} file{csvFiles.length !== 1 ? 's' : ''} uploaded to this workspace
                  </CardDescription>
                </div>
                {csvFiles.length > 0 && (
                  <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-600">
                    {totalTrades} total trades
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {csvFiles.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No CSV files uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Upload your exchange trade history CSV to get started with FIFO matching and tax calculation.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {csvFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 shrink-0">
                        <FileSpreadsheet className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{file.originalName}</p>
                          {file.exchangeName && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                              {file.exchangeName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {file.validRows} trades
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(file.uploadedAt)}
                          </span>
                          {file.skippedRows > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600">
                              {file.skippedRows} skipped
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          {file.fileHash.slice(0, 8)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleDeleteFile(file.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Navigation hint ── */}
      {hasFiles && (
        <Card className="rounded-xl border-border shadow-sm bg-gradient-to-r from-card via-card to-teal-500/[0.02]">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
                <Zap className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Ready to analyze?</p>
                <p className="text-xs text-muted-foreground">
                  Process your uploaded data to generate FIFO-matched reports and tax summaries.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleProcessReport}
                disabled={isProcessing}
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Process Report</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage('dashboard')}
                className="rounded-lg"
              >
                View Dashboard <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────

function UploadPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="lg:col-span-2 h-[280px] rounded-xl" />
        <Skeleton className="lg:col-span-3 h-[280px] rounded-xl" />
      </div>
    </div>
  )
}
