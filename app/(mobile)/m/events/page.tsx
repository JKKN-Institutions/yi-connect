/**
 * Mobile Events Page
 *
 * Lists upcoming events in a mobile-optimized format
 * with RSVP functionality.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { MobileHeader } from '@/components/mobile/mobile-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Users, Clock } from 'lucide-react'
import { getEvents } from '@/lib/data/events'
import { getUserProfile } from '@/lib/auth'
import { format } from 'date-fns'

// Event card component for mobile
// Note: isUpcoming is pre-computed on server to avoid hydration mismatch
function MobileEventCard({
  event,
  isUpcoming
}: {
  event: {
    id: string
    title: string
    description: string | null
    start_date: string
    end_date: string
    venue: string | null
    status: string
    category: string
    rsvp_count?: number
    capacity?: number
  }
  isUpcoming: boolean
}) {
  const startDate = new Date(event.start_date)

  return (
    <Link href={`/m/events/${event.id}`}>
      <Card className='overflow-hidden active:bg-accent transition-colors'>
        <CardContent className='p-4'>
          <div className='flex gap-4'>
            {/* Date Badge */}
            <div className='flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-primary/10 shrink-0'>
              <span className='text-xs font-medium text-primary uppercase'>
                {format(startDate, 'MMM')}
              </span>
              <span className='text-xl font-bold text-primary'>
                {format(startDate, 'd')}
              </span>
            </div>

            {/* Event Details */}
            <div className='flex-1 min-w-0'>
              <div className='flex items-start justify-between gap-2'>
                <h3 className='font-semibold text-sm line-clamp-2'>
                  {event.title}
                </h3>
                <Badge
                  variant={
                    event.status === 'published'
                      ? 'default'
                      : event.status === 'completed'
                      ? 'secondary'
                      : 'outline'
                  }
                  className='shrink-0 text-[10px]'
                >
                  {event.status}
                </Badge>
              </div>

              <div className='mt-2 space-y-1'>
                <div className='flex items-center text-xs text-muted-foreground'>
                  <Clock className='h-3 w-3 mr-1.5 shrink-0' />
                  <span>{format(startDate, 'h:mm a')}</span>
                </div>

                {event.venue && (
                  <div className='flex items-center text-xs text-muted-foreground'>
                    <MapPin className='h-3 w-3 mr-1.5 shrink-0' />
                    <span className='truncate'>{event.venue}</span>
                  </div>
                )}

                {event.capacity && (
                  <div className='flex items-center text-xs text-muted-foreground'>
                    <Users className='h-3 w-3 mr-1.5 shrink-0' />
                    <span>
                      {event.rsvp_count || 0} / {event.capacity} attending
                    </span>
                  </div>
                )}
              </div>

              {isUpcoming && event.status === 'published' && (
                <Button size='sm' className='mt-3 h-8 text-xs w-full'>
                  RSVP Now
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// Events list component
async function EventsList() {
  const profile = await getUserProfile()
  const result = await getEvents({
    filters: {
      status: ['published']
    },
    page: 1,
    pageSize: 20
  })

  if (!result.data || result.data.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 px-4 text-center'>
        <Calendar className='h-12 w-12 text-muted-foreground/50 mb-4' />
        <h3 className='font-semibold text-lg mb-1'>No Events Found</h3>
        <p className='text-sm text-muted-foreground'>
          There are no upcoming events at the moment.
          <br />
          Check back later for new events!
        </p>
      </div>
    )
  }

  // Compute current time once on server for consistent hydration
  const serverNow = new Date()

  return (
    <div className='space-y-3 px-4'>
      {result.data.map((event) => {
        const startDate = new Date(event.start_date)
        const isUpcoming = startDate > serverNow

        return (
          <MobileEventCard
            key={event.id}
            event={{
              id: event.id,
              title: event.title,
              description: event.description,
              start_date: event.start_date,
              end_date: event.end_date,
              venue: typeof event.venue === 'object' && event.venue ? event.venue.name : event.venue_address || null,
              status: event.status,
              category: event.category,
              capacity: event.max_capacity || undefined
            }}
            isUpcoming={isUpcoming}
          />
        )
      })}
    </div>
  )
}

// Loading skeleton
function EventsListSkeleton() {
  return (
    <div className='space-y-3 px-4'>
      {[1, 2, 3].map((i) => (
        <Card key={i} className='overflow-hidden'>
          <CardContent className='p-4'>
            <div className='flex gap-4'>
              <div className='w-14 h-14 rounded-lg bg-muted animate-pulse' />
              <div className='flex-1'>
                <div className='h-4 w-3/4 bg-muted animate-pulse rounded mb-2' />
                <div className='h-3 w-1/2 bg-muted animate-pulse rounded mb-2' />
                <div className='h-3 w-2/3 bg-muted animate-pulse rounded' />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function MobileEventsPage() {
  return (
    <div className='min-h-screen bg-background'>
      <MobileHeader title='Events' showBack />

      <div className='py-4'>
        <Suspense fallback={<EventsListSkeleton />}>
          <EventsList />
        </Suspense>
      </div>
    </div>
  )
}
