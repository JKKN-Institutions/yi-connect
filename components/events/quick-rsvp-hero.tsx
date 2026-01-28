'use client';

import { CalendarDays, Clock, MapPin, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { PublicEvent } from '@/lib/data/public-events';

interface QuickRSVPHeroProps {
  event: PublicEvent;
  attendeeCount: number;
  totalMembers: number;
  isEventOver: boolean;
  isEventFull: boolean;
}

export function QuickRSVPHero({ event, attendeeCount, totalMembers, isEventOver, isEventFull }: QuickRSVPHeroProps) {
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const capacityMax = event.max_capacity || totalMembers;
  const progressPercent = Math.min(100, Math.round((attendeeCount / capacityMax) * 100));

  return (
    <div className="mb-6">
      {/* Banner Image or Gradient */}
      {event.banner_image_url ? (
        <div className="w-full h-48 rounded-t-xl overflow-hidden">
          <img
            src={event.banner_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-32 rounded-t-xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center">
          <span className="text-white text-4xl font-bold opacity-20">Yi</span>
        </div>
      )}

      {/* Event Info Card */}
      <div className="bg-card border border-t-0 rounded-b-xl p-5 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>

        {event.description && (
          <p className="text-muted-foreground text-sm line-clamp-2">{event.description}</p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{format(startDate, 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}</span>
          </div>
          {event.venue_address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{event.venue_address}</span>
            </div>
          )}
        </div>

        {/* Status Badges */}
        {isEventOver && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">This event has ended</span>
          </div>
        )}

        {isEventFull && !isEventOver && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Event is full</span>
          </div>
        )}

        {/* Attendee Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-600">{attendeeCount} attending</span>
            </div>
            {event.max_capacity && (
              <span className="text-muted-foreground">{event.max_capacity} spots</span>
            )}
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
