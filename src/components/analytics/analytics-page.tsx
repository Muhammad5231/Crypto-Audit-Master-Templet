'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Analytics Page (v2 — Deep Analysis)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Premium analytics page with:
//   1. Time Frame Selector + Pair/Exchange Filters
//   2. KPI Summary Cards (6)
//   3. Profit Over Time (cumulative area) + Realized Profit Trend (bar)
//   4. Top Profitable Pairs + Top Loss-Making Pairs
//   5. Deductions Breakdown (donut) + Gross→Final Net Waterfall
//   6. Win vs Loss Ratio + Average Trade Outcome
//   7. Trade Count by Pair + Profit Efficiency by Pair
//   8. Open Holdings Allocation (donut) + Cost Distribution (bar)
//   9. Insight Cards (6)
//  10. Mobile: 1-chart-per-card layout with bottom sheet filters
//  11. Empty / Error states
//
// Data source: GET /api/workspaces/:workspaceId/reports/latest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet } from '@/lib/api-client'
import { toD, formatINR, formatQty } from '@/lib/decimal'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import {
  BarChart3, TrendingUp, IndianRupee, Receipt, Target,
  Wallet, ArrowUpRight, ArrowDownRight, Minus, Upload,
  RotateCcw, Calendar, Filter, RefreshCw, HelpCircle,
  Trophy, AlertTriangle, Flame, Percent, Activity, PieChart as PieIcon,
} from 'lucide-react'

// ── Time Frame Types ───────────────────────────────────────

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
  effectiveTaxRate: string
  avgProfitPerTrade: string
  avgLossPerTrade: string
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

interface OpenHolding {
  pair: string
  asset: string
  exchange?: string
  remainingQty: string
  remainingCostBasis: string
  [key: string]: unknown
}

interface ReportData {
  reportId: string
  generatedAt: string
  summary: {
    totalHoldingValue: string
    [key: string]: unknown
  }
  realizedTrades: RealizedTrade[]
  openHoldings: OpenHolding[]
  warnings: unknown[]
  taxSummary: TaxSummary
}

// ── Chart Colors ───────────────────────────────────────────

const COLORS = {
  teal: '#14b8a6',
  tealLight: '#5eead4',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f97316',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  blue: '#3b82f6',
  pink: '#ec4899',
  emerald: '#10b981',
}

const PAIR_COLORS = [
  COLORS.teal, COLORS.orange, COLORS.purple, COLORS.blue,
  COLORS.pink, COLORS.amber, COLORS.green, COLORS.red,
  COLORS.emerald, COLORS.tealLight,
]

const DEDUCTION_COLORS = [COLORS.orange, COLORS.purple, COLORS.red, COLORS.teal]

// ── Helper: resolved value with fallback ───────────────────

function rv(resolved: string | undefined, fallback: string | number, zeroDefault = '0'): string {
  const v = resolved || fallback || zeroDefault
  return v.toString()
}

// ── Grouping helper for time-aware charts ──────────────────

type GroupMode = 'daily' | 'weekly' | 'monthly' | 'quarterly'

function getGroupMode(tf: TimeFrame): GroupMode {
  switch (tf) {
    case '7d': case '30d': return 'daily'
    case '90d': return 'weekly'
    case '6m': case '1y': return 'monthly'
    case 'all': return 'monthly'
    case 'custom': return 'monthly'
    default: return 'monthly'
  }
}

function getGroupKey(date: Date, mode: GroupMode): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')

  switch (mode) {
    case 'daily': return `${y}-${m}-${d}`
    case 'weekly': {
      const jan1 = new Date(y, 0, 1)
      const weekNum = Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
      return `${y}-W${String(weekNum).padStart(2, '0')}`
    }
    case 'monthly': return `${y}-${m}`
    case 'quarterly': return `${y}-Q${Math.ceil((date.getMonth() + 1) / 3)}`
  }
}

function formatGroupLabel(key: string, mode: GroupMode): string {
  try {
    if (mode === 'daily') {
      const d = new Date(key + 'T00:00:00')
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }
    if (mode === 'monthly') {
      const [y, m] = key.split('-')
      const d = new Date(Number(y), Number(m) - 1)
      return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    }
    if (mode === 'weekly') return key
    if (mode === 'quarterly') return key
    return key
  } catch {
    return key
  }
}

// ── Main Component ─────────────────────────────────────────

