'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Export Center Page (Premium Rebuild)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Premium export center for generating, downloading, and tracking
// audit exports in CSV, Excel, and PDF formats.
// Implements 13-section specification with full modals, custom
// builder, history filters, and mobile-responsive design.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Table2,
  Settings2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  MoreVertical,
  ChevronRight,
  FolderOpen,
  Zap,
  Search,
  Filter,
  ArrowUpDown,
  TableIcon,
  FileOutput,
  BarChart3,
  StickyNote,
  Calculator,
  Building2,
  AlertTriangle,
  FileDown,
  Layers,
  X,
  Info,
  Sparkles,
  FileBarChart,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { getCurrentFinancialYear } from '@/lib/tax-defaults'

// ── Types ──────────────────────────────────────────────────

interface ExportRecord {
  id: string
  workspaceId: string
  userId: string
  exportType: string
  filename: string
  fileFormat: string
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'generated'
  generatedAt: string
  downloadUrl: string | null
  exportScope: string | null
  createdAt: string
}

type ExportFormat = 'csv' | 'excel' | 'pdf'
type ExportScope = 'full' | 'realized-trades' | 'open-holdings' | 'tax-summary' | 'pair-summary' | 'monthly-summary' | 'warnings' | 'upload-history'
type RecordScope = 'all' | 'filtered' | 'custom'

interface CustomExportConfig {
  format: ExportFormat
  scope: ExportScope
  recordScope: RecordScope
  includeSummary: boolean
  includeCharts: boolean
  includeFormulas: boolean
  includeExchangeDetails: boolean
  includeWarnings: boolean
  includeNotes: boolean
  includeAppendices: boolean
}

// ── CSV dataset options ────────────────────────────────────

const csvDatasetOptions = [
  { id: 'realized-trades', label: 'Realized Trades', desc: 'All buy-sell matched pairs', scope: 'realized-trades' as ExportScope },
  { id: 'open-holdings', label: 'Open Holdings', desc: 'Unsold asset positions', scope: 'open-holdings' as ExportScope },
  { id: 'tax-summary', label: 'Tax Summary', desc: 'Capital gains & tax liability', scope: 'tax-summary' as ExportScope },
  { id: 'pair-summary', label: 'Pair-wise Performance', desc: 'Performance per trading pair', scope: 'pair-summary' as ExportScope },
  { id: 'monthly-summary', label: 'Time-wise Profit Summary', desc: 'Monthly/quarterly breakdown', scope: 'monthly-summary' as ExportScope },
  { id: 'upload-history', label: 'Upload History', desc: 'CSV upload audit trail', scope: 'upload-history' as ExportScope },
  { id: 'warnings', label: 'Warnings & Unmatched Sells', desc: 'Anomalies and unmatched trades', scope: 'warnings' as ExportScope },
  { id: 'skipped', label: 'Skipped Rows', desc: 'Rows skipped during processing', scope: 'upload-history' as ExportScope },
]

// ── Scope labels ────────────────────────────────────────────

const scopeLabels: Record<ExportScope, string> = {
  'full': 'Full Workspace Report',
  'realized-trades': 'Realized Trades',
  'open-holdings': 'Open Holdings',
  'tax-summary': 'Tax Summary',
  'pair-summary': 'Pair-wise Summary',
  'monthly-summary': 'Monthly Summary',
  'warnings': 'Warnings / Unmatched',
  'upload-history': 'Upload History',
}

