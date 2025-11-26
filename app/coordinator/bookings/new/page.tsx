/**
 * New Booking Page
 *
 * Multi-step wizard for creating a new session booking.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getSessionTypes, getCoordinatorById } from '@/lib/data/session-bookings'
import { BookingForm } from '@/components/session-bookings'

export const metadata = {
  title: 'Book New Session | Coordinator Portal',
  description: 'Create a new session booking',
}

async function getCoordinatorSession() {
  const cookieStore = await cookies()
  const coordinatorId = cookieStore.get('coordinator_id')?.value

  if (!coordinatorId) {
    return null
  }

  return { id: coordinatorId }
}

async function NewBookingContent() {
  const session = await getCoordinatorSession()

  if (!session) {
    redirect('/coordinator/login')
  }

  const [sessionTypes, coordinator] = await Promise.all([
    getSessionTypes(),
    getCoordinatorById(session.id),
  ])

  if (!coordinator) {
    redirect('/coordinator/login')
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
