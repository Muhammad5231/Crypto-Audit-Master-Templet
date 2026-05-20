'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Tax Summary Page (v2 — Full Tax Review)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Comprehensive tax breakdown with:
//   1. Page Top — Title, subtitle, time frame, export
//   2. 8 Main Tax KPI Cards
//   3. Tax Calculation Breakdown (formula rows)
//   4. Deduction Impact Section (waterfall visual)
//   5. Tax & Withholding Breakdown (donut chart)
//   6. Pair-wise Tax Summary (table)
//   7. Trade-Level Tax Preview (table)
//   8. TDS Summary Section
//   9. Fees & GST Summary Section
//  10. Explanation / Help Cards (accordion)
//  11. Export Functionality (PDF + Excel)
//  12. Mobile card-based layout
//  13. Empty / Error states
//  14. Strict rules: workspace-specific, positive-only tax, etc.
//
// Data source: GET /api/workspaces/:workspaceId/reports/latest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost } from '@/lib/api-client'
import { toD, formatINR } from '@/lib/decimal'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import {
  IndianRupee,
  Percent,
  Receipt,
  Wallet,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Calculator,
  FileText,
  Loader2,
  Zap,
  Info,
  Upload,
  RotateCcw,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  FileSpreadsheet,
  ChevronRight,
  HelpCircle,
  ArrowLeftRight,
  ChevronDown,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface TaxSummary {
  totalTrades: number
  profitableTrades: number
  lossTrades: number
  totalBuyValue: string
  totalSellValue: string
  totalGrossProfit: string
  totalGrossLoss: string
  totalFees: string
  totalGstOnFees: string
  totalTds: string
  totalDirectTax: string
  totalCess: string
  totalNetProfit: string
  totalNetProfitFromProfitableTrades: string
  totalNetLossFromLossTrades: string
  effectiveTaxRate: string
  avgProfitPerTrade: string
  avgLossPerTrade: string
  taxablePositiveGain?: string
  tdsFromCsv?: string
  tdsFromFallback?: string
  fallbackTdsCount?: number
  feesFromCsv?: string
  feesFromFallback?: string
  fallbackFeeCount?: number
  [key: string]: unknown
}

interface RealizedTrade {
  pair: string
  asset: string
  exchange?: string
  buyDate: string
  sellDate: string
  matchedQty: string
  buyPrice: string
  sellPrice: string
  buyValue: string
  sellValue: string
  grossProfit: string
  allocatedBuyFee: string
  allocatedSellFee: string
  totalFees: string
  tds: string
  gstOnFees: string
  baseCryptoTax: string
  cess: string
  totalDirectTax: string
  netProfitInHand: string
  finalNetProfit: string
  status: string
  resolvedBuyFee?: string
  resolvedSellFee?: string
  resolvedTotalFees?: string
  resolvedGstOnFees?: string
  resolvedTotalTds?: string
  resolvedNetProfitInHand?: string
  resolvedFinalNetProfit?: string
  resolvedProfitLossStatus?: string
  resolvedBaseCryptoTax?: string
  resolvedCess?: string
  resolvedTotalDirectTax?: string
  buyFeeSource?: string
  sellFeeSource?: string
  buyTdsSource?: string
  sellTdsSource?: string
  [key: string]: unknown
}

interface ReportData {
  reportId: string
  generatedAt: string
  sourceCsvFiles: string[]
  summary: {
    totalHoldingValue: string
    [key: string]: unknown
  }
  realizedTrades: RealizedTrade[]
  openHoldings: unknown[]
  warnings: unknown[]
  taxSummary: TaxSummary
}

// ── Time Frame ─────────────────────────────────────────────

type TimeFrame = '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | 'custom'

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
]

function getTimeFrameStart(tf: TimeFrame): Date | null {
  if (tf === 'all' || tf === 'custom') return null
  const now = new Date()
  switch (tf) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  }
}

// ── Chart Colors ───────────────────────────────────────────

const COLORS = {
  teal: '#14b8a6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  blue: '#3b82f6',
  pink: '#ec4899',
  emerald: '#10b981',
}

const TAX_COLORS = {
  baseTax: COLORS.red,
  cess: COLORS.orange,
  tds: COLORS.teal,
  gst: COLORS.purple,
}

const DEDUCTION_COLORS = [COLORS.orange, COLORS.purple, COLORS.teal, COLORS.red]

// ── Helper: resolved value with fallback ───────────────────

function rv(resolved: string | undefined, fallback: string | number): string {
  const v = resolved || fallback || '0'
  return v.toString()
}

// ── Main Component ─────────────────────────────────────────

