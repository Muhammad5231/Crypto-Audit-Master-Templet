'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Dashboard Page (v2 — Executive Summary)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Premium FinTech executive dashboard with:
//   1. Time Frame Selector
//   2. Primary KPI Cards (6)
//   3. Profit Trend + Deduction Snapshot charts
//   4. Top Performing Pairs + Alerts & Data Quality
//   5. Recent Realized Trades + Open Holdings previews
//
// Mobile layout: hero profit card + 2-col KPIs + stacked sections
// Desktop layout: single-row KPIs + side-by-side panels
//
// All hooks are called unconditionally before any early returns.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost } from '@/lib/api-client'
import { toD, formatINR, formatQty } from '@/lib/decimal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  IndianRupee,
  Receipt,
  ShieldCheck,
  Wallet,
  ArrowLeftRight,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Upload,
  FileWarning,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'

// ── Time Frame Types ───────────────────────────────────────

type TimeFrame = '7d' | '30d' | '90d' | '6m' | '1y' | 'all'

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

function getTimeFrameStart(tf: TimeFrame): Date | null {
  if (tf === 'all') return null
  const now = new Date()
  switch (tf) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  }
}

// ── Types for report data ──────────────────────────────────

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
}

interface ReportSummary {
  totalTrades: number
  totalBuyTrades: number
  totalSellTrades: number
  uniquePairs: number
  totalBuyValue: string
  totalSellValue: string
  totalFees: string
  totalTds: string
  totalRealizedTrades: number
  totalOpenHoldings: number
  totalWarnings: number
  fullyUnmatchedHoldings: number
  partiallyMatchedHoldings: number
  totalHoldingValue: string
  totalHoldingQty: string
  taxSummary: TaxSummary
}

interface RealizedTrade {
  pair: string
  asset: string
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
  buyCsvFileId: string
  sellCsvFileId: string
  buyTradeId: string
  sellTradeId: string
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
}

interface UnmatchedSellWarning {
  pair: string
  sellTradeId: string
  sellDate: string
  originalSellQty: string
  unmatchedQty: string
  reason: string
}

interface OpenHolding {
  pair: string
  asset: string
  buyDate: string
  originalQty: string
  remainingQty: string
  buyPrice: string
  remainingCostBasis: string
  remainingAllocatedBuyFee: string
  sourceCsvId: string
  buyTradeId: string
  status: 'Fully Unmatched Buy Lot' | 'Partially Matched Remaining Lot'
}

interface ReportData {
  reportId: string
  generatedAt: string
  sourceCsvFiles: string[]
  summary: ReportSummary
  realizedTrades: RealizedTrade[]
  openHoldings: OpenHolding[]
  warnings: UnmatchedSellWarning[]
  taxSummary: TaxSummary
}

// ── Chart color constants ──────────────────────────────────

const COLORS = {
  teal: '#14b8a6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  purple: '#8b5cf6',
  amber: '#f59e0b',
}

const DEDUCTION_COLORS = ['#f97316', '#8b5cf6', '#ef4444', '#14b8a6']

// ── Main Dashboard Component ───────────────────────────────

