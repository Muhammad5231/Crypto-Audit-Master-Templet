'use client'

import { cn } from '@/lib/utils'
import { useAppStore, type AppPage } from '@/stores/app-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Calculator,
  FolderOpen,
  Settings,
  SlidersHorizontal,
  FileText,
  Download,
  BookOpen,
  Shield,
  Plus,
  Archive,
  ChevronsLeft,
  ChevronsRight,
  Package,
} from 'lucide-react'

interface NavItem {
  id: AppPage
  label: string
  icon: React.ElementType
  section: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'OVERVIEW' },
  { id: 'realized-trades', label: 'Realized Trades', icon: ArrowLeftRight, section: 'OVERVIEW' },
  { id: 'open-holdings', label: 'Open Holdings', icon: Wallet, section: 'OVERVIEW' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'OVERVIEW' },
  { id: 'tax-summary', label: 'Tax Summary', icon: Calculator, section: 'OVERVIEW' },
  { id: 'workspaces', label: 'Workspaces', icon: FolderOpen, section: 'WORKSPACE' },
  { id: 'workspace-settings', label: 'Workspace Settings', icon: Settings, section: 'WORKSPACE' },
  { id: 'exchange-settings', label: 'Exchange Settings', icon: SlidersHorizontal, section: 'TOOLS' },
  { id: 'notes', label: 'Notes', icon: FileText, section: 'TOOLS' },
  { id: 'export-center', label: 'Export Center', icon: Package, section: 'TOOLS' },
  { id: 'export-history', label: 'Export History', icon: Download, section: 'TOOLS' },
  { id: 'documentation', label: 'Documentation', icon: BookOpen, section: 'TOOLS' },
]

const sections = ['OVERVIEW', 'WORKSPACE', 'TOOLS'] as const

const SIDEBAR_EXPANDED_WIDTH = 272
const SIDEBAR_COLLAPSED_WIDTH = 64

export { SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH }

export function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore()
  const { createWorkspace, workspaces } = useWorkspaceStore()
  const safeWorkspaces = workspaces ?? []

  const handleNewWorkspace = async () => {
    try {
      await createWorkspace({
        name: `Workspace ${safeWorkspaces.length + 1}`,
        financialYear: new Date().getFullYear().toString(),
      })
      setCurrentPage('workspaces')
    } catch (error) {
      console.error('Failed to create workspace:', error)
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-card h-screen fixed left-0 top-0 z-30',
          'transition-[width] duration-300 ease-in-out'
        )}
        style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
      >
        {/* Brand Area */}
        <div className={cn(
          'flex items-center gap-3 transition-all duration-300',
          sidebarCollapsed ? 'px-0 py-5 justify-center' : 'px-6 py-5'
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
            <Shield className="h-5 w-5 text-teal-500" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-semibold leading-tight whitespace-nowrap">Crypto Audit Master</h1>
              <p className="text-[11px] text-muted-foreground leading-tight whitespace-nowrap">Trade Audit Platform</p>
            </div>
          )}
        </div>

        {/* New Workspace Button */}
        <div className={cn('pb-3 transition-all duration-300', sidebarCollapsed ? 'px-2' : 'px-4')}>
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleNewWorkspace}
                  size="icon"
                  className="w-full h-9 rounded-xl bg-teal-500 hover:bg-teal-600 text-white"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                New Workspace
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={handleNewWorkspace}
              className="w-full justify-start gap-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          )}
        </div>

        <div className={cn('transition-all duration-300', sidebarCollapsed ? 'px-2' : 'px-4')}>
          <Separator />
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-3">
          <div className={cn('transition-all duration-300', sidebarCollapsed ? 'px-2' : 'px-3')}>
            {sections.map((section) => {
              const sectionItems = navItems.filter((item) => item.section === section)
              return (
                <div key={section} className="mb-2">
                  {/* Section header — hidden when collapsed */}
                  {!sidebarCollapsed && (
                    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {section}
                    </p>
                  )}
                  {sidebarCollapsed && section === 'WORKSPACE' && (
                    <Separator className="my-2" />
                  )}
                  {sidebarCollapsed && section === 'TOOLS' && (
                    <Separator className="my-2" />
                  )}
                  <div className="space-y-0.5">
                    {sectionItems.map((item) => {
                      const isActive = currentPage === item.id
                      const Icon = item.icon

                      const navButton = (
                        <button
                          key={item.id}
                          onClick={() => setCurrentPage(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex items-center rounded-lg text-sm transition-all duration-150',
                            'hover:bg-accent hover:text-accent-foreground',
                            isActive
                              ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium'
                              : 'text-muted-foreground',
                            sidebarCollapsed
                              ? 'w-full justify-center px-0 py-2.5'
                              : 'w-full justify-start gap-3 px-3 py-2'
                          )}
                        >
                          <div className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
                            isActive && 'text-teal-500'
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {!sidebarCollapsed && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {item.id === 'workspaces' && safeWorkspaces.length > 0 && (
                                <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                                  {safeWorkspaces.filter((w) => !w.isArchived).length}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      )

                      if (sidebarCollapsed) {
                        return (
                          <Tooltip key={item.id}>
                            <TooltipTrigger asChild>
                              {navButton}
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                              {item.label}
                              {item.id === 'workspaces' && safeWorkspaces.length > 0 && (
                                <span className="ml-1.5 text-muted-foreground">
                                  ({safeWorkspaces.filter((w) => !w.isArchived).length})
                                </span>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )
                      }

                      return navButton
                    })}
                  </div>
                </div>
              )
            })}

            {/* Archived workspaces link */}
            {safeWorkspaces.some((w) => w.isArchived) && (
              sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCurrentPage('workspaces')}
                      className="flex w-full items-center justify-center rounded-lg px-0 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                    >
                      <Archive className="h-4 w-4 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    Archived ({safeWorkspaces.filter((w) => w.isArchived).length})
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="mt-3">
                  <button
                    onClick={() => setCurrentPage('workspaces')}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
                  >
                    <Archive className="h-4 w-4 shrink-0" />
                    <span className="truncate">Archived ({safeWorkspaces.filter((w) => w.isArchived).length})</span>
                  </button>
                </div>
              )
            )}
          </div>
        </ScrollArea>

        {/* Bottom Section — Collapse Toggle */}
        <div className={cn(
          'border-t border-border flex items-center transition-all duration-300',
          sidebarCollapsed ? 'justify-center py-3' : 'px-4 py-3 justify-between'
        )}>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">v1.0</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 whitespace-nowrap">
                For educational purposes only
              </p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md shrink-0 text-muted-foreground hover:text-foreground"
                onClick={toggleSidebarCollapsed}
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
