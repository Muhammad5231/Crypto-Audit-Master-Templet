'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Upload CSV Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Upload CSV trade files, view upload history, and manage
// imported data. After upload, auto-generates FIFO report.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiUpload, apiDelete } from '@/lib/api-client'
import { formatINR } from '@/lib/decimal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileUp,
  FileWarning,
  Clock,
  ArrowRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface CsvFileInfo {
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
  reportGenerated: boolean
  isDeltaExchange: boolean
}

// ── Helper: Format file size ──────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Helper: Format date ───────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Main Component ────────────────────────────────────────

export default function UploadPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()

  const [csvFiles, setCsvFiles] = useState<CsvFileInfo[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch CSV files ──
  const fetchCsvFiles = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoadingFiles(false)
      return
    }
    setIsLoadingFiles(true)
    setError(null)
    try {
      const data = await apiGet<CsvFileInfo[]>(
        `/api/workspaces/${currentWorkspace.id}/uploads`
      )
      setCsvFiles(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load CSV files'
      setError(msg)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchCsvFiles()
  }, [fetchCsvFiles])

  // ── Handle file upload ──
  const handleUpload = useCallback(async (file: File) => {
    if (!currentWorkspace) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are accepted')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadResult(null)

    try {
      const result = await apiUpload<UploadResult>(
        `/api/workspaces/${currentWorkspace.id}/uploads/csv`,
        file,
        'file'
      )
      setUploadResult(result)
      await fetchCsvFiles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
    } finally {
      setIsUploading(false)
    }
  }, [currentWorkspace, fetchCsvFiles])

  // ── Handle file delete ──
  const handleDelete = useCallback(async (csvFileId: string) => {
    if (!currentWorkspace) return
    setIsDeleting(csvFileId)
    try {
      await apiDelete(
        `/api/workspaces/${currentWorkspace.id}/uploads/${csvFileId}`
      )
      await fetchCsvFiles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      setError(msg)
    } finally {
      setIsDeleting(null)
    }
  }, [currentWorkspace, fetchCsvFiles])

  // ── Drag & Drop handlers ──
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
  }, [handleUpload])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
    // Reset input so the same file can be re-uploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleUpload])

  // ── No workspace ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <FileUp className="h-8 w-8 text-teal-500" />
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
          Upload your exchange trade history CSV to generate reports
        </p>
      </div>

      {/* Upload Zone */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
              dragActive
                ? 'border-teal-500 bg-teal-500/5'
                : 'border-border hover:border-teal-500/50 hover:bg-accent/30'
            } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 mb-3">
              {isUploading ? (
                <RefreshCw className="h-6 w-6 text-teal-500 animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-teal-500" />
              )}
            </div>
            <h3 className="text-sm font-semibold mb-1">
              {isUploading ? 'Uploading & Processing...' : 'Drop your CSV file here'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isUploading
                ? 'Parsing trades and generating report...'
                : 'or click to browse. Supports .csv files from any exchange.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <Card className={`rounded-xl border shadow-sm ${
          uploadResult.validRows > 0
            ? 'border-green-500/30 bg-green-500/[0.02]'
            : 'border-red-500/30 bg-red-500/[0.02]'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              {uploadResult.validRows > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold mb-2">
                  {uploadResult.validRows > 0
                    ? 'Upload Successful'
                    : 'Upload Failed — No Valid Trades'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">File</p>
                    <p className="text-xs font-medium truncate">{uploadResult.originalName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Rows</p>
                    <p className="text-xs font-bold">{uploadResult.totalRows}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valid Trades</p>
                    <p className="text-xs font-bold text-green-600">{uploadResult.validRows}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Skipped</p>
                    <p className="text-xs font-bold text-orange-600">{uploadResult.skippedRows}</p>
                  </div>
                </div>

                {uploadResult.isDeltaExchange && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 mb-3">
                    <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      Delta Exchange detected — GST included in trading fees.
                    </span>
                  </div>
                )}

                {uploadResult.reportGenerated && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-green-500/5 border border-green-500/10 mb-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Report auto-generated with FIFO matching and tax calculations.
                    </span>
                  </div>
                )}

                {uploadResult.skipReasons.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      View skipped row details ({uploadResult.skipReasons.length})
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {uploadResult.skipReasons.map((sr, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] p-1.5 rounded bg-muted/30">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">Row {sr.row}</Badge>
                          <span className="text-muted-foreground">{sr.reason}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {uploadResult.reportGenerated && (
                  <Button
                    onClick={() => setCurrentPage('dashboard')}
                    size="sm"
                    className="mt-3 bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    View Dashboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="rounded-xl border-red-500/30 bg-red-500/[0.02] shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600">Error</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="shrink-0 h-7 w-7 p-0">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Upload History</CardTitle>
              <CardDescription className="text-xs">Previously uploaded CSV files</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCsvFiles}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isLoadingFiles ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : csvFiles.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No CSV files uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your first trade history file to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {csvFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                    <FileSpreadsheet className="h-4 w-4 text-teal-500" />
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
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDate(file.uploadedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {file.validRows} trades
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </span>
                      {file.skippedRows > 0 && (
                        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                          <FileWarning className="h-2.5 w-2.5" />
                          {file.skippedRows} skipped
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                    disabled={isDeleting === file.id}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                  >
                    {isDeleting === file.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
