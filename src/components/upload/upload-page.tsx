'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Upload CSV Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Professional CSV upload page with:
//   1. Drag & Drop upload zone
//   2. File selection via button
//   3. Upload progress / status indicators
//   4. Upload history table (list of previously uploaded CSVs)
//   5. Auto-report generation notification
//
// Data source:
//   POST /api/workspaces/:workspaceId/uploads/csv  (upload)
//   GET  /api/workspaces/:workspaceId/uploads       (history)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiUpload } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  FileText,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Wallet,
  X,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
  skipReasons: string[]
  exchangeName: string | null
  buyFeePercent: string | null
  sellFeePercent: string | null
  mappingMode: string | null
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
  skipReasons: string[]
  detectedColumns: string[]
  unmappedColumns: string[]
  requiredMapping: string[]
  isDuplicate: boolean
  reportGenerated: boolean
  isDeltaExchange: boolean
}

// ── Helpers ────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(d: string): string {
  try { return format(new Date(d), 'dd MMM yyyy HH:mm') } catch { return d }
}

// ── Main Component ─────────────────────────────────────────

export default function UploadPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  const [csvFiles, setCsvFiles] = useState<CsvFileRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [dragActive, setDragActive] = useState(false)
  const [lastUploadResult, setLastUploadResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch CSV files history ──
  const fetchCsvFiles = useCallback(async () => {
    if (!currentWorkspace) { setIsLoading(false); return }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<CsvFileRecord[]>(
        `/api/workspaces/${currentWorkspace.id}/uploads`
      )
      setCsvFiles(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load CSV files'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => { fetchCsvFiles() }, [fetchCsvFiles])

  // ── Upload handler ──
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    if (!currentWorkspace) return
    if (files.length === 0) return

    setIsUploading(true)
    setLastUploadResult(null)

    for (const file of Array.from(files)) {
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.csv')) {
        toast({
          title: 'Invalid file type',
          description: `"${file.name}" is not a CSV file. Only .csv files are accepted.`,
          variant: 'destructive',
        })
        continue
      }

      setUploadProgress(`Uploading ${file.name}...`)

      try {
        const result = await apiUpload<UploadResult>(
          `/api/workspaces/${currentWorkspace.id}/uploads/csv`,
          file,
          'file'
        )

        setLastUploadResult(result)

        toast({
          title: 'CSV uploaded successfully',
          description: `${result.validRows} trades imported from ${file.name}.${result.reportGenerated ? ' Report auto-generated.' : ''}${result.isDeltaExchange ? ' Delta Exchange detected.' : ''}`,
        })

        // Refresh the file list
        await fetchCsvFiles()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        toast({
          title: 'Upload failed',
          description: msg,
          variant: 'destructive',
        })
      }
    }

    setIsUploading(false)
    setUploadProgress('')
  }, [currentWorkspace, fetchCsvFiles, toast])

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }, [handleUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files)
      // Reset input so same file can be re-uploaded
      e.target.value = ''
    }
  }, [handleUpload])

  // ── Delete CSV file handler ──
  const handleDeleteFile = useCallback(async (fileId: string, fileName: string) => {
    if (!currentWorkspace) return
    try {
      const { apiDelete } = await import('@/lib/api-client')
      await apiDelete(`/api/workspaces/${currentWorkspace.id}/uploads/${fileId}`)
      toast({ title: 'File deleted', description: `"${fileName}" has been removed.` })
      await fetchCsvFiles()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' })
    }
  }, [currentWorkspace, fetchCsvFiles, toast])

  // ── Loading ──
  if (isLoading) {
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

  return (
    <div className="space-y-5 pb-4">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Upload CSV</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload your exchange trade history CSV files for FIFO matching and tax analysis.
        </p>
      </div>

      {/* ── Upload Zone ── */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12
              transition-all duration-200 cursor-pointer
              ${dragActive
                ? 'border-teal-500 bg-teal-500/5 scale-[1.01]'
                : 'border-border hover:border-teal-500/50 hover:bg-accent/30'
              }
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 text-teal-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-foreground">{uploadProgress}</p>
                <p className="text-xs text-muted-foreground mt-1">Please wait while your file is being processed...</p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
                  <FileUp className="h-7 w-7 text-teal-500" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Drag & drop your CSV files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Supports Delta Exchange, WazirX, CoinDCX, and generic CSV formats
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  <Upload className="h-4 w-4 mr-1.5" /> Select Files
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Last Upload Result ── */}
      {lastUploadResult && (
        <Card className={`rounded-xl border-border shadow-sm ${
          lastUploadResult.reportGenerated
            ? 'bg-green-500/[0.03] border-green-500/20'
            : 'bg-amber-500/[0.03] border-amber-500/20'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {lastUploadResult.reportGenerated ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {lastUploadResult.reportGenerated
                      ? 'Upload complete — Report auto-generated'
                      : 'Upload complete — No report generated'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lastUploadResult.validRows} valid trades imported, {lastUploadResult.skippedRows} rows skipped.
                    {lastUploadResult.isDeltaExchange && ' Delta Exchange detected — GST included in fees.'}
                  </p>
                  {lastUploadResult.skipReasons.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Skip reasons: {lastUploadResult.skipReasons.join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setLastUploadResult(null)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {lastUploadResult.reportGenerated && (
              <Button
                size="sm"
                className="mt-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
                onClick={() => setCurrentPage('dashboard')}
              >
                View Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Upload History ── */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Upload History</CardTitle>
              <CardDescription className="text-xs">
                {csvFiles.length} file{csvFiles.length !== 1 ? 's' : ''} uploaded
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 rounded-lg"
              onClick={fetchCsvFiles}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-5 pb-4">
          {csvFiles.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No CSV files uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload your first trade history file to get started with FIFO matching.
              </p>
            </div>
          ) : isMobile ? (
            // ── Mobile: Card list ──
            <div className="space-y-3">
              {csvFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                    <FileText className="h-4 w-4 text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.originalName}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {file.validRows} trades
                      </span>
                      {file.skippedRows > 0 && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-amber-600">
                            {file.skippedRows} skipped
                          </span>
                        </>
                      )}
                      {file.exchangeName && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-teal-500/30 text-teal-600">
                            {file.exchangeName}
                          </Badge>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {fmtDate(file.uploadedAt || file.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDeleteFile(file.id, file.originalName)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            // ── Desktop: Table ──
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[180px]">File Name</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10">Exchange</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right">Size</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right">Total Rows</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right">Valid Trades</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right">Skipped</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[130px]">Uploaded At</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvFiles.map((file) => (
                    <TableRow key={file.id} className="hover:bg-accent/50 transition-colors">
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-teal-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{file.originalName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {file.exchangeName ? (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-teal-500/30 text-teal-600 dark:text-teal-400">
                            {file.exchangeName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {file.totalRows}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium text-green-600 dark:text-green-400">
                        {file.validRows}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {file.skippedRows > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{file.skippedRows}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(file.uploadedAt || file.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => handleDeleteFile(file.id, file.originalName)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Supported Exchanges Info ── */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
          <CardTitle className="text-sm font-semibold">Supported Formats</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-teal-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Delta Exchange India</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Auto-detected from filename or data pattern. GST-inclusive fees, zero buy fees, and TDS handling configured automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Generic CSV Format</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Any CSV with columns: Date, Pair/Symbol, Side (Buy/Sell), Quantity, Price. Optional: Fee, TDS, Order Value.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────────

function UploadPageSkeleton() {
  return (
    <div className="space-y-5 pb-4">
      <div>
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card className="rounded-xl border-border">
        <CardContent className="p-6">
          <div className="flex flex-col items-center py-12">
            <Skeleton className="h-14 w-14 rounded-2xl mb-4" />
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border-border">
        <CardContent className="p-5">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
