'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppStore, type AppPage } from '@/stores/app-store'
import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/components/auth/login-page'
import { RegisterPage } from '@/components/auth/register-page'
import { Loader2, Shield } from 'lucide-react'

// ── Page components ──
import DashboardPage from '@/components/dashboard/dashboard-page'
import AnalyticsPage from '@/components/analytics/analytics-page'
import WorkspacesPage from '@/components/workspaces/workspaces-page'
import WorkspaceSettingsPage from '@/components/workspaces/workspace-settings-page'
import UploadPage from '@/components/upload/upload-page'
import RealizedTradesPage from '@/components/trades/realized-trades-page'
import OpenHoldingsPage from '@/components/holdings/open-holdings-page'
import TaxSummaryPage from '@/components/tax/tax-summary-page'
import ExchangeSettingsPage from '@/components/settings/exchange-settings-page'
import NotesPage from '@/components/notes/notes-page'
import DocumentationPage from '@/components/docs/documentation-page'
import UserSettingsPage from '@/components/settings/user-settings-page'
import ExportHistoryPage from '@/components/exports/export-history-page'

// Placeholder for pages not yet implemented
function PlaceholderPage({ page }: { page: AppPage }) {
  const pageNames: Record<AppPage, string> = {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
        <Shield className="h-8 w-8 text-teal-500" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{pageNames[page]}</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        This page is coming soon. The {pageNames[page].toLowerCase()} feature is under development.
      </p>
    </div>
  )
}

export default function Home() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore()
  const { fetchWorkspaces } = useWorkspaceStore()
  const currentPage = useAppStore((s) => s.currentPage)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    initialize().then(() => setInitialized(true))
  }, [initialize])

  // Fetch workspaces when authenticated
  useEffect(() => {
    if (isAuthenticated && initialized) {
      fetchWorkspaces()
    }
  }, [isAuthenticated, initialized, fetchWorkspaces])

  // Loading state during initialization
  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10">
            <Shield className="h-7 w-7 text-teal-500" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Crypto Audit Master...
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated - show auth pages
  if (!isAuthenticated) {
    if (authMode === 'register') {
      return <RegisterPage onToggleLogin={() => setAuthMode('login')} />
    }
    return <LoginPage onToggleRegister={() => setAuthMode('register')} />
  }

  // ── Page routing: render the correct page component based on currentPage state ──
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />
      case 'analytics':
        return <AnalyticsPage />
      case 'workspaces':
        return <WorkspacesPage />
      case 'workspace-settings':
        return <WorkspaceSettingsPage />
      case 'upload':
        return <UploadPage />
      case 'realized-trades':
        return <RealizedTradesPage />
      case 'open-holdings':
        return <OpenHoldingsPage />
      case 'tax-summary':
        return <TaxSummaryPage />
      case 'exchange-settings':
        return <ExchangeSettingsPage />
      case 'notes':
        return <NotesPage />
      case 'documentation':
        return <DocumentationPage />
      case 'settings':
        return <UserSettingsPage />
      case 'export-history':
        return <ExportHistoryPage />
      default:
        return <PlaceholderPage page={currentPage} />
    }
  }

  return <AppLayout><div key={currentPage} className="page-enter">{renderPage()}</div></AppLayout>
}
