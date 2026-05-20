'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — CSV Preview Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full CSV data preview in a large dialog with search, jump-to-row,
// sticky headers, and premium fintech styling.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, X, FileSpreadsheet, ArrowDown } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

// ── Constants ─────────────────────────────────────────────────
const MAX_RENDER_ROWS = 500

// ── Props Interface ───────────────────────────────────────────
interface CsvPreviewModalProps {
  open: boolean
  onClose: () => void
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}

// ── Component ─────────────────────────────────────────────────
export function CsvPreviewModal({
  open,
  onClose,
  fileName,
  headers,
  rows,
  totalRows,
}: CsvPreviewModalProps) {
  const isMobile = useIsMobile()
  const [searchQuery, setSearchQuery] = useState('')
  const [jumpToRow, setJumpToRow] = useState('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
  const [headerScrolled, setHeaderScrolled] = useState(false)

  // ── Filter rows by search query ──
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows

    const query = searchQuery.toLowerCase().trim()
    return rows.filter((row) =>
      headers.some((header) => {
        const val = row[header]
        return val != null && val.toLowerCase().includes(query)
      })
    )
  }, [rows, headers, searchQuery])

  // ── Limit rendered rows for performance ──
  const isTruncated = filteredRows.length > MAX_RENDER_ROWS
  const displayRows = useMemo(
    () => (isTruncated ? filteredRows.slice(0, MAX_RENDER_ROWS) : filteredRows),
    [filteredRows, isTruncated],
  )

  // ── Scroll handler for sticky header shadow ──
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current) return
    const scrollTop = tableContainerRef.current.scrollTop
    setHeaderScrolled(scrollTop > 0)
  }, [])

  // ── Jump to a specific row number ──
  const handleJumpToRow = useCallback(() => {
    const rowNum = parseInt(jumpToRow, 10)
    if (isNaN(rowNum) || rowNum < 1 || rowNum > filteredRows.length) return

    const targetRow = rowRefs.current.get(rowNum - 1)
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight flash
      targetRow.classList.add('ring-2', 'ring-teal-500/50')
      setTimeout(() => {
        targetRow.classList.remove('ring-2', 'ring-teal-500/50')
      }, 1500)
    }
    setJumpToRow('')
  }, [jumpToRow, filteredRows.length])

  // ── Close handler: reset internal state then notify parent ──
  const handleClose = useCallback(() => {
    setSearchQuery('')
    setJumpToRow('')
    setHeaderScrolled(false)
    rowRefs.current.clear()
    onClose()
  }, [onClose])

  // ── Keyboard handler for jump input ──
  const handleJumpKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleJumpToRow()
      }
    },
    [handleJumpToRow],
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className={`
          flex flex-col gap-0 p-0 overflow-hidden
          ${isMobile ? 'w-[95vw] h-[95vh] max-w-none max-h-none' : 'sm:max-w-[1000px]'}
          rounded-2xl border-border
        `}
      >
        {/* ── Header ── */}
        <DialogHeader
          className={`
            shrink-0 px-4 py-3 border-b border-border
            bg-gradient-to-r from-teal-600 to-teal-500
            ${isMobile ? 'px-3 py-2.5' : ''}
          `}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-white" />
              </div>
              <DialogTitle className="text-white text-sm font-semibold truncate">
                {fileName} — CSV Preview
              </DialogTitle>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-white/20 text-white border-white/25 text-[10px] px-2 py-0.5 hover:bg-white/25">
                {totalRows.toLocaleString()} rows
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-white/80 hover:text-white hover:bg-white/15"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Toolbar ── */}
        <div
          className={`
            shrink-0 border-b border-border bg-background/95 backdrop-blur-sm
            ${isMobile ? 'px-3 py-2' : 'px-4 py-2.5'}
          `}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-[300px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search all columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs rounded-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Jump to row */}
            {!isMobile && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Go to row</span>
                <Input
                  type="number"
                  min={1}
                  max={filteredRows.length}
                  placeholder="#"
                  value={jumpToRow}
                  onChange={(e) => setJumpToRow(e.target.value)}
                  onKeyDown={handleJumpKeyDown}
                  className="h-8 w-16 text-xs text-center rounded-lg"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg shrink-0"
                  onClick={handleJumpToRow}
                  disabled={!jumpToRow}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Row count */}
            <div className="ml-auto shrink-0">
              {searchQuery ? (
                <span className="text-[11px] text-muted-foreground">
                  Showing{' '}
                  <span className="font-medium text-foreground">
                    {filteredRows.length.toLocaleString()}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-foreground">
                    {rows.length.toLocaleString()}
                  </span>{' '}
                  rows
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {rows.length.toLocaleString()} rows
                  {headers.length > 0 && (
                    <> &middot; {headers.length} columns</>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Truncation notice ── */}
        {isTruncated && (
          <div className="shrink-0 px-4 py-1.5 bg-amber-500/5 border-b border-amber-500/15">
            <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
              Displaying first {MAX_RENDER_ROWS} of {filteredRows.length.toLocaleString()} matching rows for performance.
              Use search to narrow results.
            </p>
          </div>
        )}

        {/* ── Table ── */}
        <ScrollArea
          className={`
            flex-1 overflow-hidden
            ${isMobile ? 'h-[calc(95vh-130px)]' : 'max-h-[60vh]'}
          `}
        >
          <div
            ref={tableContainerRef}
            onScroll={handleScroll}
            className="min-w-full"
          >
            <Table className="w-full border-collapse">
              <TableHeader>
                <TableRow
                  className={`
                    bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-50 dark:hover:bg-teal-950/30
                    sticky top-0 z-10
                    ${headerScrolled ? 'shadow-md' : 'shadow-none'}
                    transition-shadow duration-200
                  `}
                >
                  {/* Row number column */}
                  <TableHead
                    className="
                      w-[50px] min-w-[50px] text-center text-[10px] font-bold
                      text-teal-700 dark:text-teal-300 uppercase tracking-wider
                      bg-teal-50 dark:bg-teal-950/30
                    "
                  >
                    #
                  </TableHead>
                  {headers.map((header) => (
                    <TableHead
                      key={header}
                      className="
                        min-w-[100px] text-[10px] font-bold uppercase tracking-wider
                        text-teal-700 dark:text-teal-300 whitespace-nowrap
                        bg-teal-50 dark:bg-teal-950/30
                      "
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={headers.length + 1}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      {searchQuery ? (
                        <div className="flex flex-col items-center gap-2">
                          <Search className="h-5 w-5 text-muted-foreground/40" />
                          <span>No rows match &ldquo;{searchQuery}&rdquo;</span>
                        </div>
                      ) : (
                        <span>No data to display</span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayRows.map((row, index) => (
                    <TableRow
                      key={index}
                      ref={(el) => {
                        if (el) {
                          rowRefs.current.set(index, el)
                        }
                      }}
                      className={`
                        transition-colors duration-100
                        ${index % 2 === 0
                          ? 'bg-background'
                          : 'bg-muted/30 dark:bg-muted/15'
                        }
                        hover:bg-teal-50/50 dark:hover:bg-teal-950/15
                      `}
                    >
                      {/* Row number */}
                      <TableCell
                        className="
                          w-[50px] min-w-[50px] text-center text-[10px]
                          text-muted-foreground font-medium sticky left-0
                          bg-inherit z-[5]
                        "
                      >
                        {index + 1}
                      </TableCell>
                      {headers.map((header) => (
                        <TableCell
                          key={header}
                          className="
                            text-xs font-mono whitespace-nowrap
                            text-foreground/80 max-w-[300px]
                            truncate
                          "
                          title={row[header] ?? ''}
                        >
                          {row[header] ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        {/* ── Footer (mobile jump-to-row) ── */}
        {isMobile && (
          <div className="shrink-0 px-3 py-2 border-t border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Row</span>
              <Input
                type="number"
                min={1}
                max={filteredRows.length}
                placeholder="#"
                value={jumpToRow}
                onChange={(e) => setJumpToRow(e.target.value)}
                onKeyDown={handleJumpKeyDown}
                className="h-8 w-16 text-xs text-center rounded-lg"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={handleJumpToRow}
                disabled={!jumpToRow}
              >
                <ArrowDown className="h-3.5 w-3.5 mr-1" />
                Go
              </Button>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-xs text-muted-foreground"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
