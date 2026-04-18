/**
 * Public Event Landing Page (Stutzee Feature 2B)
 *
 * Route: /e/[slug]
 *
 * A short, shareable, SEO/OG-friendly landing page for any published event.
 * Anonymous visitors can read event details, agenda, speakers, map, and
 * register via the existing member/guest RSVP flows — no login required.
 *
 * Data access: `getPublicEventBySlug` uses the anonymous Supabase client
 * gated by the `anon_view_events_by_slug` RLS policy. 404s silently if the
 * slug is unknown or the event is not in a public-visible status.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  getPublicEventBySlug,
  getGuestRSVPs,
} from '@/lib/data/public-events';
import {
  PublicEventHero,
  PublicEventDetails,
  PublicEventMap,
  PublicEventVirtual,
  PublicEventAgenda,
  PublicEventSpeakers,
  PublicRegisterCTA,
} from '@/components/events/public';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// OpenGraph / metadata — WhatsApp, LinkedIn, Twitter link previews
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);

  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'This event link is no longer active.',
    };
  }

  const dateStr = format(new Date(event.start_date), 'EEE, MMM d, yyyy');
  const locationStr = event.is_virtual
    ? 'Online'
    : event.venue_address?.split(',')[0] || 'TBA';
  const descBase =
    event.description?.slice(0, 160)?.replace(/\s+/g, ' ').trim() ||
    `${dateStr} · ${locationStr}`;

  const images = event.banner_image_url
    ? [{ url: event.banner_image_url, alt: event.title }]
    : [];

  return {
    title: event.title,
    description: descBase,
    openGraph: {
      type: 'website',
      title: event.title,
      description: `${dateStr} · ${locationStr}${event.chapter?.name ? ` · ${event.chapter.name}` : ''}`,
      images,
      siteName: 'Yi Connect',
    },
    twitter: {
      card: event.banner_image_url ? 'summary_large_image' : 'summary',
      title: event.title,
      description: `${dateStr} · ${locationStr}`,
      images: event.banner_image_url ? [event.banner_image_url] : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublicEventPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug);

  if (!event) {
    notFound();
  }

  // Flags computed server-side so the hero and CTA stay in sync
  const endDate = new Date(event.end_date);
  const isEventOver = event.status === 'completed' || endDate < new Date();
  const isEventFull =
    !!event.max_capacity && event.current_registrations >= event.max_capacity;

  // Existing guest RSVPs so the GuestRSVPForm can show them
  const existingGuests = event.rsvp_token ? await getGuestRSVPs(event.id) : [];

  return (
    <div className='mx-auto max-w-4xl space-y-6 pb-12 sm:space-y-8'>
      <PublicEventHero
        event={event}
        isEventOver={isEventOver}
        isEventFull={isEventFull}
      />

      <PublicEventVirtual
        isVirtual={event.is_virtual}
        virtualMeetingLink={event.virtual_meeting_link}
      />

      <PublicEventDetails event={event} />

      <PublicEventAgenda sessions={event.sessions} />

      <PublicEventSpeakers sessions={event.sessions} />

      <PublicEventMap
        isVirtual={event.is_virtual}
        venueAddress={event.venue_address}
      />

      <PublicRegisterCTA
        event={event}
        isEventOver={isEventOver}
        isEventFull={isEventFull}
        existingGuests={existingGuests}
      />

      {/* Footer credit */}
      <div className='pt-4 text-center text-xs text-muted-foreground'>
        Powered by{' '}
        <span className='font-semibold text-foreground'>Yi Connect</span>
      </div>
    </div>
  );
}
