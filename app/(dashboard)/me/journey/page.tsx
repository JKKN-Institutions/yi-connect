/**
 * My Yi Journey — Personal Impact Timeline
 *
 * Shows the authenticated member's complete Yi story:
 * events attended, connections made, vows taken, health cards contributed.
 * Displayed as a vertical timeline, newest first.
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/yifi/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays,
  Users,
  Heart,
  ClipboardCheck,
  MapPin,
  ExternalLink,
} from 'lucide-react';

export const metadata = {
  title: 'My Yi Journey',
  description: 'Your personal Yi impact timeline',
};

// ─── Types ───────────────────────────────────────────────────────────────────

type TimelineItemType = 'event' | 'connection' | 'vow' | 'health_card';

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  date: string; // ISO timestamp
  data: EventData | ConnectionData | VowData | HealthCardData;
}

interface EventData {
  title: string;
  venue_address: string | null;
  category: string;
  attendee_count: number;
  check_in_method?: string | null;
}

interface ConnectionData {
  person_name: string;
  company: string | null;
  event_title: string | null;
  phone: string | null;
}

interface VowData {
  category: string;
  vow_text: string;
  witness_name: string | null;
  status: string;
}

interface HealthCardData {
  activity_name: string;
  vertical_name: string;
  aaa_type: string | null;
  ec_members_count: number;
  non_ec_members_count: number;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='rounded-lg bg-[#000066] px-6 py-8 text-white'>
        <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
          My Yi Journey
        </h1>
        <p className='mt-1 text-sm text-white/70'>
          Your complete story — every event, connection, vow, and contribution.
        </p>
      </div>

      {/* Timeline */}
      <Suspense fallback={<TimelineSkeleton />}>
        <JourneyTimeline />
      </Suspense>
    </div>
  );
}

// ─── Timeline Data Fetcher ───────────────────────────────────────────────────

