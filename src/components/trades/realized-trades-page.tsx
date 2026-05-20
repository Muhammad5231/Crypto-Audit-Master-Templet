'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Realized Trades Page (v2 — Audit-Focused)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Professional audit page for FIFO-matched BUY–SELL trade segments.
//
// Desktop: Summary chips + filter bar + 17-column table + totals
//          footer + configurable pagination + export
// Mobile:  Summary chips + search/filter/sort bar + swipe card
//          carousel with full trade detail
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet } from '@/lib/api-client'
import { toD, formatINR, formatQty, type D } from '@/lib/decimal'
import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { SwipeCard } from '@/components/ui/swipe-card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Filter,
  Download,
  Upload,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  RotateCcw,
  Calendar,
  FileSpreadsheet,
  IndianRupee,
  Calculator,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

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

interface ReportData {
  reportId: string
  generatedAt: string
  sourceCsvFiles: string[]
  realizedTrades: RealizedTrade[]
  openHoldings: unknown[]
  warnings: unknown[]
  summary: {
    totalRealizedTrades: number
    [key: string]: unknown
  }
  taxSummary: {
    totalGrossProfit: string
    totalNetProfit: string
    totalFees: string
    totalGstOnFees: string
    totalTds: string
    totalDirectTax: string
    totalCess: string
    [key: string]: unknown
  }
}

type SortOption = 'newest' | 'oldest' | 'highest-profit' | 'highest-loss' | 'highest-gross'
type ProfitFilter = 'all' | 'profit' | 'loss' | 'break-even'
type PageSize = 10 | 25 | 50 | 100

// ── Helpers ────────────────────────────────────────────────

function fmtDate(d: string): string {
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return d }
}

function getTradeStatus(trade: RealizedTrade): 'PROFIT' | 'LOSS' | 'BREAK-EVEN' {
  if (trade.resolvedProfitLossStatus) {
    const s = trade.resolvedProfitLossStatus.toUpperCase()
    if (s === 'PROFIT' || s === 'LOSS') return s
  }
  if (trade.status) {
    const s = trade.status.toUpperCase()
    if (s === 'PROFIT' || s === 'LOSS') return s
  }
  const np = toD(trade.resolvedFinalNetProfit || trade.finalNetProfit || trade.grossProfit)
  if (np.isZero()) return 'BREAK-EVEN'
  return np.greaterThan(0) ? 'PROFIT' : 'LOSS'
}

// Get resolved value with fallback
function rv(resolved: string | undefined, fallback: string | number, zeroDefault = '0'): string {
  const v = resolved || fallback || zeroDefault
  return v.toString()
}

// ── Main Component ─────────────────────────────────────────

