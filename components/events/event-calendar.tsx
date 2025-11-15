'use client';

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { EventListItem } from '@/types/event';

interface EventCalendarProps {
  events: EventListItem[];
}

export function EventCalendar({ events }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const daysInCalendar = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EventListItem[]>();

    events.forEach((event) => {
      const dateKey = format(new Date(event.start_date), 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    });

    return grouped;
  }, [events]);

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-500';
      case 'draft':
        return 'bg-gray-400';
      case 'completed':
        return 'bg-blue-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className='space-y-4'>
      {/* Calendar Header */}
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold'>
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={handleToday}>
            Today
          </Button>
          <Button variant='outline' size='icon' onClick={handlePreviousMonth}>
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button variant='outline' size='icon' onClick={handleNextMonth}>
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className='p-4'>
          {/* Day Headers */}
          <div className='grid grid-cols-7 gap-2 mb-2'>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className='text-center text-sm font-medium text-muted-foreground p-2'
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className='grid grid-cols-7 gap-2'>
            {daysInCalendar.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={index}
                  className={cn(
                    'min-h-24 p-2 border rounded-lg',
                    !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                    isCurrentDay && 'border-primary border-2',
                    'hover:bg-muted/50 transition-colors'
                  )}
                >
                  {/* Day Number */}
                  <div
                    className={cn(
                      'text-sm font-medium mb-1',
                      isCurrentDay && 'text-primary font-bold'
                    )}
                  >
                    {format(day, 'd')}
                  </div>

                  {/* Events for this day */}
                  <div className='space-y-1'>
                    {dayEvents.slice(0, 3).map((event) => (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        className='block'
                      >
                        <div
                          className={cn(
                            'text-xs p-1 rounded truncate hover:opacity-80 transition-opacity',
                            getStatusColor(event.status),
                            'text-white'
                          )}
                          title={event.title}
                        >
                          {format(new Date(event.start_date), 'HH:mm')} {event.title}
                        </div>
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className='text-xs text-muted-foreground pl-1'>
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className='flex items-center gap-4 mt-4 pt-4 border-t'>
            <span className='text-sm font-medium'>Status:</span>
            <div className='flex items-center gap-2'>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded bg-green-500' />
                <span className='text-xs'>Published</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded bg-gray-400' />
                <span className='text-xs'>Draft</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded bg-blue-500' />
                <span className='text-xs'>Completed</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-3 h-3 rounded bg-red-500' />
                <span className='text-xs'>Cancelled</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
