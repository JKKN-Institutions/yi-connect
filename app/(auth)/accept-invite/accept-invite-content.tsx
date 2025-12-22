/**
 * Accept Invite Content Component
 *
 * Client component for handling the invitation acceptance flow.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  MapPin,
  User,
  Calendar,
  Loader2,
  CheckCircle2,
  LogIn,
  Quote,
} from 'lucide-react'
import { acceptInvitation } from '@/app/actions/chapters'
import { toast } from 'sonner'
import Link from 'next/link'
import type { InvitationLookup } from '@/types/chapter'

interface AcceptInviteContentProps {
  invitation: InvitationLookup
  token: string
  isLoggedIn: boolean
  userEmail?: string
}

export function AcceptInviteContent({
  invitation,
  token,
  isLoggedIn,
  userEmail,
}: AcceptInviteContentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  const handleAccept = () => {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvitation(token)

      if (result.success) {
        setAccepted(true)
        toast.success('Welcome! You are now the Chapter Chair.')
        // Redirect to dashboard after a moment
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        setError(result.error || 'Failed to accept invitation')
      }
    })
  }

  // Success state
  if (accepted) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-800">
            Welcome, Chapter Chair!
          </CardTitle>
          <CardDescription>
            You are now the Chair of {invitation.chapter_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Redirecting you to your dashboard...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Chapter Invitation</Badge>
        </div>
        <CardTitle className="text-2xl">
          You&apos;re Invited to Lead {invitation.chapter_name}
        </CardTitle>
        <CardDescription>
          {invitation.inviter_name} has invited you to become the Chapter Chair
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Chapter Info */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{invitation.chapter_name}</span>
            <span className="text-muted-foreground">
              - {invitation.chapter_location}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Role: </span>
            <Badge>{invitation.invited_role}</Badge>
          </div>
          {invitation.expires_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Expires:{' '}
                {new Date(invitation.expires_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Personal message */}
        {invitation.personal_message && (
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="flex gap-2">
              <Quote className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm italic">{invitation.personal_message}</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Invitee info */}
        <div className="text-sm text-muted-foreground">
          <p>
            This invitation is for <strong>{invitation.full_name}</strong>
            {invitation.email && <span> ({invitation.email})</span>}
            {invitation.phone && <span> ({invitation.phone})</span>}
          </p>
        </div>

        {/* Login prompt or accept button */}
        {!isLoggedIn ? (
          <div className="space-y-4">
            <Alert>
              <LogIn className="h-4 w-4" />
              <AlertDescription>
                Please sign in with your Google account to accept this
                invitation. Use the same email that was invited if possible.
              </AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href={`/login?redirect=/accept-invite?token=${token}`}>
                <LogIn className="h-4 w-4 mr-2" />
                Sign in to Accept
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {userEmail && (
              <p className="text-sm text-muted-foreground">
                Logged in as: <strong>{userEmail}</strong>
              </p>
            )}
          </div>
        )}
      </CardContent>

      {isLoggedIn && (
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={handleAccept}
            disabled={isPending}
            className="w-full"
            size="lg"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Accept & Become Chapter Chair
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/">Maybe Later</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