export default function RealizedTradesPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  const [report, setReport] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [pairFilter, setPairFilter] = useState<string>('all')
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('newest')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Pagination
  const [paginationPage, setPaginationPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  // Mobile
  const [mobileIndex, setMobileIndex] = useState(0)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

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
      if (msg.includes('404') || msg.includes('No reports found')) { setReport(null) }
      else { setError(msg) }
    } finally { setIsLoading(false) }
  }, [currentWorkspace])

  useEffect(() => { fetchReport() }, [fetchReport])

  // ── Unique pairs ──
  const uniquePairs = useMemo(() => {
    if (!report?.realizedTrades) return []
    return Array.from(new Set(report.realizedTrades.map(t => t.pair))).sort()
  }, [report])

  // ── Filtered & sorted trades ──
  const filteredTrades = useMemo(() => {
    if (!report?.realizedTrades) return []
    let trades = [...report.realizedTrades]

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      trades = trades.filter(t =>
        t.pair.toLowerCase().includes(q) ||
        t.asset.toLowerCase().includes(q)
      )
    }

    // Pair filter
    if (pairFilter !== 'all') {
      trades = trades.filter(t => t.pair === pairFilter)
    }

    // Profit/Loss filter
    if (profitFilter !== 'all') {
      trades = trades.filter(t => {
        const s = getTradeStatus(t)
        if (profitFilter === 'profit') return s === 'PROFIT'
        if (profitFilter === 'loss') return s === 'LOSS'
        if (profitFilter === 'break-even') return s === 'BREAK-EVEN'
        return true
      })
    }

    // Date range
    if (dateFrom) {
      const from = new Date(dateFrom)
      trades = trades.filter(t => new Date(t.sellDate) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      trades = trades.filter(t => new Date(t.sellDate) <= to)
    }

    // Sort
    switch (sortOption) {
      case 'newest':
        trades.sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime())
        break
      case 'oldest':
        trades.sort((a, b) => new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime())
        break
      case 'highest-profit':
        trades.sort((a, b) => toD(rv(b.resolvedFinalNetProfit, b.finalNetProfit)).minus(toD(rv(a.resolvedFinalNetProfit, a.finalNetProfit))).toNumber())
        break
      case 'highest-loss':
        trades.sort((a, b) => toD(rv(a.resolvedFinalNetProfit, a.finalNetProfit)).minus(toD(rv(b.resolvedFinalNetProfit, b.finalNetProfit))).toNumber())
        break
      case 'highest-gross':
        trades.sort((a, b) => toD(b.grossProfit).minus(toD(a.grossProfit)).toNumber())
        break
    }

    return trades
  }, [report, searchQuery, pairFilter, profitFilter, sortOption, dateFrom, dateTo])

  // ── Reset page on filter change ──
  useEffect(() => {
    setPaginationPage(1)
    setMobileIndex(0)
  }, [searchQuery, pairFilter, profitFilter, sortOption, dateFrom, dateTo, pageSize])

  // ── Pagination ──
  const totalPages = Math.ceil(filteredTrades.length / pageSize)
  const paginatedTrades = filteredTrades.slice(
    (paginationPage - 1) * pageSize,
    paginationPage * pageSize
  )
  const showingFrom = filteredTrades.length === 0 ? 0 : (paginationPage - 1) * pageSize + 1
  const showingTo = Math.min(paginationPage * pageSize, filteredTrades.length)

  // ── Totals (based on filtered trades) ──
  const totals = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        buyValue: toD(0), sellValue: toD(0), grossProfit: toD(0),
        feesIncGst: toD(0), tds: toD(0), baseTax: toD(0),
        cess: toD(0), totalTax: toD(0), netProfit: toD(0), finalNetProfit: toD(0),
      }
    }
    return filteredTrades.reduce((acc, t) => {
      const fees = toD(rv(t.resolvedTotalFees, t.totalFees))
      const gst = toD(rv(t.resolvedGstOnFees, t.gstOnFees, '0'))
      const tdsVal = toD(rv(t.resolvedTotalTds, t.tds, '0'))
      const baseTax = toD(rv(t.resolvedBaseCryptoTax, t.baseCryptoTax, '0'))
      const cess = toD(rv(t.resolvedCess, t.cess, '0'))
      const totalTax = toD(rv(t.resolvedTotalDirectTax, t.totalDirectTax, '0'))
      const netProfitInHand = toD(rv(t.resolvedNetProfitInHand, t.netProfitInHand, t.grossProfit))
      const finalNetProfit = toD(rv(t.resolvedFinalNetProfit, t.finalNetProfit, t.grossProfit))

      return {
        buyValue: acc.buyValue.plus(toD(t.buyValue)),
        sellValue: acc.sellValue.plus(toD(t.sellValue)),
        grossProfit: acc.grossProfit.plus(toD(t.grossProfit)),
        feesIncGst: acc.feesIncGst.plus(fees).plus(gst),
        tds: acc.tds.plus(tdsVal),
        baseTax: acc.baseTax.plus(baseTax),
        cess: acc.cess.plus(cess),
        totalTax: acc.totalTax.plus(totalTax),
        netProfit: acc.netProfit.plus(netProfitInHand),
        finalNetProfit: acc.finalNetProfit.plus(finalNetProfit),
      }
    }, {
      buyValue: toD(0), sellValue: toD(0), grossProfit: toD(0),
      feesIncGst: toD(0), tds: toD(0), baseTax: toD(0),
      cess: toD(0), totalTax: toD(0), netProfit: toD(0), finalNetProfit: toD(0),
    })
  }, [filteredTrades])

  // ── Summary chips data ──
  const summaryChips = useMemo(() => [
    { label: 'Total Realized Trades', value: String(filteredTrades.length), icon: FileText, color: 'text-teal-500 bg-teal-500/10' },
    { label: 'Total Gross Profit', value: formatINR(totals.grossProfit), icon: ArrowUpRight, color: `${totals.grossProfit.gte(0) ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}` },
    { label: 'Total Final Net Profit', value: formatINR(totals.finalNetProfit), icon: IndianRupee, color: `${totals.finalNetProfit.gte(0) ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'}` },
    { label: 'Total Tax', value: formatINR(totals.totalTax), icon: Calculator, color: 'text-orange-500 bg-orange-500/10' },
  ], [filteredTrades.length, totals])

  // ── Reset all filters ──
  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setPairFilter('all')
    setProfitFilter('all')
    setSortOption('newest')
    setDateFrom('')
    setDateTo('')
  }, [])

  // ── Export handler ──
  const handleExport = useCallback((type: 'excel' | 'pdf') => {
    toast({ title: `${type === 'excel' ? 'Excel' : 'PDF'} export started`, description: 'Your download will begin shortly.' })
  }, [toast])

  // ── Loading ──
  if (isLoading) return <RealizedTradesSkeleton />

  // ── No workspace ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">Select or create a workspace to view realized trades.</p>
        <Button onClick={() => setCurrentPage('workspaces')} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white">Go to Workspaces</Button>
      </div>
    )
  }

  // ── No report / empty state ──
  if (!report || !report.realizedTrades || report.realizedTrades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <FileText className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No realized trades found.</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Process uploaded CSV files to generate FIFO-matched realized trades.
        </p>
        <Button onClick={() => setCurrentPage('upload')} className="mt-4 bg-teal-500 hover:bg-teal-600 text-white">
          <Upload className="h-4 w-4 mr-2" /> Upload CSV
        </Button>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-4">
          <FileText className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Failed to load trades</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button variant="outline" onClick={fetchReport} className="mt-4">Retry</Button>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════════

  if (isMobile) {
    const currentTrade = filteredTrades[mobileIndex]

    return (
      <div className="space-y-4 px-4 pb-6">
        {/* Mobile Header */}
        <div>
          <h1 className="text-xl font-bold">Realized Trades</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review FIFO-matched completed trades with profit and tax breakdown.
          </p>
        </div>

        {/* Mobile Summary Chips — 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {summaryChips.map((chip) => (
            <div key={chip.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${chip.color}`}>
                <chip.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{chip.label}</p>
                <p className="text-xs font-bold truncate">{chip.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search pair..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm rounded-lg"
            />
          </div>
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2.5 rounded-lg shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Filter & Sort</SheetTitle>
                <SheetDescription>Narrow down your realized trades</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <FilterControls
                  pairFilter={pairFilter} setPairFilter={setPairFilter}
                  profitFilter={profitFilter} setProfitFilter={setProfitFilter}
                  sortOption={sortOption} setSortOption={setSortOption}
                  dateFrom={dateFrom} setDateFrom={setDateFrom}
                  dateTo={dateTo} setDateTo={setDateTo}
                  uniquePairs={uniquePairs}
                  onReset={resetFilters}
                  compact
                />
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="outline" size="sm" className="h-9 px-2.5 rounded-lg shrink-0" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''} found
        </p>

        {/* Swipe Carousel */}
        {filteredTrades.length > 0 && currentTrade ? (
          <SwipeCard
            currentIndex={mobileIndex}
            totalCount={filteredTrades.length}
            onSwipeLeft={() => setMobileIndex(i => Math.min(i + 1, filteredTrades.length - 1))}
            onSwipeRight={() => setMobileIndex(i => Math.max(i - 1, 0))}
            positionLabel={`Trade ${mobileIndex + 1} of ${filteredTrades.length}`}
          >
            <MobileTradeCard trade={currentTrade} index={mobileIndex} />
          </SwipeCard>
        ) : (
          <Card className="rounded-2xl border-border">
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No trades match the selected filters.</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Realized Trades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review FIFO-matched completed trades with profit and tax breakdown.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => handleExport('excel')} disabled={filteredTrades.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => handleExport('pdf')} disabled={filteredTrades.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── Summary Chips ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryChips.map((chip) => (
          <Card key={chip.label} className="rounded-xl border-border shadow-sm">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${chip.color}`}>
                <chip.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{chip.label}</p>
                <p className="text-sm font-bold truncate">{chip.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters Bar ── */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardContent className="p-3.5">
          <FilterControls
            pairFilter={pairFilter} setPairFilter={setPairFilter}
            profitFilter={profitFilter} setProfitFilter={setProfitFilter}
            sortOption={sortOption} setSortOption={setSortOption}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            uniquePairs={uniquePairs}
            onReset={resetFilters}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </CardContent>
      </Card>

      {/* ── No filtered results ── */}
      {filteredTrades.length === 0 ? (
        <Card className="rounded-xl border-border">
          <CardContent className="p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No trades match the selected filters.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Trades Table ── */}
          <Card className="rounded-xl border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 bg-muted/40 z-10 w-10 text-center">#</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[100px]">Pair</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[95px]">Buy Date</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[95px]">Sell Date</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[70px]">Qty</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[90px]">Buy Value</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[90px]">Sell Value</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[100px]">Gross Profit</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Fees (Inc. GST)</span>
                        </TooltipTrigger>
                        <TooltipContent>Total exchange fees + GST on fees</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[70px]">TDS</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[80px]">Tax</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[70px]">Cess (4%)</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[90px]">Total Tax</TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Net Profit</span>
                        </TooltipTrigger>
                        <TooltipContent>Gross Profit − Fees (Inc. GST) − TDS</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[110px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Final Net Profit</span>
                        </TooltipTrigger>
                        <TooltipContent>Net Profit − Total Tax + TDS</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-center min-w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTrades.map((trade, i) => {
                    const status = getTradeStatus(trade)
                    const isProfit = status === 'PROFIT'
                    const isBreakEven = status === 'BREAK-EVEN'

                    const fees = toD(rv(trade.resolvedTotalFees, trade.totalFees))
                    const gst = toD(rv(trade.resolvedGstOnFees, trade.gstOnFees, '0'))
                    const feesIncGst = fees.plus(gst)
                    const tdsVal = toD(rv(trade.resolvedTotalTds, trade.tds, '0'))
                    const baseTax = toD(rv(trade.resolvedBaseCryptoTax, trade.baseCryptoTax, '0'))
                    const cess = toD(rv(trade.resolvedCess, trade.cess, '0'))
                    const totalTax = toD(rv(trade.resolvedTotalDirectTax, trade.totalDirectTax, '0'))
                    const netProfitInHand = toD(rv(trade.resolvedNetProfitInHand, trade.netProfitInHand, trade.grossProfit))
                    const finalNetProfit = toD(rv(trade.resolvedFinalNetProfit, trade.finalNetProfit, trade.grossProfit))

                    const rowBg = isBreakEven
                      ? 'hover:bg-muted/30'
                      : isProfit
                        ? 'hover:bg-green-500/[0.04]'
                        : 'hover:bg-red-500/[0.04]'

                    const profitColor = isBreakEven
                      ? 'text-muted-foreground'
                      : isProfit
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'

                    return (
                      <TableRow key={i} className={`${rowBg} transition-colors`}>
                        <TableCell className="text-muted-foreground text-xs text-center">
                          {(paginationPage - 1) * pageSize + i + 1}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{trade.pair}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(trade.buyDate)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(trade.sellDate)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatQty(toD(trade.matchedQty))}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(toD(trade.buyValue))}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(toD(trade.sellValue))}</TableCell>
                        <TableCell className={`text-right font-mono text-xs font-semibold ${profitColor}`}>{formatINR(toD(trade.grossProfit))}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(feesIncGst)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(tdsVal)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(baseTax)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(cess)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(totalTax)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs font-semibold ${profitColor}`}>{formatINR(netProfitInHand)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs font-bold ${profitColor}`}>{formatINR(finalNetProfit)}</TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={status} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 font-semibold">
                    <TableCell colSpan={5} className="text-right text-xs">Totals</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatINR(totals.buyValue)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatINR(totals.sellValue)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${totals.grossProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatINR(totals.grossProfit)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(totals.feesIncGst)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(totals.tds)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(totals.baseTax)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(totals.cess)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatINR(totals.totalTax)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-semibold ${totals.netProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatINR(totals.netProfit)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-bold ${totals.finalNetProfit.gte(0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatINR(totals.finalNetProfit)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {filteredTrades.length} realized trade records
              </p>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as PageSize)}>
                <SelectTrigger className="w-[80px] h-8 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => setPaginationPage(p => Math.max(1, p - 1))}
                  disabled={paginationPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {generatePageNumbers(paginationPage, totalPages).map((pageNum, i) =>
                  pageNum === -1 ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
                  ) : (
                    <Button
                      key={pageNum}
                      variant={pageNum === paginationPage ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 w-8 p-0 rounded-lg ${pageNum === paginationPage ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}`}
                      onClick={() => setPaginationPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                )}
                <Button
                  variant="outline" size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => setPaginationPage(p => Math.min(totalPages, p + 1))}
                  disabled={paginationPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Page Number Generator ──────────────────────────────────

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: number[] = [1]
  if (current > 3) pages.push(-1) // ellipsis
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push(-1) // ellipsis
  pages.push(total)
  return pages
}

// ── Status Badge ───────────────────────────────────────────

function StatusBadge({ status }: { status: 'PROFIT' | 'LOSS' | 'BREAK-EVEN' }) {
  if (status === 'PROFIT') {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
        <ArrowUpRight className="h-3 w-3 mr-0.5" />PROFIT
      </Badge>
    )
  }
  if (status === 'LOSS') {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
        <ArrowDownRight className="h-3 w-3 mr-0.5" />LOSS
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-muted-foreground/30 bg-muted/50 text-muted-foreground">
      <Minus className="h-3 w-3 mr-0.5" />BREAK-EVEN
    </Badge>
  )
}

// ── Filter Controls (shared between desktop & mobile) ──────

function FilterControls({
  pairFilter, setPairFilter,
  profitFilter, setProfitFilter,
  sortOption, setSortOption,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  uniquePairs,
  onReset,
  searchQuery, setSearchQuery,
  compact,
}: {
  pairFilter: string
  setPairFilter: (v: string) => void
  profitFilter: ProfitFilter
  setProfitFilter: (v: ProfitFilter) => void
  sortOption: SortOption
  setSortOption: (v: SortOption) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  uniquePairs: string[]
  onReset: () => void
  searchQuery?: string
  setSearchQuery?: (v: string) => void
  compact?: boolean
}) {
  return (
    <div className={`flex ${compact ? 'flex-col' : 'flex-wrap'} items-center gap-3`}>
      {/* Search */}
      {searchQuery !== undefined && setSearchQuery && (
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search pair / asset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-lg h-9 text-sm"
          />
        </div>
      )}

      {/* Pair */}
      <Select value={pairFilter} onValueChange={setPairFilter}>
        <SelectTrigger className={`${compact ? 'w-full' : 'w-[140px]'} rounded-lg h-9 text-sm`}>
          <SelectValue placeholder="All Pairs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Pairs</SelectItem>
          {uniquePairs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Profit/Loss */}
      <Select value={profitFilter} onValueChange={(v) => setProfitFilter(v as ProfitFilter)}>
        <SelectTrigger className={`${compact ? 'w-full' : 'w-[130px]'} rounded-lg h-9 text-sm`}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Trades</SelectItem>
          <SelectItem value="profit">Profit Only</SelectItem>
          <SelectItem value="loss">Loss Only</SelectItem>
          <SelectItem value="break-even">Break-Even</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range */}
      <div className={`flex items-center gap-1.5 ${compact ? 'w-full' : ''}`}>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg h-9 text-xs w-[130px]"
          placeholder="From"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg h-9 text-xs w-[130px]"
          placeholder="To"
        />
      </div>

      {/* Sort */}
      <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
        <SelectTrigger className={`${compact ? 'w-full' : 'w-[170px]'} rounded-lg h-9 text-sm`}>
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest Sell Date</SelectItem>
          <SelectItem value="oldest">Oldest Sell Date</SelectItem>
          <SelectItem value="highest-profit">Highest Net Profit</SelectItem>
          <SelectItem value="highest-loss">Highest Loss</SelectItem>
          <SelectItem value="highest-gross">Highest Gross Profit</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset */}
      <Button variant="ghost" size="sm" className="h-9 px-3 rounded-lg text-muted-foreground hover:text-foreground" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
      </Button>
    </div>
  )
}

// ── Mobile Trade Card ──────────────────────────────────────

function MobileTradeCard({ trade, index }: { trade: RealizedTrade; index: number }) {
  const status = getTradeStatus(trade)
  const isProfit = status === 'PROFIT'

  const fees = toD(rv(trade.resolvedTotalFees, trade.totalFees))
  const gst = toD(rv(trade.resolvedGstOnFees, trade.gstOnFees, '0'))
  const feesIncGst = fees.plus(gst)
  const tdsVal = toD(rv(trade.resolvedTotalTds, trade.tds, '0'))
  const baseTax = toD(rv(trade.resolvedBaseCryptoTax, trade.baseCryptoTax, '0'))
  const cess = toD(rv(trade.resolvedCess, trade.cess, '0'))
  const totalTax = toD(rv(trade.resolvedTotalDirectTax, trade.totalDirectTax, '0'))
  const netProfitInHand = toD(rv(trade.resolvedNetProfitInHand, trade.netProfitInHand, trade.grossProfit))
  const finalNetProfit = toD(rv(trade.resolvedFinalNetProfit, trade.finalNetProfit, trade.grossProfit))

  const profitColor = isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  const borderColor = isProfit ? 'border-green-500/20' : 'border-red-500/20'
  const bgColor = isProfit ? 'bg-green-500/5' : 'bg-red-500/5'

  return (
    <Card className={`rounded-2xl border shadow-sm overflow-hidden ${borderColor}`}>
      {/* Card Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${bgColor}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{trade.pair}</span>
          <StatusBadge status={status} />
        </div>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Dates & Qty */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Trade Details</p>
          <div className="grid grid-cols-3 gap-2">
            <DetailItem label="Buy Date" value={fmtDate(trade.buyDate)} />
            <DetailItem label="Sell Date" value={fmtDate(trade.sellDate)} />
            <DetailItem label="Qty" value={formatQty(toD(trade.matchedQty))} />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Values */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Value Breakdown</p>
          <div className="grid grid-cols-2 gap-2">
            <DetailItem label="Buy Value" value={formatINR(toD(trade.buyValue))} />
            <DetailItem label="Sell Value" value={formatINR(toD(trade.sellValue))} />
            <DetailItem label="Gross Profit" value={formatINR(toD(trade.grossProfit))} valueColor={profitColor} />
            <DetailItem label="Fees (Inc. GST)" value={formatINR(feesIncGst)} />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Tax Breakdown */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Tax & Deductions</p>
          <div className="space-y-1">
            <DeductRow label="TDS" value={formatINR(tdsVal)} />
            <DeductRow label="Tax (30%)" value={formatINR(baseTax)} />
            <DeductRow label="Cess (4%)" value={formatINR(cess)} />
            <DeductRow label="Total Tax" value={formatINR(totalTax)} isBold />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Profit Summary */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Net Profit</span>
            <span className={`text-sm font-semibold font-mono ${profitColor}`}>{formatINR(netProfitInHand)}</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
            <span className="text-sm font-semibold">Final Net Profit</span>
            <span className={`text-base font-bold font-mono ${profitColor}`}>{formatINR(finalNetProfit)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Small sub-components ──

function DetailItem({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${valueColor || ''}`}>{value}</p>
    </div>
  )
}

function DeductRow({ label, value, isBold }: { label: string; value: string; isBold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${isBold ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs font-mono ${isBold ? 'font-medium' : ''}`}>{value}</span>
    </div>
  )
}

// ── Skeleton ──

function RealizedTradesSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-52 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-lg mt-1.5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  )
}