export default function AnalyticsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()

  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [exchangeFilter, setExchangeFilter] = useState<string>('all')

  // Mobile filter sheet
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Pair performance sort toggle
  const [pairSortMode, setPairSortMode] = useState<'finalNetProfit' | 'grossProfit' | 'tradeCount'>('finalNetProfit')

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

  // ── Unique pairs & exchanges ──
  const uniquePairs = useMemo(() => {
    if (!report?.realizedTrades) return []
    return Array.from(new Set(report.realizedTrades.map((t) => t.pair))).sort()
  }, [report])

  const uniqueExchanges = useMemo(() => {
    if (!report?.realizedTrades) return []
    const exchanges = new Set(
      report.realizedTrades.map((t) => t.exchange).filter((e): e is string => !!e && e !== '--')
    )
    return Array.from(exchanges).sort()
  }, [report])

  // ── Filtered trades by time, pair, exchange ──
  const filteredTrades = useMemo(() => {
    if (!report?.realizedTrades) return []
    let trades = report.realizedTrades

    // Time filter
    if (timeFrame === 'custom' && customFrom) {
      const from = new Date(customFrom)
      trades = trades.filter((t) => new Date(t.sellDate) >= from)
    } else if (timeFrame !== 'custom') {
      const start = getTimeFrameStart(timeFrame)
      if (start) {
        trades = trades.filter((t) => new Date(t.sellDate) >= start)
      }
    }
    if (timeFrame === 'custom' && customTo) {
      const to = new Date(customTo)
      to.setHours(23, 59, 59, 999)
      trades = trades.filter((t) => new Date(t.sellDate) <= to)
    }

    // Pair filter
    if (pairFilter !== 'all') {
      trades = trades.filter((t) => t.pair === pairFilter)
    }

    // Exchange filter
    if (exchangeFilter !== 'all') {
      trades = trades.filter((t) => (t.exchange || '--') === exchangeFilter)
    }

    return trades
  }, [report, timeFrame, customFrom, customTo, pairFilter, exchangeFilter])

  // ── Filtered open holdings ──
  const filteredHoldings = useMemo(() => {
    if (!report?.openHoldings) return []
    if (pairFilter !== 'all') return report.openHoldings.filter((h) => h.pair === pairFilter)
    return report.openHoldings
  }, [report, pairFilter])

  // ── Group mode based on timeframe ──
  const groupMode = useMemo(() => getGroupMode(timeFrame), [timeFrame])

  // ── KPI data ──
  const kpiData = useMemo(() => {
    let grossProfit = toD(0)
    let finalNetProfit = toD(0)
    let totalFees = toD(0)
    let totalGst = toD(0)
    let totalTds = toD(0)
    let totalTax = toD(0)
    let wins = 0
    let losses = 0

    for (const t of filteredTrades) {
      grossProfit = grossProfit.plus(toD(t.grossProfit))
      finalNetProfit = finalNetProfit.plus(toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit)))
      totalFees = totalFees.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
      totalGst = totalGst.plus(toD(rv(t.resolvedGstOnFees, t.gstOnFees)))
      totalTds = totalTds.plus(toD(rv(t.resolvedTotalTds, t.tds)))
      totalTax = totalTax.plus(toD(rv(t.resolvedTotalDirectTax, t.totalDirectTax)))

      const fnp = toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      if (fnp.greaterThan(0)) wins++
      else if (fnp.lessThan(0)) losses++
    }

    const totalDeductions = totalFees.plus(totalGst).plus(totalTds).plus(totalTax)
    const totalTrades = filteredTrades.length
    const avgProfitPerTrade = totalTrades > 0 ? finalNetProfit.div(totalTrades) : toD(0)
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0

    // Best performing pair
    const pairProfits = new Map<string, ReturnType<typeof toD>>()
    for (const t of filteredTrades) {
      const existing = pairProfits.get(t.pair) || toD(0)
      pairProfits.set(t.pair, existing.plus(toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit))))
    }
    let bestPair = '--'
    let bestPairProfit = toD(0)
    pairProfits.forEach((profit, pair) => {
      if (profit.greaterThan(bestPairProfit)) {
        bestPair = pair
        bestPairProfit = profit
      }
    })

    return {
      finalNetProfit, grossProfit, totalDeductions, totalTds,
      totalTrades, avgProfitPerTrade, winRate, bestPair,
      wins, losses, totalTax,
    }
  }, [filteredTrades])

  // ── Chart: Profit Over Time (cumulative area) ──
  const profitOverTimeData = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, number>()
    for (const t of filteredTrades) {
      const date = new Date(t.sellDate)
      const key = getGroupKey(date, groupMode)
      const np = Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      grouped.set(key, (grouped.get(key) || 0) + np)
    }
    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
    let cumulative = 0
    return sorted.map(([key, periodProfit]) => {
      cumulative += periodProfit
      return {
        key,
        label: formatGroupLabel(key, groupMode),
        cumulative: Math.round(cumulative * 100) / 100,
      }
    })
  }, [filteredTrades, groupMode])

  // ── Chart: Realized Profit Trend (bar, positive/negative) ──
  const realizedProfitTrendData = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, number>()
    for (const t of filteredTrades) {
      const date = new Date(t.sellDate)
      const key = getGroupKey(date, groupMode)
      const np = Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      grouped.set(key, (grouped.get(key) || 0) + np)
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, netProfit]) => ({
        key,
        label: formatGroupLabel(key, groupMode),
        netProfit: Math.round(netProfit * 100) / 100,
      }))
  }, [filteredTrades, groupMode])

  // ── Chart: Top Profitable Pairs ──
  const topProfitablePairs = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, { finalNetProfit: number; grossProfit: number; count: number }>()
    for (const t of filteredTrades) {
      const existing = grouped.get(t.pair) || { finalNetProfit: 0, grossProfit: 0, count: 0 }
      existing.finalNetProfit += Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      existing.grossProfit += Number(t.grossProfit)
      existing.count++
      grouped.set(t.pair, existing)
    }
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => {
        if (pairSortMode === 'grossProfit') return b.grossProfit - a.grossProfit
        if (pairSortMode === 'tradeCount') return b.count - a.count
        return b.finalNetProfit - a.finalNetProfit
      })
      .slice(0, 10)
      .map(([pair, data]) => ({
        pair,
        value: Math.round((pairSortMode === 'grossProfit' ? data.grossProfit : pairSortMode === 'tradeCount' ? data.count : data.finalNetProfit) * 100) / 100,
        finalNetProfit: Math.round(data.finalNetProfit * 100) / 100,
        grossProfit: Math.round(data.grossProfit * 100) / 100,
        count: data.count,
      }))
  }, [filteredTrades, pairSortMode])

  // ── Chart: Top Loss-Making Pairs ──
  const topLossPairs = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, number>()
    for (const t of filteredTrades) {
      const np = Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      grouped.set(t.pair, (grouped.get(t.pair) || 0) + np)
    }
    return Array.from(grouped.entries())
      .filter(([, profit]) => profit < 0)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 10)
      .map(([pair, profit]) => ({
        pair,
        loss: Math.round(profit * 100) / 100,
      }))
  }, [filteredTrades])

  // ── Chart: Deductions Breakdown (donut) ──
  const deductionsBreakdownData = useMemo(() => {
    if (!filteredTrades.length) return []
    let fees = toD(0), gst = toD(0), tds = toD(0), tax = toD(0)
    for (const t of filteredTrades) {
      fees = fees.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
      gst = gst.plus(toD(rv(t.resolvedGstOnFees, t.gstOnFees)))
      tds = tds.plus(toD(rv(t.resolvedTotalTds, t.tds)))
      tax = tax.plus(toD(rv(t.resolvedTotalDirectTax, t.totalDirectTax)))
    }
    return [
      { name: 'Fees', value: Number(fees), fill: DEDUCTION_COLORS[0] },
      { name: 'GST on Fees', value: Number(gst), fill: DEDUCTION_COLORS[1] },
      { name: 'Total Tax', value: Number(tax), fill: DEDUCTION_COLORS[2] },
      { name: 'TDS Withheld', value: Number(tds), fill: DEDUCTION_COLORS[3] },
    ].filter((i) => i.value > 0)
  }, [filteredTrades])

  // ── Chart: Gross→Final Net Waterfall ──
  const waterfallData = useMemo(() => {
    if (!filteredTrades.length) return []
    let grossProfit = toD(0), fees = toD(0), gst = toD(0), tds = toD(0), tax = toD(0), finalNet = toD(0)
    for (const t of filteredTrades) {
      grossProfit = grossProfit.plus(toD(t.grossProfit))
      fees = fees.plus(toD(rv(t.resolvedTotalFees, t.totalFees)))
      gst = gst.plus(toD(rv(t.resolvedGstOnFees, t.gstOnFees)))
      tds = tds.plus(toD(rv(t.resolvedTotalTds, t.tds)))
      tax = tax.plus(toD(rv(t.resolvedTotalDirectTax, t.totalDirectTax)))
      finalNet = finalNet.plus(toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit)))
    }
    return [
      { name: 'Gross Profit', value: Number(grossProfit), fill: COLORS.green },
      { name: 'Fees', value: -Number(fees), fill: COLORS.orange },
      { name: 'GST', value: -Number(gst), fill: COLORS.purple },
      { name: 'TDS', value: -Number(tds), fill: COLORS.teal },
      { name: 'Total Tax', value: -Number(tax), fill: COLORS.red },
      { name: 'Final Net Profit', value: Number(finalNet), fill: COLORS.teal },
    ]
  }, [filteredTrades])

  // ── Chart: Win/Loss Ratio (donut) ──
  const winLossData = useMemo(() => {
    if (kpiData.wins === 0 && kpiData.losses === 0) return []
    const data = []
    if (kpiData.wins > 0) data.push({ name: 'Winning', value: kpiData.wins, fill: COLORS.green })
    if (kpiData.losses > 0) data.push({ name: 'Losing', value: kpiData.losses, fill: COLORS.red })
    return data
  }, [kpiData])

  // ── Chart: Average Trade Outcome ──
  const avgOutcomeData = useMemo(() => {
    let winProfit = toD(0), lossAmount = toD(0)
    let winCount = 0, lossCount = 0
    for (const t of filteredTrades) {
      const fnp = toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      if (fnp.greaterThan(0)) { winProfit = winProfit.plus(fnp); winCount++ }
      else if (fnp.lessThan(0)) { lossAmount = lossAmount.plus(fnp.abs()); lossCount++ }
    }
    return {
      avgWin: winCount > 0 ? winProfit.div(winCount) : toD(0),
      avgLoss: lossCount > 0 ? lossAmount.div(lossCount) : toD(0),
      avgOverall: kpiData.avgProfitPerTrade,
    }
  }, [filteredTrades, kpiData])

  // ── Chart: Trade Count by Pair ──
  const tradeCountByPairData = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, number>()
    for (const t of filteredTrades) {
      grouped.set(t.pair, (grouped.get(t.pair) || 0) + 1)
    }
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pair, count]) => ({ pair, count }))
  }, [filteredTrades])

  // ── Chart: Profit Efficiency by Pair ──
  const profitEfficiencyData = useMemo(() => {
    if (!filteredTrades.length) return []
    const grouped = new Map<string, { totalProfit: number; totalSellValue: number; count: number }>()
    for (const t of filteredTrades) {
      const existing = grouped.get(t.pair) || { totalProfit: 0, totalSellValue: 0, count: 0 }
      existing.totalProfit += Number(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      existing.totalSellValue += Number(t.sellValue)
      existing.count++
      grouped.set(t.pair, existing)
    }
    return Array.from(grouped.entries())
      .map(([pair, data]) => ({
        pair,
        efficiency: data.totalSellValue > 0
          ? Math.round((data.totalProfit / data.totalSellValue) * 10000) / 100
          : 0,
        totalProfit: Math.round(data.totalProfit * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => b.efficiency - a.efficiency)
      .slice(0, 10)
  }, [filteredTrades])

  // ── Chart: Open Holdings Allocation (donut by pair) ──
  const holdingsAllocationData = useMemo(() => {
    if (!filteredHoldings.length) return []
    const grouped = new Map<string, number>()
    for (const h of filteredHoldings) {
      grouped.set(h.pair, (grouped.get(h.pair) || 0) + Number(h.remainingCostBasis || 0))
    }
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([pair, value], index) => ({
        name: pair,
        value: Math.round(value * 100) / 100,
        fill: PAIR_COLORS[index % PAIR_COLORS.length],
      }))
  }, [filteredHoldings])

  // ── Chart: Open Holdings Cost Distribution (horizontal bar) ──
  const holdingsCostData = useMemo(() => {
    if (!filteredHoldings.length) return []
    const grouped = new Map<string, { costBasis: number; qty: number }>()
    for (const h of filteredHoldings) {
      const existing = grouped.get(h.pair) || { costBasis: 0, qty: 0 }
      existing.costBasis += Number(h.remainingCostBasis || 0)
      existing.qty += Number(h.remainingQty || 0)
      grouped.set(h.pair, existing)
    }
    return Array.from(grouped.entries())
      .sort(([, a], [, b]) => b.costBasis - a.costBasis)
      .slice(0, 10)
      .map(([pair, data]) => ({
        pair,
        costBasis: Math.round(data.costBasis * 100) / 100,
        qty: Math.round(data.qty * 10000) / 10000,
      }))
  }, [filteredHoldings])

  // ── Insight Cards ──
  const insights = useMemo(() => {
    if (!filteredTrades.length) return []
    let highestProfit = toD(0), highestProfitPair = '--'
    let highestLoss = toD(0), highestLossPair = '--'
    let mostTradedPair = '--', mostTradedCount = 0
    const pairFees = new Map<string, number>()
    const pairTax = new Map<string, number>()
    const pairWinLoss = new Map<string, { wins: number; total: number }>()

    for (const t of filteredTrades) {
      const fnp = toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit))
      if (fnp.greaterThan(highestProfit)) { highestProfit = fnp; highestProfitPair = t.pair }
      if (fnp.lessThan(highestLoss.negated())) { highestLoss = fnp.abs(); highestLossPair = t.pair }

      const wl = pairWinLoss.get(t.pair) || { wins: 0, total: 0 }
      wl.total++
      if (fnp.greaterThan(0)) wl.wins++
      pairWinLoss.set(t.pair, wl)

      const tradeCount = (pairWinLoss.get(t.pair)?.total || 0)
      if (tradeCount > mostTradedCount) { mostTradedPair = t.pair; mostTradedCount = tradeCount }

      pairFees.set(t.pair, (pairFees.get(t.pair) || 0) + Number(rv(t.resolvedTotalFees, t.totalFees)))
      pairTax.set(t.pair, (pairTax.get(t.pair) || 0) + Number(rv(t.resolvedTotalDirectTax, t.totalDirectTax)))
    }

    let highestFeePair = '--', highestFeeAmount = 0
    pairFees.forEach((amt, pair) => { if (amt > highestFeeAmount) { highestFeePair = pair; highestFeeAmount = amt } })

    let highestTaxPair = '--', highestTaxAmount = 0
    pairTax.forEach((amt, pair) => { if (amt > highestTaxAmount) { highestTaxPair = pair; highestTaxAmount = amt } })

    let bestWinRatePair = '--', bestWinRate = 0
    pairWinLoss.forEach((data, pair) => {
      const rate = data.total > 0 ? data.wins / data.total : 0
      if (rate > bestWinRate && data.total >= 2) { bestWinRate = rate; bestWinRatePair = pair }
    })

    return [
      { label: 'Highest Profit Trade', value: formatINR(highestProfit), sub: highestProfitPair, icon: Trophy, color: 'text-green-500 bg-green-500/10' },
      { label: 'Highest Loss Trade', value: formatINR(highestLoss), sub: highestLossPair, icon: AlertTriangle, color: 'text-red-500 bg-red-500/10' },
      { label: 'Most Traded Pair', value: mostTradedPair, sub: `${mostTradedCount} trades`, icon: Activity, color: 'text-teal-500 bg-teal-500/10' },
      { label: 'Pair with Highest Fees', value: highestFeePair, sub: formatINR(toD(highestFeeAmount)), icon: Receipt, color: 'text-orange-500 bg-orange-500/10' },
      { label: 'Pair with Highest Tax', value: highestTaxPair, sub: formatINR(toD(highestTaxAmount)), icon: IndianRupee, color: 'text-purple-500 bg-purple-500/10' },
      { label: 'Best Win Rate Pair', value: bestWinRatePair, sub: `${Math.round(bestWinRate * 100)}%`, icon: Percent, color: 'text-emerald-500 bg-emerald-500/10' },
    ]
  }, [filteredTrades])

  // ── Reset filters ──
  const resetFilters = useCallback(() => {
    setTimeFrame('30d')
    setCustomFrom('')
    setCustomTo('')
    setPairFilter('all')
    setExchangeFilter('all')
  }, [])

  // ── Loading ──
  if (isLoading) return <AnalyticsSkeleton />

  // ── No workspace ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <BarChart3 className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">Select a workspace to view analytics.</p>
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
        <h2 className="text-xl font-bold">Failed to load analytics</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button variant="outline" onClick={fetchReport} className="mt-4">Retry</Button>
      </div>
    )
  }

  // ── No data ──
  if (!report || !report.realizedTrades || report.realizedTrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <BarChart3 className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No analytics available yet.</h2>
        <p className="text-muted-foreground mt-2 max-w-md">Process your trade report to unlock performance analysis.</p>
        <Button onClick={() => setCurrentPage('upload')} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white">
          <Upload className="h-4 w-4 mr-2" /> Upload CSV
        </Button>
      </div>
    )
  }

  // ── No filtered results ──
  if (filteredTrades.length === 0) {
    return (
      <div className="space-y-5">
        <FilterBar
          timeFrame={timeFrame} setTimeFrame={setTimeFrame}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          pairFilter={pairFilter} setPairFilter={setPairFilter}
          exchangeFilter={exchangeFilter} setExchangeFilter={setExchangeFilter}
          uniquePairs={uniquePairs} uniqueExchanges={uniqueExchanges}
          onReset={resetFilters} onRefresh={fetchReport}
        />
        <Card className="rounded-xl border-border">
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No data found for selected filters.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
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
      <div className="space-y-4 pb-6">
        {/* Mobile Header */}
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deeply analyze trade performance, profit trends, deductions, and holdings.
          </p>
        </div>

        {/* Mobile Time Frame + Filters */}
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
                <SheetDescription>Filter analytics data</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <MobileFilterControls
                  pairFilter={pairFilter} setPairFilter={setPairFilter}
                  exchangeFilter={exchangeFilter} setExchangeFilter={setExchangeFilter}
                  customFrom={customFrom} setCustomFrom={setCustomFrom}
                  customTo={customTo} setCustomTo={setCustomTo}
                  uniquePairs={uniquePairs} uniqueExchanges={uniqueExchanges}
                  onReset={resetFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Mobile KPI Cards — 2x3 grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Final Net Profit', value: formatINR(kpiData.finalNetProfit), icon: IndianRupee, color: kpiData.finalNetProfit.gte(0) ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10' },
            { label: 'Gross Profit', value: formatINR(kpiData.grossProfit), icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: 'Avg Profit / Trade', value: formatINR(kpiData.avgProfitPerTrade), icon: Activity, color: 'text-teal-500 bg-teal-500/10' },
            { label: 'Win Rate', value: `${kpiData.winRate.toFixed(1)}%`, icon: Percent, color: 'text-green-500 bg-green-500/10' },
            { label: 'Best Pair', value: kpiData.bestPair, icon: Trophy, color: 'text-amber-500 bg-amber-500/10' },
            { label: 'Total Deductions', value: formatINR(kpiData.totalDeductions), icon: Receipt, color: 'text-orange-500 bg-orange-500/10' },
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

        {/* Mobile Charts — one per full-width card */}
        {/* 1. Profit Over Time */}
        <ChartCard title="Profit Over Time" description="Cumulative Final Net Profit trend" config={{ cumulative: { label: 'Cumulative Profit', color: COLORS.teal } }}>
          {profitOverTimeData.length > 0 ? (
            <AreaChart data={profitOverTimeData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs><linearGradient id="mProfitGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.2} /><stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} width={50} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="cumulative" stroke={COLORS.teal} fill="url(#mProfitGrad)" strokeWidth={2} />
            </AreaChart>
          ) : <EmptyChart />}
        </ChartCard>

        {/* 2. Realized Profit Trend */}
        <ChartCard title="Realized Profit Trend" description="Period-wise Final Net Profit" config={{ netProfit: { label: 'Net Profit', color: COLORS.teal } }}>
          {realizedProfitTrendData.length > 0 ? (
            <BarChart data={realizedProfitTrendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} width={50} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                {realizedProfitTrendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.netProfit >= 0 ? COLORS.green : COLORS.red} />
                ))}
              </Bar>
            </BarChart>
          ) : <EmptyChart />}
        </ChartCard>

        {/* 3. Top Profitable Pairs — Mobile card list */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Top Profitable Pairs</CardTitle>
            <CardDescription className="text-xs">By Final Net Profit</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topProfitablePairs.length > 0 ? (
              <div className="space-y-2.5">
                {topProfitablePairs.map((item, index) => {
                  const maxVal = Math.max(...topProfitablePairs.map(p => Math.abs(p.value)), 1)
                  const pct = Math.max((Math.abs(item.value) / maxVal) * 100, 4)
                  const isPositive = item.value >= 0
                  return (
                    <div key={item.pair} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-medium text-muted-foreground w-4 shrink-0">{index + 1}</span>
                          <span className="text-xs font-semibold truncate">{item.pair.replace('_', '/')}</span>
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                          {isPositive ? '+' : ''}{formatINR(toD(item.value))}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isPositive ? 'bg-gradient-to-r from-teal-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`}
                          style={{ width: `${pct}%`, transition: 'width 0.4s ease' }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{item.count} trade{item.count !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>Gross: {formatINR(toD(item.grossProfit))}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* 4. Deductions Breakdown */}
        <ChartCard title="Deductions Breakdown" description="Fees, GST, TDS, Tax" config={{ Fees: { label: 'Fees', color: DEDUCTION_COLORS[0] }, 'GST on Fees': { label: 'GST', color: DEDUCTION_COLORS[1] }, 'Total Tax': { label: 'Tax', color: DEDUCTION_COLORS[2] }, 'TDS Withheld': { label: 'TDS Withheld', color: DEDUCTION_COLORS[3] } }}>
          {deductionsBreakdownData.length > 0 ? (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={deductionsBreakdownData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" nameKey="name">
                {deductionsBreakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          ) : <EmptyChart />}
        </ChartCard>

        {/* 5. Gross → Final Net Comparison */}
        <ChartCard title="Gross → Final Net Profit" description="How deductions reduce gross profit" config={{}}>
          {waterfallData.length > 0 ? (
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
          ) : <EmptyChart />}
        </ChartCard>

        {/* 6. Win vs Loss Ratio */}
        <ChartCard title="Win vs Loss Ratio" description="Distribution of trade outcomes" config={{ Winning: { label: 'Winning', color: COLORS.green }, Losing: { label: 'Losing', color: COLORS.red } }}>
          {winLossData.length > 0 ? (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={winLossData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" nameKey="name">
                {winLossData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          ) : <EmptyChart />}
        </ChartCard>

        {/* 7. Open Holdings Allocation */}
        <ChartCard title="Open Holdings Allocation" description="Cost basis by pair" config={Object.fromEntries(holdingsAllocationData.slice(0, 6).map((item, i) => [item.name, { label: item.name, color: PAIR_COLORS[i % PAIR_COLORS.length] }]))}>
          {holdingsAllocationData.length > 0 ? (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={holdingsAllocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" nameKey="name">
                {holdingsAllocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          ) : <EmptyChart />}
        </ChartCard>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-5 pb-4">
      {/* ── ROW 1: Filter Bar ── */}
      <FilterBar
        timeFrame={timeFrame} setTimeFrame={setTimeFrame}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo} setCustomTo={setCustomTo}
        pairFilter={pairFilter} setPairFilter={setPairFilter}
        exchangeFilter={exchangeFilter} setExchangeFilter={setExchangeFilter}
        uniquePairs={uniquePairs} uniqueExchanges={uniqueExchanges}
        onReset={resetFilters} onRefresh={fetchReport}
      />

      {/* ── ROW 2: KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Final Net Profit */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpiData.finalNetProfit.gte(0) ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <IndianRupee className={`h-4 w-4 ${kpiData.finalNetProfit.gte(0) ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Final Net Profit</p>
              <p className={`text-sm font-bold truncate ${kpiData.finalNetProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatINR(kpiData.finalNetProfit)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. Gross Profit */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Gross Profit</p>
              <p className="text-sm font-bold truncate">{formatINR(kpiData.grossProfit)}</p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Avg Profit / Trade */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
              <Activity className="h-4 w-4 text-teal-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Avg Profit / Trade</p>
              <p className={`text-sm font-bold truncate ${kpiData.avgProfitPerTrade.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatINR(kpiData.avgProfitPerTrade)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Win Rate */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <Percent className="h-4 w-4 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Win Rate</p>
              <p className="text-sm font-bold truncate">{kpiData.winRate.toFixed(1)}%</p>
              <p className="text-[9px] text-muted-foreground">{kpiData.wins}W / {kpiData.losses}L of {kpiData.totalTrades}</p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Best Performing Pair */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Best Pair</p>
              <p className="text-sm font-bold truncate">{kpiData.bestPair}</p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Total Deductions */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
              <Receipt className="h-4 w-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Deductions</p>
              <p className="text-sm font-bold truncate">{formatINR(kpiData.totalDeductions)}</p>
              <p className="text-[9px] text-muted-foreground">Fees + GST + TDS + Tax</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 3: Profit Over Time + Realized Profit Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Profit Over Time"
          description="Cumulative Final Net Profit trend"
          config={{ cumulative: { label: 'Cumulative Profit', color: COLORS.teal } }}
        >
          {profitOverTimeData.length > 0 ? (
            <AreaChart data={profitOverTimeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="cumulative" stroke={COLORS.teal} fill="url(#profitGradient)" strokeWidth={2} />
            </AreaChart>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard
          title="Realized Profit Trend"
          description="Period-wise Final Net Profit"
          config={{ netProfit: { label: 'Net Profit', color: COLORS.teal } }}
        >
          {realizedProfitTrendData.length > 0 ? (
            <BarChart data={realizedProfitTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                {realizedProfitTrendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.netProfit >= 0 ? COLORS.green : COLORS.red} />
                ))}
              </Bar>
            </BarChart>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── ROW 4: Top Profitable Pairs + Top Loss Pairs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Top Profitable Pairs"
          description="Top 10 pairs ranked by performance"
          config={{ value: { label: 'Value', color: COLORS.teal } }}
          extra={
            <Select value={pairSortMode} onValueChange={(v) => setPairSortMode(v as typeof pairSortMode)}>
              <SelectTrigger className="w-[150px] h-7 rounded-md text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="finalNetProfit">Final Net Profit</SelectItem>
                <SelectItem value="grossProfit">Gross Profit</SelectItem>
                <SelectItem value="tradeCount">Trade Count</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          {topProfitablePairs.length > 0 ? (
            <BarChart data={topProfitablePairs} layout="vertical" margin={{ top: 10, right: 10, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="pair" tick={{ fontSize: 11 }} width={90} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {topProfitablePairs.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.value >= 0 ? COLORS.teal : COLORS.red} />
                ))}
              </Bar>
            </BarChart>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard
          title="Top Loss-Making Pairs"
          description="Pairs with lowest/negative Final Net Profit"
          config={{ loss: { label: 'Loss', color: COLORS.red } }}
        >
          {topLossPairs.length > 0 ? (
            <BarChart data={topLossPairs} layout="vertical" margin={{ top: 10, right: 10, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="pair" tick={{ fontSize: 11 }} width={90} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="loss" fill={COLORS.red} radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px] text-center">
              <Trophy className="h-10 w-10 text-green-500/30 mb-2" />
              <p className="text-sm text-muted-foreground">No loss-making pairs in this period.</p>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── ROW 5: Deduction Breakdown + Gross→Final Net ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Deductions Breakdown"
          description="Fees, GST on Fees, Total Tax, TDS Withheld"
          config={{
            Fees: { label: 'Fees', color: DEDUCTION_COLORS[0] },
            'GST on Fees': { label: 'GST', color: DEDUCTION_COLORS[1] },
            'Total Tax': { label: 'Tax', color: DEDUCTION_COLORS[2] },
            'TDS Withheld': { label: 'TDS Withheld', color: DEDUCTION_COLORS[3] },
          }}
        >
          {deductionsBreakdownData.length > 0 ? (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={deductionsBreakdownData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                {deductionsBreakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard
          title="Gross Profit → Final Net Profit"
          description="How deductions reduce your gross profit"
          config={{}}
        >
          {waterfallData.length > 0 ? (
            <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── ROW 6: Trade Quality ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Win vs Loss Ratio"
          description="Distribution of profitable vs loss-making trades"
          config={{
            Winning: { label: 'Winning', color: COLORS.green },
            Losing: { label: 'Losing', color: COLORS.red },
          }}
        >
          {winLossData.length > 0 ? (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={winLossData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" nameKey="name">
                {winLossData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          ) : <EmptyChart />}
        </ChartCard>

        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Average Trade Outcome</CardTitle>
            <CardDescription className="text-xs">Average profit on wins vs losses</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Avg Win</p>
                <p className="text-base font-bold text-green-600 dark:text-green-400">{formatINR(avgOutcomeData.avgWin)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Per winning trade</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Avg Loss</p>
                <p className="text-base font-bold text-red-600 dark:text-red-400">{formatINR(avgOutcomeData.avgLoss)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Per losing trade</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-teal-500/5 border border-teal-500/10">
                <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Avg Overall</p>
                <p className={`text-base font-bold ${avgOutcomeData.avgOverall.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatINR(avgOutcomeData.avgOverall)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Per trade</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ROW 7: Trade Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Trade Count by Pair"
          description="Which pairs were traded most often"
          config={{ count: { label: 'Trades', color: COLORS.purple } }}
        >
          {tradeCountByPairData.length > 0 ? (
            <BarChart data={tradeCountByPairData} layout="vertical" margin={{ top: 10, right: 10, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="pair" tick={{ fontSize: 11 }} width={90} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : <EmptyChart />}
        </ChartCard>

        <ChartCard
          title="Profit Efficiency by Pair"
          description="Profitability quality, not only total profit"
          config={{ efficiency: { label: 'Efficiency %', color: COLORS.emerald } }}
          extra={
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                Efficiency compares profitability quality, not only total profit. Calculated as: Final Net Profit ÷ Total Sell Value × 100
              </TooltipContent>
            </Tooltip>
          }
        >
          {profitEfficiencyData.length > 0 ? (
            <BarChart data={profitEfficiencyData} layout="vertical" margin={{ top: 10, right: 10, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="pair" tick={{ fontSize: 11 }} width={90} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="efficiency" fill={COLORS.emerald} radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── ROW 8: Open Holdings Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Open Holdings Allocation"
          description="Remaining cost basis by pair (latest snapshot)"
          config={Object.fromEntries(
            holdingsAllocationData.slice(0, 8).map((item, i) => [item.name, { label: item.name, color: PAIR_COLORS[i % PAIR_COLORS.length] }])
          )}
        >
          {holdingsAllocationData.length > 0 ? (
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={holdingsAllocationData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                {holdingsAllocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          ) : <EmptyChart message="No open holdings" />}
        </ChartCard>

        <ChartCard
          title="Open Holdings Cost Distribution"
          description="Top holdings by Remaining Cost Basis"
          config={{ costBasis: { label: 'Cost Basis', color: COLORS.teal } }}
        >
          {holdingsCostData.length > 0 ? (
            <BarChart data={holdingsCostData} layout="vertical" margin={{ top: 10, right: 10, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="pair" tick={{ fontSize: 11 }} width={90} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="costBasis" fill={COLORS.teal} radius={[0, 4, 4, 0]} />
            </BarChart>
          ) : <EmptyChart message="No open holdings" />}
        </ChartCard>
      </div>

      {/* ── ROW 9: Insight Cards ── */}
      {insights.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {insights.map((insight) => (
            <Card key={insight.label} className="rounded-xl border-border shadow-sm">
              <CardContent className="p-3.5 flex items-start gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${insight.color}`}>
                  <insight.icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{insight.label}</p>
                  <p className="text-xs font-bold truncate">{insight.value}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{insight.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter Bar Component ───────────────────────────────────

function FilterBar({
  timeFrame, setTimeFrame,
  customFrom, setCustomFrom,
  customTo, setCustomTo,
  pairFilter, setPairFilter,
  exchangeFilter, setExchangeFilter,
  uniquePairs, uniqueExchanges,
  onReset, onRefresh,
}: {
  timeFrame: TimeFrame
  setTimeFrame: (v: TimeFrame) => void
  customFrom: string
  setCustomFrom: (v: string) => void
  customTo: string
  setCustomTo: (v: string) => void
  pairFilter: string
  setPairFilter: (v: string) => void
  exchangeFilter: string
  setExchangeFilter: (v: string) => void
  uniquePairs: string[]
  uniqueExchanges: string[]
  onReset: () => void
  onRefresh: () => void
}) {
  return (
    <Card className="rounded-xl border-border shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Deeply analyze trade performance, profit trends, deductions, and holdings.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 px-2.5 rounded-lg text-muted-foreground" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2.5 rounded-lg text-muted-foreground" onClick={onReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
              </Button>
            </div>
          </div>

          {/* Time Frame Selector */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto -mx-1 px-1">
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

          {/* Custom date range */}
          {timeFrame === 'custom' && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg h-9 text-xs w-[140px]" placeholder="From" />
              <span className="text-xs text-muted-foreground">–</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg h-9 text-xs w-[140px]" placeholder="To" />
            </div>
          )}

          {/* Pair + Exchange filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={pairFilter} onValueChange={setPairFilter}>
              <SelectTrigger className="w-[140px] rounded-lg h-9 text-sm">
                <SelectValue placeholder="All Pairs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pairs</SelectItem>
                {uniquePairs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={exchangeFilter} onValueChange={setExchangeFilter}>
              <SelectTrigger className="w-[140px] rounded-lg h-9 text-sm">
                <SelectValue placeholder="All Exchanges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exchanges</SelectItem>
                {uniqueExchanges.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Mobile Filter Controls ────────────────────────────────

function MobileFilterControls({
  pairFilter, setPairFilter,
  exchangeFilter, setExchangeFilter,
  customFrom, setCustomFrom,
  customTo, setCustomTo,
  uniquePairs, uniqueExchanges,
  onReset,
}: {
  pairFilter: string
  setPairFilter: (v: string) => void
  exchangeFilter: string
  setExchangeFilter: (v: string) => void
  customFrom: string
  setCustomFrom: (v: string) => void
  customTo: string
  setCustomTo: (v: string) => void
  uniquePairs: string[]
  uniqueExchanges: string[]
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Pair</label>
        <Select value={pairFilter} onValueChange={setPairFilter}>
          <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="All Pairs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pairs</SelectItem>
            {uniquePairs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Exchange</label>
        <Select value={exchangeFilter} onValueChange={setExchangeFilter}>
          <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="All Exchanges" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exchanges</SelectItem>
            {uniqueExchanges.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Custom Date Range</label>
        <div className="flex items-center gap-2">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl flex-1" placeholder="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl flex-1" placeholder="To" />
        </div>
      </div>
      <Button variant="outline" className="rounded-xl w-full" onClick={onReset}>
        <RotateCcw className="h-4 w-4 mr-2" /> Reset All Filters
      </Button>
    </div>
  )
}

// ── Chart Card Component ──────────────────────────────────

function ChartCard({
  title, description, config, children, extra,
}: {
  title: string
  description: string
  config: ChartConfig
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <Card className="rounded-xl border-border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          {extra}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ChartContainer config={config} className="h-[260px] w-full">
          {children}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ── Empty Chart ────────────────────────────────────────────

function EmptyChart({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[260px] text-center">
      <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ── Analytics Skeleton ─────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="rounded-xl border-border">
            <CardContent className="p-3.5 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-20 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[320px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
