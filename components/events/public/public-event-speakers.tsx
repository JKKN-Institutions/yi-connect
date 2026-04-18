/**
 * PublicEventSpeakers
 *
 * Deduplicated grid of speakers across all active sessions. Returns
 * `null` when there are no speakers on any session.
 */

import { Mic2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicSession } from '@/lib/data/public-events';

interface PublicEventSpeakersProps {
  sessions: PublicSession[];
}

type SpeakerCard = {
  id: string;
  speaker_name: string;
  title: string | null;
  current_organization: string | null;
  designation: string | null;
  photo_url: string | null;
};

export function PublicEventSpeakers({ sessions }: PublicEventSpeakersProps) {
  const seen = new Map<string, SpeakerCard>();

  for (const s of sessions) {
    if (!s.is_active) continue;
    for (const ss of s.speakers || []) {
      if (!ss.speaker) continue;
      if (!seen.has(ss.speaker.id)) {
        seen.set(ss.speaker.id, ss.speaker);
      }
    }
  }

  const speakers = Array.from(seen.values());
  if (speakers.length === 0) return null;

  return (
    <Card className='overflow-hidden border-0 shadow-sm'>
      <CardContent className='p-5 sm:p-6'>
        <div className='mb-5 flex items-center gap-2'>
          <Mic2 className='h-4 w-4 text-orange-500' />
          <h2 className='text-lg font-semibold text-foreground'>
            Speakers & guests
          </h2>
          <span className='text-sm text-muted-foreground'>
            · {speakers.length}
          </span>
        </div>

        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
          {speakers.map((sp) => (
            <SpeakerTile key={sp.id} speaker={sp} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SpeakerTile({ speaker }: { speaker: SpeakerCard }) {
  const initials = speaker.speaker_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const subtitle = [speaker.designation, speaker.current_organization]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className='flex flex-col items-center rounded-xl border bg-card p-3 text-center transition-colors hover:bg-muted/40'>
      {speaker.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={speaker.photo_url}
          alt={speaker.speaker_name}
          className='h-16 w-16 rounded-full object-cover ring-2 ring-background'
        />
      ) : (
        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-lg font-semibold text-white ring-2 ring-background'>
          {initials || '?'}
        </div>
      )}

      <div className='mt-3 text-sm font-semibold text-foreground line-clamp-2'>
        {speaker.speaker_name}
      </div>

      {subtitle && (
        <div className='mt-1 text-xs text-muted-foreground line-clamp-2'>
          {subtitle}
        </div>
      )}
    </div>
  );
}
