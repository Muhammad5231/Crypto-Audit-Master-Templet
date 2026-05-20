'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore, type AppPage } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useNotificationStore, type NotificationType } from '@/stores/notification-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Search,
  Sun,
  Moon,
  Bell,
  LogOut,
  Settings,
  User,
  ChevronDown,
  Plus,
  FolderOpen,
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  BarChart3,
  Calculator,
  SlidersHorizontal,
  FileText,
  Download,
  BookOpen,
  Upload,
  Check,
  CheckCheck,
  Trash2,
  FileUp,
  FileWarning,
  AlertTriangle,
  FileSpreadsheet,
  FolderPlus,
  Archive,
  X,
  Menu,
} from 'lucide-react'
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

const notificationIcons: Record<NotificationType, React.ElementType> = {
  'csv-uploaded': FileUp,
  'report-processed': FileSpreadsheet,
  'duplicate-csv': AlertTriangle,
  'warnings-found': FileWarning,
  'export-generated': Download,
  'workspace-created': FolderPlus,
  'workspace-archived': Archive,
  'general': Bell,
}

const notificationColors: Record<NotificationType, string> = {
  'csv-uploaded': 'text-emerald-500 bg-emerald-500/10',
  'report-processed': 'text-blue-500 bg-blue-500/10',
  'duplicate-csv': 'text-amber-500 bg-amber-500/10',
  'warnings-found': 'text-orange-500 bg-orange-500/10',
  'export-generated': 'text-violet-500 bg-violet-500/10',
  'workspace-created': 'text-teal-500 bg-teal-500/10',
  'workspace-archived': 'text-slate-500 bg-slate-500/10',
  'general': 'text-muted-foreground bg-muted',
}

// ─── Workspace Selector ───────────────────────────────────────────
function WorkspaceSelector() {
  const { workspaces, currentWorkspace, selectWorkspace, createWorkspace } = useWorkspaceStore()
  const { setCurrentPage } = useAppStore()
  const safeWorkspaces = workspaces ?? []
  const activeWorkspaces = safeWorkspaces.filter((w) => !w.isArchived)
  const archivedCount = safeWorkspaces.filter((w) => w.isArchived).length

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 px-3 py-1.5 text-sm transition-colors max-w-[260px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
        >
          {currentWorkspace?.color && (
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: currentWorkspace.color }}
            />
          )}
          <span className="truncate font-medium text-foreground">
            {currentWorkspace?.name || 'Select Workspace'}
          </span>
          {currentWorkspace?.financialYear && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-medium shrink-0">
              FY {currentWorkspace.financialYear}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-2">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2">
          Workspaces
        </DropdownMenuLabel>
        {activeWorkspaces.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            No workspaces yet
          </div>
        )}
        {activeWorkspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => selectWorkspace(ws.id)}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
              currentWorkspace?.id === ws.id && 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
            )}
          >
            {ws.color && (
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: ws.color }}
              />
            )}
            <span className="truncate flex-1">{ws.name}</span>
            {ws.financialYear && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
                FY{ws.financialYear}
              </Badge>
            )}
            {currentWorkspace?.id === ws.id && (
              <Check className="h-3.5 w-3.5 text-teal-500 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleNewWorkspace} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCurrentPage('workspaces')} className="cursor-pointer">
          <FolderOpen className="mr-2 h-4 w-4" />
          Manage Workspaces
          {archivedCount > 0 && (
            <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0 h-4">
              {archivedCount} archived
            </Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Page Title ───────────────────────────────────────────────────
function PageTitle() {
  const { currentPage } = useAppStore()
  const pageTitle = pageTitles[currentPage] || 'Dashboard'

  return (
    <div className="hidden sm:flex items-center gap-3 shrink-0">
      <Separator orientation="vertical" className="h-5" />
      <h2 className="text-sm font-semibold leading-none text-foreground">{pageTitle}</h2>
    </div>
  )
}

// ─── Search Trigger + Modal ───────────────────────────────────────
function SearchTrigger() {
  const [open, setOpen] = useState(false)
  const { setCurrentPage } = useAppStore()

  // Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
      >
        <Search className="h-3.5 w-3.5" />
        <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search pages, workspaces, and actions"
      >
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Overview">
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('dashboard'))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('realized-trades'))}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Realized Trades
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('open-holdings'))}>
              <Wallet className="mr-2 h-4 w-4" />
              Open Holdings
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('analytics'))}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('tax-summary'))}>
              <Calculator className="mr-2 h-4 w-4" />
              Tax Summary
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Workspace">
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('workspaces'))}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Workspaces
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('workspace-settings'))}>
              <Settings className="mr-2 h-4 w-4" />
              Workspace Settings
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('upload'))}>
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Tools">
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('exchange-settings'))}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Exchange Settings
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('notes'))}>
              <FileText className="mr-2 h-4 w-4" />
              Notes
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('export-history'))}>
              <Download className="mr-2 h-4 w-4" />
              Export History
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setCurrentPage('documentation'))}>
              <BookOpen className="mr-2 h-4 w-4" />
              Documentation
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