export default function DashboardPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()

  // ── State ──
  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d')

  // ── Fetch latest report ──
  const fetchReport = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false)
      return
    }
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

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // ── Process report action ──
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

  // ── ALL useMemo hooks called BEFORE any conditional returns ──

  // Filter realized trades by selected time frame
  const filteredTrades = useMemo(() => {
    if (!report?.realizedTrades?.length) return []
    const start = getTimeFrameStart(timeFrame)
    if (!start) return report.realizedTrades
    return report.realizedTrades.filter((t) => {
      const sellDate = new Date(t.sellDate)
      return sellDate >= start
    })
  }, [report, timeFrame])

  // Computed KPI values from filtered trades
  const kpiData = useMemo(() => {
    const trades = filteredTrades
    let grossProfit = toD(0)
    let totalFees = toD(0)
    let totalGstOnFees = toD(0)
    let totalTds = toD(0)
    let totalDirectTax = toD(0)
    let finalNetProfit = toD(0)

    for (const t of trades) {
      grossProfit = grossProfit.plus(toD(t.grossProfit))
      totalFees = totalFees.plus(toD(t.resolvedTotalFees || t.totalFees))
      totalGstOnFees = totalGstOnFees.plus(toD(t.resolvedGstOnFees || t.gstOnFees))
      totalTds = totalTds.plus(toD(t.resolvedTotalTds || t.tds))
      totalDirectTax = totalDirectTax.plus(toD(t.resolvedTotalDirectTax || t.totalDirectTax))
      finalNetProfit = finalNetProfit.plus(toD(t.resolvedFinalNetProfit || t.finalNetProfit))
    }

    const totalDeductions = totalFees.plus(totalGstOnFees).plus(totalDirectTax)

    return {
      finalNetProfit,
      grossProfit,
      totalDeductions,
      totalTds,
      realizedCount: trades.length,
      isProfit: finalNetProfit.greaterThan(0),
    }
  }, [filteredTrades])

  // Open holdings cost basis (latest snapshot — not date-filtered)
  const holdingsCostBasis = useMemo(() => {
    if (!report?.openHoldings?.length) return toD(0)
    return report.openHoldings.reduce((sum, h) => sum.plus(toD(h.remainingCostBasis)), toD(0))
  }, [report])

  // Profit trend data — group by date for the area chart
  const profitTrendData = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, { profit: number; date: string }>()
    for (const t of filteredTrades) {
      const date = new Date(t.sellDate)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const np = Number(t.resolvedFinalNetProfit || t.finalNetProfit || t.grossProfit || 0)
      const existing = grouped.get(key)
      if (existing) {
        existing.profit += np
      } else {
        grouped.set(key, { profit: np, date: key })
      }
    }
    return Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        profit: Math.round(d.profit * 100) / 100,
        label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      }))
  }, [filteredTrades])

  // Deduction snapshot data for donut chart
  const deductionData = useMemo(() => {
    const trades = filteredTrades
    let fees = toD(0)
    let gst = toD(0)
    let directTax = toD(0)
    let tds = toD(0)

    for (const t of trades) {
      fees = fees.plus(toD(t.resolvedTotalFees || t.totalFees))
      gst = gst.plus(toD(t.resolvedGstOnFees || t.gstOnFees))
      directTax = directTax.plus(toD(t.resolvedTotalDirectTax || t.totalDirectTax))
      tds = tds.plus(toD(t.resolvedTotalTds || t.tds))
    }

    const items = [
      { name: 'Fees', value: Number(fees), fill: DEDUCTION_COLORS[0] },
      { name: 'GST', value: Number(gst), fill: DEDUCTION_COLORS[1] },
      { name: 'Direct Tax', value: Number(directTax), fill: DEDUCTION_COLORS[2] },
    ]
    // Only include TDS if non-zero
    if (tds.gt(0)) {
      items.push({ name: 'TDS Withheld', value: Number(tds), fill: DEDUCTION_COLORS[3] })
    }

    return items.filter(i => i.value > 0)
  }, [filteredTrades])

  // Top 5 performing pairs by final net profit
  const topPairsData = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, number>()
    for (const t of filteredTrades) {
      const existing = grouped.get(t.pair) || 0
      grouped.set(t.pair, existing + Number(t.resolvedFinalNetProfit || t.finalNetProfit || t.grossProfit || 0))
    }
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pair, profit]) => ({
        pair,
        profit: Math.round(profit * 100) / 100,
        isProfit: profit >= 0,
      }))
  }, [filteredTrades])

  // Recent 5 realized trades
  const recentTrades = useMemo(() => {
    if (!filteredTrades.length) return []
    return [...filteredTrades]
      .sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime())
      .slice(0, 5)
  }, [filteredTrades])

  // Top 5 open holdings by cost basis
  const topHoldings = useMemo(() => {
    if (!report?.openHoldings?.length) return []
    return [...report.openHoldings]
      .sort((a, b) => toD(b.remainingCostBasis).minus(toD(a.remainingCostBasis)).toNumber())
      .slice(0, 5)
  }, [report])

  // Alert counts
  const alertCounts = useMemo(() => {
    const unmatchedSells = report?.warnings?.length || 0
    const hasFeeFallback = filteredTrades.some(
      (t) => t.buyFeeSource === 'DEFAULT' || t.sellFeeSource === 'DEFAULT'
    )
    return {
      unmatchedSells,
      hasFeeFallback,
      total: unmatchedSells + (hasFeeFallback ? 1 : 0),
    }
  }, [report, filteredTrades])

  const hasReport = !!report

  // ── Conditional returns after all hooks ──

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select or create a workspace to view your dashboard.
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
      {/* ══════════════════════════════════════════════════════
          ROW 1: Time Frame Selector
          ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Quick overview of your portfolio performance
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto shrink-0 -mx-1 px-1 sm:mx-0 sm:px-1">
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
      </div>

      {/* ══════════════════════════════════════════════════════
          No Report Empty State
          ══════════════════════════════════════════════════════ */}
      {!hasReport && (
        <Card className="rounded-2xl border-dashed border-border">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
              <Upload className="h-7 w-7 text-teal-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Report Available</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Upload your CSV trade data and process a report to see your dashboard metrics.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setCurrentPage('upload')}
                className="bg-teal-500 hover:bg-teal-600 text-white"
                size="sm"
              >
                <Upload className="h-4 w-4 mr-1.5" /> Upload CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleProcessReport}
                disabled={isProcessing}
                size="sm"
              >
                {isProcessing ? 'Processing...' : 'Process Report'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════
          ROW 2: Primary Summary KPI Cards
          Mobile: Hero profit card + 2-col mini cards
          Desktop: Single row of 6 compact cards
          ══════════════════════════════════════════════════════ */}

      {/* Mobile Hero: Final Net Profit (visible only on small screens) */}
      <Card className="rounded-xl border-border shadow-sm bg-gradient-to-br from-teal-500/[0.06] to-transparent sm:hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-muted-foreground">Final Net Profit</span>
            {hasReport && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                kpiData.isProfit
                  ? 'border-green-500/30 text-green-600 dark:text-green-400'
                  : 'border-red-500/30 text-red-600 dark:text-red-400'
              }`}>
                {kpiData.isProfit ? (
                  <><ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />PROFIT</>
                ) : (
                  <><ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />LOSS</>
                )}
              </Badge>
            )}
          </div>
          <span className={`text-2xl font-bold tracking-tight ${kpiData.isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {hasReport ? formatINR(kpiData.finalNetProfit) : '--'}
          </span>
          <p className="text-xs text-muted-foreground mt-1.5">
            Gross: <span className="font-medium text-foreground">{hasReport ? formatINR(kpiData.grossProfit) : '--'}</span>
            {' · '}
            Deductions: <span className="font-medium text-foreground">{hasReport ? formatINR(kpiData.totalDeductions) : '--'}</span>
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Final Net Profit — Desktop card (hidden on mobile) */}
        <Card className="rounded-xl border-border shadow-sm hidden sm:block bg-gradient-to-br from-teal-500/[0.04] to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                <IndianRupee className="h-4 w-4 text-teal-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Final Net Profit</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-bold tracking-tight ${kpiData.isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {hasReport ? formatINR(kpiData.finalNetProfit) : '--'}
              </span>
              {hasReport && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                  kpiData.isProfit
                    ? 'border-green-500/30 text-green-600 dark:text-green-400'
                    : 'border-red-500/30 text-red-600 dark:text-red-400'
                }`}>
                  {kpiData.isProfit ? (
                    <><ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />PROFIT</>
                  ) : (
                    <><ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />LOSS</>
                  )}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Gross Profit */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Gross Profit</span>
            </div>
            <span className="text-base font-bold tracking-tight">
              {hasReport ? formatINR(kpiData.grossProfit) : '--'}
            </span>
          </CardContent>
        </Card>

        {/* 3. Total Deductions */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                <Receipt className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Total Deductions</span>
            </div>
            <span className="text-base font-bold tracking-tight">
              {hasReport ? formatINR(kpiData.totalDeductions) : '--'}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Fees + GST + Direct Tax</p>
          </CardContent>
        </Card>

        {/* 4. TDS Withheld */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <ShieldCheck className="h-4 w-4 text-purple-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">TDS Withheld</span>
            </div>
            <span className="text-base font-bold tracking-tight">
              {hasReport ? formatINR(kpiData.totalTds) : '--'}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tax credit available</p>
          </CardContent>
        </Card>

        {/* 5. Open Holdings Cost Basis */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                <Wallet className="h-4 w-4 text-teal-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Open Holdings</span>
            </div>
            <span className="text-base font-bold tracking-tight">
              {hasReport ? formatINR(holdingsCostBasis) : '--'}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hasReport ? `${report.openHoldings.length} lot${report.openHoldings.length !== 1 ? 's' : ''} open` : 'Cost basis'}
            </p>
          </CardContent>
        </Card>

        {/* 6. Realized Trades Count */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <ArrowLeftRight className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Realized Trades</span>
            </div>
            <span className="text-base font-bold tracking-tight">
              {hasReport ? kpiData.realizedCount : '--'}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">In selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 3: Profit Trend + Deduction Snapshot
          ══════════════════════════════════════════════════════ */}
      {hasReport && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* A. Profit Trend — Area Chart */}
          <Card className="rounded-xl border-border shadow-sm lg:col-span-3">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Profit Trend</CardTitle>
                  <CardDescription className="text-xs">Final Net Profit over time</CardDescription>
                </div>
                {kpiData.realizedCount > 0 && (
                  <Badge variant="outline" className="text-[10px] px-2">
                    {kpiData.realizedCount} trades
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {profitTrendData.length > 0 ? (
                <ChartContainer
                  config={{
                    profit: { label: 'Net Profit', color: COLORS.teal },
                  }}
                  className="h-[220px] w-full"
                >
                  <AreaChart data={profitTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={COLORS.teal}
                      fill="url(#profitGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <EmptyChart message="No trades in selected period" />
              )}
            </CardContent>
          </Card>

          {/* B. Deduction Snapshot — Donut Chart */}
          <Card className="rounded-xl border-border shadow-sm lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Deduction Snapshot</CardTitle>
              <CardDescription className="text-xs">Where your gains were reduced</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {deductionData.length > 0 ? (
                <ChartContainer
                  config={{
                    Fees: { label: 'Fees', color: DEDUCTION_COLORS[0] },
                    GST: { label: 'GST', color: DEDUCTION_COLORS[1] },
                    'Direct Tax': { label: 'Direct Tax', color: DEDUCTION_COLORS[2] },
                    'TDS Withheld': { label: 'TDS Withheld', color: DEDUCTION_COLORS[3] },
                  }}
                  className="h-[220px] w-full"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                      data={deductionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {deductionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <EmptyChart message="No deductions in selected period" />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ROW 4: Top Performing Pairs + Alerts & Data Quality
          ══════════════════════════════════════════════════════ */}
      {hasReport && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* A. Top Performing Pairs */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Top Performing Pairs</CardTitle>
                  <CardDescription className="text-xs">By Final Net Profit</CardDescription>
                </div>
                <button
                  onClick={() => setCurrentPage('analytics')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-500 hover:text-teal-600 transition-colors"
                >
                  View All <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {topPairsData.length > 0 ? (
                <div className="space-y-3">
                  {topPairsData.map((item, i) => {
                    const maxProfit = Math.max(...topPairsData.map(p => Math.abs(p.profit)), 1)
                    const barWidth = Math.max((Math.abs(item.profit) / maxProfit) * 100, 4)
                    return (
                      <div key={item.pair} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-mono w-4 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{item.pair}</span>
                            <span className={`text-sm font-semibold tabular-nums ml-2 ${item.isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {formatINR(toD(item.profit))}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${item.isProfit ? 'bg-teal-500' : 'bg-red-400'}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No trades in selected period</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* B. Alerts & Data Quality */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Alerts & Data Quality</CardTitle>
                  <CardDescription className="text-xs">Important audit issues</CardDescription>
                </div>
                {alertCounts.total > 0 && (
                  <Badge variant="outline" className="border-orange-500/30 text-orange-600 text-[10px] px-2">
                    {alertCounts.total} issue{alertCounts.total !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {alertCounts.total > 0 ? (
                <div className="space-y-2.5">
                  {alertCounts.unmatchedSells > 0 && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <FileWarning className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Unmatched Sells</p>
                        <p className="text-xs text-muted-foreground">
                          {alertCounts.unmatchedSells} sell trade{alertCounts.unmatchedSells !== 1 ? 's' : ''} without earlier BUY lots
                        </p>
                      </div>
                      <Badge variant="outline" className="border-orange-500/30 text-orange-600 text-[10px] shrink-0">
                        {alertCounts.unmatchedSells}
                      </Badge>
                    </div>
                  )}
                  {alertCounts.hasFeeFallback && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <HelpCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Default Fee Used</p>
                        <p className="text-xs text-muted-foreground">
                          Some trades used exchange default fees instead of CSV data
                        </p>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setCurrentPage('realized-trades')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-500 hover:text-teal-600 transition-colors mt-1"
                  >
                    View Details <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500/40 mb-2" />
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">No major data issues detected</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your report data looks clean</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ROW 5: Recent Realized Trades + Open Holdings Snapshot
          ══════════════════════════════════════════════════════ */}
      {hasReport && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* A. Recent Realized Trades Preview */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Recent Realized Trades</CardTitle>
                <button
                  onClick={() => setCurrentPage('realized-trades')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-500 hover:text-teal-600 transition-colors"
                >
                  View All Trades <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {recentTrades.length > 0 ? (
                <div className="space-y-1">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_90px_90px_55px] gap-2 pb-1.5 border-b border-border/50 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    <span>Pair</span>
                    <span className="text-right">Sell Date</span>
                    <span className="text-right">Net Profit</span>
                    <span className="text-right">Status</span>
                  </div>
                  <div className="space-y-0.5">
                    {recentTrades.map((trade) => {
                      const profit = toD(trade.resolvedFinalNetProfit || trade.finalNetProfit || trade.grossProfit)
                      const isTradeProfit = profit.greaterThan(0)
                      const status = trade.resolvedProfitLossStatus || trade.status || (isTradeProfit ? 'PROFIT' : 'LOSS')
                      return (
                        <div
                          key={trade.buyTradeId + '-' + trade.sellTradeId}
                          className="grid grid-cols-[1fr_90px_90px_55px] gap-2 py-2 px-1 rounded-lg hover:bg-accent/50 transition-colors items-center"
                        >
                          <span className="font-medium truncate text-xs">{trade.pair}</span>
                          <span className="text-xs text-muted-foreground text-right">
                            {new Date(trade.sellDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className={`text-xs font-semibold text-right ${isTradeProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatINR(profit)}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 justify-self-end ${
                              status === 'PROFIT'
                                ? 'border-green-500/30 text-green-600 dark:text-green-400'
                                : 'border-red-500/30 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {status}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <ArrowLeftRight className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No trades in selected period</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* B. Open Holdings Snapshot */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Open Holdings Snapshot</CardTitle>
                <button
                  onClick={() => setCurrentPage('open-holdings')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-500 hover:text-teal-600 transition-colors"
                >
                  View All Holdings <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {topHoldings.length > 0 ? (
                <div className="space-y-1">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_80px_90px] gap-2 pb-1.5 border-b border-border/50 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    <span>Pair</span>
                    <span className="text-right">Remaining Qty</span>
                    <span className="text-right">Cost Basis</span>
                  </div>
                  <div className="space-y-0.5">
                    {topHoldings.map((holding) => (
                      <div
                        key={holding.buyTradeId}
                        className="grid grid-cols-[1fr_80px_90px] gap-2 py-2 px-1 rounded-lg hover:bg-accent/50 transition-colors items-center"
                      >
                        <div className="min-w-0">
                          <span className="font-medium truncate text-xs block">{holding.pair}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {holding.status === 'Partially Matched Remaining Lot' ? 'Partial' : 'Full lot'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground text-right tabular-nums">
                          {formatQty(toD(holding.remainingQty))}
                        </span>
                        <span className="text-xs font-semibold text-right tabular-nums">
                          {formatINR(toD(holding.remainingCostBasis))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No open holdings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Error State ── */}
      {error && (
        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={fetchReport} className="mt-3" size="sm">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-center">
      <BarChart3 className="h-8 w-8 text-muted-foreground/25 mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 pb-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-28 rounded" />
          <Skeleton className="h-4 w-52 rounded mt-1.5" />
        </div>
        <Skeleton className="h-9 w-[360px] rounded-lg hidden sm:block" />
        <Skeleton className="h-9 w-full rounded-lg sm:hidden" />
      </div>
      {/* Mobile hero skeleton */}
      <Skeleton className="h-24 rounded-xl sm:hidden" />
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Skeleton className="h-[88px] rounded-xl hidden sm:block" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
        <Skeleton className="h-[88px] rounded-xl sm:hidden" />
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="h-[300px] rounded-xl lg:col-span-3" />
        <Skeleton className="h-[300px] rounded-xl lg:col-span-2" />
      </div>
      {/* Second row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[240px] rounded-xl" />
        <Skeleton className="h-[240px] rounded-xl" />
      </div>
      {/* Third row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
    </div>
  )
}