// ── Format badge helper ─────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const styles: Record<string, string> = {
    'XLSX': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'EXCEL': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'EXCEL_FULL': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'PDF': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    'PDF_DATA': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    'CSV': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    'CUSTOM': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  }
  const displayFormat = format === 'EXCEL_FULL' ? 'XLSX' : format === 'PDF_DATA' ? 'PDF' : format
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold ${styles[format] || 'border-border'}`}>
      {displayFormat}
    </Badge>
  )
}

// ── Status badge helper ─────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
    case 'generated':
      return (
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
        </Badge>
      )
    case 'PENDING':
      return (
        <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px]">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating
        </Badge>
      )
    case 'FAILED':
      return (
        <Badge variant="outline" className="border-red-500/30 text-red-600 dark:text-red-400 text-[10px]">
          <AlertCircle className="h-3 w-3 mr-1" /> Failed
        </Badge>
      )
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>
  }
}

// ── Format icon helper ──────────────────────────────────────

function FormatIcon({ format, className }: { format: string; className?: string }) {
  const cn = className || 'h-5 w-5'
  switch (format) {
    case 'csv':
    case 'CSV':
      return <Table2 className={cn} />
    case 'excel':
    case 'XLSX':
    case 'EXCEL':
    case 'EXCEL_FULL':
      return <FileSpreadsheet className={cn} />
    case 'pdf':
    case 'PDF':
    case 'PDF_DATA':
      return <FileText className={cn} />
    default:
      return <FileDown className={cn} />
  }
}

// ── Animated generating messages ─────────────────────────────

const generatingMessages = [
  'Preparing your export...',
  'Compiling trade data...',
  'Calculating tax summaries...',
  'Formatting output file...',
  'Almost there...',
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT CENTER COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ExportCenterPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  // ── Core state ──
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoadingExports, setIsLoadingExports] = useState(true)
  const [exportsError, setExportsError] = useState<string | null>(null)
  const [generatingType, setGeneratingType] = useState<string | null>(null)
  const [generatingMessage, setGeneratingMessage] = useState('')
  const generatingMsgIndex = useRef(0)

  // ── Modal state ──
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)

  // ── CSV modal state ──
  const [csvScope, setCsvScope] = useState<ExportScope>('realized-trades')
  const [csvRecordScope, setCsvRecordScope] = useState<'all' | 'filtered'>('all')

  // ── Excel modal state ──
  const [excelIncludeNotes, setExcelIncludeNotes] = useState(true)
  const [excelIncludeWarnings, setExcelIncludeWarnings] = useState(true)
  const [excelIncludeDetailedTrades, setExcelIncludeDetailedTrades] = useState(true)

  // ── PDF modal state ──
  const [pdfMode, setPdfMode] = useState<'summary' | 'full'>('summary')
  const [pdfIncludeDetailedTrades, setPdfIncludeDetailedTrades] = useState(false)
  const [pdfIncludeDetailedHoldings, setPdfIncludeDetailedHoldings] = useState(false)
  const [pdfIncludeNotes, setPdfIncludeNotes] = useState(false)

  // ── Custom export builder state ──
  const [customConfig, setCustomConfig] = useState<CustomExportConfig>({
    format: 'excel',
    scope: 'full',
    recordScope: 'all',
    includeSummary: true,
    includeCharts: true,
    includeFormulas: false,
    includeExchangeDetails: false,
    includeWarnings: true,
    includeNotes: false,
    includeAppendices: false,
  })

  // ── History filters state ──
  const [historySearch, setHistorySearch] = useState('')
  const [historyFormatFilter, setHistoryFormatFilter] = useState<'all' | 'CSV' | 'Excel' | 'PDF'>('all')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'Ready' | 'Failed'>('all')
  const [historySort, setHistorySort] = useState<'newest' | 'oldest'>('newest')

  // ── Animated generating messages effect ──
  useEffect(() => {
    if (!generatingType) {
      generatingMsgIndex.current = 0
      return
    }
    const interval = setInterval(() => {
      generatingMsgIndex.current = (generatingMsgIndex.current + 1) % generatingMessages.length
      setGeneratingMessage(generatingMessages[generatingMsgIndex.current])
    }, 2500)
    return () => clearInterval(interval)
  }, [generatingType])

  // ── Fetch exports ──────────────────────────────────────
  const fetchExports = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoadingExports(false)
      return
    }
    setIsLoadingExports(true)
    setExportsError(null)
    try {
      const data = await apiGet<{ exports: ExportRecord[] } | ExportRecord[]>(
        `/api/workspaces/${currentWorkspace.id}/exports`
      )
      const exportList = Array.isArray(data) ? data : (data as { exports: ExportRecord[] }).exports || []
      setExports(exportList)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load exports'
      setExportsError(msg)
    } finally {
      setIsLoadingExports(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchExports()
  }, [fetchExports])

  // ── Token helper ──
  const getToken = () => localStorage.getItem('crypto_audit_token')

  // ── Download helper ──
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // ── File download via POST ──
  const downloadExportFile = async (url: string, data?: Record<string, unknown>, filenameFallback?: string) => {
    const token = getToken()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Export generation failed' }))
      throw new Error(errorData.error || 'Export generation failed')
    }
    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition')
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
      : filenameFallback || `CryptoAudit_Export_${new Date().toISOString().slice(0, 10)}`
    downloadBlob(blob, filename)
  }

  // ── Generate CSV Export ──
  const handleGenerateCsv = async (scope?: ExportScope, recordScope?: 'all' | 'filtered') => {
    if (!currentWorkspace) return
    const useScope = scope || csvScope
    const useRecordScope = recordScope || csvRecordScope
    setGeneratingType('csv')
    setGeneratingMessage('Preparing CSV export...')
    setShowCsvModal(false)
    try {
      const wsName = currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
      await downloadExportFile(
        `/api/workspaces/${currentWorkspace.id}/exports/csv?scope=${useScope}&recordScope=${useRecordScope}`,
        undefined,
        `CryptoAudit_${wsName}_${useScope}_${new Date().toISOString().slice(0, 10)}.csv`
      )
      toast.success('CSV export generated successfully')
      await fetchExports()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate CSV export')
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Generate Excel Export ──
  const handleGenerateExcel = async () => {
    if (!currentWorkspace) return
    setGeneratingType('excel')
    setGeneratingMessage('Generating Excel workbook...')
    setShowExcelModal(false)
    try {
      const wsName = currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
      await downloadExportFile(
        `/api/workspaces/${currentWorkspace.id}/exports/excel/full`,
        { includeNotes: excelIncludeNotes, includeWarnings: excelIncludeWarnings, includeDetailedTrades: excelIncludeDetailedTrades },
        `CryptoAudit_${wsName}_FullWorkbook_${new Date().toISOString().slice(0, 10)}.xlsx`
      )
      toast.success('Excel workbook generated successfully')
      await fetchExports()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate Excel workbook')
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Generate PDF Export ──
  const handleGeneratePdf = async () => {
    if (!currentWorkspace) return
    setGeneratingType('pdf')
    setGeneratingMessage('Building PDF report...')
    setShowPdfModal(false)
    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspace.id}/exports/pdf/data`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: pdfMode,
            includeDetailedTrades: pdfIncludeDetailedTrades,
            includeDetailedHoldings: pdfIncludeDetailedHoldings,
            includeNotes: pdfIncludeNotes,
          }),
        }
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate PDF' }))
        throw new Error(errorData.error || 'Failed to generate PDF report')
      }
      const result = await response.json()
      const pdfData = result.data || result
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(generatePdfHtml(pdfData, currentWorkspace))
        printWindow.document.close()
        setTimeout(() => printWindow.print(), 500)
      }
      toast.success('PDF report generated successfully')
      await fetchExports()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate PDF report')
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Generate Custom Export ──
  const handleGenerateCustom = async () => {
    if (!currentWorkspace) return
    setShowCustomBuilder(false)
    const { format, scope, recordScope } = customConfig
    const typeName = format === 'excel' ? 'Excel' : format === 'pdf' ? 'PDF' : 'CSV'
    setGeneratingType('custom')
    setGeneratingMessage(`Generating custom ${typeName} export...`)

    try {
      if (format === 'csv') {
        await handleGenerateCsv(scope, recordScope === 'filtered' ? 'filtered' : 'all')
        return
      } else if (format === 'pdf') {
        setPdfMode('full')
        await handleGeneratePdf()
        return
      } else if (format === 'excel') {
        if (scope === 'full') {
          await handleGenerateExcel()
          return
        }
        const endpointMap: Record<string, string> = {
          'realized-trades': `/api/workspaces/${currentWorkspace.id}/exports/excel/realized-trades`,
          'open-holdings': `/api/workspaces/${currentWorkspace.id}/exports/excel/open-holdings`,
          'tax-summary': `/api/workspaces/${currentWorkspace.id}/exports/excel/tax-summary`,
        }
        const endpoint = endpointMap[scope]
        if (!endpoint) {
          toast.error('This export combination is not yet available')
          setGeneratingType(null)
          return
        }
        const wsName = currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
        await downloadExportFile(
          endpoint,
          undefined,
          `CryptoAudit_${wsName}_${scope}_${new Date().toISOString().slice(0, 10)}.xlsx`
        )
        toast.success('Excel export generated successfully')
        await fetchExports()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate export')
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Delete export record ──
  const handleDeleteExport = async (exportId: string) => {
    if (!currentWorkspace) return
    try {
      await fetch(
        `/api/workspaces/${currentWorkspace.id}/exports/${exportId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      )
      toast.success('Export record deleted')
      await fetchExports()
    } catch {
      toast.error('Failed to delete export record')
    }
  }

  // ── Regenerate export ──
  const handleRegenerate = async (exp: ExportRecord) => {
    const exportType = exp.exportType
    if (exportType.includes('EXCEL')) {
      await handleGenerateExcel()
    } else if (exportType.includes('PDF')) {
      await handleGeneratePdf()
    } else if (exportType.includes('CSV')) {
      await handleGenerateCsv('realized-trades', 'all')
    }
  }

  // ── Generate filename preview ──
  const getFilenamePreview = () => {
    if (!currentWorkspace) return ''
    const wsName = currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
    const fy = currentWorkspace.financialYear || getCurrentFinancialYear()
    const ext = customConfig.format === 'excel' ? 'xlsx' : customConfig.format === 'pdf' ? 'pdf' : 'csv'
    const scopeLabel = scopeLabels[customConfig.scope].replace(/\s+/g, '_')
    return `Crypto_Audit_Master_${wsName}_${fy}_${scopeLabel}.${ext}`
  }

  // ── Format date ──
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ── Filtered & sorted exports ──
  const filteredExports = useMemo(() => {
    let result = [...exports]

    // Search
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      result = result.filter((e) => e.filename?.toLowerCase().includes(q))
    }

    // Format filter
    if (historyFormatFilter !== 'all') {
      result = result.filter((e) => {
        const fmt = (e.exportType || e.fileFormat || '').toUpperCase()
        if (historyFormatFilter === 'CSV') return fmt.includes('CSV')
        if (historyFormatFilter === 'Excel') return fmt.includes('EXCEL') || fmt.includes('XLSX')
        if (historyFormatFilter === 'PDF') return fmt.includes('PDF')
        return true
      })
    }

    // Status filter
    if (historyStatusFilter !== 'all') {
      result = result.filter((e) => {
        if (historyStatusFilter === 'Ready') return e.status === 'COMPLETED' || e.status === 'generated'
        if (historyStatusFilter === 'Failed') return e.status === 'FAILED'
        return true
      })
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.generatedAt || a.createdAt).getTime()
      const dateB = new Date(b.generatedAt || b.createdAt).getTime()
      return historySort === 'newest' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [exports, historySearch, historyFormatFilter, historyStatusFilter, historySort])

  // ── Generating state ──
  const isGenerating = generatingType !== null

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOADING STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (isLoadingExports) {
    return <ExportCenterSkeleton />
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NO WORKSPACE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <FolderOpen className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select a workspace to access the Export Center.
        </p>
        <Button
          onClick={() => setCurrentPage('workspaces')}
          className="mt-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
        >
          Go to Workspaces
        </Button>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAIN RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════════════════
          1. PAGE TOP AREA
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Export Center</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Generate CSV data files, detailed Excel audit workbooks, and professional PDF reports.
          </p>
        </div>
        <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-600 dark:text-teal-400 w-fit shrink-0">
          <FolderOpen className="h-3 w-3 mr-1.5" />
          {currentWorkspace.name} &bull; FY {currentWorkspace.financialYear || 'N/A'}
        </Badge>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          7. EXPORT GENERATION STATUS (animated progress banner)
          ═══════════════════════════════════════════════════════════ */}
      {isGenerating && (
        <Card className="rounded-2xl border-teal-500/30 bg-gradient-to-r from-teal-500/5 via-cyan-500/5 to-teal-500/5 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 shrink-0">
                <Loader2 className="h-5 w-5 text-teal-500 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-teal-600 dark:text-teal-400">{generatingMessage}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Please wait, your export is being prepared&hellip;</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          3. EXPORT OVERVIEW BANNER
          ═══════════════════════════════════════════════════════════ */}
      <Card className="rounded-2xl border-border shadow-sm bg-gradient-to-r from-card via-card to-teal-500/[0.02]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 shrink-0 mt-0.5">
              <Info className="h-4.5 w-4.5 text-teal-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Choose the right export for your audit needs</p>
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mt-3`}>
                <div className="flex items-start gap-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/10 p-3">
                  <Table2 className="h-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">CSV</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Raw records for import into external tools</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Excel</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Full audit workbook with multi-sheet data</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10 p-3">
                  <FileText className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">PDF</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">Professional report, print/share-ready</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════
          4. PRIMARY EXPORT TYPE CARDS (3 cards)
          ═══════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
          Primary Export Types
        </h3>
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>

          {/* ── CSV Card ── */}
          <Card className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all duration-200 group">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10">
                  <Table2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">
                  CSV
                </Badge>
              </div>
              <h4 className="text-base font-semibold mb-1.5">Raw CSV Data Export</h4>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Lightweight structured data files for external tools, spreadsheets, or further processing.
              </p>
              <ul className="space-y-1.5 mb-5">
                {['Realized Trades', 'Open Holdings', 'Tax Summary', 'Warnings & Unmatched'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-cyan-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowCsvModal(true)}
                disabled={isGenerating}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9"
              >
                <Table2 className="h-4 w-4 mr-2" />
                Create CSV Export
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Select dataset &amp; scope</p>
            </CardContent>
          </Card>

          {/* ── Excel Card (highlighted) ── */}
          <Card className="rounded-2xl border-emerald-500/30 shadow-sm shadow-emerald-500/5 hover:shadow-md hover:shadow-emerald-500/10 transition-all duration-200 group relative ring-1 ring-emerald-500/20">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-emerald-500 text-white text-[10px] font-semibold px-2.5 py-0.5 shadow-sm">
                <Sparkles className="h-3 w-3 mr-1" /> Most Comprehensive
              </Badge>
            </div>
            <CardContent className="p-5 sm:p-6 pt-7">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  XLSX
                </Badge>
              </div>
              <h4 className="text-base font-semibold mb-1.5">Full Audit Excel Workbook</h4>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Comprehensive multi-sheet workbook with every detail of your audit — the most complete export option.
              </p>
              <ul className="space-y-1.5 mb-5">
                {['Multi-sheet workbook', 'Charts & visualizations', 'Detailed trades & holdings', 'Tax, fees, warnings & formulas'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowExcelModal(true)}
                disabled={isGenerating}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Generate Excel Workbook
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Configure included sections</p>
            </CardContent>
          </Card>

          {/* ── PDF Card ── */}
          <Card className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all duration-200 group">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10">
                  <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                  PDF
                </Badge>
              </div>
              <h4 className="text-base font-semibold mb-1.5">Professional PDF Audit Report</h4>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Clean, printable audit report with executive summary, charts, and tax overview for documentation.
              </p>
              <ul className="space-y-1.5 mb-5">
                {['Executive summary', 'Charts & visualizations', 'Tax overview', 'Print / share-ready'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-rose-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowPdfModal(true)}
                disabled={isGenerating}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate PDF Report
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">Summary or full with appendices</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          6. CUSTOM EXPORT BUILDER SECTION
          ═══════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
          Custom Export
        </h3>
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <Settings2 className="h-4 w-4 text-violet-500" />
                  </div>
                  <h4 className="text-sm font-semibold">Build a Custom Export</h4>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-10">
                  Tailor your export format, scope, and included sections
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowCustomBuilder(true)}
                disabled={isGenerating}
                className="rounded-xl shrink-0"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                {isMobile ? 'Build' : 'Open Builder'}
              </Button>
            </div>

            {/* Quick summary of current custom config */}
            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-3`}>
              <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Format</p>
                <p className="text-sm font-semibold mt-0.5 capitalize">{customConfig.format === 'excel' ? 'Excel (XLSX)' : customConfig.format === 'pdf' ? 'PDF' : 'CSV'}</p>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Data Scope</p>
                <p className="text-sm font-semibold mt-0.5">{scopeLabels[customConfig.scope]}</p>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Records</p>
                <p className="text-sm font-semibold mt-0.5 capitalize">{customConfig.recordScope === 'all' ? 'All Records' : customConfig.recordScope === 'filtered' ? 'Filtered' : 'Custom'}</p>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sections</p>
                <p className="text-sm font-semibold mt-0.5">
                  {[customConfig.includeSummary && 'Summary', customConfig.includeCharts && 'Charts', customConfig.includeWarnings && 'Warnings', customConfig.includeNotes && 'Notes'].filter(Boolean).length} included
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          8. EXPORT HISTORY SECTION
          ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Exports
          </h3>
          {exports.length > 0 && (
            <Button variant="ghost" size="sm" onClick={fetchExports} className="text-xs text-muted-foreground rounded-xl w-fit">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          )}
        </div>

        {/* ── Error State ── */}
        {exportsError && (
          <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 dark:text-red-400">{exportsError}</p>
              <Button variant="outline" onClick={fetchExports} className="mt-3 rounded-xl">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Empty State ── */}
        {exports.length === 0 && !exportsError && (
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                <Download className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No exports generated yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first export using one of the options above.
              </p>
              <Button
                onClick={() => setShowCsvModal(true)}
                disabled={isGenerating}
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> Create Your First Export
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════
            9. EXPORT HISTORY FILTERS
            ═══════════════════════════════════════════════════════════ */}
        {exports.length > 0 && !exportsError && (
          <>
            <div className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center'} gap-3 mb-4`}>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search file name..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9 h-8 text-xs rounded-xl"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={historyFormatFilter} onValueChange={(v) => setHistoryFormatFilter(v as typeof historyFormatFilter)}>
                  <SelectTrigger className="h-8 w-[110px] text-xs rounded-xl">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Formats</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                    <SelectItem value="Excel">Excel</SelectItem>
                    <SelectItem value="PDF">PDF</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={historyStatusFilter} onValueChange={(v) => setHistoryStatusFilter(v as typeof historyStatusFilter)}>
                  <SelectTrigger className="h-8 w-[110px] text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Ready">Ready</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={historySort} onValueChange={(v) => setHistorySort(v as typeof historySort)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs rounded-xl">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Desktop: Export History Table */}
            {!isMobile && filteredExports.length > 0 && (
              <Card className="rounded-2xl border-border shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs font-medium text-muted-foreground p-4 w-10">#</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-4">File Name</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-4">Format</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-4">Export Type</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-4">Scope</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-4">Generated On</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                          <th className="text-right text-xs font-medium text-muted-foreground p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExports.map((exp, index) => (
                          <tr
                            key={exp.id}
                            className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                          >
                            <td className="p-4 text-xs text-muted-foreground">{index + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <FormatIcon format={exp.exportType || exp.fileFormat || 'CSV'} className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm truncate max-w-[220px]">{exp.filename}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <FormatBadge format={exp.exportType || exp.fileFormat || 'CSV'} />
                            </td>
                            <td className="p-4">
                              <Badge variant="secondary" className="text-[10px]">
                                {exp.exportType?.replace(/_/g, ' ') || 'Export'}
                              </Badge>
                            </td>
                            <td className="p-4 text-xs text-muted-foreground">
                              {exp.exportScope || '—'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDate(exp.generatedAt || exp.createdAt)}
                              </div>
                            </td>
                            <td className="p-4">
                              <StatusBadge status={exp.status} />
                            </td>
                            <td className="p-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  {(exp.status === 'COMPLETED' || exp.status === 'generated') && (
                                    <DropdownMenuItem
                                      onClick={() => handleRegenerate(exp)}
                                      className="text-teal-600 dark:text-teal-400"
                                    >
                                      <Download className="h-4 w-4 mr-2" /> Download
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleRegenerate(exp)}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteExport(exp.id)}
                                    className="text-red-600 dark:text-red-400"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No filtered results */}
            {!isMobile && filteredExports.length === 0 && exports.length > 0 && (
              <Card className="rounded-2xl border-border shadow-sm">
                <CardContent className="p-8 text-center">
                  <Search className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No exports match your current filters</p>
                  <Button variant="link" size="sm" onClick={() => { setHistorySearch(''); setHistoryFormatFilter('all'); setHistoryStatusFilter('all') }} className="text-teal-500 mt-1">
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Mobile: Export History Cards */}
            {isMobile && filteredExports.length > 0 && (
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {filteredExports.map((exp) => (
                  <Card key={exp.id} className="rounded-2xl border-border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FormatBadge format={exp.exportType || exp.fileFormat || 'CSV'} />
                          <StatusBadge status={exp.status} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => handleRegenerate(exp)} className="text-teal-600 dark:text-teal-400">
                              <Download className="h-4 w-4 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRegenerate(exp)}>
                              <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteExport(exp.id)} className="text-red-600 dark:text-red-400">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <FormatIcon format={exp.exportType || exp.fileFormat || 'CSV'} className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{exp.filename}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px]">
                            {exp.exportType?.replace(/_/g, ' ') || 'Export'}
                          </Badge>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(exp.generatedAt || exp.createdAt)}
                          </div>
                        </div>
                        {exp.exportScope && (
                          <p className="text-xs text-muted-foreground">Scope: {exp.exportScope}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Mobile: No filtered results */}
            {isMobile && filteredExports.length === 0 && exports.length > 0 && (
              <Card className="rounded-2xl border-border shadow-sm">
                <CardContent className="p-6 text-center">
                  <Search className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No exports match your filters</p>
                  <Button variant="link" size="sm" onClick={() => { setHistorySearch(''); setHistoryFormatFilter('all'); setHistoryStatusFilter('all') }} className="text-teal-500 text-xs mt-1">
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          5A. CSV EXPORT MODAL
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showCsvModal} onOpenChange={setShowCsvModal}>
        <DialogContent className={`${isMobile ? 'max-w-full h-[85vh]' : 'sm:max-w-[520px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                <Table2 className="h-4 w-4 text-cyan-500" />
              </div>
              CSV Data Export
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select which dataset to export as a CSV file
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className={isMobile ? 'max-h-[50vh]' : 'max-h-[400px]'} type="auto">
            <div className="space-y-5 py-2 pr-2">
              {/* Dataset selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Dataset</Label>
                <RadioGroup value={csvScope} onValueChange={(v) => setCsvScope(v as ExportScope)} className="space-y-2">
                  {csvDatasetOptions.map((opt) => (
                    <label
                      key={opt.id}
                      htmlFor={`csv-${opt.id}`}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                        csvScope === opt.scope
                          ? 'border-teal-500/40 bg-teal-500/5'
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <RadioGroupItem value={opt.scope} id={`csv-${opt.id}`} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Record scope */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Record Scope</Label>
                <RadioGroup value={csvRecordScope} onValueChange={(v) => setCsvRecordScope(v as 'all' | 'filtered')} className="flex gap-3">
                  <label
                    htmlFor="csv-all"
                    className={`flex-1 flex items-center gap-2 rounded-xl border p-3 cursor-pointer transition-all ${
                      csvRecordScope === 'all'
                        ? 'border-teal-500/40 bg-teal-500/5'
                        : 'border-border hover:bg-accent/30'
                    }`}
                  >
                    <RadioGroupItem value="all" id="csv-all" />
                    <div>
                      <p className="text-sm font-medium">All Records</p>
                      <p className="text-[10px] text-muted-foreground">Export complete dataset</p>
                    </div>
                  </label>
                  <label
                    htmlFor="csv-filtered"
                    className={`flex-1 flex items-center gap-2 rounded-xl border p-3 cursor-pointer transition-all ${
                      csvRecordScope === 'filtered'
                        ? 'border-teal-500/40 bg-teal-500/5'
                        : 'border-border hover:bg-accent/30'
                    }`}
                  >
                    <RadioGroupItem value="filtered" id="csv-filtered" />
                    <div>
                      <p className="text-sm font-medium">Filtered</p>
                      <p className="text-[10px] text-muted-foreground">Current view filters</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCsvModal(false)} className="rounded-xl" disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={() => handleGenerateCsv()}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[150px]"
            >
              {isGenerating && generatingType === 'csv' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating&hellip;</>
              ) : (
                <><Table2 className="h-4 w-4 mr-2" /> Generate CSV</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          5B. EXCEL EXPORT MODAL
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showExcelModal} onOpenChange={setShowExcelModal}>
        <DialogContent className={`${isMobile ? 'max-w-full h-[85vh]' : 'sm:max-w-[480px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              </div>
              Full Audit Excel Workbook
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure sections to include in your Excel workbook
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Info */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>The full workbook includes realized trades, open holdings, tax summary, fees breakdown, and more. Use the toggles below to customize your output.</span>
              </p>
            </div>

            {/* Include toggles */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Include / Exclude Sections</Label>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-[10px] text-muted-foreground">Workspace notes &amp; annotations</p>
                  </div>
                </div>
                <Switch checked={excelIncludeNotes} onCheckedChange={setExcelIncludeNotes} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Full Warnings Appendix</p>
                    <p className="text-[10px] text-muted-foreground">Warnings &amp; unmatched sells detail</p>
                  </div>
                </div>
                <Switch checked={excelIncludeWarnings} onCheckedChange={setExcelIncludeWarnings} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Detailed Realized Trades</p>
                    <p className="text-[10px] text-muted-foreground">Full trade-level detail sheet</p>
                  </div>
                </div>
                <Switch checked={excelIncludeDetailedTrades} onCheckedChange={setExcelIncludeDetailedTrades} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExcelModal(false)} className="rounded-xl" disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateExcel}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[180px]"
            >
              {isGenerating && generatingType === 'excel' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating&hellip;</>
              ) : (
                <><FileSpreadsheet className="h-4 w-4 mr-2" /> Generate Excel Workbook</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          5C. PDF EXPORT MODAL
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showPdfModal} onOpenChange={setShowPdfModal}>
        <DialogContent className={`${isMobile ? 'max-w-full h-[85vh]' : 'sm:max-w-[500px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
                <FileText className="h-4 w-4 text-rose-500" />
              </div>
              Professional Audit Summary Report
            </DialogTitle>
            <DialogDescription className="text-xs">
              Choose report type and optional sections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* PDF Mode selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report Type</Label>
              <RadioGroup value={pdfMode} onValueChange={(v) => setPdfMode(v as 'summary' | 'full')} className="grid grid-cols-2 gap-3">
                <label
                  htmlFor="pdf-summary"
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all text-center ${
                    pdfMode === 'summary'
                      ? 'border-teal-500/40 bg-teal-500/5'
                      : 'border-border hover:bg-accent/30'
                  }`}
                >
                  <RadioGroupItem value="summary" id="pdf-summary" />
                  <FileBarChart className="h-5 w-5 text-rose-500" />
                  <div>
                    <p className="text-sm font-medium">Summary PDF</p>
                    <p className="text-[10px] text-muted-foreground">Key metrics &amp; overview</p>
                  </div>
                </label>
                <label
                  htmlFor="pdf-full"
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all text-center ${
                    pdfMode === 'full'
                      ? 'border-teal-500/40 bg-teal-500/5'
                      : 'border-border hover:bg-accent/30'
                  }`}
                >
                  <RadioGroupItem value="full" id="pdf-full" />
                  <Layers className="h-5 w-5 text-rose-500" />
                  <div>
                    <p className="text-sm font-medium">Full PDF</p>
                    <p className="text-[10px] text-muted-foreground">With appendices</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Optional checkboxes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optional Sections</Label>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Checkbox
                    id="pdf-trades"
                    checked={pdfIncludeDetailedTrades}
                    onCheckedChange={(v) => setPdfIncludeDetailedTrades(v === true)}
                  />
                  <label htmlFor="pdf-trades" className="text-sm cursor-pointer flex-1">Include detailed realized trades</label>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Checkbox
                    id="pdf-holdings"
                    checked={pdfIncludeDetailedHoldings}
                    onCheckedChange={(v) => setPdfIncludeDetailedHoldings(v === true)}
                  />
                  <label htmlFor="pdf-holdings" className="text-sm cursor-pointer flex-1">Include detailed open holdings</label>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Checkbox
                    id="pdf-notes"
                    checked={pdfIncludeNotes}
                    onCheckedChange={(v) => setPdfIncludeNotes(v === true)}
                  />
                  <label htmlFor="pdf-notes" className="text-sm cursor-pointer flex-1">Include workspace notes</label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPdfModal(false)} className="rounded-xl" disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={handleGeneratePdf}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[170px]"
            >
              {isGenerating && generatingType === 'pdf' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating&hellip;</>
              ) : (
                <><FileText className="h-4 w-4 mr-2" /> Generate PDF Report</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          6. CUSTOM EXPORT BUILDER DIALOG
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showCustomBuilder} onOpenChange={setShowCustomBuilder}>
        <DialogContent className={`${isMobile ? 'max-w-full h-[90vh]' : 'sm:max-w-[560px]'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                <Settings2 className="h-4 w-4 text-violet-500" />
              </div>
              Build a Custom Export
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select format, data scope, record mode, and optional sections
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className={isMobile ? 'max-h-[60vh]' : 'max-h-[450px]'} type="auto">
            <div className="space-y-6 py-2 pr-2">
              {/* Step 1: Format */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-[10px] font-bold text-teal-600 dark:text-teal-400">1</span>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Format</Label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'csv' as ExportFormat, icon: Table2, label: 'CSV', color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
                    { value: 'excel' as ExportFormat, icon: FileSpreadsheet, label: 'Excel', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                    { value: 'pdf' as ExportFormat, icon: FileText, label: 'PDF', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
                  ]).map((fmt) => (
                    <button
                      key={fmt.value}
                      onClick={() => setCustomConfig((prev) => ({ ...prev, format: fmt.value }))}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all ${
                        customConfig.format === fmt.value
                          ? `${fmt.border} bg-teal-500/5 ring-1 ring-teal-500/20`
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <fmt.icon className={`h-5 w-5 ${fmt.color}`} />
                      <span className="text-xs font-semibold">{fmt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Data Scope */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-[10px] font-bold text-teal-600 dark:text-teal-400">2</span>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Data Scope</Label>
                </div>
                <Select
                  value={customConfig.scope}
                  onValueChange={(v) => setCustomConfig((prev) => ({ ...prev, scope: v as ExportScope }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(scopeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 3: Record Mode */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-[10px] font-bold text-teal-600 dark:text-teal-400">3</span>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Record Mode</Label>
                </div>
                <RadioGroup
                  value={customConfig.recordScope}
                  onValueChange={(v) => setCustomConfig((prev) => ({ ...prev, recordScope: v as RecordScope }))}
                  className="grid grid-cols-3 gap-2"
                >
                  {([
                    { value: 'all' as RecordScope, label: 'All Records', desc: 'Complete dataset' },
                    { value: 'filtered' as RecordScope, label: 'Filtered', desc: 'Current view' },
                    { value: 'custom' as RecordScope, label: 'Custom', desc: 'Specify range' },
                  ]).map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={`record-${opt.value}`}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-3 cursor-pointer transition-all text-center ${
                        customConfig.recordScope === opt.value
                          ? 'border-teal-500/40 bg-teal-500/5'
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} id={`record-${opt.value}`} />
                      <p className="text-xs font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Step 4: Optional Sections */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10 text-[10px] font-bold text-teal-600 dark:text-teal-400">4</span>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Include Optional Sections</Label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'includeSummary' as const, label: 'Summary', icon: BarChart3 },
                    { key: 'includeCharts' as const, label: 'Charts', icon: BarChart3 },
                    { key: 'includeFormulas' as const, label: 'Formulas', icon: Calculator },
                    { key: 'includeExchangeDetails' as const, label: 'Exchange Details', icon: Building2 },
                    { key: 'includeWarnings' as const, label: 'Warnings', icon: AlertTriangle },
                    { key: 'includeNotes' as const, label: 'Notes', icon: StickyNote },
                    { key: 'includeAppendices' as const, label: 'Appendices', icon: Layers },
                  ]).map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                        customConfig[opt.key]
                          ? 'border-teal-500/30 bg-teal-500/5'
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <Checkbox
                        checked={customConfig[opt.key]}
                        onCheckedChange={(v) =>
                          setCustomConfig((prev) => ({ ...prev, [opt.key]: v === true }))
                        }
                      />
                      <opt.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* File name preview */}
              <div className="rounded-xl border border-dashed border-border p-3 bg-muted/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">File Name Preview</p>
                <p className="text-xs font-mono text-foreground break-all">{getFilenamePreview()}</p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCustomBuilder(false)} className="rounded-xl" disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCustom}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl min-w-[150px]"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating&hellip;</>
              ) : (
                <><FileOutput className="h-4 w-4 mr-2" /> Generate Export</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKELETON LOADER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExportCenterSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-muted rounded-lg" />
          <div className="h-4 w-80 bg-muted rounded mt-2" />
        </div>
        <div className="h-6 w-40 bg-muted rounded" />
      </div>
      <div className="h-28 bg-muted rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-72 bg-muted rounded-2xl" />
        ))}
      </div>
      <div className="h-32 bg-muted rounded-2xl" />
      <div className="h-48 bg-muted rounded-2xl" />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PDF HTML GENERATOR (for print-to-PDF)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generatePdfHtml(data: Record<string, unknown>, workspace: { name: string; financialYear?: string | null }): string {
  const wsName = workspace.name
  const fy = workspace.financialYear || 'N/A'
  const now = new Date().toLocaleString('en-IN')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Crypto Audit Report - ${wsName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #0d9488; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #0d9488; margin-bottom: 4px; }
    .header p { font-size: 12px; color: #666; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { font-size: 16px; color: #0d9488; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f0fdfa; color: #0d9488; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #0d9488; }
    td { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
    .summary-card .label { font-size: 10px; color: #666; text-transform: uppercase; }
    .summary-card .value { font-size: 18px; font-weight: 700; color: #0d9488; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Crypto Audit Master — Audit Report</h1>
    <p>Workspace: ${wsName} &bull; Financial Year: ${fy} &bull; Generated: ${now}</p>
  </div>
  <div class="section">
    <h2>Executive Summary</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">Total Realized P&L</div>
        <div class="value">${formatCurrency(data.totalRealizedPnl as number)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Short-Term Gains</div>
        <div class="value">${formatCurrency(data.shortTermGains as number)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Long-Term Gains</div>
        <div class="value">${formatCurrency(data.longTermGains as number)}</div>
      </div>
      <div class="summary-card">
        <div class="label">Tax Liability</div>
        <div class="value">${formatCurrency(data.taxLiability as number)}</div>
      </div>
    </div>
  </div>
  <div class="section">
    <h2>Tax Overview</h2>
    <p style="font-size:12px;color:#666;">Detailed tax computation is available in the Excel workbook export.</p>
  </div>
  <div class="footer">
    <p>Generated by Crypto Audit Master &bull; This report is for informational purposes only &bull; ${now}</p>
  </div>
</body>
</html>`
}

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '₹0'
  return '₹' + Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
