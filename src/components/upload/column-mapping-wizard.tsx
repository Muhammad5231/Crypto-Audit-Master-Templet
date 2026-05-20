'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Smart CSV Column Mapping Wizard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Professional data import wizard for mapping CSV columns to
// normalized trade fields. Features:
//   - Desktop: Split layout (preview left, mapping right)
//   - Mobile: Step-based flow
//   - Smart auto-suggestions with visual indicators
//   - Required field validation checklist
//   - Duplicate mapping prevention with inline warnings
//   - Side value normalization step
//   - Date format assistance
//   - Save as import template option
//   - Template auto-detection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { apiPost } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  Sparkles,
  Save,
  FileSpreadsheet,
  Info,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────

interface SkipReason {
  row: number
  reason: string
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

interface ImportTemplate {
  id: string
  templateName: string
  originalColumns: string[]
  mappingConfig: Record<string, string>
  sideValueMap: Record<string, string>
  dateFormat: string
  exchangeName: string
  createdAt: string
  lastUsedAt: string | null
}

interface ColumnMappingWizardProps {
  open: boolean
  onClose: () => void
  analysisResult: AnalysisResult
  onConfirm: (mapping: Record<string, string>, sideValueMap: Record<string, string>, dateFormat?: string) => void
  isProcessing: boolean
  workspaceId: string
}

// ── Constants ─────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  TIME: 'Trade Time / Date',
  CONTRACT: 'Contract / Symbol / Pair',
  QTY: 'Quantity',
  SIDE: 'Side — Buy or Sell',
  PRICE: 'Executed Price',
  FEES: 'Fees',
  TDS: 'TDS',
  ORDER_VALUE: 'Order Value',
  TRADE_STATUS: 'Trade Status',
  ORDER_ID: 'Order ID',
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  TIME: 'Date and time of the trade execution',
  CONTRACT: 'Trading pair like BTC_INR, ETH/USDT',
  QTY: 'Amount of crypto bought or sold',
  SIDE: 'Whether the trade was a BUY or SELL',
  PRICE: 'Price per unit at which trade executed',
  FEES: 'Trading fee charged by the exchange',
  TDS: 'Tax Deducted at Source (Indian exchanges)',
  ORDER_VALUE: 'Total value of the trade (qty × price)',
  TRADE_STATUS: 'Order status — cancelled trades are skipped',
  ORDER_ID: 'Exchange order identifier for reference',
}

const REQUIRED_FIELDS = ['TIME', 'CONTRACT', 'QTY', 'SIDE', 'PRICE']

const ALL_MAPPING_OPTIONS = [
  '__skip__',
  'TIME',
  'CONTRACT',
  'QTY',
  'SIDE',
  'PRICE',
  'FEES',
  'TDS',
  'ORDER_VALUE',
  'TRADE_STATUS',
  'ORDER_ID',
]

const DATE_FORMAT_OPTIONS = [
  { value: 'auto', label: 'Auto-detect (recommended)', description: 'Let the system figure it out' },
  { value: 'YYYY-MM-DD HH:mm:ss', label: 'YYYY-MM-DD HH:mm:ss', description: 'e.g., 2026-05-17 15:26:10' },
  { value: 'DD/MM/YYYY HH:mm:ss', label: 'DD/MM/YYYY HH:mm:ss', description: 'e.g., 17/05/2026 15:26:10' },
  { value: 'MM/DD/YYYY HH:mm:ss', label: 'MM/DD/YYYY HH:mm:ss', description: 'e.g., 05/17/2026 15:26:10' },
  { value: 'YYYY-MM-DDTHH:mm:ssZ', label: 'ISO 8601', description: 'e.g., 2026-05-17T15:26:10+05:30' },
  { value: 'unix_seconds', label: 'Unix timestamp (seconds)', description: 'e.g., 1747466170' },
  { value: 'unix_millis', label: 'Unix timestamp (milliseconds)', description: 'e.g., 1747466170000' },
]

// ── Helper ────────────────────────────────────────────────────

function getSampleValues(header: string, sampleRows: Record<string, string>[], maxItems: number = 3): string[] {
  return sampleRows
    .map((r) => r[header])
    .filter((v) => v && v.trim() !== '')
    .slice(0, maxItems)
}

