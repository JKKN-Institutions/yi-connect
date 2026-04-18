import Link from 'next/link'
import { Calendar, Clock, MapPin, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SpeakerUpcomingSession } from '@/types/stakeholder'

interface SpeakerSessionHistoryProps {
  sessions: SpeakerUpcomingSession[]
}

function formatDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }
  } catch {
    return { date: iso, time: '' }
  }
}

export function SpeakerSessionHistory({ sessions }: SpeakerSessionHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <History className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-sm font-medium">No sessions yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This speaker has not been assigned to any event sessions.
        </p>
      </div>
    )
  }

  // Partition into upcoming vs past
  const now = Date.now()
  const upcoming = sessions.filter(
    (s) => new Date(s.start_time).getTime() >= now
  )
  const past = sessions.filter((s) => new Date(s.start_time).getTime() < now)

  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Upcoming Sessions ({upcoming.length})
          </h3>
          <div className="space-y-3">
            {upcoming.map((session) => (
              <SessionCard key={session.session_id} session={session} upcoming />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Past Sessions ({past.length})
          </h3>
          <div className="space-y-3">
            {past.map((session) => (
              <SessionCard key={session.session_id} session={session} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SessionCard({
  session,
  upcoming = false,
}: {
  session: SpeakerUpcomingSession
  upcoming?: boolean
}) {
  const { date, time } = formatDateTime(session.start_time)
  const { time: endTime } = formatDateTime(session.end_time)

  return (
    <div className="rounded-lg border p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium">{session.session_title}</h4>
          <Link
            href={`/events/${session.event_id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {session.event_title}
          </Link>
        </div>
        {upcoming && (
          <Badge variant="default" className="shrink-0 text-xs">
            Upcoming
          </Badge>
        )}
        {session.role && (
          <Badge variant="outline" className="shrink-0 text-xs capitalize">
            {session.role}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            {time}
            {endTime ? ` – ${endTime}` : ''}
          </span>
        </div>
        {session.room_or_track && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{session.room_or_track}</span>
          </div>
        )}
      </div>
    </div>
  )
}
