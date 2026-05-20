'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Open Holdings Page (v2 — Audit-Focused)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Professional audit page for remaining unmatched BUY lots after
// FIFO processing.
//
// Desktop: Summary cards + filter bar + 12-column table + totals
//          footer + configurable pagination + export
// Mobile:  Summary cards + search/filter/sort bar + swipe card
//          carousel with full holding detail
//
// Data source: GET /api/workspaces/:workspaceId/reports/latest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet } from '@/lib/api-client'
import { toD, formatINR, formatQty } from '@/lib/decimal'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
  FileSpreadsheet,
  Layers,
  Package,
  IndianRupee,
  Target,
  CircleDot,
  CircleDashed,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface OpenHolding {
  pair: string
  asset: string
  exchange?: string
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
  realizedTrades: unknown[]
  openHoldings: OpenHolding[]
  warnings: unknown[]
  summary: {
    totalOpenHoldings: number
    totalHoldingValue: string
    totalHoldingQty: string
    fullyUnmatchedHoldings: number
    partiallyMatchedHoldings: number
    [key: string]: unknown
  }
  taxSummary: {
    [key: string]: unknown
  }
}

type SortOption =
  | 'newest-buy'
  | 'oldest-buy'
  | 'highest-remaining-qty'
  | 'highest-cost-basis'
  | 'lowest-cost-basis'
  | 'pair-az'

type HoldingStatusFilter = 'all' | 'fully-unmatched' | 'partially-matched'
type PageSize = 10 | 25 | 50 | 100

// ── Helpers ────────────────────────────────────────────────

function fmtDate(d: string): string {
  try {
    return format(new Date(d), 'dd MMM yyyy')
  } catch {
    return d
  }
}

function getHoldingStatusInfo(h: OpenHolding) {
  const isFullyUnmatched =
    h.status === 'Fully Unmatched Buy Lot' ||
    toD(h.remainingQty).equals(toD(h.originalQty))

  if (isFullyUnmatched) {
    return {
      label: 'Fully Unmatched',
      fullLabel: 'Fully Unmatched Buy Lot',
      variant: 'outline' as const,
      className:
        'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    }
  }
  return {
    label: 'Partially Matched',
    fullLabel: 'Partially Matched Remaining Lot',
    variant: 'outline' as const,
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  }
}

// ── Page Number Generator ──────────────────────────────────

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: number[] = [1]
  if (current > 3) pages.push(-1) // ellipsis
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.push(i)
  }
  if (current < total - 2) pages.push(-1)
  pages.push(total)
  return pages
}

// ── Main Component ─────────────────────────────────────────

