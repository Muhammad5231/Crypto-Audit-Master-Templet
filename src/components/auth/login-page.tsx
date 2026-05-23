'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface LoginPageProps {
  onToggleRegister: () => void
}

export function LoginPage({ onToggleRegister }: LoginPageProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login: authLogin } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !password.trim()) {
      toast.error('Please fill in all fields.')
      return
    }

    setIsSubmitting(true)
    try {
      await authLogin(login, password)
      toast.success('You have successfully logged in.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Please try again.'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 mb-4">
            <Shield className="h-7 w-7 text-teal-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Crypto Audit Master</h1>
          <p className="text-sm text-muted-foreground mt-1">Trade Audit & Tax Analysis Platform</p>
        </div>

        {/* Login Card */}
        <Card className="rounded-2xl shadow-lg border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your email or username and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">Email or Username</Label>
                <Input
                  id="login"
                  type="text"
                  placeholder="name@example.com"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-xl h-11"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <span className="text-xs text-foreground/50 cursor-default select-none">Forgot password?</span>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="rounded-xl h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl h-11 font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Don&apos;t have an account? </span>
              <button
                onClick={onToggleRegister}
                className="text-teal-500 hover:text-teal-600 font-medium transition-colors"
              >
                Create one
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
          For educational purposes only. Not financial or tax advice.
        </p>
      </div>
    </div>
  )
}
