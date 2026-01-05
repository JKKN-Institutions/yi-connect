/**
 * Login Form Component
 *
 * Supports both Google OAuth and Magic Link authentication
 */

'use client'

import { useState, useTransition } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OAuthButtons } from './oauth-buttons'
import { MagicLinkForm } from './magic-link-form'
import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, Info, ShieldCheck, Mail, Chrome, Loader2, Users } from 'lucide-react'
import { loginAsDemoUser } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Demo accounts with their roles for display
const DEMO_ACCOUNTS = [
  { email: 'demo-chair@yi-demo.com', role: 'Chair', variant: 'default' as const },
  { email: 'demo-cochair@yi-demo.com', role: 'Co-Chair', variant: 'secondary' as const },
  { email: 'demo-ec@yi-demo.com', role: 'EC Member', variant: 'outline' as const },
]

export function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get('error')
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google')
  const [isPending, startTransition] = useTransition()
  const [demoLoginEmail, setDemoLoginEmail] = useState<string | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)

  const handleDemoLogin = (email: string) => {
    setDemoLoginEmail(email)
    setDemoError(null)

    startTransition(async () => {
      const result = await loginAsDemoUser(email)

      if (result.success) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setDemoError(result.error || 'Failed to login')
        setDemoLoginEmail(null)
      }
    })
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Section */}
      <div className="text-center space-y-3">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary/70 rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-9 h-9 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
        <p className="text-muted-foreground text-base">
          Sign in to access your Yi Connect dashboard
        </p>
      </div>

      {/* Error Messages */}
      {error === 'auth_failed' && (
        <Alert variant="destructive" className="border-l-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <span className="font-semibold">Authentication Failed</span>
            <p className="text-sm mt-1">
              Unable to sign you in. Please try again or contact support if the
              issue persists.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {error === 'unauthorized' && (
        <Alert variant="destructive" className="border-l-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2 space-y-2">
            <div>
              <span className="font-semibold block">Access Denied</span>
              <p className="text-sm mt-1">
                Your email is not authorized to access this system. Only
                approved members can sign in.
              </p>
            </div>
            <div className="pt-2 border-t border-destructive/20">
              <p className="text-sm">
                <strong>Need access?</strong> Contact your chapter administrator
                to be added to the system.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Login Card */}
      <Card className="border-2 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardDescription className="text-center text-base">
            Choose your sign-in method
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={authMethod}
            onValueChange={(v) => setAuthMethod(v as 'google' | 'email')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="google" className="flex items-center gap-2">
                <Chrome className="h-4 w-4" />
                Google
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="google" className="mt-4 space-y-4">
              <OAuthButtons />
              <p className="text-xs text-center text-muted-foreground">
                Sign in with your approved Google account
              </p>
            </TabsContent>

            <TabsContent value="email" className="mt-4">
              <MagicLinkForm />
            </TabsContent>
          </Tabs>

          {/* Divider */}
          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Member Portal
              </span>
            </div>
          </div>

          {/* Info Box */}
          <Alert className="bg-muted/50 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="ml-2 text-sm">
              <strong className="text-foreground">Members Only:</strong> You
              must use an email address that was approved for your membership.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Demo Accounts - One-Click Login */}
      <Card className="border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
        <CardContent className="py-5">
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Try Demo Accounts</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Click any account below to instantly login and explore
              </p>
            </div>

            {demoError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs ml-2">
                  {demoError}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  variant="outline"
                  className="w-full justify-between h-auto py-3 hover:bg-primary/5 hover:border-primary/40 transition-all group"
                  onClick={() => handleDemoLogin(account.email)}
                  disabled={isPending}
                >
                  <div className="flex items-center gap-3">
                    {isPending && demoLoginEmail === account.email ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <span className="text-xs font-bold text-primary">
                          {account.role.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium">
                        {isPending && demoLoginEmail === account.email
                          ? 'Logging in...'
                          : `Login as ${account.role}`}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {account.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant={account.variant} className="ml-2">
                    {account.role}
                  </Badge>
                </Button>
              ))}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Demo accounts are pre-configured with sample data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to Yi Connect&apos;s terms of service and
        privacy policy
      </p>
    </div>
  )
}
