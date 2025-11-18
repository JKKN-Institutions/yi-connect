/**
 * Event Check-in Page
 *
 * QR code redirects here for quick event check-in.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, QrCode, CheckCircle2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { getEventFull } from '@/lib/data/events';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { CheckInForm } from '@/components/events/check-in-form';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    qr?: string;
  }>;
}

export default function EventCheckInPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<CheckInSkeleton />}>
      <CheckInContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CheckInContent({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;
  const { qr } = await searchParams;

  const event = await getEventFull(id);

  if (!event) {
    notFound();
  }

  // Check if user is already checked in
  let isCheckedIn = false;
  if (user) {
    const supabase = await createClient();
    const { data: checkin } = await supabase
      .from('event_checkins')
      .select('id')
      .eq('event_id', id)
      .eq('attendee_id', user.id)
      .eq('attendee_type', 'member')
      .single();

    isCheckedIn = !!checkin;
  }

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
            <BreadcrumbPage>Check-in</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Event Check-in</h1>
          <p className='text-muted-foreground mt-2'>
            {event.title}
          </p>
        </div>
        <Button variant='outline' asChild>
          <Link href={`/events/${id}`}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Event
          </Link>
        </Button>
      </div>

      {/* Check-in Status or Form */}
      {isCheckedIn ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <CheckCircle2 className='h-16 w-16 text-green-600 mb-4' />
            <h3 className='text-xl font-semibold mb-2'>Already Checked In!</h3>
            <p className='text-muted-foreground text-center mb-4'>
              You have already checked in to this event.
            </p>
            <Button asChild>
              <Link href={`/events/${id}`}>View Event Details</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              {qr && <QrCode className='h-5 w-5 text-muted-foreground' />}
              <CardTitle>Check-in to Event</CardTitle>
            </div>
            <CardDescription>
              {qr
                ? 'Complete the form below to check in via QR code'
                : 'Mark your attendance for this event'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CheckInForm eventId={id} userId={user?.id} />
          </CardContent>
        </Card>
      )}

      {/* Event Information */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Event Information</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Date:</span>
            <span className='font-medium'>
              {new Date(event.start_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Time:</span>
            <span className='font-medium'>
              {new Date(event.start_date).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
              {event.end_date && ` - ${new Date(event.end_date).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}`}
            </span>
          </div>
          {(event as any).venue?.name && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Venue:</span>
              <span className='font-medium'>{(event as any).venue.name}</span>
            </div>
          )}
          {event.is_virtual && event.virtual_meeting_link && (
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Meeting Link:</span>
              <a
                href={event.virtual_meeting_link}
                target='_blank'
                rel='noopener noreferrer'
                className='font-medium text-primary hover:underline'
              >
                Join Virtual Event
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CheckInSkeleton() {
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
        <Skeleton className='h-4 w-16' />
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
        <CardHeader>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='h-4 w-full' />
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