// ─── Notification Panel ───────────────────────────────────────────
function NotificationPanel() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } =
    useNotificationStore()

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    return `${diffDay}d ago`
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2 text-teal-600 dark:text-teal-400 hover:text-teal-700"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-0.5">We&apos;ll notify you when something happens</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type]
                const colorClass = notificationColors[notification.type]
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30 group',
                      !notification.read && 'bg-teal-500/[0.03]'
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm leading-snug', !notification.read && 'font-medium')}>
                          {notification.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            clearNotification(notification.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-muted"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatTimeAgo(notification.timestamp)}
                        </span>
                        {notification.workspaceName && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] text-muted-foreground/70">
                              {notification.workspaceName}
                            </span>
                          </>
                        )}
                        {!notification.read && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] text-teal-500 font-medium">New</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ─── Theme Toggle ─────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-lg"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

// ─── Profile Dropdown ─────────────────────────────────────────────
function ProfileDropdown() {
  const { user, logout } = useAuthStore()
  const { setCurrentPage } = useAppStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg p-0.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[11px] font-semibold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-2">
        <div className="px-2 py-2 mb-1">
          <p className="text-sm font-medium">{user?.username || 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCurrentPage('settings')} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Profile & Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCurrentPage('settings')} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          User Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Upload CSV Button ────────────────────────────────────────────
function UploadCsvButton() {
  const { setCurrentPage } = useAppStore()

  return (
    <Button
      onClick={() => setCurrentPage('upload')}
      size="sm"
      className="h-8 gap-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg px-3 shadow-sm"
    >
      <Upload className="h-3.5 w-3.5" />
      <span className="hidden sm:inline text-xs font-medium">Upload CSV</span>
    </Button>
  )
}

// ─── Main Desktop Header ──────────────────────────────────────────
export function DesktopHeader() {
  const { currentPage, toggleSidebar } = useAppStore()
  const pageTitle = pageTitles[currentPage] || 'Dashboard'

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
      <div className="flex items-center h-14 px-3 md:px-4 gap-2 md:gap-3">
        {/* Mobile: Menu Button + Page Title */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0 h-8 w-8"
          onClick={toggleSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="md:hidden flex items-center gap-2 shrink-0">
          <h2 className="text-sm font-semibold">{pageTitle}</h2>
        </div>

        {/* Desktop: [ Workspace Selector ] | [ Page Title ] */}
        <div className="hidden md:flex items-center gap-3 flex-1 min-w-0">
          <WorkspaceSelector />
          <PageTitle />
        </div>

        {/* Right: [ Upload CSV ] | [ Search ] | [ Notification ] | [ Theme ] | [ Profile ] */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {/* Upload CSV Button */}
          <UploadCsvButton />

          {/* Desktop Search */}
          <div className="hidden sm:block">
            <SearchTrigger />
          </div>

          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden h-8 w-8 rounded-lg"
            onClick={() => {
              // Trigger Ctrl+K programmatically
              const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true })
              document.dispatchEvent(event)
            }}
          >
            <Search className="h-4 w-4" />
          </Button>

          <NotificationPanel />
          <ThemeToggle />
          <Separator orientation="vertical" className="h-5 mx-1 hidden sm:block" />
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
