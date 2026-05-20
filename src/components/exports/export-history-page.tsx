'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — Export History Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Table on desktop, cards on mobile. Each export row/card shows
// type badge, filename, date, status badge, and download button.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore } from '@/stores/app-store'
import { apiGet, apiPost } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Download,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wallet,
  Archive,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────

interface ExportRecord {
  id: string
  workspaceId: string
  userId: string
  exportType: string
  fileName: string
  fileFormat: string
  status: 'COMPLETED' | 'PENDING' | 'FAILED'
  generatedAt: string
  downloadUrl: string | null
  createdAt: string
}

// ── Main Export History Component ──────────────────────────

export default function ExportHistoryPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const isMobile = useIsMobile()
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Fetch exports
  const fetchExports = useCallback(async () => {
    if (!currentWorkspace) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiGet<{ exports: ExportRecord[] }>(
        `/api/workspaces/${currentWorkspace.id}/exports`
      )
      setExports(data.exports || [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load exports'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchExports()
  }, [fetchExports])

  // Generate new export
  const handleGenerateExport = async () => {
    if (!currentWorkspace) return
    setIsGenerating(true)
    try {
      await apiPost(`/api/workspaces/${currentWorkspace.id}/reports/process`)
      toast.success('Report regenerated. Export will be available shortly.')
      await fetchExports()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate export'
      toast.error(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-400 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
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

  // Get export type badge
  const getExportTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      'TAX_SUMMARY': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      'REALIZED_TRADES': 'bg-green-500/10 text-green-600 dark:text-green-400',
      'OPEN_HOLDINGS': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      'FULL_REPORT': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    }
    return (
      <Badge variant="secondary" className={`text-[10px] ${typeColors[type] || ''}`}>
        {type.replace(/_/g, ' ')}
      </Badge>
    )
  }

  // Loading state
  if (isLoading) {
    return <ExportHistorySkeleton />
  }

  // No workspace
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
          <Archive className="h-8 w-8 text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Workspace Selected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Select a workspace to view export history.
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
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Archive className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Export History</h2>
                <p className="text-sm text-muted-foreground">
                  {exports.length} export{exports.length !== 1 ? 's' : ''} generated
                </p>
              </div>
            </div>
            <Button
              onClick={handleGenerateExport}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Generate New Export</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Error State ── */}
      {error && (
        <Card className="rounded-2xl border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={fetchExports} className="mt-3">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty State ── */}
      {exports.length === 0 && !error && (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <Download className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No exports generated yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Process a report first, then generate exports for download.
            </p>
            <Button
              onClick={handleGenerateExport}
              disabled={isGenerating}
              className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Generate Your First Export</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Desktop: Table Layout ── */}
      {!isMobile && exports.length > 0 && (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Type</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Filename</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Generated</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {exports.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="p-4">{getExportTypeBadge(exp.exportType)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate max-w-[200px]">{exp.fileName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(exp.generatedAt || exp.createdAt)}
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(exp.status)}</td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={exp.status !== 'COMPLETED' || !exp.downloadUrl}
                          className="rounded-lg text-teal-500 hover:text-teal-600 hover:bg-teal-500/10"
                        >
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Mobile: Card Layout ── */}
      {isMobile && exports.length > 0 && (
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {exports.map((exp) => (
            <Card key={exp.id} className="rounded-2xl border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  {getExportTypeBadge(exp.exportType)}
                  {getStatusBadge(exp.status)}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{exp.fileName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDate(exp.generatedAt || exp.createdAt)}
                  </div>
                </div>
                {exp.status === 'COMPLETED' && exp.downloadUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 rounded-xl text-teal-500 border-teal-500/30 hover:bg-teal-500/10"
                  >
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────

function ExportHistorySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
