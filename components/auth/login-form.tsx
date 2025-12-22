/**
 * Login Form Component
 *
 * Supports both Google OAuth and Magic Link authentication
 */

'use client'

import { useState } from 'react'
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
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Info, ShieldCheck, Mail, Chrome } from 'lucide-react'

export function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google')

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

      {/* Demo Accounts Notice */}
      <Card className="border-dashed border-2 bg-muted/30">
        <CardContent className="py-4">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">Demo Accounts Available</p>
            <p className="text-xs text-muted-foreground">
              Try the system with demo accounts using the Email Link option:
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <code className="text-xs bg-background px-2 py-1 rounded border">
                demo-chair@yi-demo.com
              </code>
              <code className="text-xs bg-background px-2 py-1 rounded border">
                demo-cochair@yi-demo.com
              </code>
              <code className="text-xs bg-background px-2 py-1 rounded border">
                demo-ec@yi-demo.com
              </code>
            </div>
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
