'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Upload CSV Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Drag-and-drop + file picker CSV upload page.
// Shows uploaded files list, upload progress, and re-process option.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost, apiUpload, apiDelete } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileUp,
  ArrowRight,
  FolderOpen,
  Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface CsvFileSummary {
  id: string
  originalName: string
  storedName: string
  fileHash: string
  fileSize: number
  totalRows: number
  validRows: number
  skippedRows: number
  skipReasons: string[]
  exchangeName: string | null
  buyFeePercent: number | null
  sellFeePercent: number | null
  mappingMode: string | null
  tradeCount: number
  uploadedAt: string
}

interface UploadResult {
  csvFileId: string
  originalName: string
  fileHash: string
  totalRows: number
  validRows: number
  skippedRows: number
  skipReasons: string[]
  detectedColumns: string[]
  unmappedColumns: string[]
  requiredMapping: string[]
  isDuplicate: boolean
  message?: string
}

// ── Main Component ────────────────────────────────────────────

export default function UploadPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()

  // ── State ──
  const [csvFiles, setCsvFiles] = useState<CsvFileSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch CSV files ──
  const fetchFiles = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<CsvFileSummary[]>(
        `/api/workspaces/${currentWorkspace.id}/uploads`
      )
      setCsvFiles(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load files'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // ── Upload handler ──
  const handleUpload = async (file: File) => {
    if (!currentWorkspace) return

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv')) {
      setError('Only CSV files are accepted. Please upload a .csv file.')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadResult(null)

    try {
      const result = await apiUpload<UploadResult>(
        `/api/workspaces/${currentWorkspace.id}/uploads/csv`,
        file
      )
      setUploadResult(result)
      await fetchFiles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Delete handler ──
  const handleDelete = async (csvFileId: string) => {
    if (!currentWorkspace) return
    try {
      await apiDelete(`/api/workspaces/${currentWorkspace.id}/uploads/${csvFileId}`)
      await fetchFiles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete file'
      setError(msg)
    }
  }

  // ── Process report ──
  const handleProcessReport = async () => {
    if (!currentWorkspace) return
    setIsProcessing(true)
    try {
      await apiPost(`/api/workspaces/${currentWorkspace.id}/reports/process`)
      setCurrentPage('dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process report'
      setError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Drag handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleUpload(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  // ── Format file size ──
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Format date ──
  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalTrades = csvFiles.reduce((sum, f) => sum + f.tradeCount, 0)

  // ── Render ──

  if (isLoading) {
    return <UploadSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <FolderOpen className="h-8 w-8 text-teal-500" />
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

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Upload CSV</h1>
        <p className="text-sm text-muted-foreground">
          Upload your exchange trade history CSV files for analysis
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <Card
        className={`rounded-2xl border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? 'border-teal-500 bg-teal-500/5 scale-[1.01]'
            : 'border-border hover:border-teal-500/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8 flex flex-col items-center text-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-4 transition-colors ${
            isDragOver ? 'bg-teal-500/20' : 'bg-teal-500/10'
          }`}>
            {isUploading ? (
              <Loader2 className="h-7 w-7 text-teal-500 animate-spin" />
            ) : (
              <FileUp className={`h-7 w-7 transition-colors ${isDragOver ? 'text-teal-600' : 'text-teal-500'}`} />
            )}
          </div>

          {isUploading ? (
            <>
              <h3 className="text-lg font-semibold mb-1">Uploading...</h3>
              <p className="text-sm text-muted-foreground">
                Processing your CSV file, please wait
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-1">
                {isDragOver ? 'Drop your CSV here' : 'Drag & drop your CSV file'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                or click to browse. Supported format: .csv files from crypto exchanges
                (WazirX, CoinDCX, Binance, etc.)
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-teal-500 hover:bg-teal-600 text-white"
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-1.5" /> Browse Files
              </Button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <Card className={`rounded-xl border shadow-sm ${
          uploadResult.isDuplicate
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-green-500/30 bg-green-500/5'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {uploadResult.isDuplicate ? (
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {uploadResult.isDuplicate ? 'Duplicate File Detected' : 'Upload Successful'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {uploadResult.isDuplicate
                    ? uploadResult.message
                    : `${uploadResult.validRows} trades imported, ${uploadResult.skippedRows} rows skipped from ${uploadResult.originalName}`}
                </p>
                {!uploadResult.isDuplicate && uploadResult.skipReasons.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {uploadResult.skipReasons.slice(0, 3).map((reason, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">• {reason}</p>
                    ))}
                    {uploadResult.skipReasons.length > 3 && (
                      <p className="text-[11px] text-muted-foreground">
                        ...and {uploadResult.skipReasons.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUploadResult(null)}
                className="shrink-0 h-7 w-7 p-0"
              >
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="rounded-xl border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="shrink-0 h-7 w-7 p-0">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Files List */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Uploaded Files</CardTitle>
              <CardDescription className="text-xs">
                {csvFiles.length > 0
                  ? `${csvFiles.length} file${csvFiles.length !== 1 ? 's' : ''} · ${totalTrades} total trades`
                  : 'No files uploaded yet'}
              </CardDescription>
            </div>
            {csvFiles.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-2">
                {totalTrades} trades
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {csvFiles.length > 0 ? (
            <div className="space-y-2">
              {csvFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                    <FileSpreadsheet className="h-5 w-5 text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{file.originalName}</span>
                      {file.exchangeName && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                          {file.exchangeName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {file.validRows} valid · {file.skippedRows} skipped
                      </span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatSize(file.fileSize)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(file.uploadedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {file.tradeCount} trades
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No CSV files uploaded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your first trade history file to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Report Button */}
      {csvFiles.length > 0 && (
        <Card className="rounded-xl border-border shadow-sm bg-gradient-to-br from-teal-500/[0.04] to-transparent">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 shrink-0">
              <RefreshCw className="h-6 w-6 text-teal-500" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-sm font-semibold">Ready to Process Report</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run FIFO matching and tax computation on your uploaded trade data
              </p>
            </div>
            <Button
              onClick={handleProcessReport}
              disabled={isProcessing}
              className="bg-teal-500 hover:bg-teal-600 text-white shrink-0"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  Process Report <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

function UploadSkeleton() {
  return (
    <div className="space-y-5 pb-4">
      <div>
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-4 w-72 rounded mt-1.5" />
      </div>
      <Skeleton className="h-[200px] rounded-2xl" />
      <Skeleton className="h-[160px] rounded-xl" />
      <Skeleton className="h-[100px] rounded-xl" />
    </div>
  )
}
