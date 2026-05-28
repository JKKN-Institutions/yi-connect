/**
 * Coordinator Bookings List Page
 *
 * View all session bookings with filtering.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { getCoordinatorBookings } from '@/lib/data/session-bookings'
import { BookingsList } from '@/components/session-bookings'

export const metadata = {
  title: 'Bookings | Coordinator Portal',
  description: 'View and manage your session bookings',
}

async function getCoordinatorSession() {
  const cookieStore = await cookies()
  const coordinatorId = cookieStore.get('coordinator_id')?.value

  if (!coordinatorId) {
    return null
  }

  return { id: coordinatorId }
}

async function BookingsContent() {
  const session = await getCoordinatorSession()

  if (!session) {
    redirect('/coordinator/login')
  }

  const bookings = await getCoordinatorBookings(session.id)

  const pendingBookings = bookings.filter((b) =>
    ['pending', 'pending_trainer'].includes(b.status)
  )
  const confirmedBookings = bookings.filter((b) =>
    ['trainer_assigned', 'confirmed', 'materials_pending', 'in_progress'].includes(b.status)
  )
  const completedBookings = bookings.filter((b) => b.status === 'completed')
  const cancelledBookings = bookings.filter((b) =>
    ['cancelled', 'rescheduled'].includes(b.status)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Session Bookings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your scheduled training sessions
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/coordinator/bookings/new">
            <Plus className="h-4 w-4" />
            Book New Session
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="h-4 w-4" />
            All ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Confirmed ({confirmedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed ({completedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-2">
            <XCircle className="h-4 w-4" />
            Cancelled ({cancelledBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <BookingsList
            bookings={bookings}
            emptyMessage="No bookings yet. Create your first session booking!"
          />
        </TabsContent>

        <TabsContent value="pending">
          <BookingsList
            bookings={pendingBookings}
            emptyMessage="No pending bookings"
          />
        </TabsContent>

        <TabsContent value="confirmed">
          <BookingsList
            bookings={confirmedBookings}
            emptyMessage="No confirmed bookings"
          />
        </TabsContent>

        <TabsContent value="completed">
          <BookingsList
            bookings={completedBookings}
            showActions={false}
            emptyMessage="No completed sessions yet"
          />
        </TabsContent>

        <TabsContent value="cancelled">
          <BookingsList
            bookings={cancelledBookings}
            showActions={false}
            emptyMessage="No cancelled bookings"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BookingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <Skeleton className="h-10 w-full max-w-md" />

      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[150px]" />
        ))}
      </div>
    </div>
  )
}

export default function CoordinatorBookingsPage() {
  return (
    <Suspense fallback={<BookingsSkeleton />}>
      <BookingsContent />
    </Suspense>
  )
}
