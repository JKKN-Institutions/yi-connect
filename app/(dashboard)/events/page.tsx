/**
 * Events List Page
 *
 * Main events listing page with filtering and search.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Grid3x3, Filter } from 'lucide-react';
import { getEvents, getEventAnalytics } from '@/lib/data/events';
import { getCurrentUser } from '@/lib/data/auth';
import { createClient } from '@/lib/supabase/server';
import { EventCard, EventCalendar } from '@/components/events';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventFilters, EventSortOptions } from '@/types/event';
import { EVENT_CATEGORIES, EVENT_STATUSES } from '@/types/event';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    category?: string;
    sort?: string;
    page?: string;
    view?: 'grid' | 'calendar';
  }>;
}

export default function EventsPage({ searchParams }: PageProps) {
  return (
    <div className='flex flex-col gap-8'>
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <EventsHeader />
      </Suspense>

      {/* Analytics */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <EventAnalytics />
      </Suspense>

      {/* Filters & Content */}
      <Suspense fallback={<div>Loading...</div>}>
        <EventsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Async component that handles searchParams and renders tabs
async function EventsContent({
  searchParams
}: {
  searchParams: Promise<{ search?: string; status?: string; category?: string; page?: string; view?: 'grid' | 'calendar' }>
}) {
  // Await searchParams inside Suspense boundary
  const params = await searchParams;

  // Parse filters from search params
  const filters: EventFilters = {
    search: params.search,
    status: params.status ? [params.status as any] : undefined,
    category: params.category ? [params.category as any] : undefined
  };

  const sort: EventSortOptions = {
    field: 'start_date',
    direction: 'desc'
  };

  const page = parseInt(params.page || '1');
  const view = params.view || 'grid';

  return (
    <Tabs defaultValue='all' className='w-full'>
      <div className='flex items-center justify-between mb-4'>
        <TabsList>
          <TabsTrigger value='all'>All Events</TabsTrigger>
          <TabsTrigger value='upcoming'>Upcoming</TabsTrigger>
          <TabsTrigger value='my-events'>My Events</TabsTrigger>
          <TabsTrigger value='past'>Past Events</TabsTrigger>
        </TabsList>

        <div className='flex gap-2'>
          <ToggleGroup type='single' value={view}>
            <ToggleGroupItem value='grid' asChild>
              <Link href={`/events?view=grid`}>
                <Grid3x3 className='h-4 w-4' />
              </Link>
            </ToggleGroupItem>
            <ToggleGroupItem value='calendar' asChild>
              <Link href={`/events?view=calendar`}>
                <Calendar className='h-4 w-4' />
              </Link>
            </ToggleGroupItem>
          </ToggleGroup>
          <Input
            placeholder='Search events...'
            className='w-64'
            defaultValue={params.search}
          />
          <Select defaultValue={params.category}>
            <SelectTrigger className='w-48'>
              <SelectValue placeholder='Category' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Categories</SelectItem>
              {(Object.entries(EVENT_CATEGORIES) as [string, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select defaultValue={params.status}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Statuses</SelectItem>
              {(Object.entries(EVENT_STATUSES) as [string, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TabsContent value='all'>
        <Suspense fallback={<EventsGridSkeleton />}>
          <EventsList filters={filters} sort={sort} page={page} view={view} />
        </Suspense>
      </TabsContent>

      <TabsContent value='upcoming'>
        <Suspense fallback={<EventsGridSkeleton />}>
          <EventsList
            filters={{
              ...filters,
              status: ['published'],
              start_date_from: new Date().toISOString()
            }}
            sort={{ field: 'start_date', direction: 'asc' }}
            page={page}
            view={view}
          />
        </Suspense>
      </TabsContent>

      <TabsContent value='my-events'>
        <Suspense fallback={<EventsGridSkeleton />}>
          <MyEventsList filters={filters} sort={sort} page={page} view={view} />
        </Suspense>
      </TabsContent>

      <TabsContent value='past'>
        <Suspense fallback={<EventsGridSkeleton />}>
          <EventsList
            filters={{
              ...filters,
              status: ['completed', 'cancelled']
            }}
            sort={{ field: 'start_date', direction: 'desc' }}
            page={page}
            view={view}
          />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

async function EventsHeader() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Events</h1>
          <p className='text-muted-foreground'>Please sign in to view events</p>
        </div>
      </div>
    );
  }

  // Get user's hierarchy level
  const supabase = await createClient();
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    {
      user_id: user.id
    }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  return (
    <div className='flex items-center justify-between'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Events</h1>
        <p className='text-muted-foreground'>Discover and manage Yi events</p>
      </div>
      {userHierarchyLevel <= 4 && (
        <Button asChild>
          <Link href='/events/new'>
            <Plus className='mr-2 h-4 w-4' />
            Create Event
          </Link>
        </Button>
      )}
    </div>
  );
}

async function EventAnalytics() {
  const analytics = await getEventAnalytics();

  return (
    <div className='grid gap-4 md:grid-cols-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Total Events</CardTitle>
          <Calendar className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{analytics.total_events}</div>
          <p className='text-xs text-muted-foreground'>
            {analytics.upcoming_events} upcoming
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Total Attendees</CardTitle>
          <Calendar className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{analytics.total_attendees}</div>
          <p className='text-xs text-muted-foreground'>
            {Math.round(analytics.average_attendance_rate)}% attendance rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Volunteers</CardTitle>
          <Calendar className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{analytics.total_volunteers}</div>
          <p className='text-xs text-muted-foreground'>
            {analytics.total_volunteer_hours} hours contributed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Active Events</CardTitle>
          <Calendar className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{analytics.ongoing_events}</div>
          <p className='text-xs text-muted-foreground'>
            {analytics.completed_events} completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function MyEventsList({
  filters,
  sort,
  page,
  view
}: {
  filters: EventFilters;
  sort: EventSortOptions;
  page: number;
  view: 'grid' | 'calendar';
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <Calendar className='h-12 w-12 text-muted-foreground mb-4' />
          <h3 className='text-lg font-semibold mb-2'>Sign in required</h3>
          <p className='text-muted-foreground text-center mb-4'>
            Please sign in to view your events
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <EventsList
      filters={{
        ...filters,
        organizer_id: user.id
      }}
      sort={sort}
      page={page}
      view={view}
    />
  );
}

async function EventsList({
  filters,
  sort,
  page,
  view
}: {
  filters: EventFilters;
  sort: EventSortOptions;
  page: number;
  view: 'grid' | 'calendar';
}) {
  const { data: events, totalPages } = await getEvents({
    page: view === 'calendar' ? 1 : page,
    pageSize: view === 'calendar' ? 100 : 12,
    filters,
    sort
  });

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <Calendar className='h-12 w-12 text-muted-foreground mb-4' />
          <h3 className='text-lg font-semibold mb-2'>No events found</h3>
          <p className='text-muted-foreground text-center mb-4'>
            Try adjusting your filters or create a new event
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view === 'calendar') {
    return <EventCalendar events={events} />;
  }

  return (
    <>
      <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-2 mt-8'>
          <Button variant='outline' disabled={page === 1} asChild={page !== 1}>
            {page !== 1 ? (
              <Link href={`/events?page=${page - 1}`}>Previous</Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <span className='text-sm text-muted-foreground'>
            Page {page} of {totalPages}
          </span>
          <Button
            variant='outline'
            disabled={page === totalPages}
            asChild={page !== totalPages}
          >
            {page !== totalPages ? (
              <Link href={`/events?page=${page + 1}`}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </div>
      )}
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <Skeleton className='h-9 w-32 mb-2' />
        <Skeleton className='h-5 w-64' />
      </div>
      <Skeleton className='h-10 w-32' />
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className='space-y-0 pb-2'>
            <Skeleton className='h-4 w-24' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-8 w-16 mb-2' />
            <Skeleton className='h-3 w-32' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EventsGridSkeleton() {
  return (
    <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <Skeleton className='aspect-video' />
          <CardHeader>
            <Skeleton className='h-6 w-3/4' />
            <Skeleton className='h-4 w-full' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-20 w-full' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