async function JourneyTimeline() {
  const user = await requireAuth();
  const supabase = await createClient();

  // Look up member record by auth user id
  const { data: member } = await supabase
    .from('members')
    .select('id, chapter_id')
    .eq('id', user.id)
    .single();

  if (!member) {
    return (
      <Card>
        <CardContent className='py-12 text-center'>
          <Users className='mx-auto h-10 w-10 text-muted-foreground/60' />
          <h2 className='mt-3 text-lg font-semibold'>No member profile found</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Your account is not linked to a Yi member profile yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const memberId = member.id;
  const items: TimelineItem[] = [];

  // ── 1. Events attended (via checkins joined with events) ─────────────────
  const { data: checkins } = await supabase
    .from('event_checkins')
    .select(`
      id,
      checked_in_at,
      check_in_method,
      event_id,
      events (
        id,
        title,
        venue_address,
        category,
        current_registrations
      )
    `)
    .eq('attendee_id', memberId)
    .eq('attendee_type', 'member')
    .order('checked_in_at', { ascending: false });

  if (checkins) {
    for (const ci of checkins) {
      const event = ci.events as any;
      if (!event) continue;
      items.push({
        id: `event-${ci.id}`,
        type: 'event',
        date: ci.checked_in_at,
        data: {
          title: event.title,
          venue_address: event.venue_address,
          category: event.category,
          attendee_count: event.current_registrations || 0,
          check_in_method: ci.check_in_method,
        } satisfies EventData,
      });
    }
  }

  // Also include RSVPs where they confirmed but may not have a checkin row
  const { data: rsvps } = await supabase
    .from('event_rsvps')
    .select(`
      id,
      created_at,
      status,
      event_id,
      events (
        id,
        title,
        venue_address,
        category,
        current_registrations
      )
    `)
    .eq('member_id', memberId)
    .in('status', ['confirmed', 'attended'])
    .order('created_at', { ascending: false });

  if (rsvps) {
    // Avoid duplicating events already captured via checkins
    const checkedInEventIds = new Set(
      checkins?.map((ci) => ci.event_id) ?? []
    );
    for (const rsvp of rsvps) {
      if (checkedInEventIds.has(rsvp.event_id)) continue;
      const event = rsvp.events as any;
      if (!event) continue;
      items.push({
        id: `rsvp-${rsvp.id}`,
        type: 'event',
        date: rsvp.created_at,
        data: {
          title: event.title,
          venue_address: event.venue_address,
          category: event.category,
          attendee_count: event.current_registrations || 0,
        } satisfies EventData,
      });
    }
  }

  // ── 2. Connections made ──────────────────────────────────────────────────
  const { data: connections } = await supabase
    .from('member_connections')
    .select(`
      id,
      created_at,
      event_id,
      to_member:members!member_connections_to_member_id_fkey (
        id,
        company,
        profiles (
          full_name,
          phone
        )
      ),
      events (
        title
      )
    `)
    .eq('from_member_id', memberId)
    .order('created_at', { ascending: false });

  if (connections) {
    for (const conn of connections) {
      const toMember = conn.to_member as any;
      if (!toMember) continue;
      const profile = toMember.profiles;
      const event = conn.events as any;
      items.push({
        id: `conn-${conn.id}`,
        type: 'connection',
        date: conn.created_at,
        data: {
          person_name: profile?.full_name ?? 'Unknown',
          company: toMember.company,
          event_title: event?.title ?? null,
          phone: profile?.phone ?? null,
        } satisfies ConnectionData,
      });
    }
  }

  // ── 3. Vows (from yifi schema) ──────────────────────────────────────────
  try {
    const yifiClient = await createServiceClient();

    // Find registrant by matching email
    const { data: registrants } = await yifiClient
      .schema('yifi' as any)
      .from('registrants')
      .select('id, edition_id')
      .eq('email', user.email!)
      .order('created_at', { ascending: false });

    if (registrants && registrants.length > 0) {
      for (const reg of registrants) {
        const { data: vows } = await yifiClient
          .schema('yifi' as any)
          .from('vows')
          .select(`
            id,
            category,
            vow_text,
            status,
            created_at,
            witness:registrants!vows_witness_id_fkey (
              full_name
            )
          `)
          .eq('registrant_id', reg.id);

        if (vows) {
          for (const vow of vows) {
            const witness = vow.witness as any;
            items.push({
              id: `vow-${vow.id}`,
              type: 'vow',
              date: vow.created_at,
              data: {
                category: vow.category,
                vow_text: vow.vow_text,
                witness_name: witness?.full_name ?? null,
                status: vow.status,
              } satisfies VowData,
            });
          }
        }
      }
    }
  } catch {
    // yifi schema may not be available — gracefully skip
  }

  // ── 4. Health card contributions ─���───────────────────────────────────────
  const { data: healthCards } = await supabase
    .from('health_card_entries')
    .select(`
      id,
      activity_name,
      activity_date,
      aaa_type,
      ec_members_count,
      non_ec_members_count,
      verticals (
        name
      )
    `)
    .eq('member_id', memberId)
    .order('activity_date', { ascending: false });

  if (healthCards) {
    for (const hc of healthCards) {
      const vertical = hc.verticals as any;
      items.push({
        id: `hc-${hc.id}`,
        type: 'health_card',
        date: hc.activity_date,
        data: {
          activity_name: hc.activity_name,
          vertical_name: vertical?.name ?? 'Unknown',
          aaa_type: hc.aaa_type,
          ec_members_count: hc.ec_members_count,
          non_ec_members_count: hc.non_ec_members_count,
        } satisfies HealthCardData,
      });
    }
  }

  // ── Sort all items newest first ──────────────────────────────────────────
  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className='py-12 text-center'>
          <CalendarDays className='mx-auto h-10 w-10 text-muted-foreground/60' />
          <h2 className='mt-3 text-lg font-semibold'>Your journey starts here</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Attend events, make connections, and take vows to build your timeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Render timeline ──────────────────────────────────────────────────────
  return (
    <div className='relative'>
      {/* Vertical line */}
      <div className='absolute left-4 top-0 bottom-0 w-0.5 bg-border sm:left-6' />

      <div className='space-y-6'>
        {items.map((item) => (
          <TimelineCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ─── Timeline Card ───────────────────────────────────────────────────────────

function TimelineCard({ item }: { item: TimelineItem }) {
  const iconMap: Record<TimelineItemType, { icon: typeof CalendarDays; color: string; bg: string }> = {
    event: { icon: CalendarDays, color: 'text-[#FD7215]', bg: 'bg-[#FD7215]/10' },
    connection: { icon: Users, color: 'text-[#229434]', bg: 'bg-[#229434]/10' },
    vow: { icon: Heart, color: 'text-[#000066]', bg: 'bg-[#000066]/10' },
    health_card: { icon: ClipboardCheck, color: 'text-[#FD7215]', bg: 'bg-[#FD7215]/10' },
  };

  const { icon: Icon, color, bg } = iconMap[item.type];
  const formattedDate = new Date(item.date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className='relative flex gap-4 pl-10 sm:pl-14'>
      {/* Dot on timeline */}
      <div
        className={`absolute left-2.5 top-3 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background sm:left-4.5 sm:h-4 sm:w-4 ${bg}`}
      >
        <div className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${color.replace('text-', 'bg-')}`} />
      </div>

      <Card className='flex-1'>
        <CardContent className='p-4 sm:p-5'>
          <div className='flex items-start gap-3'>
            <div className={`rounded-lg p-2 ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className='flex-1 min-w-0'>
              {item.type === 'event' && <EventCard data={item.data as EventData} />}
              {item.type === 'connection' && <ConnectionCard data={item.data as ConnectionData} />}
              {item.type === 'vow' && <VowCard data={item.data as VowData} />}
              {item.type === 'health_card' && <HealthCardCard data={item.data as HealthCardData} />}

              <p className='mt-2 text-xs text-muted-foreground'>{formattedDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Card Renderers ─────��────────────────────────────────────────────────────

function EventCard({ data }: { data: EventData }) {
  return (
    <div>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-semibold sm:text-base'>{data.title}</h3>
        <Badge variant='secondary' className='text-xs capitalize'>
          {data.category.replace(/_/g, ' ')}
        </Badge>
      </div>
      <div className='mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
        {data.venue_address && (
          <span className='flex items-center gap-1'>
            <MapPin className='h-3 w-3' />
            {data.venue_address}
          </span>
        )}
        {data.attendee_count > 0 && (
          <span className='flex items-center gap-1'>
            <Users className='h-3 w-3' />
            {data.attendee_count} attendees
          </span>
        )}
      </div>
    </div>
  );
}

function ConnectionCard({ data }: { data: ConnectionData }) {
  return (
    <div>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-semibold sm:text-base'>{data.person_name}</h3>
        {data.company && (
          <span className='text-xs text-muted-foreground'>at {data.company}</span>
        )}
      </div>
      <div className='mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
        {data.event_title && (
          <span className='flex items-center gap-1'>
            <CalendarDays className='h-3 w-3' />
            {data.event_title}
          </span>
        )}
        {data.phone && (
          <a
            href={`https://wa.me/${data.phone.replace(/[^0-9]/g, '')}`}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-[#229434] hover:underline'
          >
            <ExternalLink className='h-3 w-3' />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function VowCard({ data }: { data: VowData }) {
  const statusColors: Record<string, string> = {
    active: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
  };

  const categoryLabels: Record<string, string> = {
    business: 'Business',
    family_health: 'Family & Health',
    yi: 'Yi',
  };

  return (
    <div>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline' className='text-xs'>
          {categoryLabels[data.category] ?? data.category}
        </Badge>
        <Badge className={`text-xs ${statusColors[data.status] ?? 'bg-gray-100 text-gray-800'}`}>
          {data.status.replace(/_/g, ' ')}
        </Badge>
      </div>
      <p className='mt-1.5 text-sm italic text-foreground/80'>
        &ldquo;{data.vow_text}&rdquo;
      </p>
      {data.witness_name && (
        <p className='mt-1 text-xs text-muted-foreground'>
          Witnessed by {data.witness_name}
        </p>
      )}
    </div>
  );
}

function HealthCardCard({ data }: { data: HealthCardData }) {
  const totalParticipants = data.ec_members_count + data.non_ec_members_count;

  return (
    <div>
      <div className='flex flex-wrap items-center gap-2'>
        <h3 className='text-sm font-semibold sm:text-base'>{data.activity_name}</h3>
        <Badge variant='secondary' className='text-xs'>
          {data.vertical_name}
        </Badge>
        {data.aaa_type && (
          <Badge variant='outline' className='text-xs capitalize'>
            {data.aaa_type}
          </Badge>
        )}
      </div>
      <p className='mt-1 text-xs text-muted-foreground'>
        {totalParticipants} participants ({data.ec_members_count} EC + {data.non_ec_members_count} Non-EC)
      </p>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className='relative'>
      <div className='absolute left-4 top-0 bottom-0 w-0.5 bg-border sm:left-6' />
      <div className='space-y-6'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='relative flex gap-4 pl-10 sm:pl-14'>
            <div className='absolute left-2.5 top-3 h-3 w-3 rounded-full bg-muted sm:left-4.5 sm:h-4 sm:w-4' />
            <Card className='flex-1'>
              <CardContent className='p-4 sm:p-5'>
                <div className='flex items-start gap-3'>
                  <Skeleton className='h-8 w-8 rounded-lg' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-4 w-3/4' />
                    <Skeleton className='h-3 w-1/2' />
                    <Skeleton className='h-3 w-1/4' />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
