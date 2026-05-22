'use client';

/**
 * LiveDashboard — root client component for Stutzee 2C.
 *
 * Owns:
 *   - Supabase Realtime subscription (event_checkins INSERT + event_rsvps INSERT/UPDATE)
 *   - 30s polling fallback (in case WebSocket drops silently)
 *   - Kiosk-session heartbeat every 45 min (refreshes access token so the
 *     Realtime WebSocket stays authenticated)
 *   - Full-screen CSS grid layout (projector-friendly)
 *   - Member profile cache so we don't refetch the same attendee twice
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { EventSessionWithRelations } from '@/types/event';
import { BigAttendanceCounter } from './big-attendance-counter';
import { LatestArrivals } from './latest-arrivals';
import { EngagementMetrics } from './engagement-metrics';
import { NextSessionCard } from './next-session-card';
import { QRPosterCard } from './qr-poster-card';
import { LiveClock } from './live-clock';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type LiveCheckinRow = {
  id: string;
  attendee_type: 'member' | 'guest';
  attendee_id: string;
  checked_in_at: string;
  check_in_method: string | null;
};

export type MemberLite = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  company: string | null;
  designation: string | null;
};

export type GuestLite = {
  id: string;
  full_name: string;
  company: string | null;
};

export type EnrichedArrival = {
  id: string;
  attendee_type: 'member' | 'guest';
  attendee_id: string;
  checked_in_at: string;
  display_name: string;
  display_company: string | null;
  avatar_url: string | null;
};

interface LiveDashboardProps {
  event: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    status: string;
    venue_address: string | null;
    is_virtual: boolean;
  };
  initialCheckins: LiveCheckinRow[];
  rsvpTotal: number;
  initialSessions: EventSessionWithRelations[];
}

// ----------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 45 * 60 * 1000; // 45 min

export function LiveDashboard({
  event,
  initialCheckins,
  rsvpTotal: initialRsvpTotal,
  initialSessions,
}: LiveDashboardProps) {
  const [checkins, setCheckins] = useState<LiveCheckinRow[]>(initialCheckins);
  const [rsvpTotal, setRsvpTotal] = useState<number>(initialRsvpTotal);
  const [arrivals, setArrivals] = useState<EnrichedArrival[]>([]);

  // Profile caches — avoid refetching if the same attendee appears again
  const memberCache = useRef<Map<string, MemberLite>>(new Map());
  const guestCache = useRef<Map<string, GuestLite>>(new Map());

  // Mount flag prevents hydration mismatch with Realtime channel IDs
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // --------------------------------------------------------------------------
  // Profile enrichment — resolves member/guest display data for an arrival
  // --------------------------------------------------------------------------
  const enrichArrival = useCallback(
    async (
      row: LiveCheckinRow,
      supabase: ReturnType<typeof createBrowserSupabaseClient>
    ): Promise<EnrichedArrival> => {
      if (row.attendee_type === 'member') {
        const cached = memberCache.current.get(row.attendee_id);
        if (cached) {
          return {
            id: row.id,
            attendee_type: 'member',
            attendee_id: row.attendee_id,
            checked_in_at: row.checked_in_at,
            display_name: cached.full_name,
            display_company: cached.company ?? cached.designation,
            avatar_url: cached.avatar_url,
          };
        }

        const { data } = await supabase
          .from('members')
          .select(
            'id, company, designation, profile:profiles(full_name, avatar_url)'
          )
          .eq('id', row.attendee_id)
          .maybeSingle();

        const profile = (data?.profile as unknown as {
          full_name: string | null;
          avatar_url: string | null;
        } | null) ?? null;

        const lite: MemberLite = {
          id: row.attendee_id,
          full_name: profile?.full_name || 'Member',
          avatar_url: profile?.avatar_url ?? null,
          company: (data?.company as string | null) ?? null,
          designation: (data?.designation as string | null) ?? null,
        };
        memberCache.current.set(row.attendee_id, lite);

        return {
          id: row.id,
          attendee_type: 'member',
          attendee_id: row.attendee_id,
          checked_in_at: row.checked_in_at,
          display_name: lite.full_name,
          display_company: lite.company ?? lite.designation,
          avatar_url: lite.avatar_url,
        };
      }

      // Guest
      const cachedGuest = guestCache.current.get(row.attendee_id);
      if (cachedGuest) {
        return {
          id: row.id,
          attendee_type: 'guest',
          attendee_id: row.attendee_id,
          checked_in_at: row.checked_in_at,
          display_name: cachedGuest.full_name,
          display_company: cachedGuest.company,
          avatar_url: null,
        };
      }

      const { data } = await supabase
        .from('guest_rsvps')
        .select('id, full_name, company')
        .eq('id', row.attendee_id)
        .maybeSingle();

      const lite: GuestLite = {
        id: row.attendee_id,
        full_name: (data?.full_name as string | null) || 'Guest',
        company: (data?.company as string | null) ?? null,
      };
      guestCache.current.set(row.attendee_id, lite);

      return {
        id: row.id,
        attendee_type: 'guest',
        attendee_id: row.attendee_id,
        checked_in_at: row.checked_in_at,
        display_name: lite.full_name,
        display_company: lite.company,
        avatar_url: null,
      };
    },
    []
  );

  // --------------------------------------------------------------------------
  // Initial enrichment for server-rendered check-ins
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mounted) return;
    if (initialCheckins.length === 0) return;

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    (async () => {
      const enriched = await Promise.all(
        initialCheckins
          .slice(0, 5)
          .map((row) => enrichArrival(row, supabase))
      );
      if (!cancelled) setArrivals(enriched);
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, initialCheckins, enrichArrival]);

  // --------------------------------------------------------------------------
  // Realtime subscription + polling fallback + kiosk heartbeat
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mounted) return;

    const supabase = createBrowserSupabaseClient();
    const channels: RealtimeChannel[] = [];

    // -- Check-ins channel (INSERT)
    const checkinChannel = supabase
      .channel(`live-checkins:${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_checkins',
          filter: `event_id=eq.${event.id}`,
        },
        async (payload) => {
          const row = payload.new as LiveCheckinRow;
          setCheckins((prev) => {
            // De-dupe by id in case polling fetched this row first
            if (prev.some((c) => c.id === row.id)) return prev;
            return [row, ...prev].slice(0, 200);
          });

          const enriched = await enrichArrival(row, supabase);
          setArrivals((prev) => {
            const without = prev.filter((a) => a.id !== enriched.id);
            return [enriched, ...without].slice(0, 5);
          });
        }
      )
      .subscribe();
    channels.push(checkinChannel);

    // -- RSVPs channel (INSERT + UPDATE) — updates denominator live
    const rsvpChannel = supabase
      .channel(`live-rsvps:${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_rsvps',
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          const row = payload.new as { status: string };
          if (row.status === 'confirmed' || row.status === 'attended') {
            setRsvpTotal((n) => n + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_rsvps',
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { status?: string } | null;
          const newRow = payload.new as { status: string };
          const wasCounted =
            oldRow?.status === 'confirmed' || oldRow?.status === 'attended';
          const nowCounted =
            newRow.status === 'confirmed' || newRow.status === 'attended';
          if (!wasCounted && nowCounted) setRsvpTotal((n) => n + 1);
          if (wasCounted && !nowCounted) setRsvpTotal((n) => Math.max(0, n - 1));
        }
      )
      .subscribe();
    channels.push(rsvpChannel);

    // -- Polling fallback (in case Realtime drops silently)
    const pollId = setInterval(async () => {
      const { data: latest } = await supabase
        .from('event_checkins')
        .select('id, attendee_type, attendee_id, checked_in_at, check_in_method')
        .eq('event_id', event.id)
        .order('checked_in_at', { ascending: false })
        .limit(100);

      if (latest) {
        setCheckins((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newRows = (latest as LiveCheckinRow[]).filter(
            (r) => !existingIds.has(r.id)
          );
          if (newRows.length === 0) return prev;
          return [...newRows, ...prev].slice(0, 200);
        });

        // Re-fetch RSVP total
        const [{ count: memberCount }, { count: guestCount }] =
          await Promise.all([
            supabase
              .from('event_rsvps')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .in('status', ['confirmed', 'attended']),
            supabase
              .from('guest_rsvps')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .in('status', ['confirmed', 'attended']),
          ]);
        setRsvpTotal((memberCount ?? 0) + (guestCount ?? 0));
      }
    }, POLL_INTERVAL_MS);

    // -- Kiosk-session heartbeat — refresh Supabase access token so the
    //    WebSocket connection stays authenticated beyond 1h default expiry.
    //    `getSession()` triggers a silent refresh if the token is near expiry.
    const heartbeatId = setInterval(async () => {
      try {
        await supabase.auth.getSession();
        // If the WebSocket has dropped, Supabase-js will reconnect when a new
        // channel event fires. Also force a manual removeChannel + re-add?
        // For simplicity: trust the client's auto-reconnect; polling covers
        // missed events in the interim.
      } catch (err) {
        console.warn('[LiveDashboard] heartbeat failed', err);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup
    return () => {
      clearInterval(pollId);
      clearInterval(heartbeatId);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [mounted, event.id, enrichArrival]);

  // --------------------------------------------------------------------------
  // Derived metrics
  // --------------------------------------------------------------------------
  const checkedInCount = checkins.length;
  const checkInRate = useMemo(() => {
    if (rsvpTotal <= 0) return 0;
    return Math.min(100, Math.round((checkedInCount / rsvpTotal) * 100));
  }, [checkedInCount, rsvpTotal]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className='relative grid h-screen w-screen grid-rows-[auto_1fr_auto] gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950 p-6 text-slate-50 md:gap-6 md:p-10'>
      {/* Header */}
      <header className='flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4'>
        <div className='min-w-0'>
          <p className='text-xs font-semibold uppercase tracking-[0.3em] text-orange-300/80'>
            Live Event Dashboard
          </p>
          <h1 className='truncate text-2xl font-bold leading-tight md:text-4xl'>
            {event.title}
          </h1>
          {event.venue_address && !event.is_virtual && (
            <p className='mt-1 line-clamp-1 text-sm text-slate-300 md:text-base'>
              {event.venue_address}
            </p>
          )}
        </div>
        <LiveClock />
      </header>

      {/* Main grid */}
      <div className='grid min-h-0 grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12 lg:grid-rows-2'>
        {/* Big counter — dominant tile */}
        <div className='lg:col-span-6 lg:row-span-2'>
          <BigAttendanceCounter
            checkedIn={checkedInCount}
            rsvpTotal={rsvpTotal}
          />
        </div>

        {/* Latest arrivals */}
        <div className='lg:col-span-4 lg:row-span-2'>
          <LatestArrivals arrivals={arrivals} />
        </div>

        {/* QR poster */}
        <div className='lg:col-span-2'>
          <QRPosterCard eventId={event.id} />
        </div>

        {/* Next session (polls every 30s) */}
        <div className='lg:col-span-2'>
          <NextSessionCard
            eventId={event.id}
            initialSessions={initialSessions}
          />
        </div>
      </div>

      {/* Footer metrics */}
      <footer>
        <EngagementMetrics
          rsvpTotal={rsvpTotal}
          checkedIn={checkedInCount}
          checkInRate={checkInRate}
        />
      </footer>
    </div>
  );
}
