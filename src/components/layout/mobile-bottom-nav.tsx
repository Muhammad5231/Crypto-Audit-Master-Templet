'use client'

import { useState } from 'react'
import { useAppStore, type AppPage } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Calculator,
  MoreHorizontal,
  BarChart3,
  Upload,
  SlidersHorizontal,
  FileText,
  Download,
  BookOpen,
  Settings,
  FolderOpen,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const mainTabs: { id: AppPage; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'realized-trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'open-holdings', label: 'Holdings', icon: Wallet },
  { id: 'tax-summary', label: 'Tax', icon: Calculator },
]

const moreItems: { id: AppPage; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'OVERVIEW' },
  { id: 'upload', label: 'Upload CSV', icon: Upload, section: 'OVERVIEW' },
  { id: 'workspaces', label: 'Workspaces', icon: FolderOpen, section: 'WORKSPACE' },
  { id: 'exchange-settings', label: 'Exchange Settings', icon: SlidersHorizontal, section: 'TOOLS' },
  { id: 'notes', label: 'Notes', icon: FileText, section: 'TOOLS' },
  { id: 'export-history', label: 'Export History', icon: Download, section: 'TOOLS' },
  { id: 'documentation', label: 'Documentation', icon: BookOpen, section: 'TOOLS' },
  { id: 'settings', label: 'Settings', icon: Settings, section: '' },
]

export function MobileBottomNav() {
  const { currentPage, setCurrentPage } = useAppStore()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = moreItems.some((item) => item.id === currentPage)

  const handleMoreItemSelect = (page: AppPage) => {
    setCurrentPage(page)
    setMoreOpen(false)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {mainTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = currentPage === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentPage(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors rounded-lg',
                isActive ? 'text-teal-500' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-teal-500" />
              )}
            </button>
          )
        })}

        {/* More button with Sheet */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              aria-current={isMoreActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors rounded-lg',
                isMoreActive ? 'text-teal-500' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
            <SheetHeader>
              <SheetTitle className="text-left">More Options</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1">
              {moreItems.map((item, idx) => {
                const Icon = item.icon
                const isActive = currentPage === item.id
                const showSection = idx === 0 || (item.section !== moreItems[idx - 1]?.section && item.section)
                return (
                  <div key={item.id}>
                    {showSection && item.section && (
                      <>
                        {idx > 0 && <Separator className="my-2" />}
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {item.section}
                        </p>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full justify-start gap-3 rounded-xl h-11',
                        isActive && 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                      )}
                      onClick={() => handleMoreItemSelect(item.id)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </div>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
