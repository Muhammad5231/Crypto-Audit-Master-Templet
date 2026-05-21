'use client'

import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/stores/app-store'
import { Sidebar, SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './sidebar'
import { DesktopHeader } from './desktop-header'
import { MobileBottomNav } from './mobile-bottom-nav'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type { AppPage } from '@/stores/app-store'

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
  { id: 'export-history', label: 'Export History', icon: Download, section: 'TOOLS' },
  { id: 'documentation', label: 'Documentation', icon: BookOpen, section: 'TOOLS' },
]

const sections = ['OVERVIEW', 'WORKSPACE', 'TOOLS'] as const

function MobileSidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen } = useAppStore()
  const { createWorkspace, workspaces } = useWorkspaceStore()
  const safeWorkspaces = workspaces ?? []

  const handleNewWorkspace = async () => {
    try {
      await createWorkspace({
        name: `Workspace ${safeWorkspaces.length + 1}`,
        financialYear: new Date().getFullYear().toString(),
      })
      setCurrentPage('workspaces')
      setSidebarOpen(false)
    } catch (error) {
      console.error('Failed to create workspace:', error)
    }
  }

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent side="left" className="w-[272px] p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        {/* Brand Area */}
        <div className="px-6 py-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
            <Shield className="h-5 w-5 text-teal-500" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Crypto Audit Master</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Trade Audit Platform</p>
          </div>
        </div>

        {/* New Workspace Button */}
        <div className="px-4 pb-3">
          <Button
            onClick={handleNewWorkspace}
            className="w-full justify-start gap-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-9 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Workspace
          </Button>
        </div>

        <Separator className="mx-4" />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-3">
          {sections.map((section) => {
            const sectionItems = navItems.filter((item) => item.section === section)
            return (
              <div key={section} className="mb-2">
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section}
                </p>
                <div className="space-y-0.5">
                  {sectionItems.map((item) => {
                    const isActive = currentPage === item.id
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentPage(item.id)
                          setSidebarOpen(false)
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                          'hover:bg-accent hover:text-accent-foreground',
                          isActive
                            ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium'
                            : 'text-muted-foreground'
                        )}
                      >
                        <div className={cn(
                          'flex h-5 w-5 items-center justify-center rounded transition-colors',
                          isActive && 'text-teal-500'
                        )}>
                          <Icon className="h-4 w-4 shrink-0" />
                        </div>
                        <span className="truncate">{item.label}</span>
                        {item.id === 'workspaces' && safeWorkspaces.length > 0 && (
                          <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                            {safeWorkspaces.filter((w) => !w.isArchived).length}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </ScrollArea>

        {/* Bottom */}
        <div className="border-t border-border px-6 py-3">
          <p className="text-[10px] text-muted-foreground">v1.0</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  const { sidebarCollapsed } = useAppStore()

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Sidebar (Sheet) */}
      {isMobile && <MobileSidebar />}

      {/* Main content area */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out',
          !isMobile && 'md:ml-0'
        )}
        style={!isMobile ? { marginLeft: sidebarWidth } : undefined}
      >
        <div className={cn(isMobile && 'safe-area-top')}>
          <DesktopHeader />
        </div>
        <main className={cn('flex-1 p-4 md:p-6', isMobile && 'pb-24')}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  )
}
