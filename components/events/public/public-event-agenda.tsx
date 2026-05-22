/**
 * PublicEventAgenda
 *
 * Read-only agenda timeline for the public landing page. Shows each
 * active session with its time window, room/track, type badge, and a
 * compact list of speakers. Returns `null` when there are no active
 * sessions.
 *
 * This is intentionally separate from `components/events/sessions/*` —
 * which is the logged-in management + interest view — so that public
 * rendering stays dependency-light and anonymous-safe.
 */

import { format } from 'date-fns';
import { Clock, MapPin, LayoutList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  PublicSession,
  PublicSessionSpeaker,
} from '@/lib/data/public-events';

interface PublicEventAgendaProps {
  sessions: PublicSession[];
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  keynote: 'Keynote',
  workshop: 'Workshop',
  panel: 'Panel',
  networking: 'Networking',
  break: 'Break',
  presentation: 'Presentation',
  qa: 'Q&A',
  other: 'Session',
};

const SESSION_TYPE_CLASSES: Record<string, string> = {
  keynote:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  workshop:
    'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  panel:
    'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  networking:
    'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  break:
    'bg-muted text-muted-foreground',
  presentation:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  qa:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  other:
    'bg-muted text-muted-foreground',
};

export function PublicEventAgenda({ sessions }: PublicEventAgendaProps) {
  const active = sessions.filter((s) => s.is_active);
  if (active.length === 0) return null;

  return (
    <Card className='overflow-hidden border-0 shadow-sm'>
      <CardContent className='p-5 sm:p-6'>
        <div className='mb-5 flex items-center gap-2'>
          <LayoutList className='h-4 w-4 text-orange-500' />
          <h2 className='text-lg font-semibold text-foreground'>Agenda</h2>
          <span className='text-sm text-muted-foreground'>
            · {active.length} session{active.length !== 1 ? 's' : ''}
          </span>
        </div>

        <ol className='space-y-4'>
          {active.map((session) => (
            <li
              key={session.id}
              className='relative rounded-xl border bg-card p-4 sm:p-5'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <Badge
                  className={`text-[11px] uppercase tracking-wider ${
                    SESSION_TYPE_CLASSES[session.session_type] ||
                    SESSION_TYPE_CLASSES.other
                  }`}
                >
                  {SESSION_TYPE_LABELS[session.session_type] || 'Session'}
                </Badge>
                {session.room_or_track && (
                  <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                    <MapPin className='h-3 w-3' />
                    {session.room_or_track}
                  </span>
                )}
              </div>

              <h3 className='mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg'>
                {session.title}
              </h3>

              <div className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
                <Clock className='h-3.5 w-3.5' />
                <span>
                  {format(new Date(session.start_time), 'h:mm a')} –{' '}
                  {format(new Date(session.end_time), 'h:mm a')}
                </span>
              </div>

              {session.description && (
                <p className='mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap'>
                  {session.description}
                </p>
              )}

              {session.speakers && session.speakers.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {session.speakers.map((s) => (
                    <SessionSpeakerChip key={s.id} speaker={s} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function SessionSpeakerChip({ speaker }: { speaker: PublicSessionSpeaker }) {
  if (!speaker.speaker) return null;
  const { speaker_name, photo_url, current_organization } = speaker.speaker;
  const initials = speaker_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <span className='inline-flex items-center gap-2 rounded-full border bg-muted/50 px-2 py-1 text-xs'>
      {photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo_url}
          alt={speaker_name}
          className='h-5 w-5 rounded-full object-cover'
        />
      ) : (
        <span className='flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-200'>
          {initials || '?'}
        </span>
      )}
      <span className='font-medium text-foreground'>{speaker_name}</span>
      {current_organization && (
        <span className='text-muted-foreground'>· {current_organization}</span>
      )}
      {speaker.role && (
        <span className='text-muted-foreground'>· {speaker.role}</span>
      )}
    </span>
  );
}
