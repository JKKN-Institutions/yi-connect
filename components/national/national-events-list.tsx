'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  MapPin,
  Users,
  Video,
  ExternalLink,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import Link from 'next/link';
import type { NationalEventListItem } from '@/types/national-integration';

interface NationalEventsListProps {
  events: NationalEventListItem[];
  showActions?: boolean;
}

const eventTypeLabels: Record<string, string> = {
  rcm: 'Regional Chapter Meet',
  summit: 'Yi Summit',
  yuva_conclave: 'Yuva Conclave',
  national_meet: 'National Meeting',
  training: 'Training Program',
  workshop: 'Workshop',
  conference: 'Conference',
  other: 'Other'
};

const eventTypeColors: Record<string, string> = {
  rcm: 'bg-blue-100 text-blue-800',
  summit: 'bg-purple-100 text-purple-800',
  yuva_conclave: 'bg-green-100 text-green-800',
  national_meet: 'bg-orange-100 text-orange-800',
  training: 'bg-cyan-100 text-cyan-800',
  workshop: 'bg-pink-100 text-pink-800',
  conference: 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-800'
};

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-500',
  registration_open: 'bg-green-500',
  registration_closed: 'bg-yellow-500',
  ongoing: 'bg-purple-500',
  completed: 'bg-gray-500',
  cancelled: 'bg-red-500'
};

const statusLabels: Record<string, string> = {
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export function NationalEventsList({
  events,
  showActions = true
}: NationalEventsListProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No upcoming events</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const registrationDeadline = event.registration_deadline
          ? new Date(event.registration_deadline)
          : null;
        const isDeadlineSoon =
          registrationDeadline &&
          isFuture(registrationDeadline) &&
          formatDistanceToNow(registrationDeadline).includes('day');
        const isDeadlinePast =
          registrationDeadline && isPast(registrationDeadline);
        const spotsLeft = event.max_participants
          ? event.max_participants - event.current_registrations
          : null;
        const almostFull = spotsLeft !== null && spotsLeft < 10;

        return (
          <Card
            key={event.id}
            className={event.is_featured ? 'border-primary' : ''}
          >
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Date Badge */}
                <div className="flex-shrink-0 text-center bg-muted rounded-lg p-3 w-20">
                  <div className="text-2xl font-bold">
                    {format(new Date(event.start_date), 'd')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(event.start_date), 'MMM')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(event.start_date), 'yyyy')}
                  </div>
                </div>

                {/* Event Details */}
                <div className="flex-grow min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <Badge className={eventTypeColors[event.event_type]}>
                      {eventTypeLabels[event.event_type]}
                    </Badge>
                    <Badge className={statusColors[event.status]}>
                      {statusLabels[event.status]}
                    </Badge>
                    {event.is_featured && (
                      <Badge variant="outline" className="border-primary">
                        Featured
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg mb-2 truncate">
                    {event.title}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(event.start_date), 'PPp')}
                        {event.end_date !== event.start_date && (
                          <> - {format(new Date(event.end_date), 'PPp')}</>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {event.is_virtual ? (
                        <>
                          <Video className="h-4 w-4" />
                          <span>Virtual Event</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4" />
                          <span>{event.city || 'Location TBA'}</span>
                        </>
                      )}
                    </div>

                    {event.max_participants && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>
                          {event.current_registrations} / {event.max_participants}{' '}
                          registered
                          {almostFull && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Almost Full
                            </Badge>
                          )}
                        </span>
                      </div>
                    )}

                    {registrationDeadline && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          Registration:{' '}
                          {isDeadlinePast ? (
                            <span className="text-red-500">Closed</span>
                          ) : (
                            <>
                              {format(registrationDeadline, 'PP')}
                              {isDeadlineSoon && (
                                <Badge
                                  variant="secondary"
                                  className="ml-2 text-xs"
                                >
                                  Closing Soon
                                </Badge>
                              )}
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {showActions && (
                  <div className="flex-shrink-0 flex flex-col gap-2">
                    <Button asChild>
                      <Link href={`/national/events/${event.id}`}>
                        View Details
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                    {event.status === 'registration_open' && !isDeadlinePast && (
                      <Button variant="outline" asChild>
                        <Link href={`/national/events/${event.id}?register=true`}>
                          Register Now
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