// ── Desktop Step Indicator ────────────────────────────────────

function StepIndicator({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < step ? 'w-8 bg-teal-500' : i === step ? 'w-6 bg-teal-500/40' : 'w-4 bg-muted'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function ColumnMappingWizard({
  open,
  onClose,
  analysisResult,
  onConfirm,
  isProcessing,
  workspaceId,
}: ColumnMappingWizardProps) {
  const isMobile = useIsMobile()

  // Compute initial side values
  const initialSideValues = useMemo(() => {
    const mapping = analysisResult.detectedColumns
    const sideHeader = Object.entries(mapping).find(([, v]) => v === 'SIDE')?.[0]
    if (!sideHeader) return { buy: '', sell: '', showMapping: false }

    const sideValues = analysisResult.sampleRows
      .map((r) => r[sideHeader]?.trim().toLowerCase())
      .filter(Boolean)
    const uniqueValues = [...new Set(sideValues)]
    const buyVariants = ['buy', 'b']
    const sellVariants = ['sell', 's']
    const allBuySell = uniqueValues.every(
      (v) => buyVariants.includes(v) || sellVariants.includes(v)
    )

    if (allBuySell && uniqueValues.length <= 2) {
      return {
        buy: uniqueValues.find((v) => buyVariants.includes(v)) || '',
        sell: uniqueValues.find((v) => sellVariants.includes(v)) || '',
        showMapping: false,
      }
    }
    return {
      buy: uniqueValues.includes('1') ? '1' : '',
      sell: uniqueValues.includes('0') ? '0' : '',
      showMapping: true,
    }
  }, [analysisResult])

  // ── Mapping state (initialized from analysisResult — parent uses key to force remount) ──
  // Every column gets either its auto-detected field or '__skip__' so the Select
  // value is never an empty string (which Radix Select doesn't allow).
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    () => {
      const mapping: Record<string, string> = {}
      for (const header of analysisResult.headers) {
        mapping[header] = analysisResult.detectedColumns[header] || '__skip__'
      }
      return mapping
    }
  )
  const [buySideInput, setBuySideInput] = useState(() => initialSideValues.buy)
  const [sellSideInput, setSellSideInput] = useState(() => initialSideValues.sell)
  const [dateFormat, setDateFormat] = useState('auto')
  const [showSideMapping, setShowSideMapping] = useState(() => initialSideValues.showMapping)
  const [showPreview, setShowPreview] = useState(!isMobile)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  // ── Template state ──
  const [matchedTemplate, setMatchedTemplate] = useState<ImportTemplate | null>(null)
  const [templateChecked, setTemplateChecked] = useState(false)
  const [useTemplate, setUseTemplate] = useState(false)

  // ── Mobile step state ──
  const [mobileStep, setMobileStep] = useState(0)

  const MOBILE_STEPS = 5

  // ── Template match check (only when dialog opens) ──
  useEffect(() => {
    if (open && analysisResult && !templateChecked) {
      const headers = analysisResult.headers
      apiPost<{
        matched: boolean
        template: ImportTemplate | null
        matchScore: number
      }>('/api/import-templates/match', { headers })
        .then((result) => {
          if (result.matched && result.template) {
            setMatchedTemplate(result.template)
          }
          setTemplateChecked(true)
        })
        .catch(() => {
          setTemplateChecked(true)
        })
    }
  }, [open, analysisResult, templateChecked])

  // ── Apply template ──
  const applyTemplate = (template: ImportTemplate) => {
    setColumnMapping(template.mappingConfig)
    if (template.sideValueMap && Object.keys(template.sideValueMap).length > 0) {
      const buyEntry = Object.entries(template.sideValueMap).find(([, v]) => v === 'BUY')
      const sellEntry = Object.entries(template.sideValueMap).find(([, v]) => v === 'SELL')
      if (buyEntry) setBuySideInput(buyEntry[0])
      if (sellEntry) setSellSideInput(sellEntry[0])
      setShowSideMapping(true)
    }
    if (template.dateFormat) setDateFormat(template.dateFormat)
    else setDateFormat('auto')
    setTemplateName(template.templateName)
    setUseTemplate(true)
    toast.success(`Template "${template.templateName}" applied`)
  }

  // ── Save as template ──
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name')
      return
    }
    try {
      await apiPost('/api/import-templates', {
        templateName: templateName.trim(),
        originalColumns: analysisResult.headers,
        mappingConfig: columnMapping,
        sideValueMap: buildSideValueMap(),
        dateFormat,
        exchangeName: '',
      })
      toast.success(`Template "${templateName.trim()}" saved`)
    } catch {
      toast.error('Failed to save template')
    }
  }

  // ── Derived state ──

  const allRequiredMapped = useMemo(() => {
    const mapped = Object.values(columnMapping)
    return REQUIRED_FIELDS.every((f) => mapped.includes(f))
  }, [columnMapping])

  const duplicateMappings = useMemo(() => {
    const fieldToHeaders: Record<string, string[]> = {}
    for (const [header, field] of Object.entries(columnMapping)) {
      if (field && field !== '__skip__') {
        if (!fieldToHeaders[field]) fieldToHeaders[field] = []
        fieldToHeaders[field].push(header)
      }
    }
    return Object.entries(fieldToHeaders)
      .filter(([, headers]) => headers.length > 1)
      .map(([field, headers]) => ({ field, headers }))
  }, [columnMapping])

  const hasDuplicates = duplicateMappings.length > 0

  const sideColumnMapped = Object.values(columnMapping).includes('SIDE')

  // Side values from sample data
  const sideUniqueValues = useMemo(() => {
    const sideHeader = Object.entries(columnMapping).find(([, v]) => v === 'SIDE')?.[0]
    if (!sideHeader) return []
    const values = analysisResult.sampleRows
      .map((r) => r[sideHeader]?.trim())
      .filter(Boolean)
    return [...new Set(values)]
  }, [analysisResult, columnMapping])

  const sideNeedsMapping = useMemo(() => {
    if (!sideColumnMapped) return false
    const buyVariants = ['buy', 'b']
    const sellVariants = ['sell', 's']
    const lowerValues = sideUniqueValues.map((v) => v.toLowerCase())
    return !lowerValues.every((v) => buyVariants.includes(v) || sellVariants.includes(v))
  }, [sideColumnMapped, sideUniqueValues])

  // Preview rows using current mapping
  const previewRows = useMemo(() => {
    if (!analysisResult.sampleRows.length) return []
    return analysisResult.sampleRows.slice(0, 3).map((row) => {
      const mapped: Record<string, string> = {}
      Object.entries(columnMapping).forEach(([header, field]) => {
        if (field && field !== '__skip__') {
          mapped[FIELD_LABELS[field] || field] = row[header] || ''
        }
      })
      return mapped
    })
  }, [analysisResult, columnMapping])

  const previewColumns = useMemo(() => {
    if (previewRows.length === 0) return []
    return Object.keys(previewRows[0])
  }, [previewRows])

  // ── Build side value map ──
  const buildSideValueMap = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {}
    if (buySideInput.trim()) map[buySideInput.trim()] = 'BUY'
    if (sellSideInput.trim()) map[sellSideInput.trim()] = 'SELL'
    return map
  }, [buySideInput, sellSideInput])

  // ── Handle mapping change ──
  const handleMappingChange = (header: string, value: string) => {
    setColumnMapping((prev) => {
      const updated = { ...prev }
      // Remove any existing mapping for this target field (prevent duplicates)
      if (value !== '__skip__') {
        Object.keys(updated).forEach((k) => {
          if (updated[k] === value) updated[k] = '__skip__'
        })
      }
      // Always set the value — '__skip__' means "ignore this column"
      updated[header] = value
      return updated
    })
  }

  // ── Handle confirm ──
  const handleConfirm = () => {
    if (!allRequiredMapped || hasDuplicates) return
    const sideValueMap = buildSideValueMap()
    // Filter out __skip__ entries — only send actual field mappings to the backend
    const filteredMapping: Record<string, string> = {}
    for (const [key, value] of Object.entries(columnMapping)) {
      if (value !== '__skip__') {
        filteredMapping[key] = value
      }
    }
    onConfirm(filteredMapping, sideValueMap, dateFormat === 'auto' ? undefined : dateFormat)

    // Save as template if requested
    if (saveAsTemplate && templateName.trim()) {
      handleSaveTemplate()
    }

    // Mark template as used if one was applied
    if (useTemplate && matchedTemplate) {
      apiPost(`/api/import-templates/${matchedTemplate.id}/use`, {}).catch(() => {})
    }
  }

  // ── Required field checklist ──
  const requiredFieldChecklist = useMemo(() => {
    return REQUIRED_FIELDS.map((field) => {
      const isMapped = Object.values(columnMapping).includes(field)
      const mappedHeader = Object.entries(columnMapping).find(([, v]) => v === field)?.[0]
      return { field, isMapped, mappedHeader, label: FIELD_LABELS[field] }
    })
  }, [columnMapping])

  // ── Unmapped columns (for optional mapping step) ──
  const requiredHeaders = useMemo(() => {
    return analysisResult.headers.filter((h) => {
      const field = columnMapping[h] || '__skip__'
      return field !== '__skip__' && REQUIRED_FIELDS.includes(field)
    })
  }, [analysisResult.headers, columnMapping])

  const optionalHeaders = useMemo(() => {
    return analysisResult.headers.filter((h) => {
      const field = columnMapping[h] || '__skip__'
      return field === '__skip__' || !REQUIRED_FIELDS.includes(field)
    })
  }, [analysisResult.headers, columnMapping])

  // ── Mobile navigation ──
  const canGoNext = useMemo(() => {
    switch (mobileStep) {
      case 0: return true
      case 1: return allRequiredMapped && !hasDuplicates
      case 2: return true
      case 3: return sideColumnMapped ? (buySideInput.trim() && sellSideInput.trim()) : true
      case 4: return allRequiredMapped && !hasDuplicates
      default: return false
    }
  }, [mobileStep, allRequiredMapped, hasDuplicates, sideColumnMapped, buySideInput, sellSideInput])

  const handleNext = () => {
    if (mobileStep === 1 && !allRequiredMapped) {
      toast.error('Please map all required columns before continuing')
      return
    }
    if (mobileStep < MOBILE_STEPS - 1) {
      setMobileStep(mobileStep + 1)
    }
  }

  const handlePrev = () => {
    if (mobileStep > 0) setMobileStep(mobileStep - 1)
  }

  // ── Mapping Row Component ──
  const MappingRow = ({ header, isRequired }: { header: string; isRequired: boolean }) => {
    const currentField = columnMapping[header] || '__skip__'
    const samples = getSampleValues(header, analysisResult.sampleRows)
    const isDuplicate =
      currentField !== '__skip__' &&
      duplicateMappings.some((d) => d.field === currentField && d.headers.includes(header))
    const isAutoDetected = analysisResult.detectedColumns[header] === currentField

    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border p-3 transition-colors ${
          isDuplicate
            ? 'border-red-500/30 bg-red-500/[0.03]'
            : currentField !== '__skip__'
              ? 'border-green-500/20 bg-green-500/[0.02]'
              : isRequired
                ? 'border-orange-500/30 bg-orange-500/[0.02]'
                : 'border-border'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{header}</p>
            {isAutoDetected && currentField !== '__skip__' && (
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0"
              >
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                Auto
              </Badge>
            )}
            {isRequired && currentField === '__skip__' && (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 border-red-500/30 text-red-600 shrink-0"
              >
                Required
              </Badge>
            )}
          </div>
          {samples.length > 0 && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {samples.join(', ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
          <Select value={currentField} onValueChange={(v) => handleMappingChange(header, v)}>
            <SelectTrigger className="w-full sm:w-[190px] shrink-0 rounded-lg h-9">
              <SelectValue placeholder="— Skip —" />
            </SelectTrigger>
            <SelectContent>
              {ALL_MAPPING_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === '__skip__' ? '— Ignore this column —' : FIELD_LABELS[opt] || opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isDuplicate && (
          <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1 sm:mt-0">
            <AlertTriangle className="h-3 w-3" />
            Already assigned to another column
          </p>
        )}
      </div>
    )
  }

  // ── Preview Table ──
  const PreviewSection = () => (
    <div className="rounded-xl border border-border overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setShowPreview(!showPreview)}
      >
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          Preview ({previewRows.length} rows with current mapping)
        </p>
        {showPreview ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      {showPreview && previewColumns.length > 0 && (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-7 w-8 text-center">#</TableHead>
                {previewColumns.map((col) => (
                  <TableHead key={col} className="text-[10px] h-7 whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-[10px] text-muted-foreground text-center">
                    {i + 1}
                  </TableCell>
                  {previewColumns.map((col) => (
                    <TableCell key={col} className="text-[10px] max-w-[120px] truncate">
                      {row[col] || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )

  // ── Required Field Checklist ──
  const RequiredChecklist = () => (
    <div className="rounded-xl border border-border p-3 space-y-2">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-teal-500" />
        Required Columns
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {requiredFieldChecklist.map(({ field, isMapped, mappedHeader, label }) => (
          <div
            key={field}
            className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg ${
              isMapped
                ? 'bg-green-500/5 text-green-600 dark:text-green-400'
                : 'bg-red-500/5 text-red-600 dark:text-red-400'
            }`}
          >
            {isMapped ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="font-medium">{label}</span>
            {isMapped && mappedHeader && (
              <span className="text-muted-foreground ml-auto truncate max-w-[100px]">
                ← {mappedHeader}
              </span>
            )}
          </div>
        ))}
      </div>
      {!allRequiredMapped && (
        <p className="text-[11px] text-red-500 flex items-center gap-1 pt-1">
          <AlertTriangle className="h-3 w-3" />
          Map all required columns to continue
        </p>
      )}
    </div>
  )

  // ── Side Value Mapping ──
  const SideMappingSection = () => {
    if (!sideColumnMapped) return null

    return (
      <div className="rounded-xl border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-teal-500" />
            Side Value Mapping
          </p>
          {!sideNeedsMapping && !showSideMapping && (
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-600"
            >
              Auto-detected
            </Badge>
          )}
        </div>

        {sideNeedsMapping || showSideMapping ? (
          <>
            <p className="text-[11px] text-muted-foreground">
              Your CSV uses non-standard values for buy/sell. Map them below.
            </p>
            <div className="text-[10px] text-muted-foreground mb-1">
              Unique values found: {sideUniqueValues.map((v) => (
                <code key={v} className="bg-muted px-1 rounded ml-1">{v}</code>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Value for BUY</Label>
                <Input
                  type="text"
                  placeholder="e.g., buy, B, 1, IN"
                  className="rounded-lg h-8 text-xs"
                  value={buySideInput}
                  onChange={(e) => setBuySideInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Value for SELL</Label>
                <Input
                  type="text"
                  placeholder="e.g., sell, S, 0, OUT"
                  className="rounded-lg h-8 text-xs"
                  value={sellSideInput}
                  onChange={(e) => setSellSideInput(e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Buy/sell values auto-detected:{' '}
            <code className="bg-muted px-1 rounded">{buySideInput || 'buy'}</code> → Buy,{' '}
            <code className="bg-muted px-1 rounded">{sellSideInput || 'sell'}</code> → Sell
          </p>
        )}

        {!showSideMapping && !sideNeedsMapping && sideColumnMapped && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground p-0 hover:bg-transparent"
            onClick={() => setShowSideMapping(true)}
          >
            Override side values
          </Button>
        )}
      </div>
    )
  }

  // ── Date Format Section ──
  const DateFormatSection = () => {
    const timeHeader = Object.entries(columnMapping).find(([, v]) => v === 'TIME')?.[0]
    if (!timeHeader) return null

    const timeSamples = getSampleValues(timeHeader, analysisResult.sampleRows, 2)

    return (
      <div className="rounded-xl border border-border p-3 space-y-2">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-teal-500" />
          Date Format
        </p>
        <div className="text-[10px] text-muted-foreground">
          Sample values:{' '}
          {timeSamples.map((v, i) => (
            <code key={i} className="bg-muted px-1 rounded ml-1 text-[10px]">
              {v.length > 30 ? v.substring(0, 30) + '...' : v}
            </code>
          ))}
        </div>
        <Select value={dateFormat} onValueChange={setDateFormat}>
          <SelectTrigger className="w-full rounded-lg h-8 text-xs">
            <SelectValue placeholder="Auto-detect (recommended)" />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMAT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground ml-2 text-[10px]">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Leave as auto-detect if unsure. The system handles most common formats.
        </p>
      </div>
    )
  }

  // ── Save Template Section ──
  const SaveTemplateSection = () => (
    <div className="rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Save className="h-3.5 w-3.5 text-teal-500" />
          Save as Import Template
        </p>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 text-[10px] px-2 rounded-lg ${
            saveAsTemplate ? 'bg-teal-500/10 text-teal-600' : 'text-muted-foreground'
          }`}
          onClick={() => setSaveAsTemplate(!saveAsTemplate)}
        >
          {saveAsTemplate ? '✓ Enabled' : 'Enable'}
        </Button>
      </div>
      {saveAsTemplate && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Save this mapping to auto-detect future uploads with the same column structure.
          </p>
          <Input
            type="text"
            placeholder="e.g., My Delta Exchange Export"
            className="rounded-lg h-8 text-xs"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        </>
      )}
    </div>
  )

  // ── Template Match Banner ──
  const TemplateMatchBanner = () => {
    if (!templateChecked || !matchedTemplate || useTemplate) return null

    return (
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-teal-600 dark:text-teal-400">
              Matching Import Template Found
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              &quot;{matchedTemplate.templateName}&quot; — last used{' '}
              {matchedTemplate.lastUsedAt
                ? new Date(matchedTemplate.lastUsedAt).toLocaleDateString()
                : 'never'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-[11px] rounded-lg bg-teal-500 hover:bg-teal-600 text-white"
            onClick={() => applyTemplate(matchedTemplate)}
          >
            <Zap className="h-3 w-3 mr-1" />
            Use Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] rounded-lg"
            onClick={() => setMatchedTemplate(null)}
          >
            Map Manually
          </Button>
        </div>
      </div>
    )
  }

  // ── Mobile Step Content ──
  const renderMobileStep = () => {
    switch (mobileStep) {
      case 0:
        return (
          <div className="space-y-4">
            {/* Intro */}
            <div className="text-center space-y-3 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 mx-auto">
                <MapPin className="h-7 w-7 text-teal-500" />
              </div>
              <h3 className="text-lg font-bold">Help us understand your CSV</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                We could not automatically identify some columns in this file.
                Please tell us what each important column represents so we can process your trades correctly.
              </p>
            </div>

            <div className="flex items-center gap-2 justify-center">
              <Badge variant="secondary" className="text-[10px]">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {analysisResult.fileName}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {analysisResult.totalRows} rows
              </Badge>
            </div>

            <TemplateMatchBanner />

            {analysisResult.requiredMapping.length > 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
                <p className="text-[11px] font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Missing auto-detection for: {analysisResult.requiredMapping.map((f) => FIELD_LABELS[f] || f).join(', ')}
                </p>
              </div>
            )}
          </div>
        )

      case 1:
        return (
          <div className="space-y-3">
            <RequiredChecklist />
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">
              Map Required Columns
            </p>
            <div className="space-y-2">
              {analysisResult.headers.map((header) => {
                const field = columnMapping[header] || '__skip__'
                const isReq = field !== '__skip__' && REQUIRED_FIELDS.includes(field)
                const isUnmappedRequired = field === '__skip__'
                // Show all columns but highlight required ones
                return (
                  <div key={header} className={isReq || isUnmappedRequired ? '' : 'opacity-50'}>
                    <MappingRow header={header} isRequired={REQUIRED_FIELDS.includes(field) || field === '__skip__'} />
                  </div>
                )
              })}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Map Optional Columns
            </p>
            <p className="text-[11px] text-muted-foreground">
              These columns are optional. Skip any that don&apos;t apply.
            </p>
            <div className="space-y-2">
              {analysisResult.headers.map((header) => {
                const field = columnMapping[header] || '__skip__'
                const isRequired = field !== '__skip__' && REQUIRED_FIELDS.includes(field)
                if (isRequired) return null
                return <MappingRow key={header} header={header} isRequired={false} />
              })}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <SideMappingSection />
            <DateFormatSection />
            <PreviewSection />
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <RequiredChecklist />
            {hasDuplicates && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-[11px] font-medium text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Duplicate mappings found. Please fix before continuing.
                </p>
              </div>
            )}
            <Separator />
            <PreviewSection />
            <SaveTemplateSection />
          </div>
        )

      default:
        return null
    }
  }

  // ── Desktop Layout ──
  const renderDesktopContent = () => (
    <div className="grid grid-cols-[1fr_1.2fr] gap-4 min-h-[60vh]">
      {/* Left: Preview + Template */}
      <div className="space-y-3">
        <TemplateMatchBanner />

        {/* File info */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            {analysisResult.fileName}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {analysisResult.totalRows} rows
          </Badge>
          {analysisResult.requiredMapping.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">
              {analysisResult.requiredMapping.length} unmapped required
            </Badge>
          )}
        </div>

        <RequiredChecklist />
        <PreviewSection />
        <DateFormatSection />
        <SideMappingSection />
        <SaveTemplateSection />
      </div>

      {/* Right: Mapping */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Column Mapping</p>
          <p className="text-[10px] text-muted-foreground">
            {Object.keys(columnMapping).filter((k) => columnMapping[k] !== '__skip__').length} of {analysisResult.headers.length} mapped
          </p>
        </div>

        <ScrollArea className="max-h-[55vh]">
          <div className="space-y-2 pr-2">
            {/* Required columns section */}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Required Fields
            </p>
            {analysisResult.headers.map((header) => {
              const field = columnMapping[header] || '__skip__'
              if (field === '__skip__' || !REQUIRED_FIELDS.includes(field)) return null
              return <MappingRow key={header} header={header} isRequired={true} />
            })}

            {/* Unmapped required columns */}
            {analysisResult.headers.map((header) => {
              const field = columnMapping[header] || '__skip__'
              if (field !== '__skip__') return null
              // Check if this header COULD map to a required field
              return <MappingRow key={header} header={header} isRequired={false} />
            })}

            <Separator className="my-2" />

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Optional Fields
            </p>
            {analysisResult.headers.map((header) => {
              const field = columnMapping[header] || '__skip__'
              if (field === '__skip__' || REQUIRED_FIELDS.includes(field)) return null
              return <MappingRow key={header} header={header} isRequired={false} />
            })}

            {/* Skipped columns */}
            {analysisResult.headers.map((header) => {
              const field = columnMapping[header] || '__skip__'
              if (field !== '__skip__') return null
              // Already shown in "Unmapped required" above for required, skip those
              return null
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  // ── Render ──
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isProcessing) onClose()
      }}
    >
      <DialogContent
        className={`${
          isMobile ? 'w-[95vw] max-h-[90vh]' : 'sm:max-w-[900px]'
        } rounded-2xl flex flex-col p-0 gap-0`}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-teal-500" />
            {isMobile ? 'Map CSV Columns' : 'Help us understand your CSV'}
          </DialogTitle>
          {isMobile && (
            <div className="flex items-center justify-between mt-2">
              <StepIndicator step={mobileStep} totalSteps={MOBILE_STEPS} />
              <span className="text-[10px] text-muted-foreground">
                Step {mobileStep + 1} of {MOBILE_STEPS}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isMobile ? renderMobileStep() : renderDesktopContent()}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t gap-2 flex-row justify-between">
          {isMobile ? (
            <>
              <Button
                variant="outline"
                onClick={mobileStep === 0 ? onClose : handlePrev}
                className="rounded-xl"
                disabled={isProcessing}
              >
                {mobileStep === 0 ? 'Cancel' : <><ArrowLeft className="h-4 w-4 mr-1" /> Back</>}
              </Button>
              {mobileStep < MOBILE_STEPS - 1 ? (
                <Button
                  onClick={handleNext}
                  className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white"
                  disabled={!canGoNext}
                >
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleConfirm}
                  disabled={isProcessing || !allRequiredMapped || hasDuplicates}
                  className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Import</>
                  )}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="rounded-xl" disabled={isProcessing}>
                Cancel
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                {!allRequiredMapped && (
                  <span className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Map all required columns
                  </span>
                )}
                {hasDuplicates && (
                  <span className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Fix duplicate mappings
                  </span>
                )}
                <Button
                  onClick={handleConfirm}
                  disabled={isProcessing || !allRequiredMapped || hasDuplicates}
                  className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Import</>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
