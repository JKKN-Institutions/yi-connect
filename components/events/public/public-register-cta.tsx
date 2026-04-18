/**
 * PublicRegisterCTA
 *
 * Registration block on the public landing page. Logic:
 *   - Event completed / past  → disabled "Event completed" card.
 *   - Event full              → disabled "Event full" card + member link
 *                               (members can still RSVP via the existing
 *                               token flow which handles waitlist).
 *   - Has rsvp_token          → primary button links to /rsvp/[token]
 *                               (existing member + HMAC'd guest flow),
 *                               plus inline GuestRSVPForm as a fast path
 *                               for anonymous visitors.
 *   - No rsvp_token           → graceful fallback with "Registration
 *                               coming soon" copy.
 */

import Link from 'next/link';
import { ArrowRight, CalendarCheck, CalendarX2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuestRSVPForm } from '@/components/events/guest-rsvp-form';
import type {
  PublicEventBySlug,
  PublicGuestRSVP,
} from '@/lib/data/public-events';

interface PublicRegisterCTAProps {
  event: PublicEventBySlug;
  isEventOver: boolean;
  isEventFull: boolean;
  existingGuests: PublicGuestRSVP[];
}

export function PublicRegisterCTA({
  event,
  isEventOver,
  isEventFull,
  existingGuests,
}: PublicRegisterCTAProps) {
  // ---------------------------------------------------------------------------
  // Event over → disabled state
  // ---------------------------------------------------------------------------
  if (isEventOver) {
    return (
      <Card
        id='register'
        className='scroll-mt-24 overflow-hidden border-0 bg-muted/40 shadow-sm'
      >
        <CardContent className='flex flex-col items-center gap-3 p-6 text-center sm:p-8'>
          <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted'>
            <CalendarX2 className='h-6 w-6 text-muted-foreground' />
          </div>
          <h2 className='text-lg font-semibold text-foreground'>
            This event has completed
          </h2>
          <p className='max-w-md text-sm text-muted-foreground'>
            Thanks for your interest — registration is now closed. Follow the
            host chapter to hear about upcoming events.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Event full → disabled state (with optional member fallback)
  // ---------------------------------------------------------------------------
  if (isEventFull) {
    return (
      <Card
        id='register'
        className='scroll-mt-24 overflow-hidden border-0 bg-amber-50 shadow-sm dark:bg-amber-950/20'
      >
        <CardContent className='flex flex-col items-center gap-3 p-6 text-center sm:p-8'>
          <div className='flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40'>
            <Users className='h-6 w-6 text-amber-700 dark:text-amber-300' />
          </div>
          <h2 className='text-lg font-semibold text-foreground'>
            This event is full
          </h2>
          <p className='max-w-md text-sm text-muted-foreground'>
            All {event.max_capacity} spots have been claimed.{' '}
            {event.rsvp_token
              ? 'Chapter members can still join the waitlist.'
              : 'Contact the host chapter for availability.'}
          </p>
          {event.rsvp_token && (
            <Button asChild variant='outline' size='sm'>
              <Link href={`/rsvp/${event.rsvp_token}`}>
                Join waitlist
                <ArrowRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Active registration
  // ---------------------------------------------------------------------------
  return (
    <Card
      id='register'
      className='scroll-mt-24 overflow-hidden border-0 bg-gradient-to-br from-orange-50 to-amber-50/60 shadow-sm dark:from-orange-950/30 dark:to-amber-950/20 ring-1 ring-orange-200/60 dark:ring-orange-800/40'
    >
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <CalendarCheck className='h-5 w-5 text-orange-500' />
          Register for this event
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-5'>
        {event.rsvp_token ? (
          <>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='text-sm text-muted-foreground'>
                {event.current_registrations > 0 ? (
                  <span>
                    Join <b className='text-foreground'>{event.current_registrations}</b>{' '}
                    others already attending.
                  </span>
                ) : (
                  <span>Be the first to RSVP.</span>
                )}
              </div>
              <Button asChild size='lg' className='shrink-0 shadow-sm'>
                <Link href={`/rsvp/${event.rsvp_token}`}>
                  Continue to RSVP
                  <ArrowRight className='ml-2 h-4 w-4' />
                </Link>
              </Button>
            </div>

            {event.allow_guests && (
              <div>
                <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                  Non-member? Add yourself below
                </p>
                <GuestRSVPForm
                  eventId={event.id}
                  token={event.rsvp_token}
                  existingGuests={existingGuests}
                />
              </div>
            )}
          </>
        ) : (
          <p className='text-sm text-muted-foreground'>
            Registration will open soon. Check back closer to the event date.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
