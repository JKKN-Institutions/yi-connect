/**
 * Events Table View Page
 *
 * Advanced data table with server-side pagination, sorting, and filtering.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { createClient } from '@/lib/supabase/server';
import { getEvents } from '@/lib/data/events';
import { EventsDataTable } from '@/components/events/events-data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventFilters, EventSortOptions } from '@/types/event';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    sort?: string;
    order?: string;
    search?: string;
    status?: string;
    category?: string;
    start_date_from?: string;
    start_date_to?: string;
  }>;
}

export default function EventsTablePage({ searchParams }: PageProps) {
  return (
    <div className='flex flex-col gap-6'>
      <Suspense fallback={<HeaderSkeleton />}>
        <EventsTableHeader />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <EventsTableContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EventsTableHeader() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    { user_id: user.id }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  return (
    <div className='flex items-center justify-between'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Events Table</h1>
        <p className='text-muted-foreground'>
          Advanced table view with filtering and bulk operations
        </p>
      </div>
      <div className='flex gap-2'>
        <Button variant='outline' asChild>
          <Link href='/events'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Events
          </Link>
        </Button>
        {userHierarchyLevel <= 4 && (
          <Button asChild>
            <Link href='/events/new'>
              <Plus className='mr-2 h-4 w-4' />
              New Event
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

async function EventsTableContent({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse pagination
  const page = parseInt(params.page || '1');
  const pageSize = parseInt(params.pageSize || '20');

  // Parse sorting
  const sortField = (params.sort || 'start_date') as any;
  const sortDirection = (params.order || 'desc') as 'asc' | 'desc';

  const sort: EventSortOptions = {
    field: sortField,
    direction: sortDirection
  };

  // Parse filters
  const filters: EventFilters = {
    search: params.search,
    status: params.status ? [params.status as any] : undefined,
    category: params.category ? [params.category as any] : undefined,
    start_date_from: params.start_date_from,
    start_date_to: params.start_date_to
  };

  // Fetch events
  const { data: events, totalPages, total } = await getEvents({
    page,
    pageSize,
    filters,
    sort
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Events</CardTitle>
        <CardDescription>
          {total} total events • Page {page} of {totalPages}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EventsDataTable
          data={events}
          pageCount={totalPages}
          totalCount={total}
          currentPage={page}
          pageSize={pageSize}
        />
      </CardContent>
    </Card>
  );
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div className='space-y-2'>
        <Skeleton className='h-9 w-48' />
        <Skeleton className='h-4 w-96' />
      </div>
      <div className='flex gap-2'>
        <Skeleton className='h-10 w-32' />
        <Skeleton className='h-10 w-32' />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-32' />
        <Skeleton className='h-4 w-64' />
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex gap-2'>
            <Skeleton className='h-10 flex-1' />
            <Skeleton className='h-10 w-32' />
            <Skeleton className='h-10 w-32' />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
