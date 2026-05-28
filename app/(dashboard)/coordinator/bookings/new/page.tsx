/**
 * New Booking Page
 *
 * Multi-step wizard for creating a new session booking.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { requireRole } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSessionTypes, getCoordinatorById } from '@/lib/data/session-bookings'
import { BookingForm } from '@/components/session-bookings'

export const metadata = {
  title: 'Book New Session | Yi Connect',
  description: 'Create a new session booking',
}

async function getCoordinatorIdForUser(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .schema('yi_connect')
    .from('stakeholder_coordinators')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data?.id ?? null
}

async function NewBookingContent() {
  const { user } = await requireRole(['Coordinator', 'Super Admin', 'National Admin'])

  const coordinatorId = await getCoordinatorIdForUser(user.id)
  if (!coordinatorId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No active coordinator profile is linked to your account.
          </p>
          <Button asChild className="mt-4">
            <Link href="/coordinator">Back to Coordinator Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const [sessionTypes, coordinator] = await Promise.all([
    getSessionTypes(),
    getCoordinatorById(coordinatorId),
  ])

  if (!coordinator) {
    redirect('/coordinator')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/coordinator/bookings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Book New Session
          </h1>
          <p className="text-muted-foreground mt-1">
            Schedule a training session for your institution
          </p>
        </div>
      </div>

      {/* Booking Form */}
      <BookingForm
        coordinatorId={coordinator.id}
        stakeholderType={coordinator.stakeholder_type}
        stakeholderId={coordinator.stakeholder_id}
        sessionTypes={sessionTypes}
      />
    </div>
  )
}

function NewBookingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
      </div>

      <Skeleton className="h-[600px]" />
    </div>
  )
}

export default function NewBookingPage() {
  return (
    <Suspense fallback={<NewBookingSkeleton />}>
      <NewBookingContent />
    </Suspense>
  )
}
