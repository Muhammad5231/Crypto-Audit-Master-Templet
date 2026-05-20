'use client'

import { create } from 'zustand'

export type NotificationType =
  | 'csv-uploaded'
  | 'report-processed'
  | 'duplicate-csv'
  | 'warnings-found'
  | 'export-generated'
  | 'workspace-created'
  | 'workspace-archived'
  | 'general'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  description: string
  timestamp: Date
  read: boolean
  workspaceId?: string
  workspaceName?: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAll: () => void
}

let notificationCounter = 0

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: 'welcome-1',
      type: 'general',
      title: 'Welcome to Crypto Audit Master',
      description: 'Upload your first CSV to get started with trade auditing.',
      timestamp: new Date(),
      read: false,
    },
  ],
  unreadCount: 1,

  addNotification: (notification) => {
    const id = `notif-${Date.now()}-${++notificationCounter}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
    }
    set((state) => {
      const notifications = [newNotification, ...state.notifications].slice(0, 50) // Keep max 50
      const unreadCount = notifications.filter((n) => !n.read).length
      return { notifications, unreadCount }
    })
  },

  markAsRead: (id: string) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      const unreadCount = notifications.filter((n) => !n.read).length
      return { notifications, unreadCount }
    })
  },

  markAllAsRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }))
      return { notifications, unreadCount: 0 }
    })
  },

  clearNotification: (id: string) => {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id)
      const unreadCount = notifications.filter((n) => !n.read).length
      return { notifications, unreadCount }
    })
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 })
  },
}))