export default function TaxSummaryPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Filters
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Pair-wise sort
  const [pairSort, setPairSort] = useState<'tax' | 'tds' | 'grossProfit' | 'finalNetProfit'>('tax')

  // Trade preview pagination
  const [previewPage, setPreviewPage] = useState(0)
  const PREVIEW_PAGE_SIZE = 10

  // ── Fetch report ──
  const fetchReport = useCallback(async () => {
    if (!currentWorkspace) { setIsLoading(false); return }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<ReportData>(
        `/api/workspaces/${currentWorkspace.id}/reports/latest`
      )
      setReport(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load report'
      if (msg.includes('404') || msg.includes('No reports found')) {
        setReport(null)
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => { fetchReport() }, [fetchReport])

  // ── Process report ──
  const handleProcessReport = async () => {
    if (!currentWorkspace) return
    setIsProcessing(true)
    try {
      await apiPost(`/api/workspaces/${currentWorkspace.id}/reports/process`)
      await fetchReport()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process report'
      setError(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Filtered trades by time ──
  const filteredTrades = useMemo(() => {
    if (!report?.realizedTrades) return []
    let trades = report.realizedTrades

    if (timeFrame === 'custom' && customFrom) {
      const from = new Date(customFrom)
      trades = trades.filter((t) => new Date(t.sellDate) >= from)
    } else if (timeFrame !== 'custom') {
      const start = getTimeFrameStart(timeFrame)
      if (start) trades = trades.filter((t) => new Date(t.sellDate) >= start)
    }
    if (timeFrame === 'custom' && customTo) {
      const to = new Date(customTo)
      to.setHours(23, 59, 59, 999)
      trades = trades.filter((t) => new Date(t.sellDate) <= to)
    }

    return trades
  }, [report, timeFrame, customFrom, customTo])

  // ── Computed tax values from filtered trades ──
  const taxData = useMemo(() => {
    const trades = filteredTrades
    let grossProfit = toD(0)
    let taxablePositiveGain = toD(0)
    let totalFees = toD(0)
    let totalGstOnFees = toD(0)
    let totalTds = toD(0)
    let baseCryptoTax = toD(0)
    let cess = toD(0)
    let totalDirectTax = toD(0)
    let netProfit = toD(0)
    let finalNetProfit = toD(0)
    let tdsFromCsv = toD(0)
    let tdsFromFallback = toD(0)
    let fallbackTdsCount = 0
    let feesFromCsv = toD(0)
    let feesFromFallback = toD(0)
    let fallbackFeeCount = 0

    for (const t of trades) {
      const gp = toD(t.grossProfit)
      grossProfit = grossProfit.plus(gp)

      // Only positive gross profit is taxable
      if (gp.greaterThan(0)) {
        taxablePositiveGain = taxablePositiveGain.plus(gp)
      }

      totalFees = totalFees.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
      totalGstOnFees = totalGstOnFees.plus(toD(rv(t.resolvedGstOnFees, t.gstOnFees)))
      totalTds = totalTds.plus(toD(rv(t.resolvedTotalTds, t.tds)))
      baseCryptoTax = baseCryptoTax.plus(toD(rv(t.resolvedBaseCryptoTax, t.baseCryptoTax)))
      cess = cess.plus(toD(rv(t.resolvedCess, t.cess)))
      totalDirectTax = totalDirectTax.plus(toD(rv(t.resolvedTotalDirectTax, t.totalDirectTax)))
      netProfit = netProfit.plus(toD(rv(t.resolvedNetProfitInHand, t.netProfitInHand)))
      finalNetProfit = finalNetProfit.plus(toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit)))

      // TDS source tracking
      const buyTdsSrc = t.buyTdsSource || ''
      const sellTdsSrc = t.sellTdsSource || ''
      if (buyTdsSrc === 'CSV' || sellTdsSrc === 'CSV') {
        tdsFromCsv = tdsFromCsv.plus(toD(rv(t.resolvedTotalTds, t.tds)))
      } else if (buyTdsSrc === 'DEFAULT' || sellTdsSrc === 'DEFAULT') {
        tdsFromFallback = tdsFromFallback.plus(toD(rv(t.resolvedTotalTds, t.tds)))
        fallbackTdsCount++
      } else {
        // If no source info, assume CSV
        tdsFromCsv = tdsFromCsv.plus(toD(rv(t.resolvedTotalTds, t.tds)))
      }

      // Fee source tracking
      const buyFeeSrc = t.buyFeeSource || ''
      const sellFeeSrc = t.sellFeeSource || ''
      if (buyFeeSrc === 'CSV' || sellFeeSrc === 'CSV') {
        feesFromCsv = feesFromCsv.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
      } else if (buyFeeSrc === 'DEFAULT' || sellFeeSrc === 'DEFAULT') {
        feesFromFallback = feesFromFallback.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
        fallbackFeeCount++
      } else {
        feesFromCsv = feesFromCsv.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
      }
    }

    return {
      grossProfit,
      taxablePositiveGain,
      totalFees,
      totalGstOnFees,
      totalTds,
      baseCryptoTax,
      cess,
      totalDirectTax,
      netProfit,
      finalNetProfit,
      tdsFromCsv,
      tdsFromFallback,
      fallbackTdsCount,
      feesFromCsv,
      feesFromFallback,
      fallbackFeeCount,
      totalTrades: trades.length,
    }
  }, [filteredTrades])

  // ── Deduction impact waterfall data ──
  const waterfallData = useMemo(() => {
    if (!filteredTrades.length) return []
    return [
      { name: 'Gross Profit', value: Number(taxData.grossProfit), fill: COLORS.green },
      { name: 'Fees', value: -Number(taxData.totalFees), fill: COLORS.orange },
      { name: 'GST', value: -Number(taxData.totalGstOnFees), fill: COLORS.purple },
      { name: 'TDS', value: -Number(taxData.totalTds), fill: COLORS.teal },
      { name: 'Base Tax', value: -Number(taxData.baseCryptoTax), fill: COLORS.red },
      { name: 'Cess', value: -Number(taxData.cess), fill: COLORS.amber },
      { name: 'Final Net', value: Number(taxData.finalNetProfit), fill: COLORS.teal },
    ]
  }, [filteredTrades, taxData])

  // ── Tax breakdown donut data ──
  const taxBreakdownData = useMemo(() => {
    const items = [
      { name: 'Base Crypto Tax', value: Number(taxData.baseCryptoTax), fill: TAX_COLORS.baseTax },
      { name: 'Cess', value: Number(taxData.cess), fill: TAX_COLORS.cess },
      { name: 'TDS Withheld', value: Number(taxData.totalTds), fill: TAX_COLORS.tds },
      { name: 'GST on Fees', value: Number(taxData.totalGstOnFees), fill: TAX_COLORS.gst },
    ]
    return items.filter((i) => i.value > 0)
  }, [taxData])

  // ── Pair-wise tax summary ──
  const pairWiseTax = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, {
      grossProfit: number
      taxableGain: number
      baseTax: number
      cess: number
      totalTax: number
      tds: number
      finalNetProfit: number
    }>()

    for (const t of filteredTrades) {
      const existing = grouped.get(t.pair) || {
        grossProfit: 0, taxableGain: 0, baseTax: 0,
        cess: 0, totalTax: 0, tds: 0, finalNetProfit: 0,
      }
      existing.grossProfit += Number(t.grossProfit)
      existing.taxableGain += Number(t.grossProfit) > 0 ? Number(t.grossProfit) : 0
      existing.baseTax += Number(rv(t.resolvedBaseCryptoTax, t.baseCryptoTax))
      existing.cess += Number(rv(t.resolvedCess, t.cess))
      existing.totalTax += Number(rv(t.resolvedTotalDirectTax, t.totalDirectTax))
      existing.tds += Number(rv(t.resolvedTotalTds, t.tds))
      existing.finalNetProfit += Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      grouped.set(t.pair, existing)
    }

    return Array.from(grouped.entries())
      .map(([pair, data]) => ({
        pair,
        ...data,
        grossProfit: Math.round(data.grossProfit * 100) / 100,
        taxableGain: Math.round(data.taxableGain * 100) / 100,
        baseTax: Math.round(data.baseTax * 100) / 100,
        cess: Math.round(data.cess * 100) / 100,
        totalTax: Math.round(data.totalTax * 100) / 100,
        tds: Math.round(data.tds * 100) / 100,
        finalNetProfit: Math.round(data.finalNetProfit * 100) / 100,
      }))
      .sort((a, b) => {
        switch (pairSort) {
          case 'tax': return b.totalTax - a.totalTax
          case 'tds': return b.tds - a.tds
          case 'grossProfit': return b.grossProfit - a.grossProfit
          case 'finalNetProfit': return b.finalNetProfit - a.finalNetProfit
          default: return b.totalTax - a.totalTax
        }
      })
  }, [filteredTrades, pairSort])

  // ── Trade-level tax preview ──
  const tradePreview = useMemo(() => {
    if (!filteredTrades.length) return []
    return filteredTrades.map((t, idx) => ({
      index: idx + 1,
      pair: t.pair,
      sellDate: t.sellDate,
      grossProfit: Number(t.grossProfit),
      fees: Number(rv(t.resolvedTotalFees, t.totalFees)),
      gst: Number(rv(t.resolvedGstOnFees, t.gstOnFees)),
      tds: Number(rv(t.resolvedTotalTds, t.tds)),
      baseTax: Number(rv(t.resolvedBaseCryptoTax, t.baseCryptoTax)),
      cess: Number(rv(t.resolvedCess, t.cess)),
      totalTax: Number(rv(t.resolvedTotalDirectTax, t.totalDirectTax)),
      finalNetProfit: Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit)),
    }))
  }, [filteredTrades])

  const totalPreviewPages = Math.ceil(tradePreview.length / PREVIEW_PAGE_SIZE)
  const previewSlice = tradePreview.slice(
    previewPage * PREVIEW_PAGE_SIZE,
    (previewPage + 1) * PREVIEW_PAGE_SIZE
  )

  // ── Reset filters ──
  const resetFilters = useCallback(() => {
    setTimeFrame('30d')
    setCustomFrom('')
    setCustomTo('')
  }, [])

  // ── Export handlers ──
  const handleExport = async (type: 'excel' | 'pdf') => {
    if (!currentWorkspace) return
    try {
      const endpoint =
        type === 'excel'
          ? `/api/workspaces/${currentWorkspace.id}/exports/excel/tax-summary`
          : `/api/workspaces/${currentWorkspace.id}/exports/pdf/data`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
        },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'excel' ? 'tax-summary.xlsx' : 'tax-summary.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Fallback — toast or silent fail
    }
  }

  // ── Loading ──
  if (isLoading) return <TaxSummarySkeleton />

  // ── No workspace ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select a workspace to view your tax summary.
        </p>
        <Button onClick={() => setCurrentPage('workspaces')} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white">
          Go to Workspaces
        </Button>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Unable to load tax summary.</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button variant="outline" onClick={fetchReport} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    )
  }

  // ── No report ──
  if (!report || !report.realizedTrades || report.realizedTrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Calculator className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No tax summary available yet.</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Process your CSV report to calculate tax summary.
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => setCurrentPage('upload')} className="bg-teal-500 hover:bg-teal-600 text-white">
            <Upload className="h-4 w-4 mr-2" /> Upload CSV
          </Button>
          <Button variant="outline" onClick={handleProcessReport} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : <><Zap className="h-4 w-4 mr-2" /> Process Report</>}
          </Button>
        </div>
      </div>
    )
  }

  // ── No filtered results ──
  if (filteredTrades.length === 0) {
    return (
      <div className="space-y-5">
        <PageTopBar
          timeFrame={timeFrame} setTimeFrame={setTimeFrame}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          onExport={handleExport}
          isMobile={isMobile}
        />
        <Card className="rounded-xl border-border">
          <CardContent className="p-8 text-center">
            <Calculator className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No tax data available for selected period.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filter
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════════

  if (isMobile) {
    return (
      <div className="space-y-4 px-4 pb-6">
        {/* Mobile Header */}
        <div>
          <h1 className="text-xl font-bold">Tax Summary</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review crypto tax, TDS, GST, and final profit calculation.
          </p>
        </div>

        {/* Mobile Time Frame */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto flex-1 -mx-1 px-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeFrame(tf.value)}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-md transition-all whitespace-nowrap ${
                  timeFrame === tf.value
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-lg shrink-0">
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>Filter tax data</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                {timeFrame === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                      <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                      <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 text-xs" />
                    </div>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={resetFilters}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Mobile: Total Direct Tax Hero Card */}
        <Card className="rounded-2xl border-border shadow-sm bg-gradient-to-br from-red-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <IndianRupee className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Direct Tax</p>
                {currentWorkspace.financialYear && (
                  <Badge variant="secondary" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] mt-0.5">
                    FY {currentWorkspace.financialYear}
                  </Badge>
                )}
              </div>
            </div>
            <span className="text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">
              {formatINR(taxData.totalDirectTax)}
            </span>
          </CardContent>
        </Card>

        {/* Mobile: Final Net Profit Card */}
        <Card className="rounded-2xl border-border shadow-sm bg-gradient-to-br from-teal-500/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${taxData.finalNetProfit.gte(0) ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {taxData.finalNetProfit.gte(0) ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
              </div>
              <p className="text-sm font-medium text-muted-foreground">Final Net Profit</p>
            </div>
            <span className={`text-3xl font-bold tracking-tight ${taxData.finalNetProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatINR(taxData.finalNetProfit)}
            </span>
          </CardContent>
        </Card>

        {/* Mobile: Mini KPI Cards */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Gross Profit', value: formatINR(taxData.grossProfit), icon: TrendingUp, color: 'text-green-500 bg-green-500/10' },
            { label: 'Taxable Gain', value: formatINR(taxData.taxablePositiveGain), icon: Target, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: 'Base Tax @30%', value: formatINR(taxData.baseCryptoTax), icon: Calculator, color: 'text-red-500 bg-red-500/10' },
            { label: 'Cess @4%', value: formatINR(taxData.cess), icon: Percent, color: 'text-orange-500 bg-orange-500/10' },
            { label: 'TDS Withheld', value: formatINR(taxData.totalTds), icon: ShieldCheck, color: 'text-teal-500 bg-teal-500/10' },
            { label: 'GST on Fees', value: formatINR(taxData.totalGstOnFees), icon: Receipt, color: 'text-purple-500 bg-purple-500/10' },
          ].map((card) => (
            <div key={card.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.color}`}>
                <card.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{card.label}</p>
                <p className="text-xs font-bold truncate">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Deduction Impact Card */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Deduction Impact</CardTitle>
            <CardDescription className="text-xs">How deductions reduce your profit</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <ChartContainer
              config={{
                'Gross Profit': { label: 'Gross Profit', color: COLORS.green },
                Fees: { label: 'Fees', color: COLORS.orange },
                GST: { label: 'GST', color: COLORS.purple },
                TDS: { label: 'TDS', color: COLORS.teal },
                'Base Tax': { label: 'Base Tax', color: COLORS.red },
                Cess: { label: 'Cess', color: COLORS.amber },
                'Final Net': { label: 'Final Net', color: COLORS.teal },
              }}
              className="h-[200px] w-full"
            >
              <BarChart data={waterfallData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} />
                <YAxis tick={{ fontSize: 9 }} width={50} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Mobile: Tax Breakdown Donut */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Tax & Withholding Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {taxBreakdownData.length > 0 ? (
              <ChartContainer
                config={{
                  'Base Crypto Tax': { label: 'Base Tax', color: TAX_COLORS.baseTax },
                  Cess: { label: 'Cess', color: TAX_COLORS.cess },
                  'TDS Withheld': { label: 'TDS', color: TAX_COLORS.tds },
                  'GST on Fees': { label: 'GST', color: TAX_COLORS.gst },
                }}
                className="h-[200px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={taxBreakdownData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" nameKey="name">
                    {taxBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Mobile: TDS Summary Card */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-500" />
              <CardTitle className="text-sm font-semibold">TDS Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total TDS Withheld</span>
                <span className="font-semibold">{formatINR(taxData.totalTds)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">TDS from CSV</span>
                <span className="font-medium">{formatINR(taxData.tdsFromCsv)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">TDS by Fallback Rule</span>
                <span className="font-medium">{formatINR(taxData.tdsFromFallback)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Trades Using Fallback TDS</span>
                <span className="font-medium">{taxData.fallbackTdsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile: Fees & GST Summary Card */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-orange-500" />
              <CardTitle className="text-sm font-semibold">Fees & GST Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Fees</span>
                <span className="font-semibold">{formatINR(taxData.totalFees)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">GST on Fees</span>
                <span className="font-semibold">{formatINR(taxData.totalGstOnFees)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fees from CSV</span>
                <span className="font-medium">{formatINR(taxData.feesFromCsv)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fees by Fallback Settings</span>
                <span className="font-medium">{formatINR(taxData.feesFromFallback)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Trades Using Fallback Fees</span>
                <span className="font-medium">{taxData.fallbackFeeCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile: Formula Explanations Accordion */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-teal-500" />
              <CardTitle className="text-sm font-semibold">Tax Calculation Explained</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="base-tax">
                <AccordionTrigger className="text-xs">What is Base Crypto Tax?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    Base Crypto Tax is calculated on positive realized gross profit at 30%.
                    Loss trades do not generate crypto tax.
                  </p>
                  <div className="p-2 rounded-lg bg-muted/50 font-mono text-[10px] mt-2">
                    Base Tax = Taxable Positive Gain × 30%
                  </div>
                  <div className="p-2 rounded-lg bg-teal-500/5 border border-teal-500/20 text-[10px] mt-1.5">
                    {formatINR(taxData.taxablePositiveGain)} × 30% = <span className="font-semibold text-red-600 dark:text-red-400">{formatINR(taxData.baseCryptoTax)}</span>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cess">
                <AccordionTrigger className="text-xs">What is Cess?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">Cess is 4% of the base crypto tax.</p>
                  <div className="p-2 rounded-lg bg-muted/50 font-mono text-[10px] mt-2">
                    Cess = Base Crypto Tax × 4%
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="tds">
                <AccordionTrigger className="text-xs">What is TDS?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    TDS is a withheld amount. It is shown separately and added back in the final net profit formula.
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="gst">
                <AccordionTrigger className="text-xs">What is GST on Fees?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">GST is applied only on exchange fees, not directly on trade value.</p>
                  <div className="p-2 rounded-lg bg-muted/50 font-mono text-[10px] mt-2">
                    GST = Total Trading Fees × 18%
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="why-tds-back">
                <AccordionTrigger className="text-xs">Why Final Net Profit adds TDS back?</AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground">
                    TDS is already deducted in Net Profit, so it is added back as withheld credit after direct tax calculation.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Mobile: Export Button */}
        <Button
          className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
          onClick={() => handleExport('excel')}
        >
          <Download className="h-4 w-4 mr-2" /> Export Tax Report
        </Button>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-5 pb-4">
      {/* ═══════════ ROW 1: Page Top Area ═══════════ */}
      <PageTopBar
        timeFrame={timeFrame} setTimeFrame={setTimeFrame}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo} setCustomTo={setCustomTo}
        onExport={handleExport}
        isMobile={false}
      />

      {/* ═══════════ ROW 2: 8 Main Tax KPI Cards ═══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <TaxKpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total Gross Profit"
          value={formatINR(taxData.grossProfit)}
          valueColor={taxData.grossProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          iconColor="text-green-500"
          bgColor="bg-green-500/10"
        />
        <TaxKpiCard
          icon={<Target className="h-4 w-4" />}
          label="Taxable Positive Gain"
          value={formatINR(taxData.taxablePositiveGain)}
          description="Positive gross profits only"
          valueColor="text-emerald-600 dark:text-emerald-400"
          iconColor="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
        <TaxKpiCard
          icon={<Calculator className="h-4 w-4" />}
          label="Base Crypto Tax"
          value={formatINR(taxData.baseCryptoTax)}
          description="30% of taxable gain"
          valueColor="text-red-600 dark:text-red-400"
          iconColor="text-red-500"
          bgColor="bg-red-500/10"
        />
        <TaxKpiCard
          icon={<Percent className="h-4 w-4" />}
          label="Cess 4%"
          value={formatINR(taxData.cess)}
          description="4% of base crypto tax"
          valueColor="text-orange-600 dark:text-orange-400"
          iconColor="text-orange-500"
          bgColor="bg-orange-500/10"
        />
        <TaxKpiCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Total Direct Tax"
          value={formatINR(taxData.totalDirectTax)}
          description="Base Tax + Cess"
          valueColor="text-red-600 dark:text-red-400"
          iconColor="text-red-600"
          bgColor="bg-red-500/10"
        />
        <TaxKpiCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="TDS Withheld"
          value={formatINR(taxData.totalTds)}
          description="Withheld, not final tax"
          valueColor="text-teal-600 dark:text-teal-400"
          iconColor="text-teal-500"
          bgColor="bg-teal-500/10"
        />
        <TaxKpiCard
          icon={<Receipt className="h-4 w-4" />}
          label="GST on Fees"
          value={formatINR(taxData.totalGstOnFees)}
          description="18% on exchange fees"
          valueColor="text-purple-600 dark:text-purple-400"
          iconColor="text-purple-500"
          bgColor="bg-purple-500/10"
        />
        <TaxKpiCard
          icon={taxData.finalNetProfit.gte(0) ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="Final Net Profit"
          value={formatINR(taxData.finalNetProfit)}
          valueColor={taxData.finalNetProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          iconColor={taxData.finalNetProfit.gte(0) ? 'text-green-500' : 'text-red-500'}
          bgColor={taxData.finalNetProfit.gte(0) ? 'bg-green-500/10' : 'bg-red-500/10'}
          isHighlight
        />
      </div>

      {/* ═══════════ ROW 3: Tax Calculation Breakdown ═══════════ */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-teal-500" />
            <CardTitle className="text-base font-semibold">Tax Calculation Breakdown</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Step-by-step formula from gross profit to final net profit
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-1">
            <FormulaRow label="1. Gross Profit" formula="Sell Value − Buy Value" value={formatINR(taxData.grossProfit)} valueColor={taxData.grossProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
            <FormulaRow label="2. Taxable Positive Gain" formula="Sum of positive gross profits only" value={formatINR(taxData.taxablePositiveGain)} valueColor="text-emerald-600 dark:text-emerald-400" />
            <FormulaRow label="3. Base Crypto Tax" formula="30% of Taxable Positive Gain" value={formatINR(taxData.baseCryptoTax)} valueColor="text-red-600 dark:text-red-400" />
            <FormulaRow label="4. Cess" formula="4% of Base Crypto Tax" value={formatINR(taxData.cess)} valueColor="text-orange-600 dark:text-orange-400" />
            <FormulaRow label="5. Total Direct Tax" formula="Base Crypto Tax + Cess" value={formatINR(taxData.totalDirectTax)} valueColor="text-red-600 dark:text-red-400" isBold />
            <FormulaRow label="6. GST on Fees" formula="18% of exchange fees" value={formatINR(taxData.totalGstOnFees)} valueColor="text-purple-600 dark:text-purple-400" />
            <FormulaRow label="7. TDS Withheld" formula="CSV TDS if available, otherwise fallback rule" value={formatINR(taxData.totalTds)} valueColor="text-teal-600 dark:text-teal-400" />
            <FormulaRow label="8. Net Profit" formula="Gross Profit − Fees − TDS" value={formatINR(taxData.netProfit)} valueColor={taxData.netProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} />
            <FormulaRow label="9. Final Net Profit" formula="Net Profit − Total Tax + TDS" value={formatINR(taxData.finalNetProfit)} valueColor={taxData.finalNetProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} isFinal />

            {/* Live calculation example */}
            <div className="mt-3 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-xs">
              <p className="font-medium text-teal-600 dark:text-teal-400 mb-1">Live Calculation:</p>
              <p className="text-muted-foreground">
                {formatINR(taxData.grossProfit)} (Gross) − {formatINR(taxData.totalFees)} (Fees) − {formatINR(taxData.totalTds)} (TDS) = {formatINR(taxData.netProfit)} (Net)
              </p>
              <p className="text-muted-foreground mt-0.5">
                {formatINR(taxData.netProfit)} (Net) − {formatINR(taxData.totalDirectTax)} (Tax) + {formatINR(taxData.totalTds)} (TDS) = <span className="font-bold text-foreground">{formatINR(taxData.finalNetProfit)}</span> (Final)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ ROW 4: Deduction Impact + Tax Breakdown Donut ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* A. Deduction Impact Waterfall */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Deduction Impact</CardTitle>
            <CardDescription className="text-xs">How deductions reduce your gross profit to final net profit</CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <ChartContainer
              config={{
                'Gross Profit': { label: 'Gross Profit', color: COLORS.green },
                Fees: { label: 'Fees', color: COLORS.orange },
                GST: { label: 'GST', color: COLORS.purple },
                TDS: { label: 'TDS', color: COLORS.teal },
                'Base Tax': { label: 'Base Tax', color: COLORS.red },
                Cess: { label: 'Cess', color: COLORS.amber },
                'Final Net': { label: 'Final Net', color: COLORS.teal },
              }}
              className="h-[280px] w-full"
            >
              <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} width={65} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* Flow summary below chart */}
            <div className="mt-3 space-y-1.5">
              <FlowStep label="Gross Profit" value={formatINR(taxData.grossProfit)} isPositive />
              <FlowStep label="→ Fees" value={`− ${formatINR(taxData.totalFees)}`} isDeduction />
              <FlowStep label="→ GST on Fees" value={`− ${formatINR(taxData.totalGstOnFees)}`} isDeduction />
              <FlowStep label="→ TDS Withheld" value={`− ${formatINR(taxData.totalTds)}`} isDeduction />
              <FlowStep label="→ Base Tax" value={`− ${formatINR(taxData.baseCryptoTax)}`} isDeduction />
              <FlowStep label="→ Cess" value={`− ${formatINR(taxData.cess)}`} isDeduction />
              <FlowStep label="+ TDS Credit" value={`+ ${formatINR(taxData.totalTds)}`} isAddition />
              <Separator className="my-1" />
              <FlowStep label="Final Net Profit" value={formatINR(taxData.finalNetProfit)} isFinal isPositive={taxData.finalNetProfit.gte(0)} />
            </div>
          </CardContent>
        </Card>

        {/* B. Tax & Withholding Breakdown Donut */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Tax & Withholding Breakdown</CardTitle>
            <CardDescription className="text-xs">
              Clearly separating Direct Tax, TDS, and GST
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {taxBreakdownData.length > 0 ? (
              <ChartContainer
                config={{
                  'Base Crypto Tax': { label: 'Base Tax', color: TAX_COLORS.baseTax },
                  Cess: { label: 'Cess', color: TAX_COLORS.cess },
                  'TDS Withheld': { label: 'TDS Withheld', color: TAX_COLORS.tds },
                  'GST on Fees': { label: 'GST on Fees', color: TAX_COLORS.gst },
                }}
                className="h-[260px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={taxBreakdownData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name">
                    {taxBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : <EmptyChart />}

            {/* Clear separation labels */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">Direct Tax</p>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatINR(taxData.totalDirectTax)}</p>
                <p className="text-[9px] text-muted-foreground">Base + Cess</p>
              </div>
              <div className="p-2.5 rounded-lg bg-teal-500/5 border border-teal-500/10 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">TDS</p>
                <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{formatINR(taxData.totalTds)}</p>
                <p className="text-[9px] text-muted-foreground">Withheld</p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">GST</p>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{formatINR(taxData.totalGstOnFees)}</p>
                <p className="text-[9px] text-muted-foreground">On Fees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ ROW 5: Pair-wise Tax Summary ═══════════ */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Pair-wise Tax Summary</CardTitle>
              <CardDescription className="text-xs">Which pair contributed most to tax and profit</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Sort by:</span>
              <Select value={pairSort} onValueChange={(v) => setPairSort(v as typeof pairSort)}>
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax">Highest Tax</SelectItem>
                  <SelectItem value="tds">Highest TDS</SelectItem>
                  <SelectItem value="grossProfit">Highest Gross Profit</SelectItem>
                  <SelectItem value="finalNetProfit">Highest Final Net Profit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {pairWiseTax.length > 0 ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-medium">Pair</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Gross Profit</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Taxable Gain</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Base Tax</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Cess</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Total Tax</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">TDS</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Final Net Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairWiseTax.map((row) => (
                    <TableRow key={row.pair} className="hover:bg-accent/50">
                      <TableCell className="text-xs font-medium">{row.pair}</TableCell>
                      <TableCell className={`text-xs text-right ${row.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatINR(toD(row.grossProfit))}
                      </TableCell>
                      <TableCell className="text-xs text-right text-emerald-600 dark:text-emerald-400">{formatINR(toD(row.taxableGain))}</TableCell>
                      <TableCell className="text-xs text-right text-red-600 dark:text-red-400">{formatINR(toD(row.baseTax))}</TableCell>
                      <TableCell className="text-xs text-right text-orange-600 dark:text-orange-400">{formatINR(toD(row.cess))}</TableCell>
                      <TableCell className="text-xs text-right font-medium text-red-600 dark:text-red-400">{formatINR(toD(row.totalTax))}</TableCell>
                      <TableCell className="text-xs text-right text-teal-600 dark:text-teal-400">{formatINR(toD(row.tds))}</TableCell>
                      <TableCell className={`text-xs text-right font-semibold ${row.finalNetProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatINR(toD(row.finalNetProfit))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <ArrowLeftRight className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No pair-wise data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ ROW 6: Trade-Level Tax Preview ═══════════ */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Trade-Level Tax Preview</CardTitle>
              <CardDescription className="text-xs">Tax impact per realized trade — full details in Realized Trades page</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentPage('realized-trades')}>
              <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> View Full Realized Trades
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {tradePreview.length > 0 ? (
            <>
              <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-medium w-8">#</TableHead>
                      <TableHead className="text-[10px] font-medium">Pair</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Sell Date</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Gross Profit</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Fees</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">GST</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">TDS</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Base Tax</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Cess</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Total Tax</TableHead>
                      <TableHead className="text-[10px] font-medium text-right">Final Net Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewSlice.map((row) => (
                      <TableRow key={row.index} className="hover:bg-accent/50">
                        <TableCell className="text-[10px] text-muted-foreground">{row.index}</TableCell>
                        <TableCell className="text-xs font-medium">{row.pair}</TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right">
                          {new Date(row.sellDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </TableCell>
                        <TableCell className={`text-xs text-right ${row.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatINR(toD(row.grossProfit))}
                        </TableCell>
                        <TableCell className="text-xs text-right">{formatINR(toD(row.fees))}</TableCell>
                        <TableCell className="text-xs text-right">{formatINR(toD(row.gst))}</TableCell>
                        <TableCell className="text-xs text-right text-teal-600 dark:text-teal-400">{formatINR(toD(row.tds))}</TableCell>
                        <TableCell className="text-xs text-right text-red-600 dark:text-red-400">{formatINR(toD(row.baseTax))}</TableCell>
                        <TableCell className="text-xs text-right text-orange-600 dark:text-orange-400">{formatINR(toD(row.cess))}</TableCell>
                        <TableCell className="text-xs text-right text-red-600 dark:text-red-400 font-medium">{formatINR(toD(row.totalTax))}</TableCell>
                        <TableCell className={`text-xs text-right font-semibold ${row.finalNetProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatINR(toD(row.finalNetProfit))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPreviewPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Showing {previewPage * PREVIEW_PAGE_SIZE + 1}–{Math.min((previewPage + 1) * PREVIEW_PAGE_SIZE, tradePreview.length)} of {tradePreview.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={previewPage === 0} onClick={() => setPreviewPage(previewPage - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{previewPage + 1}/{totalPreviewPages}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={previewPage >= totalPreviewPages - 1} onClick={() => setPreviewPage(previewPage + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <ArrowLeftRight className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No trade-level data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ ROW 7: TDS Summary + Fees & GST Summary ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* A. TDS Summary */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-500" />
              <CardTitle className="text-base font-semibold">TDS Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20">
                <p className="text-[10px] text-muted-foreground font-medium">Total TDS Withheld</p>
                <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{formatINR(taxData.totalTds)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">TDS from CSV</span>
                  <span className="font-medium">{formatINR(taxData.tdsFromCsv)}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">TDS calculated by fallback rule</span>
                  <span className="font-medium">{formatINR(taxData.tdsFromFallback)}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-muted-foreground">Trades where fallback TDS was used</span>
                  <Badge variant="outline" className="text-[10px]">{taxData.fallbackTdsCount} trade{taxData.fallbackTdsCount !== 1 ? 's' : ''}</Badge>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />
                If CSV has TDS value, use it. If CSV TDS is missing, fallback may apply. If CSV explicitly has 0, treat 0 as valid value, not missing.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B. Fees & GST Summary */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base font-semibold">Fees & GST Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <p className="text-[10px] text-muted-foreground font-medium">Total Fees</p>
                  <p className="text-lg font-bold">{formatINR(taxData.totalFees)}</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-[10px] text-muted-foreground font-medium">GST on Fees</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatINR(taxData.totalGstOnFees)}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Fees from CSV</span>
                  <span className="font-medium">{formatINR(taxData.feesFromCsv)}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Fees calculated by fallback settings</span>
                  <span className="font-medium">{formatINR(taxData.feesFromFallback)}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-muted-foreground">Trades where fallback fees were used</span>
                  <Badge variant="outline" className="text-[10px]">{taxData.fallbackFeeCount} trade{taxData.fallbackFeeCount !== 1 ? 's' : ''}</Badge>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3 inline mr-1" />
                If CSV fee exists, use CSV fee. If CSV fee is missing, fallback fee settings may apply. If CSV explicitly has 0, treat 0 as valid fee, not missing.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ ROW 8: Explanation / Help Cards ═══════════ */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-teal-500" />
            <CardTitle className="text-base font-semibold">Tax Calculation Explained</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Beginner-friendly explanations of each tax component
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="base-tax-explain">
              <AccordionTrigger className="text-sm">
                What is Base Crypto Tax?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Base Crypto Tax is calculated on positive realized gross profit.
                    Loss trades do not generate crypto tax under Indian crypto taxation rules.
                  </p>
                  <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
                    Base Tax = Taxable Positive Gain × 30%
                  </div>
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-sm">
                    {formatINR(taxData.taxablePositiveGain)} × 30% = <span className="font-semibold text-red-600 dark:text-red-400">{formatINR(taxData.baseCryptoTax)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cess-explain">
              <AccordionTrigger className="text-sm">
                What is Cess?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Cess is 4% of the base crypto tax. It is a Health and Education Cess applied on top of the base tax amount.
                  </p>
                  <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
                    Cess = Base Crypto Tax × 4%
                  </div>
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-sm">
                    {formatINR(taxData.baseCryptoTax)} × 4% = <span className="font-semibold text-orange-600 dark:text-orange-400">{formatINR(taxData.cess)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tds-explain">
              <AccordionTrigger className="text-sm">
                What is TDS?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    TDS is a withheld amount. It is shown separately and added back in the final net profit formula.
                    TDS is deducted at source by the exchange and counts as a credit against your total tax liability.
                  </p>
                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-sm">
                    <span className="font-medium text-blue-600 dark:text-blue-400">Key Point:</span> TDS is already paid to the government on your behalf.
                    It reduces your final tax payable, not your profit.
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gst-explain">
              <AccordionTrigger className="text-sm">
                What is GST on Fees?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    GST is applied only on exchange fees, not directly on trade value.
                    Exchange fees are considered a service and attract 18% GST.
                  </p>
                  <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
                    GST = Total Trading Fees × 18%
                  </div>
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-sm">
                    {formatINR(taxData.totalFees)} × 18% = <span className="font-semibold text-purple-600 dark:text-purple-400">{formatINR(taxData.totalGstOnFees)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="why-tds-back">
              <AccordionTrigger className="text-sm">
                Why Final Net Profit adds TDS back?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    TDS is already deducted in Net Profit, so it is added back as withheld credit after direct tax calculation.
                    This ensures your final net profit reflects your true bottom line after accounting for the TDS credit.
                  </p>
                  <div className="p-3 rounded-xl bg-muted/50 font-mono text-sm">
                    Final Net Profit = Net Profit − Total Direct Tax + TDS
                  </div>
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-sm">
                    {formatINR(taxData.netProfit)} − {formatINR(taxData.totalDirectTax)} + {formatINR(taxData.totalTds)} = <span className="font-semibold text-teal-600 dark:text-teal-400">{formatINR(taxData.finalNetProfit)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* ═══════════ Disclaimer ═══════════ */}
      <Card className="rounded-xl border-orange-500/30 bg-orange-500/5 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 shrink-0">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-1">Tax Disclaimer</h3>
              <p className="text-xs text-muted-foreground">
                This platform provides audit and tax-review assistance. It is not a substitute for
                professional tax filing advice. Tax laws may change, and individual circumstances
                may vary. Please consult a qualified Chartered Accountant for tax filing purposes.
                All values shown are based on FIFO matching and the data provided in your CSV files.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page Top Bar Component ─────────────────────────────────

function PageTopBar({
  timeFrame, setTimeFrame,
  customFrom, setCustomFrom,
  customTo, setCustomTo,
  onExport, isMobile,
}: {
  timeFrame: TimeFrame
  setTimeFrame: (tf: TimeFrame) => void
  customFrom: string
  setCustomFrom: (v: string) => void
  customTo: string
  setCustomTo: (v: string) => void
  onExport: (type: 'excel' | 'pdf') => void
  isMobile: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Tax Summary</h1>
        <p className="text-sm text-muted-foreground">
          Review crypto tax, TDS, GST, and final profit calculation for the selected workspace.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-1">
          {TIME_FRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeFrame(tf.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                timeFrame === tf.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {timeFrame === 'custom' && !isMobile && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-32 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-32 text-xs" />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 bg-teal-500 hover:bg-teal-600 text-white">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export Tax Report
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport('pdf')}>
              <FileText className="h-3.5 w-3.5 mr-2" /> PDF Tax Summary
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('excel')}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel Tax Summary
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ── Tax KPI Card ───────────────────────────────────────────

function TaxKpiCard({
  icon,
  label,
  value,
  description,
  valueColor,
  iconColor,
  bgColor,
  isHighlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  description?: string
  valueColor: string
  iconColor: string
  bgColor: string
  isHighlight?: boolean
}) {
  return (
    <Card className={`rounded-xl border-border shadow-sm hover:shadow-md transition-shadow ${isHighlight ? 'bg-gradient-to-br from-teal-500/[0.04] to-transparent' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgColor}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</span>
        </div>
        <p className={`text-base font-bold tracking-tight ${valueColor}`}>{value}</p>
        {description && <p className="text-[9px] text-muted-foreground mt-0.5">{description}</p>}
      </CardContent>
    </Card>
  )
}

// ── Formula Row ────────────────────────────────────────────

function FormulaRow({
  label,
  formula,
  value,
  valueColor,
  isBold,
  isFinal,
}: {
  label: string
  formula: string
  value: string
  valueColor: string
  isBold?: boolean
  isFinal?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
      isFinal ? 'bg-teal-500/5 border border-teal-500/20' : 'hover:bg-muted/30'
    } transition-colors`}>
      <div className="flex-1 min-w-0 mr-4">
        <p className={`text-xs ${isFinal || isBold ? 'font-bold' : 'font-medium'}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{formula}</p>
      </div>
      <span className={`text-sm font-semibold ${valueColor} tabular-nums whitespace-nowrap`}>{value}</span>
    </div>
  )
}

// ── Flow Step (Deduction Impact) ───────────────────────────

function FlowStep({
  label,
  value,
  isPositive,
  isDeduction,
  isAddition,
  isFinal,
}: {
  label: string
  value: string
  isPositive?: boolean
  isDeduction?: boolean
  isAddition?: boolean
  isFinal?: boolean
}) {
  const getColor = () => {
    if (isFinal) return 'bg-teal-500/5 border-teal-500/30'
    if (isDeduction) return 'bg-red-500/5 border-red-500/10'
    if (isAddition) return 'bg-green-500/5 border-green-500/10'
    if (isPositive) return 'bg-green-500/5 border-green-500/10'
    return 'bg-muted/30 border-border/50'
  }
  const getValueColor = () => {
    if (isDeduction) return 'text-red-600 dark:text-red-400'
    if (isAddition) return 'text-green-600 dark:text-green-400'
    if (isFinal) return 'text-teal-600 dark:text-teal-400'
    if (isPositive) return 'text-green-600 dark:text-green-400'
    return 'text-foreground'
  }

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg border ${getColor()}`}>
      <div className="flex items-center gap-2">
        {isDeduction && <ArrowDownRight className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        {isAddition && <ArrowUpRight className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        <span className={`text-xs ${isFinal ? 'font-bold' : 'font-medium'}`}>{label}</span>
      </div>
      <span className={`text-xs font-semibold ${getValueColor()}`}>{value}</span>
    </div>
  )
}

// ── Empty Chart ────────────────────────────────────────────

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-[180px] text-center">
      <Calculator className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground">No data to display</p>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────

function TaxSummarySkeleton() {
  return (
    <div className="space-y-5 pb-4">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-72 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
      {/* 8 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {/* Formula breakdown */}
      <Skeleton className="h-96 rounded-xl" />
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      {/* Pair-wise table */}
      <Skeleton className="h-64 rounded-xl" />
      {/* Trade preview */}
      <Skeleton className="h-64 rounded-xl" />
      {/* TDS + Fees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      {/* Help cards */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

// ── Missing icon import helper ─────────────────────────────
// Target icon used in mobile KPI cards
function Target(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

// ── ChevronLeft icon helper ────────────────────────────────
function ChevronLeft(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
