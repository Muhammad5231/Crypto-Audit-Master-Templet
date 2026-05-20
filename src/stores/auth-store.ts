'use client'

import { create } from 'zustand'
import { apiPost, apiGet } from '@/lib/api-client'

export interface User {
  id: string
  username: string
  email: string
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (login: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  initialize: () => Promise<void>
}

const TOKEN_KEY = 'crypto_audit_token'

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (login: string, password: string) => {
    set({ isLoading: true })
    try {
      const data = await apiPost<{ token: string; user: User }>('/api/auth/login', { login, password })
      localStorage.setItem(TOKEN_KEY, data.token)
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (username: string, email: string, password: string) => {
    set({ isLoading: true })
    try {
      const data = await apiPost<{ token: string; user: User }>('/api/auth/register', { username, email, password })
      localStorage.setItem(TOKEN_KEY, data.token)
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },

  checkAuth: async () => {
    const token = get().token || localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ isAuthenticated: false, isLoading: false, user: null, token: null })
      return
    }
    try {
      const data = await apiGet<{ user: User }>('/api/auth/me', token)
      set({
        user: data.user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ isAuthenticated: false, isLoading: false })
      return
    }
    set({ token, isLoading: true })
    try {
      const data = await apiGet<{ user: User }>('/api/auth/me', token)
      set({
        user: data.user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },
}))