export default function OpenHoldingsPage() {
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
  const [exchangeFilter, setExchangeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] =
    useState<HoldingStatusFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('newest-buy')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Pagination (desktop)
  const [paginationPage, setPaginationPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  // Mobile carousel index
  const [mobileIndex, setMobileIndex] = useState(0)

  // Mobile filter sheet
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // ── Fetch report ──
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

  // ── Unique pairs ──
  const uniquePairs = useMemo(() => {
    if (!report?.openHoldings) return []
    return Array.from(new Set(report.openHoldings.map((h) => h.pair))).sort()
  }, [report])

  // ── Unique exchanges ──
  const uniqueExchanges = useMemo(() => {
    if (!report?.openHoldings) return []
    const exchanges = new Set(
      report.openHoldings
        .map((h) => h.exchange)
        .filter((e): e is string => !!e && e !== '--')
    )
    return Array.from(exchanges).sort()
  }, [report])

  // ── Most concentrated holding pair ──
  const mostConcentratedPair = useMemo(() => {
    if (!report?.openHoldings || report.openHoldings.length === 0) return '--'
    const pairCosts: Record<string, ReturnType<typeof toD>> = {}
    report.openHoldings.forEach((h) => {
      if (!pairCosts[h.pair]) pairCosts[h.pair] = toD(0)
      pairCosts[h.pair] = pairCosts[h.pair].plus(toD(h.remainingCostBasis))
    })
    let maxPair = ''
    let maxCost = toD(0)
    Object.entries(pairCosts).forEach(([pair, cost]) => {
      if (cost.greaterThan(maxCost)) {
        maxPair = pair
        maxCost = cost
      }
    })
    return maxPair || '--'
  }, [report])

  // ── Filtered & sorted holdings ──
  const filteredHoldings = useMemo(() => {
    if (!report?.openHoldings) return []
    let holdings = [...report.openHoldings]

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      holdings = holdings.filter(
        (h) =>
          h.pair.toLowerCase().includes(q) ||
          h.asset.toLowerCase().includes(q) ||
          (h.exchange && h.exchange.toLowerCase().includes(q))
      )
    }

    // Pair filter
    if (pairFilter !== 'all') {
      holdings = holdings.filter((h) => h.pair === pairFilter)
    }

    // Exchange filter
    if (exchangeFilter !== 'all') {
      holdings = holdings.filter(
        (h) => (h.exchange || '--') === exchangeFilter
      )
    }

    // Holding Status filter
    if (statusFilter !== 'all') {
      holdings = holdings.filter((h) => {
        const isFullyUnmatched =
          h.status === 'Fully Unmatched Buy Lot' ||
          toD(h.remainingQty).equals(toD(h.originalQty))
        if (statusFilter === 'fully-unmatched') return isFullyUnmatched
        if (statusFilter === 'partially-matched') return !isFullyUnmatched
        return true
      })
    }

    // Buy Date range
    if (dateFrom) {
      const from = new Date(dateFrom)
      holdings = holdings.filter((h) => new Date(h.buyDate) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      holdings = holdings.filter((h) => new Date(h.buyDate) <= to)
    }

    // Sort
    switch (sortOption) {
      case 'newest-buy':
        holdings.sort(
          (a, b) =>
            new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()
        )
        break
      case 'oldest-buy':
        holdings.sort(
          (a, b) =>
            new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
        )
        break
      case 'highest-remaining-qty':
        holdings.sort((a, b) =>
          toD(b.remainingQty).minus(toD(a.remainingQty)).toNumber()
        )
        break
      case 'highest-cost-basis':
        holdings.sort((a, b) =>
          toD(b.remainingCostBasis)
            .minus(toD(a.remainingCostBasis))
            .toNumber()
        )
        break
      case 'lowest-cost-basis':
        holdings.sort((a, b) =>
          toD(a.remainingCostBasis)
            .minus(toD(b.remainingCostBasis))
            .toNumber()
        )
        break
      case 'pair-az':
        holdings.sort((a, b) => a.pair.localeCompare(b.pair))
        break
    }

    return holdings
  }, [
    report,
    searchQuery,
    pairFilter,
    exchangeFilter,
    statusFilter,
    sortOption,
    dateFrom,
    dateTo,
  ])

  // ── Reset page on filter change ──
  useEffect(() => {
    setPaginationPage(1)
    setMobileIndex(0)
  }, [searchQuery, pairFilter, exchangeFilter, statusFilter, sortOption, dateFrom, dateTo, pageSize])

  // ── Pagination ──
  const totalPages = Math.ceil(filteredHoldings.length / pageSize)
  const paginatedHoldings = filteredHoldings.slice(
    (paginationPage - 1) * pageSize,
    paginationPage * pageSize
  )
  const showingFrom =
    filteredHoldings.length === 0
      ? 0
      : (paginationPage - 1) * pageSize + 1
  const showingTo = Math.min(
    paginationPage * pageSize,
    filteredHoldings.length
  )

  // ── Totals (based on filtered holdings) ──
  const totals = useMemo(() => {
    if (filteredHoldings.length === 0) {
      return {
        originalBuyQty: toD(0),
        remainingQty: toD(0),
        originalBuyValue: toD(0),
        remainingCostBasis: toD(0),
        remainingBuyFee: toD(0),
      }
    }
    return filteredHoldings.reduce(
      (acc, h) => ({
        originalBuyQty: acc.originalBuyQty.plus(toD(h.originalQty)),
        remainingQty: acc.remainingQty.plus(toD(h.remainingQty)),
        originalBuyValue: acc.originalBuyValue.plus(
          toD(h.buyPrice).times(toD(h.originalQty))
        ),
        remainingCostBasis: acc.remainingCostBasis.plus(
          toD(h.remainingCostBasis)
        ),
        remainingBuyFee: acc.remainingBuyFee.plus(
          toD(h.remainingAllocatedBuyFee)
        ),
      }),
      {
        originalBuyQty: toD(0),
        remainingQty: toD(0),
        originalBuyValue: toD(0),
        remainingCostBasis: toD(0),
        remainingBuyFee: toD(0),
      }
    )
  }, [filteredHoldings])

  // ── Summary cards data ──
  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Open Holdings',
        value: String(filteredHoldings.length),
        icon: Layers,
        color: 'text-teal-500 bg-teal-500/10',
      },
      {
        label: 'Total Remaining Qty',
        value: formatQty(totals.remainingQty),
        icon: Package,
        color: 'text-purple-500 bg-purple-500/10',
      },
      {
        label: 'Total Cost Basis',
        value: formatINR(totals.remainingCostBasis),
        icon: IndianRupee,
        color: 'text-emerald-500 bg-emerald-500/10',
      },
      {
        label: 'Most Concentrated Pair',
        value:
          filteredHoldings.length > 0 ? mostConcentratedPair : '--',
        icon: Target,
        color: 'text-orange-500 bg-orange-500/10',
      },
    ],
    [filteredHoldings.length, totals, mostConcentratedPair]
  )

  // ── Reset all filters ──
  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setPairFilter('all')
    setExchangeFilter('all')
    setStatusFilter('all')
    setSortOption('newest-buy')
    setDateFrom('')
    setDateTo('')
  }, [])

  // ── Export handler ──
  const handleExport = useCallback(
    async (type: 'excel' | 'pdf') => {
      if (!currentWorkspace) return

      if (type === 'excel') {
        try {
          toast({
            title: 'Excel export started',
            description: 'Your download will begin shortly.',
          })
          const response = await fetch(
            `/api/workspaces/${currentWorkspace.id}/exports/excel/open-holdings`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${localStorage.getItem('crypto_audit_token')}`,
                'Content-Type': 'application/json',
              },
            }
          )
          if (!response.ok) throw new Error('Export failed')
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `open-holdings-${currentWorkspace.name || 'export'}.xlsx`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          toast({
            title: 'Excel exported successfully',
            description: 'File downloaded.',
          })
        } catch {
          toast({
            title: 'Export failed',
            description: 'Could not generate Excel file.',
            variant: 'destructive',
          })
        }
      } else {
        toast({
          title: 'PDF export coming soon',
          description: 'PDF summary export is under development.',
        })
      }
    },
    [currentWorkspace, toast]
  )

  // ── Loading ──
  if (isLoading) {
    return <OpenHoldingsSkeleton />
  }

  // ── No workspace ──
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Wallet className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          No Workspace Selected
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select or create a workspace to view open holdings.
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

  // ── No report / empty state ──
  if (!report || !report.openHoldings || report.openHoldings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Layers className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          No open holdings found.
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          All available BUY lots may already be matched with SELL trades.
        </p>
        <Button
          onClick={() => setCurrentPage('upload')}
          className="mt-4 bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
        >
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
        <h2 className="text-xl font-bold">Failed to load holdings</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button variant="outline" onClick={fetchReport} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════════

  if (isMobile) {
    const currentHolding = filteredHoldings[mobileIndex]

    return (
      <div className="space-y-4 px-4 pb-6">
        {/* Mobile Header */}
        <div>
          <h1 className="text-xl font-bold">Open Holdings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review remaining unmatched BUY lots and their cost basis after FIFO
            matching.
          </p>
        </div>

        {/* Mobile Summary Cards — 2x2 grid */}
        <div className="grid grid-cols-2 gap-2">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.color}`}
              >
                <card.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">
                  {card.label}
                </p>
                <p className="text-xs font-bold truncate">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search pair / exchange..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm rounded-lg"
            />
          </div>
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 rounded-lg shrink-0"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Filter & Sort</SheetTitle>
                <SheetDescription>
                  Narrow down your open holdings
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <MobileFilterControls
                  pairFilter={pairFilter}
                  setPairFilter={setPairFilter}
                  exchangeFilter={exchangeFilter}
                  setExchangeFilter={setExchangeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  sortOption={sortOption}
                  setSortOption={setSortOption}
                  dateFrom={dateFrom}
                  setDateFrom={setDateFrom}
                  dateTo={dateTo}
                  setDateTo={setDateTo}
                  uniquePairs={uniquePairs}
                  uniqueExchanges={uniqueExchanges}
                  onReset={resetFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 rounded-lg shrink-0"
            onClick={() => handleExport('excel')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {filteredHoldings.length} holding
          {filteredHoldings.length !== 1 ? 's' : ''} found
        </p>

        {/* Swipe Carousel */}
        {filteredHoldings.length > 0 && currentHolding ? (
          <SwipeCard
            currentIndex={mobileIndex}
            totalCount={filteredHoldings.length}
            onSwipeLeft={() =>
              setMobileIndex((i) =>
                Math.min(i + 1, filteredHoldings.length - 1)
              )
            }
            onSwipeRight={() =>
              setMobileIndex((i) => Math.max(i - 1, 0))
            }
            positionLabel={`Holding ${mobileIndex + 1} of ${filteredHoldings.length}`}
          >
            <MobileHoldingCard
              holding={currentHolding}
              index={mobileIndex}
            />
          </SwipeCard>
        ) : (
          <Card className="rounded-2xl border-border">
            <CardContent className="p-6 text-center">
              <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No holdings match the selected filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-xl"
                onClick={resetFilters}
              >
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
          <h1 className="text-2xl font-bold tracking-tight">
            Open Holdings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review remaining unmatched BUY lots and their cost basis after FIFO
            matching.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={filteredHoldings.length === 0}
              >
                <Download className="h-4 w-4 mr-1.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF Summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.label} className="rounded-xl border-border shadow-sm">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}
              >
                <card.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-sm font-bold truncate">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters Bar ── */}
      <Card className="rounded-xl border-border shadow-sm">
        <CardContent className="p-3.5">
          <FilterControls
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            pairFilter={pairFilter}
            setPairFilter={setPairFilter}
            exchangeFilter={exchangeFilter}
            setExchangeFilter={setExchangeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortOption={sortOption}
            setSortOption={setSortOption}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            uniquePairs={uniquePairs}
            uniqueExchanges={uniqueExchanges}
            onReset={resetFilters}
          />
        </CardContent>
      </Card>

      {/* ── No filtered results ── */}
      {filteredHoldings.length === 0 ? (
        <Card className="rounded-xl border-border">
          <CardContent className="p-8 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">
              No holdings match the selected filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
              onClick={resetFilters}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Holdings Table ── */}
          <Card className="rounded-xl border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky top-0 bg-muted/40 z-10 w-10 text-center">
                      #
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[100px]">
                      Pair
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[80px]">
                      Exchange
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[95px]">
                      Buy Date
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[80px]">
                      Original Qty
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[80px]">
                      Remaining Qty
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[90px]">
                      Buy Price
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[100px]">
                      Original Buy Value
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[120px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            Remaining Cost Basis
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Remaining Qty × Buy Price
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-right min-w-[110px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Remaining Buy Fee</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Proportional buy-side fee for remaining quantity
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 text-center min-w-[130px]">
                      Holding Status
                    </TableHead>
                    <TableHead className="sticky top-0 bg-muted/40 z-10 min-w-[100px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">Lot Ref</span>
                        </TooltipTrigger>
                        <TooltipContent>Source CSV / Lot Reference</TooltipContent>
                      </Tooltip>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHoldings.map((holding, i) => {
                    const statusInfo = getHoldingStatusInfo(holding)
                    const originalBuyValue = toD(holding.buyPrice).times(
                      toD(holding.originalQty)
                    )
                    const hasRemainingFee =
                      toD(holding.remainingAllocatedBuyFee).greaterThan(0)

                    return (
                      <TableRow
                        key={`${holding.buyTradeId}-${i}`}
                        className="hover:bg-teal-500/5 transition-colors"
                      >
                        <TableCell className="text-muted-foreground text-xs text-center">
                          {(paginationPage - 1) * pageSize + i + 1}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {holding.pair}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {holding.exchange || '--'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(holding.buyDate)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatQty(toD(holding.originalQty))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatQty(toD(holding.remainingQty))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatINR(toD(holding.buyPrice))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {formatINR(originalBuyValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                          {formatINR(toD(holding.remainingCostBasis))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {hasRemainingFee
                            ? formatINR(toD(holding.remainingAllocatedBuyFee))
                            : '--'}
                        </TableCell>
                        <TableCell className="text-center">
                          <HoldingStatusBadge statusInfo={statusInfo} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {holding.sourceCsvId
                            ? `CSV-${holding.sourceCsvId.slice(0, 8)}`
                            : '--'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 font-semibold">
                    <TableCell
                      colSpan={4}
                      className="text-right text-xs"
                    >
                      Totals
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQty(totals.originalBuyQty)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatQty(totals.remainingQty)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono text-xs">
                      {formatINR(totals.originalBuyValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                      {formatINR(totals.remainingCostBasis)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {totals.remainingBuyFee.greaterThan(0)
                        ? formatINR(totals.remainingBuyFee)
                        : '--'}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </Card>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {showingFrom}–{showingTo} of{' '}
                {filteredHoldings.length} open holding lots
              </p>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v) as PageSize)}
              >
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
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() =>
                    setPaginationPage((p) => Math.max(1, p - 1))
                  }
                  disabled={paginationPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {generatePageNumbers(paginationPage, totalPages).map(
                  (pageNum, i) =>
                    pageNum === -1 ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="px-1 text-muted-foreground text-xs"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={pageNum}
                        variant={
                          pageNum === paginationPage ? 'default' : 'outline'
                        }
                        size="sm"
                        className={`h-8 w-8 p-0 rounded-lg ${pageNum === paginationPage ? 'bg-teal-500 hover:bg-teal-600 text-white' : ''}`}
                        onClick={() => setPaginationPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() =>
                    setPaginationPage((p) => Math.min(totalPages, p + 1))
                  }
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

// ── Holding Status Badge ──────────────────────────────────

function HoldingStatusBadge({
  statusInfo,
}: {
  statusInfo: ReturnType<typeof getHoldingStatusInfo>
}) {
  const Icon =
    statusInfo.label === 'Fully Unmatched' ? CircleDot : CircleDashed

  return (
    <Badge
      variant={statusInfo.variant}
      className={`text-[10px] px-2 py-0.5 ${statusInfo.className}`}
    >
      <Icon className="h-3 w-3 mr-0.5" />
      {statusInfo.label}
    </Badge>
  )
}

// ── Filter Controls (desktop) ─────────────────────────────

function FilterControls({
  searchQuery,
  setSearchQuery,
  pairFilter,
  setPairFilter,
  exchangeFilter,
  setExchangeFilter,
  statusFilter,
  setStatusFilter,
  sortOption,
  setSortOption,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  uniquePairs,
  uniqueExchanges,
  onReset,
}: {
  searchQuery: string
  setSearchQuery: (v: string) => void
  pairFilter: string
  setPairFilter: (v: string) => void
  exchangeFilter: string
  setExchangeFilter: (v: string) => void
  statusFilter: HoldingStatusFilter
  setStatusFilter: (v: HoldingStatusFilter) => void
  sortOption: SortOption
  setSortOption: (v: SortOption) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  uniquePairs: string[]
  uniqueExchanges: string[]
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search pair / exchange..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 rounded-lg h-9 text-sm"
        />
      </div>

      {/* Pair */}
      <Select value={pairFilter} onValueChange={setPairFilter}>
        <SelectTrigger className="w-[140px] rounded-lg h-9 text-sm">
          <SelectValue placeholder="All Pairs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Pairs</SelectItem>
          {uniquePairs.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Exchange */}
      <Select value={exchangeFilter} onValueChange={setExchangeFilter}>
        <SelectTrigger className="w-[140px] rounded-lg h-9 text-sm">
          <SelectValue placeholder="All Exchanges" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Exchanges</SelectItem>
          {uniqueExchanges.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Holding Status */}
      <Select
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as HoldingStatusFilter)}
      >
        <SelectTrigger className="w-[160px] rounded-lg h-9 text-sm">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="fully-unmatched">Fully Unmatched</SelectItem>
          <SelectItem value="partially-matched">Partially Matched</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range */}
      <div className="flex items-center gap-1.5">
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
      <Select
        value={sortOption}
        onValueChange={(v) => setSortOption(v as SortOption)}
      >
        <SelectTrigger className="w-[180px] rounded-lg h-9 text-sm">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest-buy">Newest Buy Date</SelectItem>
          <SelectItem value="oldest-buy">Oldest Buy Date</SelectItem>
          <SelectItem value="highest-remaining-qty">
            Highest Remaining Qty
          </SelectItem>
          <SelectItem value="highest-cost-basis">
            Highest Cost Basis
          </SelectItem>
          <SelectItem value="lowest-cost-basis">Lowest Cost Basis</SelectItem>
          <SelectItem value="pair-az">Pair A–Z</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 rounded-lg text-muted-foreground hover:text-foreground"
        onClick={onReset}
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
      </Button>
    </div>
  )
}

// ── Mobile Filter Controls ────────────────────────────────

function MobileFilterControls({
  pairFilter,
  setPairFilter,
  exchangeFilter,
  setExchangeFilter,
  statusFilter,
  setStatusFilter,
  sortOption,
  setSortOption,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  uniquePairs,
  uniqueExchanges,
  onReset,
}: {
  pairFilter: string
  setPairFilter: (v: string) => void
  exchangeFilter: string
  setExchangeFilter: (v: string) => void
  statusFilter: HoldingStatusFilter
  setStatusFilter: (v: HoldingStatusFilter) => void
  sortOption: SortOption
  setSortOption: (v: SortOption) => void
  dateFrom: string
  setDateFrom: (v: string) => void
  dateTo: string
  setDateTo: (v: string) => void
  uniquePairs: string[]
  uniqueExchanges: string[]
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Pair */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Pair</label>
        <Select value={pairFilter} onValueChange={setPairFilter}>
          <SelectTrigger className="rounded-xl w-full">
            <SelectValue placeholder="All Pairs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pairs</SelectItem>
            {uniquePairs.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Exchange */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Exchange</label>
        <Select value={exchangeFilter} onValueChange={setExchangeFilter}>
          <SelectTrigger className="rounded-xl w-full">
            <SelectValue placeholder="All Exchanges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exchanges</SelectItem>
            {uniqueExchanges.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Holding Status */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          Holding Status
        </label>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as HoldingStatusFilter)}
        >
          <SelectTrigger className="rounded-xl w-full">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="fully-unmatched">
              Fully Unmatched Buy Lot
            </SelectItem>
            <SelectItem value="partially-matched">
              Partially Matched Remaining Lot
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          Buy Date Range
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl flex-1"
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl flex-1"
            placeholder="To"
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Sort By</label>
        <Select
          value={sortOption}
          onValueChange={(v) => setSortOption(v as SortOption)}
        >
          <SelectTrigger className="rounded-xl w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest-buy">Newest Buy Date</SelectItem>
            <SelectItem value="oldest-buy">Oldest Buy Date</SelectItem>
            <SelectItem value="highest-remaining-qty">
              Highest Remaining Qty
            </SelectItem>
            <SelectItem value="highest-cost-basis">
              Highest Cost Basis
            </SelectItem>
            <SelectItem value="lowest-cost-basis">
              Lowest Cost Basis
            </SelectItem>
            <SelectItem value="pair-az">Pair A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reset */}
      <Button
        variant="outline"
        className="rounded-xl w-full"
        onClick={onReset}
      >
        <RotateCcw className="h-4 w-4 mr-2" /> Reset All Filters
      </Button>
    </div>
  )
}

// ── Mobile Holding Card ────────────────────────────────────

function MobileHoldingCard({
  holding,
  index,
}: {
  holding: OpenHolding
  index: number
}) {
  const statusInfo = getHoldingStatusInfo(holding)
  const originalValue = toD(holding.buyPrice).times(toD(holding.originalQty))
  const remainingCost = toD(holding.remainingCostBasis)
  const remainingFee = toD(holding.remainingAllocatedBuyFee)
  const hasRemainingFee = remainingFee.greaterThan(0)

  return (
    <Card className="rounded-2xl border border-teal-500/20 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 flex items-center justify-between bg-teal-500/5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{holding.pair}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400"
          >
            OPEN HOLDING
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">#{index + 1}</span>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Holding Summary */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Holding Summary
          </p>
          <div className="grid grid-cols-3 gap-2">
            <DetailItem
              label="Remaining Qty"
              value={formatQty(toD(holding.remainingQty))}
            />
            <DetailItem
              label="Cost Basis"
              value={formatINR(remainingCost)}
              valueClass="text-teal-600 dark:text-teal-400 font-semibold"
            />
            <DetailItem
              label="Buy Price"
              value={formatINR(toD(holding.buyPrice))}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Lot Origin */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Lot Origin
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DetailItem
              label="Original Qty"
              value={formatQty(toD(holding.originalQty))}
            />
            <DetailItem
              label="Remaining Qty"
              value={formatQty(toD(holding.remainingQty))}
            />
            <DetailItem
              label="Buy Date"
              value={fmtDate(holding.buyDate)}
            />
            <DetailItem
              label="Exchange"
              value={holding.exchange || '--'}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Cost Details */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Cost Details
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Original Buy Value
              </span>
              <span className="text-xs font-mono">
                {formatINR(originalValue)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-teal-500/5">
              <span className="text-sm font-semibold">
                Remaining Cost Basis
              </span>
              <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
                {formatINR(remainingCost)}
              </span>
            </div>
            {hasRemainingFee && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Remaining Buy Fee
                </span>
                <span className="text-xs font-mono">
                  {formatINR(remainingFee)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Holding Status */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Holding Status
          </p>
          <HoldingStatusBadge statusInfo={statusInfo} />
          <p className="text-[10px] text-muted-foreground mt-1">
            {statusInfo.fullLabel}
          </p>
        </div>

        {/* Source */}
        {holding.sourceCsvId && (
          <>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Source / Lot Ref
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                CSV-{holding.sourceCsvId.slice(0, 8)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Small sub-components ──

function DetailItem({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

// ── Skeleton ──

function OpenHoldingsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-80 rounded-xl mt-2" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
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

      {/* Filters */}
      <Skeleton className="h-14 rounded-xl" />

      {/* Table */}
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  )
}
