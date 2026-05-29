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
import { requireRole, getCurrentChapterId } from '@/lib/auth';
import { getEventFull } from '@/lib/data/events';
import { EventForm } from '@/components/events';
import { Button } from '@/components/ui/button';
import { Forbidden } from '@/components/forbidden';
import type { Venue, EventTemplate } from '@/types/event';
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

export default async function EventEditPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

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
      p_user_id: user.id
    }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  // Fetch event data
  const event = await getEventFull(id);

  if (!event) {
    notFound();
  }

  // CHAPTER SCOPING (BUG-leak-fix 2026-05-28): block cross-chapter edits.
  // Super Admin / National Admin bypass the chapter check.
  const currentChapterId = await getCurrentChapterId();
  const { data: roleRows } = await supabase
    .schema('yi_connect')
    .rpc('get_user_roles_detailed', { p_user_id: user.id });
  const roleNames = (roleRows || []).map(
    (r: { role_name: string }) => r.role_name
  );
  const isSuperAdmin =
    roleNames.includes('Super Admin') || roleNames.includes('National Admin');

  const eventChapterId =
    (event as { chapter_id?: string | null; chapter?: { id?: string } | null })
      .chapter_id ?? (event as { chapter?: { id?: string } | null }).chapter?.id ?? null;

  if (
    !isSuperAdmin &&
    eventChapterId &&
    currentChapterId &&
    eventChapterId !== currentChapterId
  ) {
    return (
      <Forbidden reason="This event belongs to another chapter and cannot be edited from your account." />
    );
  }

  // Check permissions - only organizer or admin can edit
  // Higher hierarchy_level = more authority (Super Admin=7, National Admin=6, etc.)
  const isOrganizer = event.organizer?.id === user.id;
  const isAdmin = userHierarchyLevel >= 4; // Chair and above
  const canEdit = isOrganizer || isAdmin;

  if (!canEdit) {
    // BUG-leak-fix 2026-05-28: was `redirect(`/events/${id}`)` — silent
    // redirect created a confusing bounce-loop. Surface the reason instead.
    return (
      <Forbidden reason="You don't have edit access to this event. Only the event organizer or Chapter Chair+ can edit." />
    );
  }

  // Fetch venues for the form
  const { data: venuesData } = await supabase
    .schema('yi_connect').from('venues')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  const venues = (venuesData || []) as Venue[];

  // Fetch templates for the form
  const { data: templatesData } = await supabase
    .schema('yi_connect').from('event_templates')
    .select('*')
    .order('name', { ascending: true });
  const templates = (templatesData || []) as EventTemplate[];

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
          <EventForm event={event} venues={venues} templates={templates} />
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
