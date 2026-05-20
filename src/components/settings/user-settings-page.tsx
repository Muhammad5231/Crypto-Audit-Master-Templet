'use client'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRYPTO AUDIT MASTER — User Settings Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Profile display, theme preference (Light/Dark/System via next-themes),
// and logout button.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Mail,
  Palette,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Shield,
} from 'lucide-react'

// ── Main User Settings Component ───────────────────────────

export default function UserSettingsPage() {
  const { user, logout } = useAuthStore()
  const { setCurrentPage } = useAppStore()
  const { theme, setTheme } = useTheme()

  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ] as const

  const handleLogout = () => {
    logout()
    // The root page will handle redirect to login
  }

  return (
    <div className="space-y-6">
      {/* ── Header Card ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
              <Shield className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Settings</h2>
              <p className="text-sm text-muted-foreground">
                Manage your profile and preferences
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Profile Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-teal-500" />
            <CardTitle className="text-base">Profile</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Your account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-xl font-bold text-teal-600 dark:text-teal-400">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-base font-semibold">{user?.username || 'User'}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Mail className="h-3.5 w-3.5" />
                <span>{user?.email || 'No email'}</span>
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="text-sm font-medium mt-0.5">{user?.username || '--'}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium mt-0.5 truncate">{user?.email || '--'}</p>
            </div>
          </div>
          {user?.createdAt && (
            <p className="text-xs text-muted-foreground">
              Member since: {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Theme Preference Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-teal-500" />
            <CardTitle className="text-base">Theme Preference</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Choose how the app looks on your screen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  theme === option.value
                    ? 'border-teal-500 bg-teal-500/5 text-teal-600 dark:text-teal-400'
                    : 'border-border hover:border-teal-500/30 hover:bg-accent/30'
                }`}
              >
                {option.icon}
                <span className="text-sm font-medium">{option.label}</span>
                {theme === option.value && (
                  <Badge variant="secondary" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px]">
                    Active
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Logout Section ── */}
      <Card className="rounded-2xl border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign Out</p>
              <p className="text-xs text-muted-foreground">
                Log out of your account on this device
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="rounded-xl text-red-600 border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
