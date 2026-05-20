'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Export Center Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Premium export center for generating, downloading, and tracking
// audit exports in CSV, Excel, and PDF formats.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileDown,
  Settings2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Archive,
  Plus,
  RefreshCw,
  Trash2,
  MoreVertical,
  ChevronRight,
  Shield,
  FolderOpen,
  Zap,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

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
type RecordScope = 'all' | 'filtered'

interface CustomExportConfig {
  format: ExportFormat
  scope: ExportScope
  recordScope: RecordScope
  includeSummary: boolean
  includeTables: boolean
  includeTaxBreakdown: boolean
  includeWarnings: boolean
  includeFormulas: boolean
  includeExchangeDetails: boolean
}

// ── Export type cards config ────────────────────────────────

const exportTypeCards = [
  {
    id: 'excel-full' as const,
    title: 'Full Audit Excel Workbook',
    description: 'Detailed multi-sheet workbook with 13 sheets covering every aspect of your audit.',
    bestFor: 'Best for deep review and records',
    icon: FileSpreadsheet,
    format: 'XLSX',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    badgeBg: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    id: 'pdf-full' as const,
    title: 'Professional PDF Audit Report',
    description: 'Clean printable report with executive summary, tax overview, and key metrics.',
    bestFor: 'Best for summary and documentation',
    icon: FileText,
    format: 'PDF',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  {
    id: 'csv-full' as const,
    title: 'Raw CSV Data Export',
    description: 'Simple lightweight data export with structured rows for external tools.',
    bestFor: 'Best for importing into Excel/Sheets or external tools',
    icon: FileDown,
    format: 'CSV',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'custom' as const,
    title: 'Custom Export',
    description: 'Choose your format, sections, filters, and scope for a tailored export.',
    bestFor: 'Best for specific reporting needs',
    icon: Settings2,
    format: 'CUSTOM',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
]

// ── CSV sub-type options ───────────────────────────────────

const csvExportOptions = [
  { id: 'realized-trades', label: 'Realized Trades CSV', scope: 'realized-trades' as ExportScope },
  { id: 'open-holdings', label: 'Open Holdings CSV', scope: 'open-holdings' as ExportScope },
  { id: 'tax-summary', label: 'Tax Summary CSV', scope: 'tax-summary' as ExportScope },
  { id: 'pair-summary', label: 'Pair-wise Summary CSV', scope: 'pair-summary' as ExportScope },
  { id: 'monthly-summary', label: 'Monthly Performance CSV', scope: 'monthly-summary' as ExportScope },
  { id: 'upload-log', label: 'Upload Log / Skipped Rows CSV', scope: 'upload-history' as ExportScope },
]

// ── Scope labels ────────────────────────────────────────────

const scopeLabels: Record<ExportScope, string> = {
  'full': 'Full Workspace Report',
  'realized-trades': 'Realized Trades Only',
  'open-holdings': 'Open Holdings Only',
  'tax-summary': 'Tax Summary Only',
  'pair-summary': 'Pair-wise Summary',
  'monthly-summary': 'Monthly Summary',
  'warnings': 'Warnings / Skipped Rows',
  'upload-history': 'Upload History',
}

// ── Format badge helper ─────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const styles: Record<string, string> = {
    'XLSX': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    'EXCEL': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    'EXCEL_FULL': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    'PDF': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    'PDF_DATA': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    'CSV': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    'CUSTOM': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
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
        <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-[10px]">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
        </Badge>
      )
    case 'PENDING':
      return (
        <Badge variant="outline" className="border-orange-500/30 text-orange-600 dark:text-orange-400 text-[10px]">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pending
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT CENTER COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ExportCenterPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoadingExports, setIsLoadingExports] = useState(true)
  const [exportsError, setExportsError] = useState<string | null>(null)
  const [generatingType, setGeneratingType] = useState<string | null>(null)
  const [generatingMessage, setGeneratingMessage] = useState('')

  // CSV sub-selection
  const [showCsvOptions, setShowCsvOptions] = useState(false)

  // Custom export builder dialog
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [customConfig, setCustomConfig] = useState<CustomExportConfig>({
    format: 'excel',
    scope: 'full',
    recordScope: 'all',
    includeSummary: true,
    includeTables: true,
    includeTaxBreakdown: true,
    includeWarnings: false,
    includeFormulas: false,
    includeExchangeDetails: false,
  })

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
      // Handle both array and object with exports key
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

  // ── Generate Excel Full Export ─────────────────────────
  const handleGenerateExcel = async () => {
    if (!currentWorkspace) return
    setGeneratingType('excel')
    setGeneratingMessage('Generating Excel workbook...')
    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspace.id}/exports/excel/full`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate Excel' }))
        throw new Error(errorData.error || 'Failed to generate Excel workbook')
      }
      // Download the file
      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `CryptoAudit_${currentWorkspace.name}_Full_${new Date().toISOString().slice(0, 10)}.xlsx`
      downloadBlob(blob, filename)
      toast.success('Excel workbook generated successfully')
      await fetchExports()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate export. Please try again.'
      toast.error(msg)
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Generate PDF Export ────────────────────────────────
  const handleGeneratePdf = async () => {
    if (!currentWorkspace) return
    setGeneratingType('pdf')
    setGeneratingMessage('Building PDF report...')
    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspace.id}/exports/pdf/data`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate PDF' }))
        throw new Error(errorData.error || 'Failed to generate PDF report')
      }
      const result = await response.json()
      const pdfData = result.data || result

      // Create a printable HTML and trigger print
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(generatePdfHtml(pdfData, currentWorkspace))
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
      toast.success('PDF report generated successfully')
      await fetchExports()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate export. Please try again.'
      toast.error(msg)
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Generate CSV Export ────────────────────────────────
  const handleGenerateCsv = async (scope: ExportScope = 'realized-trades') => {
    if (!currentWorkspace) return
    setGeneratingType('csv')
    setGeneratingMessage('Preparing CSV export...')
    setShowCsvOptions(false)
    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspace.id}/exports/csv?scope=${scope}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
            'Content-Type': 'application/json',
          },
        }
      )
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate CSV' }))
        throw new Error(errorData.error || 'Failed to generate CSV export')
      }
      const blob = await response.blob()
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `CryptoAudit_${currentWorkspace.name}_${scope}_${new Date().toISOString().slice(0, 10)}.csv`
      downloadBlob(blob, filename)
      toast.success('CSV export generated successfully')
      await fetchExports()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate export. Please try again.'
      toast.error(msg)
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Generate Custom Export ─────────────────────────────
  const handleGenerateCustom = async () => {
    if (!currentWorkspace) return
    setShowCustomBuilder(false)
    const { format, scope } = customConfig
    const typeName = format === 'excel' ? 'Excel' : format === 'pdf' ? 'PDF' : 'CSV'
    setGeneratingType('custom')
    setGeneratingMessage(`Generating custom ${typeName} export...`)

    try {
      if (format === 'excel') {
        if (scope === 'full') {
          await handleGenerateExcel()
          return
        }
        // Single-sheet exports
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
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to generate Excel' }))
          throw new Error(errorData.error || 'Failed to generate Excel')
        }
        const blob = await response.blob()
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `CryptoAudit_${currentWorkspace.name}_${scope}_${new Date().toISOString().slice(0, 10)}.xlsx`
        downloadBlob(blob, filename)
        toast.success('Excel export generated successfully')
        await fetchExports()
      } else if (format === 'pdf') {
        await handleGeneratePdf()
        return
      } else if (format === 'csv') {
        await handleGenerateCsv(scope)
        return
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to generate export. Please try again.'
      toast.error(msg)
    } finally {
      setGeneratingType(null)
      setGeneratingMessage('')
    }
  }

  // ── Delete export record ───────────────────────────────
  const handleDeleteExport = async (exportId: string) => {
    if (!currentWorkspace) return
    try {
      await fetch(
        `/api/workspaces/${currentWorkspace.id}/exports/${exportId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
          },
        }
      )
      toast.success('Export record deleted')
      await fetchExports()
    } catch {
      toast.error('Failed to delete export record')
    }
  }

  // ── Regenerate export ──────────────────────────────────
  const handleRegenerate = async (exp: ExportRecord) => {
    const exportType = exp.exportType
    if (exportType.includes('EXCEL')) {
      await handleGenerateExcel()
    } else if (exportType.includes('PDF')) {
      await handleGeneratePdf()
    } else if (exportType.includes('CSV')) {
      await handleGenerateCsv('realized-trades')
    }
  }

  // ── Download helper ────────────────────────────────────
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

  // ── Generate filename preview ──────────────────────────
  const getFilenamePreview = () => {
    if (!currentWorkspace) return ''
    const wsName = currentWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
    const fy = currentWorkspace.financialYear || 'FY2025-26'
    const ext = customConfig.format === 'excel' ? 'xlsx' : customConfig.format === 'pdf' ? 'pdf' : 'csv'
    const scopeLabel = scopeLabels[customConfig.scope].replace(/\s+/g, '_')
    return `Crypto_Audit_Master_${wsName}_${fy}_${scopeLabel}.${ext}`
  }

  // ── Format date ────────────────────────────────────────
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
          className="mt-4 bg-teal-500 hover:bg-teal-600 text-white"
        >
          Go to Workspaces
        </Button>
      </div>
    )
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GENERATING OVERLAY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const isGenerating = generatingType !== null

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAIN RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="space-y-6">
      {/* ── Generating Overlay ── */}
      {isGenerating && (
        <Card className="rounded-2xl border-teal-500/30 bg-teal-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10">
                <Loader2 className="h-6 w-6 text-teal-500 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-teal-600 dark:text-teal-400">{generatingMessage}</p>
                <p className="text-xs text-muted-foreground mt-1">Please wait while we prepare your export...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Page Header ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Download className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Export Center</h2>
                <p className="text-sm text-muted-foreground">
                  Generate professional reports, detailed workbooks, and raw data exports
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-600 dark:text-teal-400">
                <FolderOpen className="h-3 w-3 mr-1" />
                {currentWorkspace.name} FY {currentWorkspace.financialYear}
              </Badge>
              <Button
                onClick={() => setShowCustomBuilder(true)}
                disabled={isGenerating}
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> Create New Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Export Type Cards ── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Quick Export
        </h3>
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} gap-4`}>
          {exportTypeCards.map((card) => {
            const Icon = card.icon
            const isThisGenerating = generatingType === card.id || (generatingType === 'excel' && card.id === 'excel-full') || (generatingType === 'pdf' && card.id === 'pdf-full') || (generatingType === 'csv' && card.id === 'csv-full')

            return (
              <Card
                key={card.id}
                className={`rounded-2xl border ${card.border} shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer`}
                onClick={() => {
                  if (isGenerating) return
                  if (card.id === 'excel-full') handleGenerateExcel()
                  else if (card.id === 'pdf-full') handleGeneratePdf()
                  else if (card.id === 'csv-full') setShowCsvOptions(true)
                  else if (card.id === 'custom') setShowCustomBuilder(true)
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <Badge variant="secondary" className={`text-[10px] font-semibold ${card.badgeBg}`}>
                      {card.format}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold mb-1">{card.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{card.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {card.bestFor}
                    </span>
                    <Button
                      size="sm"
                      disabled={isThisGenerating || isGenerating}
                      className={`rounded-lg text-xs h-7 ${card.id === 'excel-full' ? 'bg-green-600 hover:bg-green-700 text-white' : card.id === 'pdf-full' ? 'bg-red-600 hover:bg-red-700 text-white' : card.id === 'csv-full' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (card.id === 'excel-full') handleGenerateExcel()
                        else if (card.id === 'pdf-full') handleGeneratePdf()
                        else if (card.id === 'csv-full') setShowCsvOptions(true)
                        else if (card.id === 'custom') setShowCustomBuilder(true)
                      }}
                    >
                      {isThisGenerating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : null}
                      {card.id === 'excel-full' ? 'Generate Excel' : card.id === 'pdf-full' ? 'Generate PDF' : card.id === 'csv-full' ? 'Generate CSV' : 'Build Custom Export'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── CSV Sub-type Selection Panel ── */}
      {showCsvOptions && (
        <Card className="rounded-2xl border-blue-500/30 bg-blue-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base">CSV Export Type</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCsvOptions(false)} className="rounded-lg">
                Close
              </Button>
            </div>
            <CardDescription className="text-xs">Select the type of CSV data you want to export</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'} gap-3`}>
              {csvExportOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleGenerateCsv(option.scope)}
                  disabled={isGenerating}
                  className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-card p-3 text-left hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-[10px] text-muted-foreground">{scopeLabels[option.scope]}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Export History Section ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Export History
          </h3>
          {exports.length > 0 && (
            <Button variant="ghost" size="sm" onClick={fetchExports} className="text-xs text-muted-foreground rounded-lg">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          )}
        </div>

        {/* Error State */}
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

        {/* Empty State */}
        {exports.length === 0 && !exportsError && (
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                <Download className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No exports generated yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a CSV, Excel, or PDF export for your workspace.
              </p>
              <Button
                onClick={() => setShowCustomBuilder(true)}
                disabled={isGenerating}
                className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" /> Create New Export
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Desktop: Export History Table */}
        {!isMobile && exports.length > 0 && (
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground p-4 w-10">#</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">File Name</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Export Type</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Format</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Scope</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Generated On</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exports.map((exp, index) => (
                      <tr
                        key={exp.id}
                        className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                      >
                        <td className="p-4 text-xs text-muted-foreground">{index + 1}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate max-w-[220px]">{exp.filename}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="secondary" className="text-[10px]">
                            {exp.exportType?.replace(/_/g, ' ') || 'Export'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <FormatBadge format={exp.exportType || exp.fileFormat || 'CSV'} />
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
                                  onClick={() => {
                                    // For file downloads, regenerate and download
                                    handleRegenerate(exp)
                                  }}
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

        {/* Mobile: Export History Cards */}
        {isMobile && exports.length > 0 && (
          <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
            {exports.map((exp) => (
              <Card key={exp.id} className="rounded-2xl border-border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
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
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
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
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          CUSTOM EXPORT BUILDER DIALOG
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={showCustomBuilder} onOpenChange={setShowCustomBuilder}>
        <DialogContent className={`${isMobile ? 'max-w-full h-[90vh]' : 'max-w-lg'} rounded-2xl`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-500" />
              Custom Export Builder
            </DialogTitle>
            <DialogDescription>
              Configure your export format, scope, and included sections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* 1. Export Format */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Export Format</label>
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-2`}>
                {[
                  { value: 'csv' as ExportFormat, label: 'CSV', icon: FileDown, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500' },
                  { value: 'excel' as ExportFormat, label: 'Excel', icon: FileSpreadsheet, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500' },
                  { value: 'pdf' as ExportFormat, label: 'PDF', icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500' },
                ].map((fmt) => {
                  const Icon = fmt.icon
                  const isSelected = customConfig.format === fmt.value
                  return (
                    <button
                      key={fmt.value}
                      onClick={() => setCustomConfig((c) => ({ ...c, format: fmt.value }))}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                        isSelected ? `${fmt.border} ${fmt.bg}` : 'border-border hover:bg-accent'
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${isSelected ? fmt.color : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${isSelected ? fmt.color : 'text-muted-foreground'}`}>
                        {fmt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Export Scope */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Export Scope</label>
              <Select
                value={customConfig.scope}
                onValueChange={(v) => setCustomConfig((c) => ({ ...c, scope: v as ExportScope }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(scopeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Record Scope */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Record Scope</label>
              <Select
                value={customConfig.recordScope}
                onValueChange={(v) => setCustomConfig((c) => ({ ...c, recordScope: v as RecordScope }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="filtered">Current Filtered Records</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Include Sections */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Include Sections</label>
              <div className="space-y-2">
                {[
                  { key: 'includeSummary' as const, label: 'Summary' },
                  { key: 'includeTables' as const, label: 'Tables' },
                  { key: 'includeTaxBreakdown' as const, label: 'Tax breakdown' },
                  { key: 'includeWarnings' as const, label: 'Warnings' },
                  { key: 'includeFormulas' as const, label: 'Formulas' },
                  { key: 'includeExchangeDetails' as const, label: 'Exchange details' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <Checkbox
                      id={item.key}
                      checked={customConfig[item.key]}
                      onCheckedChange={(checked) =>
                        setCustomConfig((c) => ({ ...c, [item.key]: checked === true }))
                      }
                    />
                    <label htmlFor={item.key} className="text-sm text-muted-foreground cursor-pointer">
                      {item.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Filename Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium">File Name Preview</label>
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <code className="text-xs text-muted-foreground break-all">{getFilenamePreview()}</code>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCustomBuilder(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateCustom}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Generate Export</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Generate printable PDF HTML
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generatePdfHtml(
  data: Record<string, unknown>,
  workspace: { name: string; financialYear: string }
): string {
  const taxSummary = (data?.taxSummary || data?.summary?.taxSummary || {}) as Record<string, string | number>
  const realizedTrades = (data?.realizedTrades || []) as Array<Record<string, unknown>>
  const openHoldings = (data?.openHoldings || []) as Array<Record<string, unknown>>

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Crypto Audit Master — ${workspace.name} FY ${workspace.financialYear}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; }
  .cover { text-align: center; padding: 80px 40px; page-break-after: always; }
  .cover h1 { font-size: 28px; color: #0d9488; margin-bottom: 8px; }
  .cover h2 { font-size: 18px; color: #64748b; margin-bottom: 24px; }
  .cover .meta { font-size: 13px; color: #94a3b8; }
  h2 { color: #0d9488; font-size: 18px; margin: 24px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th { background: #f0fdfa; color: #0d9488; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; }
  td { padding: 6px 10px; border: 1px solid #e2e8f0; }
  .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .metric-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; }
  .profit { color: #16a34a; }
  .loss { color: #dc2626; }
  .disclaimer { margin-top: 40px; padding: 16px; background: #fef3c7; border-radius: 8px; font-size: 11px; color: #92400e; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="cover">
  <h1>Crypto Audit Master</h1>
  <h2>${workspace.name} — FY ${workspace.financialYear}</h2>
  <p class="meta">Professional Audit Report</p>
  <p class="meta">Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</div>

<h2>Executive Financial Summary</h2>
<div class="metric-grid">
  <div class="metric-card">
    <div class="metric-label">Total Trades</div>
    <div class="metric-value">${taxSummary.totalTrades || 0}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Realized Trades</div>
    <div class="metric-value">${realizedTrades.length}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Open Holdings</div>
    <div class="metric-value">${openHoldings.length}</div>
  </div>
  <div class="metric-card">
    <div class="metric-label">Net Profit</div>
    <div class="metric-value ${Number(taxSummary.totalNetProfit || 0) >= 0 ? 'profit' : 'loss'}">₹${Number(taxSummary.totalNetProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
  </div>
</div>

<h2>Tax Summary</h2>
<table>
  <tr><th>Tax Item</th><th>Value</th></tr>
  <tr><td>Total Buy Value</td><td>₹${Number(taxSummary.totalBuyValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Total Sell Value</td><td>₹${Number(taxSummary.totalSellValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Gross Profit</td><td class="${Number(taxSummary.totalGrossProfit || 0) >= 0 ? 'profit' : 'loss'}">₹${Number(taxSummary.totalGrossProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Gross Loss</td><td class="loss">₹${Number(taxSummary.totalGrossLoss || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Total Fees</td><td>₹${Number(taxSummary.totalFees || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>GST on Fees</td><td>₹${Number(taxSummary.totalGstOnFees || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Total TDS</td><td>₹${Number(taxSummary.totalTds || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Base Crypto Tax (30%)</td><td>₹${Number(taxSummary.totalDirectTax || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Cess (4%)</td><td>₹${Number(taxSummary.totalCess || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
  <tr><td>Effective Tax Rate</td><td>${Number(taxSummary.effectiveTaxRate || 0).toFixed(2)}%</td></tr>
  <tr><td><strong>Final Net Profit</strong></td><td class="${Number(taxSummary.totalNetProfit || 0) >= 0 ? 'profit' : 'loss'}"><strong>₹${Number(taxSummary.totalNetProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td></tr>
</table>

<div class="disclaimer">
  <strong>Disclaimer:</strong> This report is generated for informational purposes only. It does not constitute professional tax advice. Please consult a qualified Chartered Accountant for filing purposes. All calculations use FIFO matching as per the method configured in the application.
</div>
</body>
</html>`
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKELETON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExportCenterSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
