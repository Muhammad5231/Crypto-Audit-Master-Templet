'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Upload CSV Page (Full Rewrite)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full CSV upload flow with state machine:
//   idle → analyzing → auto-success / mapping → exchange-details
//   → confirming → done / error
//
// Includes: premium drag-and-drop, file status card, CSV preview,
// column mapping wizard, exchange details modal, import result
// summary, skipped row warnings, format guide panel, mobile view.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiUpload, apiPost, apiDelete } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Info,
  Eye,
  X,
  FileText,
  Clock,
  Hash,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
  ChevronRight,
  Sparkles,
  Building2,
  Percent,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { ColumnMappingWizard } from './column-mapping-wizard'
import { ExchangeDetailsModal } from './exchange-details-modal'
import { CsvPreviewModal } from './csv-preview-modal'

// ── Types ─────────────────────────────────────────────────────

interface SkipReason {
  row: number
  reason: string
}

interface CsvFileRecord {
  id: string
  originalName: string
  fileSize: number
  totalRows: number
  validRows: number
  skippedRows: number
  skipReasons: SkipReason[]
  exchangeName: string
  buyFeePercent: string
  sellFeePercent: string
  mappingMode: string
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
  skipReasons: SkipReason[]
  isDuplicate: boolean
  reportGenerated?: boolean
  exchangeName: string
  buyFeePercent: string
  sellFeePercent: string
  mappingMode: string
  message?: string
}

interface AnalysisResult {
  fileName: string
  headers: string[]
  sampleRows: Record<string, string>[]
  detectedColumns: Record<string, string>
  unmappedColumns: string[]
  requiredMapping: string[]
  totalRows: number
  availableFields: string[]
  requiredFields: string[]
}

type UploadStep =
  | 'idle'
  | 'analyzing'
  | 'auto-success'
  | 'mapping'
  | 'exchange-details'
  | 'confirming'
  | 'done'
  | 'error'

// ── File status badge config ──────────────────────────────────

type FileStatus =
  | 'ready'
  | 'uploading'
  | 'analyzing'
  | 'needs-mapping'
  | 'waiting-exchange'
  | 'processed'
  | 'failed'

