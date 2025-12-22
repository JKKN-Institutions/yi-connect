/**
 * Magic Link Authentication Form
 *
 * Allows users to login with email magic link (passwordless)
 * Used primarily for demo accounts
 */

'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Loader2, CheckCircle2 } from 'lucide-react'

interface MagicLinkFormProps {
  defaultEmail?: string
}

export function MagicLinkForm({ defaultEmail = '' }: MagicLinkFormProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setError('Please enter your email address')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const supabase = createBrowserSupabaseClient()

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signInError) {
        // Check if it's an unauthorized email
        if (signInError.message.includes('not authorized') ||
            signInError.message.includes('P0001')) {
          setError('This email is not authorized. Only approved members can login.')
        } else {
          setError(signInError.message)
        }
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Click the link in your email to sign in. Check spam if you don&apos;t see it.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSuccess(false)
            setEmail('')
          }}
          className="mt-4"
        >
          Use a different email
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
          autoFocus
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || !email}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending magic link...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Continue with Email
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        We&apos;ll send you a magic link to sign in instantly
      </p>
    </form>
  )
}
