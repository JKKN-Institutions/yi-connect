/**
 * PublicEventHero
 *
 * Top banner section on the public event landing page. Shows the event's
 * banner image (with a Yi-branded gradient fallback), category badge,
 * title, date/time, location summary, and a prominent Register CTA that
 * scrolls to the registration block lower on the page.
 */

import Image from 'next/image';
import { format } from 'date-fns';
import { Calendar, MapPin, Users, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PublicEventBySlug } from '@/lib/data/public-events';

interface PublicEventHeroProps {
  event: PublicEventBySlug;
  isEventOver: boolean;
  isEventFull: boolean;
}

export function PublicEventHero({
  event,
  isEventOver,
  isEventFull,
}: PublicEventHeroProps) {
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const isMultiDay =
    format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

  const spotsLeft =
    event.max_capacity && event.max_capacity > event.current_registrations
      ? event.max_capacity - event.current_registrations
      : null;

  const ctaLabel = isEventOver
    ? 'Event Completed'
    : isEventFull
      ? 'Event Full'
      : 'Register Now';

  return (
    <section className='relative overflow-hidden rounded-2xl border bg-card shadow-sm'>
      {/* Banner image or gradient fallback */}
      <div className='relative aspect-[16/9] w-full bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500 dark:from-orange-700 dark:via-amber-700 dark:to-rose-800'>
        {event.banner_image_url ? (
          <Image
            src={event.banner_image_url}
            alt={event.title}
            fill
            priority
            sizes='(max-width: 1024px) 100vw, 960px'
            className='object-cover'
          />
        ) : (
          <div
            aria-hidden
            className='absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]'
          />
        )}
        <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent' />

        {/* Badges overlay */}
        <div className='absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6'>
          <Badge
            variant='secondary'
            className='bg-background/90 text-foreground backdrop-blur-sm'
          >
            {event.category}
          </Badge>
          {event.is_virtual && (
            <Badge
              variant='secondary'
              className='bg-background/90 text-foreground backdrop-blur-sm'
            >
              <Video className='mr-1 h-3 w-3' />
              Virtual
            </Badge>
          )}
          {event.status === 'completed' && (
            <Badge variant='outline' className='bg-background/90 backdrop-blur-sm'>
              Completed
            </Badge>
          )}
          {event.status === 'ongoing' && (
            <Badge className='bg-green-600 text-white'>Live now</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className='p-5 sm:p-8'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl'>
          {event.title}
        </h1>

        <div className='mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <Calendar className='h-4 w-4 text-orange-500' />
            <span className='font-medium text-foreground'>
              {format(startDate, 'EEE, MMM d, yyyy')}
            </span>
            <span>· {format(startDate, 'h:mm a')}</span>
            {isMultiDay && (
              <span className='text-xs'>
                &nbsp;– {format(endDate, 'MMM d')}
              </span>
            )}
          </div>

          {!event.is_virtual && event.venue_address && (
            <div className='flex items-center gap-2'>
              <MapPin className='h-4 w-4 text-orange-500' />
              <span className='line-clamp-1'>
                {event.venue_address.split(',')[0]}
              </span>
            </div>
          )}

          {event.is_virtual && (
            <div className='flex items-center gap-2'>
              <Video className='h-4 w-4 text-orange-500' />
              <span>Online event</span>
            </div>
          )}

          <div className='flex items-center gap-2'>
            <Users className='h-4 w-4 text-orange-500' />
            <span>
              {event.current_registrations} registered
              {spotsLeft !== null ? ` · ${spotsLeft} spots left` : ''}
            </span>
          </div>
        </div>

        <div className='mt-6 flex flex-wrap items-center gap-3'>
          <Button
            size='lg'
            asChild={!isEventOver && !isEventFull}
            disabled={isEventOver || isEventFull}
            className='shadow-sm'
          >
            {isEventOver || isEventFull ? (
              <span>{ctaLabel}</span>
            ) : (
              <a href='#register'>{ctaLabel}</a>
            )}
          </Button>

          {event.chapter?.name && (
            <span className='text-sm text-muted-foreground'>
              Hosted by{' '}
              <span className='font-medium text-foreground'>
                {event.chapter.name}
              </span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
