/**
 * Coordinator Dashboard Page
 *
 * Main dashboard showing booking stats and upcoming sessions.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { getCoordinatorDashboardStats, getCoordinatorBookings, getCoordinatorById } from '@/lib/data/session-bookings'
import { BookingsList } from '@/components/session-bookings'
import { format } from 'date-fns'

export const metadata = {
  title: 'Dashboard | Coordinator Portal',
  description: 'View your session bookings and stats',
}

async function getCoordinatorSession() {
  const cookieStore = await cookies()
  const coordinatorId = cookieStore.get('coordinator_id')?.value

  if (!coordinatorId) {
    return null
  }

  return { id: coordinatorId }
}

async function DashboardContent() {
  const session = await getCoordinatorSession()

  if (!session) {
    redirect('/coordinator/login')
  }

  const [stats, recentBookings, coordinator] = await Promise.all([
    getCoordinatorDashboardStats(session.id),
    getCoordinatorBookings(session.id, { limit: 5 }),
    getCoordinatorById(session.id),
  ])

  if (!coordinator) {
    redirect('/coordinator/login')
  }

  const upcomingBookings = recentBookings.filter(
    (b) => !['completed', 'cancelled'].includes(b.status)
  )

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Welcome back!
          </h1>
          <p className="text-muted-foreground mt-1">
            {coordinator.stakeholder_type
              ? `Managing sessions for your ${coordinator.stakeholder_type}`
              : 'Manage your session bookings'}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/coordinator/bookings/new">
            <Plus className="h-4 w-4" />
            Book New Session
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_bookings}</p>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending_bookings}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed_bookings}</p>
                <p className="text-sm text-muted-foreground">Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed_sessions}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upcoming Sessions</CardTitle>
            <CardDescription>
              Your next scheduled sessions
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/coordinator/bookings" className="gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length > 0 ? (
            <BookingsList bookings={upcomingBookings} showActions={false} />
          ) : (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-muted-foreground">
                No upcoming sessions
              </p>
              <Button asChild className="mt-4">
                <Link href="/coordinator/bookings/new">
                  Book Your First Session
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>

      <Skeleton className="h-[400px]" />
    </div>
  )
}

export default function CoordinatorDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
