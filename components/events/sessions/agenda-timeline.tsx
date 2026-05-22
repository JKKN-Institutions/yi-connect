/**
 * AgendaTimeline
 *
 * Vertical timeline view of the session agenda — read-only. Rendered on
 * the event detail page "Agenda" tab for attendees and casual viewers.
 */

import { Calendar } from 'lucide-react'
import type { EventSessionWithRelations } from '@/types/event'
import { SessionCard } from './session-card'
import { formatSessionDateShort } from './session-time'

interface AgendaTimelineProps {
  sessions: EventSessionWithRelations[]
  memberId?: string | null
  interestedIds?: Set<string>
}

export function AgendaTimeline({
  sessions,
  memberId,
  interestedIds,
}: AgendaTimelineProps) {
  // Attendees should only see active sessions
  const visible = sessions.filter((s) => s.is_active)

  if (visible.length === 0) {
    return (
      <div className='text-center py-12'>
        <div className='w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4'>
          <Calendar className='h-8 w-8 text-muted-foreground/50' />
        </div>
        <p className='text-muted-foreground font-medium'>No agenda yet</p>
        <p className='text-sm text-muted-foreground/70 mt-1'>
          The organiser hasn't published a session schedule.
        </p>
      </div>
    )
  }

  const grouped = groupByDay(visible)

  return (
    <div className='space-y-8'>
      {grouped.map(({ dayLabel, items }) => (
        <div key={dayLabel} className='relative'>
          <div className='text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold flex items-center gap-2'>
            <Calendar className='h-3.5 w-3.5' />
            {dayLabel}
          </div>

          <div className='relative pl-6 border-l-2 border-muted space-y-4'>
            {items.map((s) => (
              <div key={s.id} className='relative'>
                <span className='absolute -left-[29px] top-5 h-3 w-3 rounded-full bg-orange-500 ring-4 ring-background' />
                <SessionCard
                  session={s}
                  showInterest
                  memberSignedIn={Boolean(memberId)}
                  initialInterested={interestedIds?.has(s.id) ?? false}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function groupByDay(
  sessions: EventSessionWithRelations[]
): Array<{ dayLabel: string; items: EventSessionWithRelations[] }> {
  const map = new Map<string, EventSessionWithRelations[]>()
  sessions.forEach((s) => {
    const key = formatSessionDateShort(s.start_time)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  })
  return Array.from(map.entries()).map(([dayLabel, items]) => ({
    dayLabel,
    items,
  }))
}
