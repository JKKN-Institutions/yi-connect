/**
 * My Industrial Visit Bookings Page
 * View and manage personal IV bookings and waitlist entries
 */

import { Suspense } from 'react';
import { Metadata } from 'next';
import { Calendar, Clock, Car, Users, ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

import {
  getMyIVBookings,
  getMyWaitlistEntries
} from '@/lib/data/industrial-visits';
import { IVBookingActions } from '@/components/industrial-visits/iv-booking-actions';
import {
  CARPOOL_STATUS_LABELS,
  WAITLIST_STATUS_LABELS
} from '@/types/industrial-visit';

export const metadata: Metadata = {
  title: 'My Industrial Visit Bookings | Yi Connect',
  description: 'View and manage your industrial visit bookings'
};

async function MyBookingsContent() {
  // Handle prerendering errors gracefully - return empty data during build
  let bookings: Awaited<ReturnType<typeof getMyIVBookings>> = [];
  let waitlistEntries: Awaited<ReturnType<typeof getMyWaitlistEntries>> = [];

  try {
    [bookings, waitlistEntries] = await Promise.all([
      getMyIVBookings(),
      getMyWaitlistEntries()
    ]);
  } catch (error) {
    // During prerendering, auth functions may fail - return empty arrays
    console.log('Prerender: returning empty data for my-bookings page');
  }

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const upcomingBookings = confirmedBookings.filter(
    (b) => new Date(b.event.start_date) > new Date()
  );
  const pastBookings = confirmedBookings.filter(
    (b) => new Date(b.event.start_date) <= new Date()
  );
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
  const activeWaitlist = waitlistEntries.filter((w) => w.status === 'waiting');

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>My Bookings</h1>
          <p className='text-muted-foreground mt-1'>
            Manage your industrial visit bookings and waitlist entries
          </p>
        </div>
        <Button asChild>
          <Link href='/industrial-visits/marketplace'>
            Browse Industrial Visits
          </Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className='grid gap-4 md:grid-cols-4'>
        <div className='rounded-lg border bg-card p-4'>
          <div className='text-2xl font-bold text-primary'>
            {upcomingBookings.length}
          </div>
          <p className='text-xs text-muted-foreground'>Upcoming Events</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <div className='text-2xl font-bold'>{pastBookings.length}</div>
          <p className='text-xs text-muted-foreground'>Past Events</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <div className='text-2xl font-bold text-amber-600'>
            {activeWaitlist.length}
          </div>
          <p className='text-xs text-muted-foreground'>On Waitlist</p>
        </div>
        <div className='rounded-lg border bg-card p-4'>
          <div className='text-2xl font-bold text-muted-foreground'>
            {cancelledBookings.length}
          </div>
          <p className='text-xs text-muted-foreground'>Cancelled</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='upcoming' className='w-full'>
        <TabsList>
          <TabsTrigger value='upcoming'>
            Upcoming
            {upcomingBookings.length > 0 && (
              <Badge variant='secondary' className='ml-2'>
                {upcomingBookings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value='past'>Past</TabsTrigger>
          <TabsTrigger value='waitlist'>
            Waitlist
            {activeWaitlist.length > 0 && (
              <Badge variant='secondary' className='ml-2'>
                {activeWaitlist.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value='cancelled'>Cancelled</TabsTrigger>
        </TabsList>

        {/* Upcoming Bookings */}
        <TabsContent value='upcoming' className='mt-6'>
          {upcomingBookings.length === 0 ? (
            <Alert>
              <Calendar className='h-4 w-4' />
              <AlertDescription>
                You don&apos;t have any upcoming industrial visits. Browse the
                marketplace to find interesting opportunities!
              </AlertDescription>
            </Alert>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              {upcomingBookings.map((booking) => {
                const event = booking.event;
                const startDate = new Date(event.start_date);
                const endDate = event.end_date
                  ? new Date(event.end_date)
                  : null;

                return (
                  <Card key={booking.id}>
                    <CardHeader>
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <CardTitle className='text-lg line-clamp-2'>
                            {event.title}
                          </CardTitle>
                          {event.industry?.name && (
                            <CardDescription className='mt-1'>
                              {event.industry.name}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant='default'>Confirmed</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className='space-y-3'>
                      <div className='flex items-center gap-2 text-sm'>
                        <Calendar className='h-4 w-4 text-muted-foreground' />
                        <span>{format(startDate, 'MMM d, yyyy')}</span>
                      </div>
                      <div className='flex items-center gap-2 text-sm'>
                        <Clock className='h-4 w-4 text-muted-foreground' />
                        <span>
                          {format(startDate, 'h:mm a')} -{' '}
                          {endDate ? format(endDate, 'h:mm a') : 'TBD'}
                        </span>
                      </div>

                      {booking.family_count > 0 && (
                        <div className='flex items-center gap-2 text-sm'>
                          <Users className='h-4 w-4 text-muted-foreground' />
                          <span>
                            +{booking.family_count} family member
                            {booking.family_count > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {booking.carpool_status !== 'not_needed' && (
                        <div className='flex items-center gap-2 text-sm'>
                          <Car className='h-4 w-4 text-muted-foreground' />
                          <span>
                            {CARPOOL_STATUS_LABELS[booking.carpool_status]}
                          </span>
                          {booking.carpool_status === 'offering_ride' &&
                            booking.seats_available && (
                              <Badge variant='secondary' className='text-xs'>
                                {booking.seats_available} seats
                              </Badge>
                            )}
                        </div>
                      )}

                      {booking.family_names &&
                        booking.family_names.length > 0 && (
                          <div className='pt-2 border-t'>
                            <p className='text-xs font-medium mb-1'>
                              Family Members:
                            </p>
                            <div className='text-xs text-muted-foreground'>
                              {booking.family_names.join(', ')}
                            </div>
                          </div>
                        )}
                    </CardContent>

                    <CardFooter className='flex gap-2'>
                      <Button
                        asChild
                        variant='outline'
                        size='sm'
                        className='flex-1'
                      >
                        <Link href={`/industrial-visits/${event.id}`}>
                          <ExternalLink className='mr-2 h-4 w-4' />
                          View Details
                        </Link>
                      </Button>
                      <IVBookingActions
                        bookingId={booking.id}
                        eventTitle={event.title}
                      />
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Past Bookings */}
        <TabsContent value='past' className='mt-6'>
          {pastBookings.length === 0 ? (
            <Alert>
              <Calendar className='h-4 w-4' />
              <AlertDescription>
                You haven&apos;t attended any industrial visits yet.
              </AlertDescription>
            </Alert>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              {pastBookings.map((booking) => {
                const event = booking.event;
                const startDate = new Date(event.start_date);

                return (
                  <Card key={booking.id} className='opacity-75'>
                    <CardHeader>
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <CardTitle className='text-lg line-clamp-2'>
                            {event.title}
                          </CardTitle>
                          {event.industry?.name && (
                            <CardDescription className='mt-1'>
                              {event.industry.name}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant='secondary'>Attended</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className='space-y-3'>
                      <div className='flex items-center gap-2 text-sm'>
                        <Calendar className='h-4 w-4 text-muted-foreground' />
                        <span>{format(startDate, 'MMM d, yyyy')}</span>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button
                        asChild
                        variant='outline'
                        size='sm'
                        className='w-full'
                      >
                        <Link href={`/industrial-visits/${event.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Waitlist Entries */}
        <TabsContent value='waitlist' className='mt-6'>
          {activeWaitlist.length === 0 ? (
            <Alert>
              <Clock className='h-4 w-4' />
              <AlertDescription>
                You&apos;re not on any waitlists. If an industrial visit is
                full, you can join the waitlist to be notified when spots open
                up.
              </AlertDescription>
            </Alert>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              {activeWaitlist.map((waitlist) => {
                const event = waitlist.event;
                const startDate = new Date(event.start_date);
                const addedDate = new Date(waitlist.added_at);

                return (
                  <Card key={waitlist.id}>
                    <CardHeader>
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <CardTitle className='text-lg line-clamp-2'>
                            {event.title}
                          </CardTitle>
                          <CardDescription className='mt-1'>
                            Position #{waitlist.position} in waitlist
                          </CardDescription>
                        </div>
                        <Badge variant='secondary'>
                          {WAITLIST_STATUS_LABELS[waitlist.status]}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className='space-y-3'>
                      <div className='flex items-center gap-2 text-sm'>
                        <Calendar className='h-4 w-4 text-muted-foreground' />
                        <span>Event: {format(startDate, 'MMM d, yyyy')}</span>
                      </div>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Clock className='h-4 w-4' />
                        <span>Joined {format(addedDate, 'MMM d, yyyy')}</span>
                      </div>
                      {event.current_registrations !== undefined &&
                        event.max_capacity && (
                          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <Users className='h-4 w-4' />
                            <span>
                              {event.current_registrations} /{' '}
                              {event.max_capacity} registered
                            </span>
                          </div>
                        )}
                    </CardContent>

                    <CardFooter className='flex gap-2'>
                      <Button
                        asChild
                        variant='outline'
                        size='sm'
                        className='flex-1'
                      >
                        <Link href={`/industrial-visits/${event.id}`}>
                          View Event
                        </Link>
                      </Button>
                      {/* TODO: Add leave waitlist button */}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Cancelled Bookings */}
        <TabsContent value='cancelled' className='mt-6'>
          {cancelledBookings.length === 0 ? (
            <Alert>
              <AlertDescription>
                You haven&apos;t cancelled any bookings.
              </AlertDescription>
            </Alert>
          ) : (
            <div className='grid gap-6 md:grid-cols-2'>
              {cancelledBookings.map((booking) => {
                const event = booking.event;
                const startDate = new Date(event.start_date);
                const cancelledDate = booking.cancelled_at
                  ? new Date(booking.cancelled_at)
                  : null;

                return (
                  <Card key={booking.id} className='opacity-60'>
                    <CardHeader>
                      <div className='flex items-start justify-between gap-2'>
                        <div>
                          <CardTitle className='text-lg line-clamp-2'>
                            {event.title}
                          </CardTitle>
                          {event.industry?.name && (
                            <CardDescription className='mt-1'>
                              {event.industry.name}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant='destructive'>Cancelled</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className='space-y-3'>
                      <div className='flex items-center gap-2 text-sm'>
                        <Calendar className='h-4 w-4 text-muted-foreground' />
                        <span>{format(startDate, 'MMM d, yyyy')}</span>
                      </div>
                      {cancelledDate && (
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <X className='h-4 w-4' />
                          <span>
                            Cancelled on {format(cancelledDate, 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter>
                      <Button
                        asChild
                        variant='outline'
                        size='sm'
                        className='w-full'
                      >
                        <Link href={`/industrial-visits/${event.id}`}>
                          View Event
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MyBookingsLoading() {
  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <Skeleton className='h-9 w-64' />
          <Skeleton className='h-4 w-96 mt-2' />
        </div>
        <Skeleton className='h-10 w-48' />
      </div>

      <div className='grid gap-4 md:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-20 rounded-lg' />
        ))}
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-64 rounded-lg' />
        ))}
      </div>
    </div>
  );
}

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<MyBookingsLoading />}>
      <MyBookingsContent />
    </Suspense>
  );
}
