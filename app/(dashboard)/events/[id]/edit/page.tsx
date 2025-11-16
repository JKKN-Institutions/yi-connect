/**
 * Event Edit Page
 *
 * Edit existing event details with pre-populated form.
 */

import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { createClient } from '@/lib/supabase/server';
import { getEventFull } from '@/lib/data/events';
import { EventForm } from '@/components/events';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EventEditPage({ params }: PageProps) {
  return (
    <Suspense fallback={<EventEditSkeleton />}>
      <EventEditContent params={params} />
    </Suspense>
  );
}

async function EventEditContent({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Await params (Next.js 16 requirement)
  const { id } = await params;

  // Get user's hierarchy level
  const supabase = await createClient();
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    {
      user_id: user.id
    }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  // Fetch event data
  const event = await getEventFull(id);

  if (!event) {
    notFound();
  }

  // Check permissions - only organizer or admin can edit
  const isOrganizer = event.organizer_id === user.id;
  const isAdmin = userHierarchyLevel <= 3;
  const canEdit = isOrganizer || isAdmin;

  if (!canEdit) {
    redirect(`/events/${id}`);
  }

  // Fetch venues for the form
  const { data: venues } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  // Fetch templates for the form
  const { data: templates } = await supabase
    .from('event_templates')
    .select('*')
    .order('name', { ascending: true }) as { data: any[] | null };

  return (
    <div className='flex flex-col gap-6'>
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/dashboard'>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/events'>Events</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/events/${id}`}>
              {event.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Edit Event</h1>
          <p className='text-muted-foreground mt-2'>
            Update event details and settings
          </p>
        </div>
        <Button variant='outline' asChild>
          <Link href={`/events/${id}`}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Event
          </Link>
        </Button>
      </div>

      {/* Event Form */}
      <Card>
        <CardContent className='pt-6'>
          <EventForm
            event={event as any}
            venues={venues || []}
            templates={(templates || []) as any}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EventEditSkeleton() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Breadcrumbs Skeleton */}
      <div className='flex items-center gap-2'>
        <Skeleton className='h-4 w-20' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-16' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-4 w-4' />
        <Skeleton className='h-4 w-12' />
      </div>

      {/* Header Skeleton */}
      <div className='flex items-center justify-between'>
        <div className='space-y-2'>
          <Skeleton className='h-9 w-48' />
          <Skeleton className='h-4 w-64' />
        </div>
        <Skeleton className='h-10 w-32' />
      </div>

      {/* Form Skeleton */}
      <Card>
        <CardContent className='pt-6'>
          <div className='space-y-6'>
            <div className='space-y-4'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-32 w-full' />
              <Skeleton className='h-10 w-full' />
            </div>
            <Skeleton className='h-10 w-full' />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
