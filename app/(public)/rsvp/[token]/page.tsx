import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  getEventByRsvpToken,
  getChapterMembersForRSVP,
  getEventRSVPsByToken,
  getGuestRSVPs,
} from '@/lib/data/public-events';
import { QuickRSVPHero } from '@/components/events/quick-rsvp-hero';
import { MemberRSVPList } from '@/components/events/member-rsvp-list';
import { GuestRSVPForm } from '@/components/events/guest-rsvp-form';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const event = await getEventByRsvpToken(token);

  if (!event) {
    return { title: 'Event Not Found | Yi Connect' };
  }

  const dateStr = format(new Date(event.start_date), 'MMM d, yyyy');
  const attendeeCount = event.current_registrations;

  return {
    title: `${event.title} - RSVP | Yi Connect`,
    description: `${dateStr} | ${event.venue_address || 'TBA'} | ${attendeeCount} attending`,
    openGraph: {
      title: event.title,
      description: `${dateStr} | ${event.venue_address || 'TBA'} | ${attendeeCount} attending`,
      images: event.banner_image_url ? [event.banner_image_url] : [],
    },
  };
}

export default async function QuickRSVPPage({ params }: PageProps) {
  const { token } = await params;
  const event = await getEventByRsvpToken(token);

  if (!event) {
    notFound();
  }

  const isEventOver = event.status === 'completed' || new Date(event.end_date) < new Date();
  const isEventFull = event.max_capacity ? event.current_registrations >= event.max_capacity : false;

  // Fetch members and RSVPs in parallel
  const [members, rsvps, guestRsvps] = await Promise.all([
    event.chapter_id ? getChapterMembersForRSVP(event.chapter_id) : Promise.resolve([]),
    getEventRSVPsByToken(event.id),
    getGuestRSVPs(event.id),
  ]);

  // Build a map of member_id -> rsvp for quick lookup
  const rsvpMap = new Map(rsvps.map(r => [r.member_id, r]));

  // Split members into attending and not-yet
  const attending = members.filter(m => {
    const rsvp = rsvpMap.get(m.id);
    return rsvp && rsvp.status === 'confirmed';
  });
  const notYet = members.filter(m => {
    const rsvp = rsvpMap.get(m.id);
    return !rsvp || rsvp.status !== 'confirmed';
  });

  // Sort attending alphabetically and not-yet alphabetically
  attending.sort((a, b) => a.full_name.localeCompare(b.full_name));
  notYet.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="max-w-lg mx-auto pb-12">
      <QuickRSVPHero
        event={event}
        attendeeCount={attending.length}
        totalMembers={members.length}
        isEventOver={isEventOver}
        isEventFull={isEventFull}
      />

      <MemberRSVPList
        attending={attending}
        notYet={notYet}
        rsvpMap={Object.fromEntries(rsvps.map(r => [r.member_id, { id: r.id, guests_count: r.guests_count }]))}
        eventId={event.id}
        token={token}
        isEventOver={isEventOver}
        isEventFull={isEventFull}
      />

      {!isEventOver && (
        <GuestRSVPForm
          eventId={event.id}
          token={token}
          existingGuests={guestRsvps}
        />
      )}

      {/* Footer Branding */}
      <div className="text-center mt-8 text-sm text-muted-foreground">
        <p>{event.chapter?.name || 'Yi Connect'}</p>
        <p className="text-xs mt-1">Together We Can. We Will.</p>
      </div>
    </div>
  );
}