const FILE_STATUS_CONFIG: Record<FileStatus, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-muted text-muted-foreground' },
  uploading: { label: 'Uploading', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  analyzing: { label: 'Analyzing', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  'needs-mapping': { label: 'Needs Mapping', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  'waiting-exchange': { label: 'Waiting Exchange Details', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  processed: { label: 'Processed', className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

// ── Required CSV fields for the guide panel ───────────────────

const REQUIRED_CSV_FIELDS = [
  { field: 'TIME', label: 'Trade Date/Time', icon: Clock, example: '2024-01-15 10:30:00' },
  { field: 'CONTRACT', label: 'Symbol / Pair', icon: Hash, example: 'BTC_INR, ETH/USDT' },
  { field: 'QTY', label: 'Quantity', icon: BarChart3, example: '0.5, 100' },
  { field: 'SIDE', label: 'Buy / Sell', icon: ArrowRight, example: 'buy, sell' },
  { field: 'PRICE', label: 'Price per unit', icon: Percent, example: '45000.00' },
]

const OPTIONAL_CSV_FIELDS = [
  { field: 'FEES', label: 'Trading Fees', example: '45.00' },
  { field: 'TDS', label: 'TDS Amount', example: '4.50' },
  { field: 'ORDER_VALUE', label: 'Order Value', example: '22500.00' },
  { field: 'TRADE_STATUS', label: 'Trade Status', example: 'complete, cancelled' },
  { field: 'ORDER_ID', label: 'Order ID', example: 'ORD-12345' },
]

// ── Helper: derive file status from upload step ──────────────

function getFileStatus(step: UploadStep): FileStatus {
  switch (step) {
    case 'idle': return 'ready'
    case 'analyzing': return 'analyzing'
    case 'auto-success': return 'analyzing'
    case 'mapping': return 'needs-mapping'
    case 'exchange-details': return 'waiting-exchange'
    case 'confirming': return 'uploading'
    case 'done': return 'processed'
    case 'error': return 'failed'
  }
}

// ── Main Component ────────────────────────────────────────────

export default function UploadPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()
  const workspaceId = currentWorkspace?.id

  // ── Upload step state machine ──
  const [step, setStep] = useState<UploadStep>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Pending file state ──
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  // ── Mapping state (stored after mapping wizard confirms) ──
  const [currentMapping, setCurrentMapping] = useState<Record<string, string>>({})
  const [currentSideValueMap, setCurrentSideValueMap] = useState<Record<string, string>>({})
  const [currentDateFormat, setCurrentDateFormat] = useState<string | undefined>(undefined)
  const [isAutoDetected, setIsAutoDetected] = useState(false)

  // ── CSV preview state ──
  const [csvPreviewOpen, setCsvPreviewOpen] = useState(false)
  const [csvFullRows, setCsvFullRows] = useState<Record<string, string>[]>([])

  // ── Uploaded files history ──
  const [csvFiles, setCsvFiles] = useState<CsvFileRecord[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<CsvFileRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteTargetRef = useRef<CsvFileRecord | null>(null)

  // ── Drag state ──
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Auto-success animation ref ──
  const autoSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch uploaded CSV files ──
  const fetchCsvFiles = useCallback(async () => {
    if (!workspaceId) return
    setIsLoadingFiles(true)
    try {
      const files = await apiGet<CsvFileRecord[]>(`/api/workspaces/${workspaceId}/uploads`)
      setCsvFiles(files)
    } catch {
      toast.error('Failed to load uploaded files')
    } finally {
      setIsLoadingFiles(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchCsvFiles()
  }, [fetchCsvFiles])

  // ── Cleanup timer on unmount ──
  useEffect(() => {
    return () => {
      if (autoSuccessTimerRef.current) {
        clearTimeout(autoSuccessTimerRef.current)
      }
    }
  }, [])

  // ── Parse CSV rows from file content (for preview) ──
  const parseCsvRows = useCallback((content: string, headers: string[]): Record<string, string>[] => {
    const lines = content.split('\n').filter((line) => line.trim() !== '')
    if (lines.length < 2) return []
    // Skip the header row (first line), parse remaining
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = values[i] ?? ''
      })
      return row
    })
  }, [])

  // ── Handle file selection/upload ──
  const handleFile = async (file: File) => {
    if (!workspaceId) {
      toast.error('Please select a workspace first')
      return
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Only CSV files are accepted')
      return
    }

    // Reset previous state
    setUploadError(null)
    setUploadResult(null)
    setStep('analyzing')
    setUploadProgress(20)

    try {
      // Read file content for the confirm step later
      const content = await file.text()
      setPendingFile(file)
      setPendingFileContent(content)
      setUploadProgress(50)

      // Call the analyze endpoint
      const analysis = await apiUpload<AnalysisResult>(
        `/api/workspaces/${workspaceId}/uploads/csv/analyze`,
        file,
        'file',
      )
      setAnalysisResult(analysis)
      setUploadProgress(100)

      // Parse full rows for preview
      if (analysis.headers.length > 0) {
        const rows = parseCsvRows(content, analysis.headers)
        setCsvFullRows(rows)
      }

      // Route based on auto-detection result
      if (analysis.requiredMapping.length === 0) {
        // All required columns auto-detected → brief success then exchange details
        setStep('auto-success')
        setCurrentMapping(analysis.detectedColumns)
        setIsAutoDetected(true)

        // Brief 1.5s success animation
        autoSuccessTimerRef.current = setTimeout(() => {
          setStep('exchange-details')
        }, 1500)
      } else {
        // Need manual mapping
        setStep('mapping')
        setIsAutoDetected(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      setUploadError(message)
      setStep('error')
      setUploadProgress(0)
      toast.error(message)
    }
  }

  // ── Handle column mapping confirmation from the wizard ──
  const handleMappingConfirm = (
    mapping: Record<string, string>,
    sideValueMap: Record<string, string>,
    dateFormat?: string,
  ) => {
    setCurrentMapping(mapping)
    setCurrentSideValueMap(sideValueMap)
    setCurrentDateFormat(dateFormat)
    setIsAutoDetected(false)
    // Move to exchange details step
    setStep('exchange-details')
  }

  // ── Handle exchange details submission ──
  const handleExchangeDetailsSubmit = async (details: {
    exchangeName: string
    buyFeePercent: string
    sellFeePercent: string
  }) => {
    if (!workspaceId || !pendingFileContent) {
      toast.error('Missing file content — please re-upload your CSV and try again')
      setStep('exchange-details')
      return
    }

    setStep('confirming')
    try {
      const result = await apiPost<UploadResult>(
        `/api/workspaces/${workspaceId}/uploads/csv/confirm-mapping`,
        {
          fileContent: pendingFileContent,
          fileName: pendingFile?.name || 'uploaded-file.csv',
          mappingConfig: currentMapping,
          sideValueMap: Object.keys(currentSideValueMap).length > 0 ? currentSideValueMap : undefined,
          dateFormat: currentDateFormat || undefined,
          exchangeName: details.exchangeName,
          buyFeePercent: details.buyFeePercent,
          sellFeePercent: details.sellFeePercent,
          mappingMode: isAutoDetected ? 'auto' : 'manual',
        },
      )

      setUploadResult(result)
      setStep('done')

      if (result.isDuplicate) {
        toast.warning('Duplicate file detected — this CSV was already uploaded')
      } else {
        const reportMsg = result.reportGenerated ? '. Report auto-generated — check Dashboard!' : ''
        toast.success(`${result.validRows} trades imported successfully${reportMsg}`)
      }

      fetchCsvFiles()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mapping confirmation failed'
      toast.error(message)
      // Stay on exchange-details so user can retry
      setStep('exchange-details')
    }
  }

  // ── Handle file deletion ──
  const handleDeleteFile = async () => {
    // Use ref because AlertDialogAction closes the dialog (nulling deleteTarget)
    // before this onClick handler can read the target
    const target = deleteTargetRef.current
    if (!workspaceId || !target) return

    setIsDeleting(true)
    try {
      await apiDelete(`/api/workspaces/${workspaceId}/uploads/${target.id}`)
      toast.success(`"${target.originalName}" deleted successfully`)
      deleteTargetRef.current = null
      setDeleteTarget(null)
      fetchCsvFiles()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file'
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Drag & drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [workspaceId, handleFile],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Reset state ──
  const handleReset = () => {
    if (autoSuccessTimerRef.current) {
      clearTimeout(autoSuccessTimerRef.current)
    }
    setStep('idle')
    setUploadProgress(0)
    setUploadResult(null)
    setUploadError(null)
    setAnalysisResult(null)
    setPendingFile(null)
    setPendingFileContent(null)
    setCurrentMapping({})
    setCurrentSideValueMap({})
    setCurrentDateFormat(undefined)
    setIsAutoDetected(false)
    setCsvFullRows([])
  }

  // ── Remove pending file (before final processing) ──
  const handleRemoveFile = () => {
    handleReset()
  }

  // ── Format file size ──
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Format date ──
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ── Group skip reasons by reason type ──
  const groupedSkipReasons = useMemo(() => {
    if (!uploadResult?.skipReasons?.length) return []
    const groups: Record<string, SkipReason[]> = {}
    for (const sr of uploadResult.skipReasons) {
      if (!groups[sr.reason]) groups[sr.reason] = []
      groups[sr.reason].push(sr)
    }
    return Object.entries(groups).map(([reason, items]) => ({
      reason,
      count: items.length,
      rows: items.map((i) => i.row),
    }))
  }, [uploadResult])

  // ── Current file status ──
  const fileStatus = getFileStatus(step)
  const statusConfig = FILE_STATUS_CONFIG[fileStatus]

  // ── Can remove file? Only before final processing ──
  const canRemoveFile = step !== 'confirming' && step !== 'done'

  // ── Show the upload area and file card? ──
  const showUploadArea = step === 'idle' || step === 'analyzing' || step === 'auto-success'
  const showFileCard = !!pendingFile && step !== 'idle'

  // ── No workspace selected ──
  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <FileSpreadsheet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Upload CSV</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Please select a workspace first to upload CSV files.
        </p>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-6">
      {/* ── Section 1: Page Top Area ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Upload CSV</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Import exchange trade history, verify file structure, add exchange fee details, and prepare it for FIFO processing.
          </p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 rounded-lg text-xs border-teal-500/30 text-teal-600 dark:text-teal-400 px-3 py-1.5 self-start"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          Workspace: {currentWorkspace?.name}
        </Badge>
      </div>

      {/* ── Section 2: Main Desktop Layout — 2 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Section 3: CSV Upload Box ── */}
          {showUploadArea && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
                    p-8 md:p-12 transition-all duration-200 cursor-pointer
                    ${step === 'analyzing' || step === 'auto-success'
                      ? 'border-teal-500/30 bg-teal-500/[0.02] cursor-default'
                      : isDragging
                        ? 'border-teal-500 bg-teal-500/5'
                        : 'border-border hover:border-teal-500/50 hover:bg-accent/50'
                    }
                  `}
                  onClick={step === 'idle' ? () => fileInputRef.current?.click() : undefined}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={step !== 'idle'}
                  />

                  {step === 'analyzing' ? (
                    <>
                      <Loader2 className="h-10 w-10 text-teal-500 animate-spin mb-4" />
                      <p className="text-sm font-medium">Analyzing CSV columns...</p>
                      <div className="w-full max-w-xs mt-4">
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    </>
                  ) : step === 'auto-success' ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 mb-4 animate-pulse">
                        <CheckCircle2 className="h-7 w-7 text-green-500" />
                      </div>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        All columns auto-detected!
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Preparing exchange details form...
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
                        <Upload className="h-7 w-7 text-teal-500" />
                      </div>
                      <p className="text-base font-semibold">Drop your trade CSV here</p>
                      <p className="text-sm text-muted-foreground mt-1">or browse files from your device</p>
                      <Button
                        className="mt-4 rounded-xl bg-teal-500 hover:bg-teal-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Browse CSV File
                      </Button>
                      <p className="text-xs text-muted-foreground mt-3">
                        Your CSV will be checked, previewed, and mapped if needed.
                      </p>
                    </>
                  )}
                </div>

                {/* Error display */}
                {uploadError && step === 'error' && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                    <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Upload Failed</p>
                      <p className="text-xs text-muted-foreground mt-1">{uploadError}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl shrink-0"
                      onClick={handleReset}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Section 4: Selected File Card ── */}
          {showFileCard && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 shrink-0">
                    <FileSpreadsheet className="h-5 w-5 text-teal-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{pendingFile?.name}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-2 py-0.5 shrink-0 ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pendingFile ? formatSize(pendingFile.size) : ''}
                      {analysisResult ? ` · ${analysisResult.totalRows} rows` : ''}
                    </p>
                  </div>

                  {/* Section 5: CSV Preview Button */}
                  {analysisResult && csvFullRows.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl shrink-0 text-xs"
                      onClick={() => setCsvPreviewOpen(true)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Preview Full CSV
                    </Button>
                  )}

                  {/* Remove file button */}
                  {canRemoveFile && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                            onClick={handleRemoveFile}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove file</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Section 9: Fee Value Info Note ── */}
          {(step === 'exchange-details' || step === 'confirming') && (
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">How fees are calculated:</span>{' '}
                If your CSV includes actual fee amounts, those will be used directly.
                Otherwise, the buy/sell fee percentages you provide will be applied to calculate fees.
              </p>
            </div>
          )}

          {/* ── Section 10: Duplicate File Detection ── */}
          {step === 'done' && uploadResult?.isDuplicate && (
            <Card className="rounded-2xl border-orange-500/20 bg-orange-500/[0.03]">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 shrink-0">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                      Duplicate File Detected
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This CSV appears to have already been uploaded in this workspace.
                      It has not been processed again.
                    </p>
                    {uploadResult.message && (
                      <p className="text-xs text-muted-foreground mt-1">{uploadResult.message}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl shrink-0 text-xs"
                    onClick={() => setCurrentPage('dashboard')}
                  >
                    View Existing Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Section 12: Import Result Summary ── */}
          {step === 'done' && uploadResult && !uploadResult.isDuplicate && (
            <Card className="rounded-2xl border-green-500/20 shadow-sm overflow-hidden">
              {/* Success header bar */}
              <div className="bg-gradient-to-r from-green-500 to-teal-500 px-5 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                  <h3 className="text-sm font-semibold text-white">Import Successful</h3>
                </div>
              </div>
              <CardContent className="p-5 space-y-4">
                {/* File & exchange info row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-teal-500" />
                    <span className="text-sm font-medium">{uploadResult.originalName}</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {uploadResult.exchangeName || 'N/A'}
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Percent className="h-3 w-3" />
                    Buy: {uploadResult.buyFeePercent || '0'}%
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Percent className="h-3 w-3" />
                    Sell: {uploadResult.sellFeePercent || '0'}%
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-border p-3 text-center">
                    <p className="text-xl font-bold">{uploadResult.totalRows.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">Total CSV Rows</p>
                  </div>
                  <div className="rounded-xl border border-green-500/20 bg-green-500/[0.03] p-3 text-center">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {uploadResult.validRows.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Valid Trades Imported</p>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${
                    uploadResult.skippedRows > 0
                      ? 'border-orange-500/20 bg-orange-500/[0.03]'
                      : 'border-border'
                  }`}>
                    <p className={`text-xl font-bold ${
                      uploadResult.skippedRows > 0
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-foreground'
                    }`}>
                      {uploadResult.skippedRows.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Skipped Rows</p>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {uploadResult.mappingMode === 'auto' ? (
                        <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-orange-500" />
                      )}
                      <p className="text-sm font-bold">
                        {uploadResult.mappingMode === 'auto' ? 'Auto' : 'Manual'}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Mapping Mode</p>
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Upload Success
                  </Badge>
                  {uploadResult.reportGenerated && (
                    <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 text-[10px]">
                      <Zap className="h-3 w-3 mr-1" />
                      Report Auto-Generated
                    </Badge>
                  )}
                  {csvFullRows.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-[10px] h-6 px-2"
                      onClick={() => setCsvPreviewOpen(true)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview Full CSV
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Section 11/13: Warnings & Skipped Row Details ── */}
          {step === 'done' && uploadResult && uploadResult.skipReasons.length > 0 && !uploadResult.isDuplicate && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-4">
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="skip-reasons" className="border-none">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-semibold">
                          {uploadResult.skippedRows} Skipped Rows
                        </span>
                        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 px-1.5 py-0">
                          {groupedSkipReasons.length} reason{groupedSkipReasons.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-1">
                        {groupedSkipReasons.map(({ reason, count, rows }) => (
                          <div
                            key={reason}
                            className="rounded-xl border border-orange-500/15 bg-orange-500/[0.03] p-3"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                {reason}
                              </p>
                              <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 px-1.5 py-0">
                                {count} row{count !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Affected rows: {rows.slice(0, 20).join(', ')}
                              {rows.length > 20 && ` ...and ${rows.length - 20} more`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* ── Section 14: Next Action After Import ── */}
          {step === 'done' && uploadResult && !uploadResult.isDuplicate && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Primary action */}
                  <Button
                    className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white h-12 px-6 text-sm font-semibold w-full sm:w-auto"
                    onClick={() => setCurrentPage('dashboard')}
                  >
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Process FIFO Report
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>

                  {/* Secondary actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs"
                      onClick={handleReset}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Upload Another CSV
                    </Button>
                    {csvFullRows.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs"
                        onClick={() => setCsvPreviewOpen(true)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Preview Full CSV
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs"
                      onClick={() => setCurrentPage('dashboard')}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      View Imported Files
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Previously Uploaded Files ── */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-teal-500" />
                Uploaded Files
                {csvFiles.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {csvFiles.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                  <span className="text-sm text-muted-foreground ml-2">Loading files...</span>
                </div>
              ) : csvFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">No files uploaded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload your first CSV to start importing trades
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {csvFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-teal-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.originalName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">
                            {file.tradeCount} trades
                          </span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatSize(file.fileSize)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(file.uploadedAt)}
                          </span>
                          {file.exchangeName && (
                            <>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Building2 className="h-2.5 w-2.5" />
                                {file.exchangeName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.skippedRows > 0 ? (
                          <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600 px-1.5 py-0">
                            {file.skippedRows} skipped
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 px-1.5 py-0">
                            All valid
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {file.validRows}/{file.totalRows}
                        </div>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(file)
                            deleteTargetRef.current = file
                          }}
                          title="Delete file"
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

        {/* ── RIGHT COLUMN (1/3) ── */}
        <div className="space-y-6">
          {/* ── Section 15: CSV Format Guide Panel ── */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-500" />
                CSV Format Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Required fields */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Required Fields
                </p>
                {REQUIRED_CSV_FIELDS.map(({ field, label, icon: Icon, example }) => (
                  <div
                    key={field}
                    className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 bg-green-500/[0.04] border border-green-500/10"
                  >
                    <Icon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="font-medium flex-1">{label}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                      {example}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Optional fields */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Optional Fields
                </p>
                {OPTIONAL_CSV_FIELDS.map(({ field, label, example }) => (
                  <div
                    key={field}
                    className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border border-border"
                  >
                    <span className="font-medium flex-1">{label}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                      {example}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Processing flow */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Upload Flow
                </p>
                {[
                  { num: 1, label: 'Upload CSV file', icon: Upload },
                  { num: 2, label: 'Map columns (if needed)', icon: Hash },
                  { num: 3, label: 'Enter exchange fees', icon: Percent },
                  { num: 4, label: 'Process & import', icon: CheckCircle2 },
                ].map(({ num, label, icon: StepIcon }) => (
                  <div key={num} className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10 text-[10px] font-bold text-teal-600 dark:text-teal-400 shrink-0">
                      {num}
                    </div>
                    <StepIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Helpful note */}
              <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.04] p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-teal-600 dark:text-teal-400">Tip:</span>{' '}
                  If your CSV uses different column names, upload it anyway. We will ask you to map the columns.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Upload flow steps indicator (current position) ── */}
          {step !== 'idle' && step !== 'error' && (
            <Card className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Progress
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'Upload CSV', done: step !== 'idle' && step !== 'analyzing', active: step === 'analyzing' },
                    { label: 'Column Detection', done: ['auto-success', 'mapping', 'exchange-details', 'confirming', 'done'].includes(step), active: ['auto-success', 'mapping'].includes(step) },
                    { label: 'Exchange Details', done: ['confirming', 'done'].includes(step), active: step === 'exchange-details' },
                    { label: 'Import & Process', done: step === 'done', active: step === 'confirming' },
                  ].map(({ label, done, active }, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`
                        flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-bold
                        ${done
                          ? 'bg-green-500 text-white'
                          : active
                            ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 ring-2 ring-teal-500/30'
                            : 'bg-muted text-muted-foreground'
                        }
                      `}>
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <span className={`text-xs ${done ? 'text-green-600 dark:text-green-400 font-medium' : active ? 'text-teal-600 dark:text-teal-400 font-medium' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                      {active && (
                        <Loader2 className="h-3 w-3 text-teal-500 animate-spin ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Helpful notes ── */}
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold">Supported Exchanges</h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Auto-detected formats include WazirX, CoinDCX, Binance, Delta Exchange, KuCoin, and more.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['WazirX', 'CoinDCX', 'Binance', 'Delta Exchange', 'KuCoin', 'Custom'].map((exchange) => (
                      <Badge key={exchange} variant="secondary" className="text-[10px] px-2 py-0.5">
                        {exchange}
                      </Badge>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <p className="text-[11px] text-muted-foreground">
                    You&apos;ll always get a chance to review and adjust column mappings before importing.
                    You can also save your mapping as a reusable import template.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MODALS — Always rendered, controlled by step state
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* ── Section 7: Column Mapping Modal ── */}
      {analysisResult && (
        <ColumnMappingWizard
          key={analysisResult.fileName + '-' + analysisResult.totalRows}
          open={step === 'mapping'}
          onClose={handleReset}
          analysisResult={analysisResult}
          onConfirm={handleMappingConfirm}
          isProcessing={false}
          workspaceId={workspaceId}
        />
      )}

      {/* ── Section 8: Exchange Details Modal ── */}
      <ExchangeDetailsModal
        open={step === 'exchange-details' || step === 'confirming'}
        onClose={() => {
          // Go back to mapping if we got here from mapping, otherwise reset
          if (analysisResult && analysisResult.requiredMapping.length > 0 && !isAutoDetected) {
            setStep('mapping')
          } else {
            handleReset()
          }
        }}
        onSubmit={handleExchangeDetailsSubmit}
        isProcessing={step === 'confirming'}
        fileName={pendingFile?.name}
      />

      {/* ── Section 5: CSV Preview Modal ── */}
      {analysisResult && (
        <CsvPreviewModal
          open={csvPreviewOpen}
          onClose={() => setCsvPreviewOpen(false)}
          fileName={analysisResult.fileName}
          headers={analysisResult.headers}
          rows={csvFullRows.length > 0 ? csvFullRows : analysisResult.sampleRows}
          totalRows={analysisResult.totalRows}
        />
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); deleteTargetRef.current = null } }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete File
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.originalName}</span>{' '}
              and all its associated trades ({deleteTarget?.tradeCount} trades). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteFile}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
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
