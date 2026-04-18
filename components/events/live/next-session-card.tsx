'use client';

/**
 * NextSessionCard — shows the next upcoming session (by start_time > now())
 * for the current event. Falls back gracefully if the event has no sessions.
 * Polls every 30s (sessions rarely change in real time, so no Realtime).
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Mic2 } from 'lucide-react';
import { format } from 'date-fns';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { EventSessionWithRelations } from '@/types/event';

interface NextSessionCardProps {
  eventId: string;
  initialSessions: EventSessionWithRelations[];
}

const POLL_MS = 30_000;

export function NextSessionCard({
  eventId,
  initialSessions,
}: NextSessionCardProps) {
  const [sessions, setSessions] =
    useState<EventSessionWithRelations[]>(initialSessions);

  const [now, setNow] = useState<Date>(() => new Date());

  // Tick the "now" cursor so "Up next" flips without a refetch
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Poll the sessions table every 30s
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    const fetchSessions = async () => {
      const { data } = await supabase
        .from('event_sessions')
        .select(
          `
            *,
            speakers:session_speakers(
              id, session_id, speaker_id, role, sort_order, created_at,
              speaker:speakers(
                id, speaker_name, title, current_organization,
                designation, photo_url, expertise_areas
              )
            )
          `
        )
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (!cancelled && data) {
        setSessions(data as unknown as EventSessionWithRelations[]);
      }
    };

    const id = setInterval(fetchSessions, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eventId]);

  const nextSession = useMemo(() => {
    const upcoming = sessions
      .filter((s) => s.is_active)
      .filter((s) => new Date(s.start_time).getTime() > now.getTime())
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    return upcoming[0] ?? null;
  }, [sessions, now]);

  if (!nextSession) {
    return (
      <div className='flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur md:p-6'>
        <div className='flex items-center gap-2 text-orange-300/80'>
          <CalendarClock className='h-4 w-4 md:h-5 md:w-5' />
          <p className='text-xs font-semibold uppercase tracking-[0.3em] md:text-sm'>
            Up Next
          </p>
        </div>
        <p className='text-sm text-slate-400 md:text-base'>
          No upcoming sessions scheduled.
        </p>
      </div>
    );
  }

  const speakerNames = (nextSession.speakers ?? [])
    .map((s) => s.speaker?.speaker_name)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  return (
    <div className='flex h-full flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur md:p-6'>
      <div className='flex items-center gap-2 text-orange-300/80'>
        <CalendarClock className='h-4 w-4 md:h-5 md:w-5' />
        <p className='text-xs font-semibold uppercase tracking-[0.3em] md:text-sm'>
          Up Next
        </p>
      </div>

      <div>
        <p className='text-base font-bold leading-tight text-white md:text-lg'>
          {nextSession.title}
        </p>
        <p className='mt-1 text-sm font-medium text-orange-200 md:text-base'>
          {format(new Date(nextSession.start_time), 'h:mm a')}
          {' – '}
          {format(new Date(nextSession.end_time), 'h:mm a')}
          {nextSession.room_or_track ? ` · ${nextSession.room_or_track}` : ''}
        </p>
      </div>

      {speakerNames && (
        <div className='mt-auto flex items-center gap-2 text-xs text-slate-300 md:text-sm'>
          <Mic2 className='h-4 w-4 shrink-0' />
          <span className='truncate'>{speakerNames}</span>
        </div>
      )}
    </div>
  );
}
