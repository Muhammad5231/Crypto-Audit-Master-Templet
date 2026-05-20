'use client'

import { useAppStore, type AppPage } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Sun, Moon, Bell, LogOut, Settings, User, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

const pageTitles: Record<AppPage, string> = {
  'dashboard': 'Dashboard',
  'realized-trades': 'Realized Trades',
  'open-holdings': 'Open Holdings',
  'analytics': 'Analytics',
  'tax-summary': 'Tax Summary',
  'exchange-settings': 'Exchange Settings',
  'notes': 'Notes',
  'export-history': 'Export History',
  'documentation': 'Documentation',
  'settings': 'Settings',
  'workspaces': 'Workspaces',
  'workspace-settings': 'Workspace Settings',
  'upload': 'Upload CSV',
}

export function Topbar() {
  const { currentPage, searchQuery, setSearchQuery, toggleSidebar, setCurrentPage } = useAppStore()
  const { user, logout } = useAuthStore()
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspaceStore()
  const safeWorkspaces = workspaces ?? []
  const { theme, setTheme } = useTheme()

  const pageTitle = pageTitles[currentPage] || 'Dashboard'

  return (
    <header className="sticky top-0 z-20 h-[72px] border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 md:px-6 gap-4">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Left: Workspace selector + Page title */}
      <div className="flex items-center gap-3 shrink-0">
        {safeWorkspaces.length > 0 && (
          <Select
            value={currentWorkspace?.id || ''}
            onValueChange={selectWorkspace}
          >
            <SelectTrigger className="w-[180px] h-8 text-sm rounded-lg">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {safeWorkspaces.filter((w) => !w.isArchived).map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  <div className="flex items-center gap-2">
                    {ws.color && (
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ws.color }}
                      />
                    )}
                    <span className="truncate">{ws.name}</span>
                    {ws.financialYear && (
                      <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">
                        FY{ws.financialYear}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="hidden sm:block">
          <h2 className="text-sm font-semibold leading-none">{pageTitle}</h2>
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-auto hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trades, holdings..."
            className="pl-9 h-9 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-teal-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-lg p-0 ml-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn('bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold')}>
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.username || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentPage('settings')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentPage('settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
