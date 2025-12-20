/**
 * Venue Availability Checker Component
 *
 * Interactive component for checking venue availability and finding
 * available time slots for events.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface VenueAvailabilityCheckerProps {
  venueId?: string;
  venueName?: string;
  selectedStartTime?: Date;
  selectedEndTime?: Date;
  onTimeSlotSelect?: (startTime: Date, endTime: Date) => void;
  excludeEventId?: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  conflictingEvent?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  };
}

interface DayAvailability {
  date: string;
  timeSlots: TimeSlot[];
  totalAvailable: number;
  totalBooked: number;
}

interface AvailableSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export function VenueAvailabilityChecker({
  venueId,
  venueName,
  selectedStartTime,
  selectedEndTime,
  onTimeSlotSelect,
  excludeEventId,
}: VenueAvailabilityCheckerProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weeklyAvailability, setWeeklyAvailability] = useState<DayAvailability[]>([]);
  const [nextSlots, setNextSlots] = useState<AvailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  // Fetch weekly availability
  const fetchWeeklyAvailability = useCallback(async () => {
    if (!venueId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/venues/${venueId}/availability?week=true&start=${weekStart.toISOString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch availability');

      const data = await response.json();
      if (data.success) {
        setWeeklyAvailability(data.availability || []);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load availability');
    } finally {
      setIsLoading(false);
    }
  }, [venueId, weekStart]);

  // Fetch next available slots
  const fetchNextSlots = useCallback(async () => {
    if (!venueId) return;

    try {
      const response = await fetch(
        `/api/venues/${venueId}/availability?find_slots=true&duration=2`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNextSlots(data.slots || []);
        }
      }
    } catch (err) {
      console.error('Error fetching next slots:', err);
    }
  }, [venueId]);

  useEffect(() => {
    fetchWeeklyAvailability();
    fetchNextSlots();
  }, [fetchWeeklyAvailability, fetchNextSlots]);

  // Check current selection
  useEffect(() => {
    if (selectedStartTime && selectedEndTime) {
      setSelectedSlot({ start: selectedStartTime, end: selectedEndTime });
    }
  }, [selectedStartTime, selectedEndTime]);

  const handlePreviousWeek = () => {
    setWeekStart(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(prev => addDays(prev, 7));
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.isAvailable || !onTimeSlotSelect) return;

    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    setSelectedSlot({ start, end });
    onTimeSlotSelect(start, end);
  };

  const handleSuggestedSlotClick = (slot: AvailableSlot) => {
    if (!onTimeSlotSelect) return;

    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    setSelectedSlot({ start, end });
    onTimeSlotSelect(start, end);
  };

  if (!venueId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Select a venue to view availability</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Venue Availability
              </CardTitle>
              {venueName && (
                <CardDescription className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {venueName}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousWeek}
                disabled={isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                disabled={isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <WeeklyCalendarSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground p-2">
                      Time
                    </th>
                    {weeklyAvailability.map((day) => (
                      <th
                        key={day.date}
                        className="text-center text-xs font-medium p-2 min-w-[80px]"
                      >
                        <div>{format(new Date(day.date), 'EEE')}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(day.date), 'MMM d')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeklyAvailability.length > 0 &&
                    weeklyAvailability[0].timeSlots.map((_, slotIndex) => (
                      <tr key={slotIndex}>
                        <td className="text-xs text-muted-foreground p-2 whitespace-nowrap">
                          {format(
                            new Date(weeklyAvailability[0].timeSlots[slotIndex].startTime),
                            'h:mm a'
                          )}
                        </td>
                        {weeklyAvailability.map((day) => {
                          const slot = day.timeSlots[slotIndex];
                          if (!slot) return <td key={day.date} />;

                          const isSelected =
                            selectedSlot &&
                            new Date(slot.startTime).getTime() === selectedSlot.start.getTime();

                          return (
                            <td key={`${day.date}-${slotIndex}`} className="p-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleSlotClick(slot)}
                                      disabled={!slot.isAvailable}
                                      className={cn(
                                        'w-full h-8 rounded transition-colors',
                                        slot.isAvailable
                                          ? isSelected
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50'
                                          : 'bg-red-100 dark:bg-red-900/30 cursor-not-allowed'
                                      )}
                                    >
                                      {slot.isAvailable ? (
                                        isSelected ? (
                                          <Check className="h-3 w-3 mx-auto" />
                                        ) : null
                                      ) : (
                                        <X className="h-3 w-3 mx-auto text-red-500" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {slot.isAvailable ? (
                                      <p>Available - Click to select</p>
                                    ) : (
                                      <div>
                                        <p className="font-medium">Booked</p>
                                        {slot.conflictingEvent && (
                                          <p className="text-xs">
                                            {slot.conflictingEvent.title}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
              <span>Booked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-primary" />
              <span>Selected</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Time Slots */}
      {nextSlots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Suggested Available Slots
            </CardTitle>
            <CardDescription>Next available 2-hour slots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {nextSlots.slice(0, 6).map((slot, index) => {
                const start = new Date(slot.startTime);
                const end = new Date(slot.endTime);
                const isSelected =
                  selectedSlot &&
                  start.getTime() === selectedSlot.start.getTime();

                return (
                  <Button
                    key={index}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSuggestedSlotClick(slot)}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(start, 'MMM d')} • {format(start, 'h:mm a')} -{' '}
                      {format(end, 'h:mm a')}
                    </span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection Summary */}
      {selectedSlot && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>Time Slot Selected</AlertTitle>
          <AlertDescription>
            {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')} from{' '}
            {format(selectedSlot.start, 'h:mm a')} to{' '}
            {format(selectedSlot.end, 'h:mm a')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function WeeklyCalendarSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: 9 }).map((_, row) => (
        <div key={row} className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Compact venue availability indicator
 */
interface VenueAvailabilityIndicatorProps {
  venueId: string;
  startTime: Date;
  endTime: Date;
  excludeEventId?: string;
}

export function VenueAvailabilityIndicator({
  venueId,
  startTime,
  endTime,
  excludeEventId,
}: VenueAvailabilityIndicatorProps) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [conflicts, setConflicts] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAvailability = async () => {
      setIsLoading(true);
      try {
        const url = new URL(`/api/venues/${venueId}/availability`, window.location.origin);
        url.searchParams.set('start', startTime.toISOString());
        url.searchParams.set('end', endTime.toISOString());
        if (excludeEventId) {
          url.searchParams.set('exclude_event', excludeEventId);
        }

        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          setIsAvailable(data.isAvailable);
          setConflicts(data.conflicts?.length || 0);
        }
      } catch (error) {
        console.error('Error checking availability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (venueId && startTime && endTime) {
      checkAvailability();
    }
  }, [venueId, startTime, endTime, excludeEventId]);

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (isAvailable === null) {
    return null;
  }

  return (
    <Badge variant={isAvailable ? 'default' : 'destructive'}>
      {isAvailable ? (
        <>
          <Check className="h-3 w-3 mr-1" />
          Available
        </>
      ) : (
        <>
          <X className="h-3 w-3 mr-1" />
          {conflicts} Conflict{conflicts !== 1 ? 's' : ''}
        </>
      )}
    </Badge>
  );
}
