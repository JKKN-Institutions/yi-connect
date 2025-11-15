/**
 * Event Card Component
 *
 * Displays event information in a card format.
 * Used in event lists, grids, and dashboards.
 */

import Link from 'next/link';
import { format } from 'date-fns';
import {
  Calendar,
  MapPin,
  Users,
  Video,
  Clock,
  TrendingUp
} from 'lucide-react';
import type { EventListItem, EventStatusBadgeVariant } from '@/types/event';
import { EVENT_CATEGORIES, getEventStatusVariant } from '@/types/event';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface EventCardProps {
  event: EventListItem;
  showOrganizer?: boolean;
  showCapacity?: boolean;
  compact?: boolean;
}

export function EventCard({
  event,
  showOrganizer = true,
  showCapacity = true,
  compact = false
}: EventCardProps) {
  const statusVariant = getEventStatusVariant(event.status);
  const capacityPercentage = event.max_capacity
    ? (event.current_registrations / event.max_capacity) * 100
    : 0;
  const isFull =
    event.max_capacity && event.current_registrations >= event.max_capacity;

  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const isMultiDay =
    format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

  return (
    <Card
      className={cn(
        'group overflow-hidden transition-all hover:shadow-lg',
        event.is_featured && 'border-primary'
      )}
    >
      {/* Banner Image */}
      {event.banner_image_url && !compact && (
        <div className='relative aspect-video overflow-hidden'>
          <Image
            src={event.banner_image_url}
            alt={event.title}
            className='object-cover w-full h-full transition-transform group-hover:scale-105'
            width={1000}
            height={1000}
          />
          {event.is_featured && (
            <Badge className='absolute top-2 right-2 bg-primary text-primary-foreground'>
              <TrendingUp className='mr-1 h-3 w-3' />
              Featured
            </Badge>
          )}
        </div>
      )}

      <CardHeader className={cn(compact && 'pb-3')}>
        <div className='flex items-start justify-between gap-2'>
          <div className='space-y-1 flex-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              <Badge variant={statusVariant as any}>{event.status}</Badge>
              <Badge variant='outline'>
                {EVENT_CATEGORIES[event.category]}
              </Badge>
              {isFull && <Badge variant='destructive'>Full</Badge>}
            </div>
            <CardTitle className='line-clamp-2 group-hover:text-primary transition-colors'>
              <Link href={`/events/${event.id}`}>{event.title}</Link>
            </CardTitle>
          </div>
        </div>
        {event.description && !compact && (
          <CardDescription className='line-clamp-2'>
            {event.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className={cn('space-y-3', compact && 'py-3')}>
        {/* Date & Time */}
        <div className='flex items-start gap-2 text-sm'>
          <Calendar className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
          <div className='flex-1'>
            <div className='font-medium'>
              {format(startDate, 'EEE, MMM d, yyyy')}
            </div>
            <div className='text-muted-foreground'>
              {format(startDate, 'h:mm a')}
              {isMultiDay && (
                <>
                  {' - '}
                  {format(endDate, 'EEE, MMM d')} at {format(endDate, 'h:mm a')}
                </>
              )}
              {!isMultiDay && endDate.getTime() !== startDate.getTime() && (
                <>
                  {' - '}
                  {format(endDate, 'h:mm a')}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className='flex items-start gap-2 text-sm'>
          {event.is_virtual ? (
            <>
              <Video className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
              <span className='text-muted-foreground'>Virtual Event</span>
            </>
          ) : (
            <>
              <MapPin className='h-4 w-4 mt-0.5 text-muted-foreground shrink-0' />
              <div className='flex-1'>
                {event.venue ? (
                  <>
                    <div className='font-medium'>{event.venue.name}</div>
                    {event.venue.city && (
                      <div className='text-muted-foreground'>
                        {event.venue.city}
                      </div>
                    )}
                  </>
                ) : event.venue_address ? (
                  <div className='text-muted-foreground line-clamp-2'>
                    {event.venue_address}
                  </div>
                ) : (
                  <div className='text-muted-foreground'>Location TBD</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Capacity */}
        {showCapacity && event.max_capacity && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center gap-2'>
                <Users className='h-4 w-4 text-muted-foreground' />
                <span className='font-medium'>
                  {event.current_registrations} / {event.max_capacity}
                </span>
              </div>
              <span className='text-muted-foreground'>
                {Math.round(capacityPercentage)}% Full
              </span>
            </div>
            <Progress value={capacityPercentage} className='h-2' />
          </div>
        )}

        {/* Organizer */}
        {showOrganizer && event.organizer?.profile && !compact && (
          <div className='flex items-center gap-2 pt-2 border-t'>
            <Avatar className='h-6 w-6'>
              <AvatarImage
                src={event.organizer.profile.avatar_url || undefined}
              />
              <AvatarFallback>
                {event.organizer.profile.full_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className='text-sm text-muted-foreground'>
              Organized by{' '}
              <span className='font-medium text-foreground'>
                {event.organizer.profile.full_name}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className={cn('pt-0', compact && 'pb-3')}>
        <Button
          asChild
          className='w-full'
          variant={event.status === 'published' ? 'default' : 'outline'}
        >
          <Link href={`/events/${event.id}`}>
            {event.status === 'published' ? 'View Details' : 'View Event'}
          </Link>
        </Button>
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
      <Card className='transition-all hover:shadow-md hover:border-primary'>
        <CardContent className='p-4'>
          <div className='flex gap-3'>
            {/* Date Badge */}
            <div className='shrink-0 flex flex-col items-center justify-center bg-muted rounded-lg p-2 w-16 h-16'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                {format(startDate, 'MMM')}
              </div>
              <div className='text-2xl font-bold'>{format(startDate, 'd')}</div>
            </div>

            {/* Event Info */}
            <div className='flex-1 min-w-0 space-y-1'>
              <div className='flex items-center gap-2'>
                <Badge variant={statusVariant as any} className='text-xs'>
                  {event.status}
                </Badge>
                {event.is_virtual && (
                  <Badge variant='outline' className='text-xs'>
                    <Video className='mr-1 h-3 w-3' />
                    Virtual
                  </Badge>
                )}
              </div>
              <h3 className='font-semibold line-clamp-1 group-hover:text-primary'>
                {event.title}
              </h3>
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <Clock className='h-3 w-3' />
                {format(startDate, 'h:mm a')}
                {event.max_capacity && (
                  <>
                    <span>•</span>
                    <Users className='h-3 w-3' />
                    {event.current_registrations}/{event.max_capacity}
                  </>
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
      <div className='flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg transition-colors'>
        <div className='flex items-center gap-4 flex-1 min-w-0'>
          {/* Date */}
          <div className='shrink-0 text-center'>
            <div className='text-sm font-medium'>
              {format(startDate, 'MMM d')}
            </div>
            <div className='text-xs text-muted-foreground'>
              {format(startDate, 'yyyy')}
            </div>
          </div>

          {/* Info */}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-1'>
              <h3 className='font-semibold truncate'>{event.title}</h3>
              <Badge variant={statusVariant as any} className='shrink-0'>
                {event.status}
              </Badge>
            </div>
            <div className='flex items-center gap-3 text-sm text-muted-foreground'>
              <span className='flex items-center gap-1'>
                {event.is_virtual ? (
                  <>
                    <Video className='h-3 w-3' />
                    Virtual
                  </>
                ) : (
                  <>
                    <MapPin className='h-3 w-3' />
                    {event.venue?.name || 'In-person'}
                  </>
                )}
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

        {/* Actions */}
        <Button variant='ghost' size='sm'>
          View
        </Button>
      </div>
    </Link>
  );
}
