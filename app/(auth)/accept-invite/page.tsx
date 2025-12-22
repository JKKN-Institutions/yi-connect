/**
 * Accept Chapter Invitation Page
 *
 * Handles the invitation acceptance flow for new Chapter Chairs.
 * - Validates token from URL
 * - Shows invitation details
 * - Prompts login if not authenticated
 * - Accepts invitation and redirects to dashboard
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getInvitationByToken } from '@/app/actions/chapters'
import { AcceptInviteContent } from './accept-invite-content'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata = {
  title: 'Accept Invitation - Yi Connect',
  description: 'Accept your Chapter Chair invitation',
}

interface PageProps {
  searchParams: Promise<{ token?: string }>
}

async function AcceptInvitePageContent({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const token = params.token

  // No token provided
  if (!token) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Link</AlertTitle>
          <AlertDescription>
            No invitation token found. Please use the link from your invitation
            message.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  // Lookup invitation
  const { found, invitation, error } = await getInvitationByToken(token)

  if (!found || !invitation) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invitation Not Found</AlertTitle>
          <AlertDescription>
            {error || 'This invitation link is invalid or has been removed.'}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  // Check if expired
  if (invitation.is_expired) {
    return (
      <div className="space-y-6">
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Invitation Expired</AlertTitle>
          <AlertDescription>
            This invitation has expired. Please contact the person who invited
            you to request a new invitation.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  // Check if already accepted
  if (invitation.status === 'accepted') {
    return (
      <div className="space-y-6">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">
            Already Accepted
          </AlertTitle>
          <AlertDescription className="text-green-700">
            This invitation has already been accepted. You can log in to access
            your chapter.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  // Check if revoked
  if (invitation.status === 'revoked') {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invitation Revoked</AlertTitle>
          <AlertDescription>
            This invitation has been revoked. Please contact the person who
            invited you if you believe this is a mistake.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    )
  }

  // Check if user is logged in
  const user = await getCurrentUser()

  // Valid invitation - show acceptance UI
  return (
    <AcceptInviteContent
      invitation={invitation}
      token={token}
      isLoggedIn={!!user}
      userEmail={user?.email}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export default function AcceptInvitePage(props: PageProps) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AcceptInvitePageContent {...props} />
    </Suspense>
  )
}
