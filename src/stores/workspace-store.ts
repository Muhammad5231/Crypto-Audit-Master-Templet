'use client'

import { create } from 'zustand'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'

export interface Workspace {
  id: string
  userId: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  financialYear: string | null
  realizedTradesRowsPerPage: number
  isArchived: boolean
  lastOpenedAt: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    trades: number
    csvFiles: number
    reports: number
    exportHistory: number
    notes: number
  }
  stats?: {
    tradeCount: number
    csvFileCount: number
    reportCount: number
    exportCount: number
    noteCount: number
  }
}

interface WorkspaceState {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  isLoading: boolean
  fetchWorkspaces: () => Promise<void>
  selectWorkspace: (workspaceId: string) => void
  createWorkspace: (data: { name: string; description?: string; color?: string; icon?: string; financialYear?: string }) => Promise<Workspace>
  updateWorkspace: (workspaceId: string, data: Partial<Pick<Workspace, 'name' | 'description' | 'color' | 'icon' | 'financialYear' | 'realizedTradesRowsPerPage'>>) => Promise<Workspace>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  archiveWorkspace: (workspaceId: string, isArchived: boolean) => Promise<void>
  duplicateWorkspace: (workspaceId: string) => Promise<Workspace>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  isLoading: false,

  fetchWorkspaces: async () => {
    set({ isLoading: true })
    try {
      // API returns array of workspaces directly after envelope unwrapping
      const workspaces = await apiGet<Workspace[]>('/api/workspaces')
      set({ workspaces, isLoading: false })

      // Auto-select current workspace if none selected
      const current = get().currentWorkspace
      if (!current && workspaces.length > 0) {
        // Select the most recently opened or first one
        const sorted = [...workspaces].sort((a, b) => {
          const dateA = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0
          const dateB = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0
          return dateB - dateA
        })
        set({ currentWorkspace: sorted[0] })
      } else if (current) {
        // Refresh the current workspace data
        const updated = workspaces.find((w) => w.id === current.id)
        if (updated) {
          set({ currentWorkspace: updated })
        } else {
          // Current workspace was deleted, select another
          if (workspaces.length > 0) {
            set({ currentWorkspace: workspaces[0] })
          } else {
            set({ currentWorkspace: null })
          }
        }
      }
    } catch {
      set({ isLoading: false })
    }
  },

  selectWorkspace: (workspaceId: string) => {
    const workspace = get().workspaces.find((w) => w.id === workspaceId)
    if (workspace) {
      set({ currentWorkspace: workspace })
      // Update last opened in background
      apiPatch(`/api/workspaces/${workspaceId}/last-opened`, {}).catch(() => {})
    }
  },

  createWorkspace: async (data) => {
    const result = await apiPost<Workspace>('/api/workspaces', data)
    set((state) => ({
      workspaces: [...state.workspaces, result],
      currentWorkspace: result,
    }))
    return result
  },

  updateWorkspace: async (workspaceId, data) => {
    const result = await apiPatch<Workspace>(`/api/workspaces/${workspaceId}`, data)
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === workspaceId ? result : w)),
      currentWorkspace: state.currentWorkspace?.id === workspaceId ? result : state.currentWorkspace,
    }))
    return result
  },

  deleteWorkspace: async (workspaceId) => {
    await apiDelete(`/api/workspaces/${workspaceId}`)
    set((state) => {
      const workspaces = state.workspaces.filter((w) => w.id !== workspaceId)
      const currentWorkspace =
        state.currentWorkspace?.id === workspaceId
          ? workspaces.length > 0
            ? workspaces[0]
            : null
          : state.currentWorkspace
      return { workspaces, currentWorkspace }
    })
  },

  archiveWorkspace: async (workspaceId, isArchived) => {
    const result = await apiPatch<Workspace>(`/api/workspaces/${workspaceId}/archive`, { isArchived })
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === workspaceId ? result : w)),
      currentWorkspace: state.currentWorkspace?.id === workspaceId ? result : state.currentWorkspace,
    }))
  },

  duplicateWorkspace: async (workspaceId) => {
    const result = await apiPost<Workspace>(`/api/workspaces/${workspaceId}/duplicate`, {})
    set((state) => ({
      workspaces: [...state.workspaces, result],
    }))
    return result
  },
}))
