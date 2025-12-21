/**
 * Event Card Component
 *
 * Modern, clean event card with responsive design.
 * Used in event lists, grids, and dashboards.
 */

'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  Calendar,
  MapPin,
  Users,
  Video,
  Clock,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import type { EventListItem } from '@/types/event';
import { EVENT_CATEGORIES, getEventStatusVariant } from '@/types/event';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { EventPublishButtonCompact } from './event-publish-button';

interface EventCardProps {
  event: EventListItem;
  showOrganizer?: boolean;
  showCapacity?: boolean;
  compact?: boolean;
  canPublish?: boolean;
}

export function EventCard({
  event,
  showOrganizer = true,
  showCapacity = true,
  compact = false,
  canPublish = false
}: EventCardProps) {
  const statusVariant = getEventStatusVariant(event.status);
  const capacityPercentage = event.max_capacity
    ? (event.current_registrations / event.max_capacity) * 100
    : 0;
  const isFull =
    event.max_capacity && event.current_registrations >= event.max_capacity;
  const isAlmostFull = capacityPercentage >= 80;

  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const isMultiDay =
    format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

  return (
    <Card
      className={cn(
        'group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-0 shadow-md bg-card',
        event.is_featured && 'ring-2 ring-orange-500/50'
      )}
    >
      {/* Image Section */}
      <div className='relative'>
        {event.banner_image_url ? (
          <div className='relative aspect-[16/10] overflow-hidden bg-muted'>
            <Image
              src={event.banner_image_url}
              alt={event.title}
              fill
              className='object-cover transition-transform duration-500 group-hover:scale-110'
              sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            />
            {/* Gradient overlay */}
            <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' />
          </div>
        ) : (
          <div className='relative aspect-[16/10] bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/30 flex items-center justify-center'>
            <Calendar className='h-12 w-12 text-orange-300 dark:text-orange-700' />
          </div>
        )}

        {/* Status Badge - Top Left */}
        <div className='absolute top-3 left-3 flex flex-wrap gap-2'>
          <Badge
            variant={statusVariant as any}
            className='shadow-lg backdrop-blur-sm'
          >
            {event.status}
          </Badge>
          {event.is_featured && (
            <Badge className='bg-orange-500 text-white shadow-lg backdrop-blur-sm'>
              <TrendingUp className='mr-1 h-3 w-3' />
              Featured
            </Badge>
          )}
        </div>

        {/* Category Badge - Top Right */}
        <Badge
          variant='secondary'
          className='absolute top-3 right-3 bg-white/90 text-black dark:bg-black/70 backdrop-blur-sm shadow-lg text-xs'
        >
          {EVENT_CATEGORIES[event.category]}
        </Badge>

        {/* Date Badge - Bottom Left, overlapping */}
        <div className='absolute -bottom-6 left-4 z-10'>
          <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-3 text-center min-w-[60px] border'>
            <div className='text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase'>
              {format(startDate, 'MMM')}
            </div>
            <div className='text-2xl font-bold text-foreground leading-none'>
              {format(startDate, 'd')}
            </div>
            <div className='text-[10px] text-muted-foreground'>
              {format(startDate, 'EEE')}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <CardContent className='pt-10 pb-4 px-4'>
        {/* Title */}
        <Link href={`/events/${event.id}`} className='block group/title'>
          <h3 className='font-bold text-lg leading-tight line-clamp-2 group-hover/title:text-orange-600 dark:group-hover/title:text-orange-400 transition-colors'>
            {event.title}
          </h3>
        </Link>

        {/* Time & Location */}
        <div className='mt-3 space-y-2'>
          {/* Time */}
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Clock className='h-4 w-4 flex-shrink-0 text-orange-500' />
            <span>
              {format(startDate, 'h:mm a')}
              {isMultiDay && (
                <span className='text-xs'> · Multi-day event</span>
              )}
            </span>
          </div>

          {/* Location */}
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            {event.is_virtual ? (
              <>
                <Video className='h-4 w-4 flex-shrink-0 text-blue-500' />
                <span>Virtual Event</span>
              </>
            ) : (
              <>
                <MapPin className='h-4 w-4 flex-shrink-0 text-red-500' />
                <span className='truncate'>
                  {event.venue?.name ||
                    event.venue_address?.split(',')[0] ||
                    'Location TBD'}
                </span>
              </>
            )}
          </div>

          {/* Capacity */}
          {showCapacity && event.max_capacity && (
            <div className='flex items-center gap-2 text-sm'>
              <Users className='h-4 w-4 flex-shrink-0 text-purple-500' />
              <div className='flex-1 flex items-center gap-2'>
                <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isFull
                        ? 'bg-red-500'
                        : isAlmostFull
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    )}
                    style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isFull
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {event.current_registrations}/{event.max_capacity}
                  {isFull && ' · Full'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Organizer */}
        {showOrganizer && event.organizer?.profile && (
          <div className='mt-4 pt-3 border-t flex items-center gap-2'>
            <Avatar className='h-6 w-6 ring-2 ring-background'>
              <AvatarImage
                src={event.organizer.profile.avatar_url || undefined}
              />
              <AvatarFallback className='bg-orange-100 text-orange-700 text-xs font-semibold'>
                {event.organizer.profile.full_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className='text-xs text-muted-foreground truncate'>
              by{' '}
              <span className='font-medium text-foreground'>
                {event.organizer.profile.full_name}
              </span>
            </span>
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className='px-4 pb-4 pt-0'>
        {event.status === 'draft' && canPublish ? (
          <div className='flex gap-2 w-full'>
            <EventPublishButtonCompact
              eventId={event.id}
              eventTitle={event.title}
              status={event.status}
              canPublish={canPublish}
            />
            <Button asChild variant='outline' size='sm' className='flex-1'>
              <Link href={`/events/${event.id}`}>
                View
                <ArrowRight className='ml-1 h-3 w-3' />
              </Link>
            </Button>
          </div>
        ) : (
          <Button
            asChild
            className={cn(
              'w-full group/btn',
              event.status === 'published'
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
            size='sm'
          >
            <Link href={`/events/${event.id}`}>
              {event.status === 'published'
                ? 'View & Register'
                : 'View Details'}
              <ArrowRight className='ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1' />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Compact Event Card for smaller displays
 */
export function CompactEventCard({ event }: { event: EventListItem }) {
  const statusVariant = getEventStatusVariant(event.status);
  const startDate = new Date(event.start_date);

  return (
    <Link href={`/events/${event.id}`}>
      <Card className='transition-all duration-200 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-800 overflow-hidden'>
        <CardContent className='p-0'>
          <div className='flex'>
            {/* Date Section */}
            <div className='flex-shrink-0 w-16 bg-gradient-to-br from-orange-500 to-amber-500 flex flex-col items-center justify-center text-white p-2'>
              <div className='text-xs font-medium uppercase opacity-90'>
                {format(startDate, 'MMM')}
              </div>
              <div className='text-2xl font-bold leading-none'>
                {format(startDate, 'd')}
              </div>
              <div className='text-[10px] opacity-75'>
                {format(startDate, 'EEE')}
              </div>
            </div>

            {/* Content */}
            <div className='flex-1 p-3 min-w-0'>
              <div className='flex items-center gap-2 mb-1'>
                <Badge
                  variant={statusVariant as any}
                  className='text-[10px] px-1.5 py-0'
                >
                  {event.status}
                </Badge>
                {event.is_virtual && (
                  <Video className='h-3 w-3 text-blue-500' />
                )}
              </div>
              <h3 className='font-semibold text-sm line-clamp-1'>
                {event.title}
              </h3>
              <div className='flex items-center gap-3 mt-1 text-xs text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' />
                  {format(startDate, 'h:mm a')}
                </span>
                {event.max_capacity && (
                  <span className='flex items-center gap-1'>
                    <Users className='h-3 w-3' />
                    {event.current_registrations}/{event.max_capacity}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Event List Item for table/list views
 */
export function EventListItemRow({ event }: { event: EventListItem }) {
  const statusVariant = getEventStatusVariant(event.status);
  const startDate = new Date(event.start_date);

  return (
    <Link href={`/events/${event.id}`}>
      <div className='flex items-center justify-between p-4 hover:bg-muted/50 rounded-xl transition-colors group'>
        <div className='flex items-center gap-4 flex-1 min-w-0'>
          {/* Date Badge */}
          <div className='flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex flex-col items-center justify-center text-white shadow-md'>
            <div className='text-[10px] font-medium uppercase'>
              {format(startDate, 'MMM')}
            </div>
            <div className='text-xl font-bold leading-none'>
              {format(startDate, 'd')}
            </div>
          </div>

          {/* Info */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-1'>
              <h3 className='font-semibold truncate group-hover:text-orange-600 transition-colors'>
                {event.title}
              </h3>
              <Badge
                variant={statusVariant as any}
                className='shrink-0 text-[10px]'
              >
                {event.status}
              </Badge>
            </div>
            <div className='flex items-center gap-4 text-sm text-muted-foreground'>
              <span className='flex items-center gap-1'>
                <Clock className='h-3 w-3' />
                {format(startDate, 'h:mm a')}
              </span>
              <span className='flex items-center gap-1'>
                {event.is_virtual ? (
                  <>
                    <Video className='h-3 w-3 text-blue-500' />
                    Virtual
                  </>
                ) : (
                  <>
                    <MapPin className='h-3 w-3 text-red-500' />
                    {event.venue?.name || 'In-person'}
                  </>
                )}
              </span>
              {event.max_capacity && (
                <span className='flex items-center gap-1'>
                  <Users className='h-3 w-3 text-purple-500' />
                  {event.current_registrations}/{event.max_capacity}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className='h-5 w-5 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0' />
      </div>
    </Link>
  );
}
