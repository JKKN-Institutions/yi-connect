/**
 * Live Event Big-Screen Dashboard — Stutzee Feature 2C
 *
 * Full-screen kiosk page that Chair+ opens on a projector or external
 * display during the event. Streams check-ins + RSVP updates in real time
 * via Supabase Realtime (`postgres_changes`).
 */

import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getCurrentUser } from '@/lib/data/auth';
import { createClient } from '@/lib/supabase/server';
import { getEventById, getSessions } from '@/lib/data/events';
import {
  LiveDashboard,
  type LiveCheckinRow,
} from '@/components/events/live/live-dashboard';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function LiveEventDashboardPage({ params }: PageProps) {
  // High-trust roles only — keeps kiosk data off lower-hierarchy members
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
  ]);

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();

  const supabase = await createClient();

  // Existing check-ins for this event (server pre-fetch so counter starts
  // correct even before the Realtime channel connects)
  const { data: checkinsRows } = await supabase
    .from('event_checkins')
    .select('id, attendee_type, attendee_id, checked_in_at, check_in_method')
    .eq('event_id', id)
    .order('checked_in_at', { ascending: false })
    .limit(100);

  // Confirmed / attended RSVPs for denominator
  const { data: rsvpRows } = await supabase
    .from('event_rsvps')
    .select('id, member_id, status')
    .eq('event_id', id)
    .in('status', ['confirmed', 'attended']);

  const { data: guestRsvpRows } = await supabase
    .from('guest_rsvps')
    .select('id, full_name, status')
    .eq('event_id', id)
    .in('status', ['confirmed', 'attended']);

  // Sessions (for NextSessionCard) — server render, component polls for freshness
  const sessions = await getSessions(id);

  return (
    <LiveDashboard
      event={{
        id: event.id,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        status: event.status,
        venue_address: event.venue_address ?? null,
        is_virtual: event.is_virtual ?? false,
      }}
      initialCheckins={(checkinsRows ?? []) as LiveCheckinRow[]}
      rsvpTotal={(rsvpRows?.length ?? 0) + (guestRsvpRows?.length ?? 0)}
      initialSessions={sessions}
    />
  );
}

