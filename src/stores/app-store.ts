'use client'

import { create } from 'zustand'

export type AppPage =
  | 'dashboard'
  | 'realized-trades'
  | 'open-holdings'
  | 'analytics'
  | 'tax-summary'
  | 'exchange-settings'
  | 'notes'
  | 'export-center'
  | 'export-history'
  | 'documentation'
  | 'settings'
  | 'workspaces'
  | 'workspace-settings'
  | 'upload'

interface AppState {
  currentPage: AppPage
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  searchQuery: string
  setCurrentPage: (page: AppPage) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSearchQuery: (query: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  sidebarOpen: false,
  sidebarCollapsed: false,
  searchQuery: '',

  setCurrentPage: (page) => set({ currentPage: page, sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
