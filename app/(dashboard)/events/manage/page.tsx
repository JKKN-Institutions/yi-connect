/**
 * Events Management Page
 *
 * Advanced data table for event management with filtering and bulk actions.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, BarChart3 } from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getEvents, getEventAnalytics } from '@/lib/data/events'
import { EventsTable } from '@/components/events/events-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { EventFilters, EventSortOptions } from '@/types/event'

interface PageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    sort?: string
    order?: string
  }>
}

export default async function EventsManagePage({ searchParams }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  return (
    <Suspense fallback={<EventsManagePageSkeleton />}>
      <EventsManagePageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function EventsManagePageContent({ searchParams }: PageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's hierarchy level
  const supabase = await createClient()
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    {
      user_id: user.id
    }
  )
  const userHierarchyLevel = hierarchyLevel || 0

  // Only allow event coordinators and above to access management view
  if (userHierarchyLevel > 4) {
    redirect('/events')
  }

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const pageSize = parseInt(params.pageSize || '20')
  const sortField = (params.sort || 'start_date') as any
  const sortDirection = (params.order || 'desc') as 'asc' | 'desc'

  const sort: EventSortOptions = {
    field: sortField,
    direction: sortDirection,
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/events">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Event Management</h1>
            <p className="text-muted-foreground">
              Manage all events with advanced filtering and bulk operations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/events/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </Button>
          <Button asChild>
            <Link href="/events/new">
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<QuickStatsSkeleton />}>
        <QuickStats />
      </Suspense>

      {/* Events Table */}
      <Suspense fallback={<div>Loading events...</div>}>
        <EventsTableData page={page} pageSize={pageSize} sort={sort} />
      </Suspense>
    </div>
  )
}

async function QuickStats() {
  const analytics = await getEventAnalytics()

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.total_events}</div>
          <p className="text-xs text-muted-foreground">
            +{analytics.upcoming_events} upcoming
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.ongoing_events}</div>
          <p className="text-xs text-muted-foreground">
            Currently running
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.total_attendees}</div>
          <p className="text-xs text-muted-foreground">
            Across all events
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(analytics.average_attendance_rate)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Average across events
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function EventsTableData({
  page,
  pageSize,
  sort,
}: {
  page: number
  pageSize: number
  sort: EventSortOptions
}) {
  const { data: events, totalPages } = await getEvents({
    page,
    pageSize,
    sort,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Events</CardTitle>
        <CardDescription>
          View and manage all events with advanced filtering and sorting
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EventsTable data={events} pageCount={totalPages} />
      </CardContent>
    </Card>
  )
}

function QuickStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EventsManagePageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-9 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Quick Stats Skeleton */}
      <QuickStatsSkeleton />

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
