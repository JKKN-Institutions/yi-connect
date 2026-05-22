/**
 * SessionCard
 *
 * Displays a single session's essential info: title, type, time range,
 * room, speakers, and (optionally) an interest button. Server-safe by
 * default — it renders pure markup and embeds the client interest button
 * as an island when the viewer is a signed-in member.
 */

import { Clock, MapPin, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type {
  EventSessionWithRelations,
  SessionSpeakerWithProfile,
} from '@/types/event'
import { SESSION_TYPES, getSessionTypeVariant } from '@/types/event'
import {
  formatSessionRange,
  sessionDurationMinutes,
} from './session-time'
import { SessionInterestButton } from './session-interest-button'

interface SessionCardProps {
  session: EventSessionWithRelations
  showInterest?: boolean
  initialInterested?: boolean
  memberSignedIn?: boolean
  rightSlot?: React.ReactNode
  className?: string
}

export function SessionCard({
  session,
  showInterest = false,
  initialInterested = false,
  memberSignedIn = false,
  rightSlot,
  className = '',
}: SessionCardProps) {
  const durationMin = sessionDurationMinutes(session.start_time, session.end_time)

  return (
    <Card className={`overflow-hidden border border-border/60 shadow-sm ${className}`}>
      <CardContent className='p-4 sm:p-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2 mb-2'>
              <Badge
                variant={getSessionTypeVariant(session.session_type)}
                className='text-xs uppercase tracking-wider'
              >
                {SESSION_TYPES[session.session_type]}
              </Badge>
              {!session.is_active && (
                <Badge variant='secondary' className='text-xs'>
                  Hidden
                </Badge>
              )}
              {session.room_or_track && (
                <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                  <MapPin className='h-3 w-3' />
                  {session.room_or_track}
                </span>
              )}
            </div>

            <h4 className='text-base sm:text-lg font-semibold text-foreground leading-snug'>
              {session.title}
            </h4>

            <div className='mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
              <span className='inline-flex items-center gap-1'>
                <Clock className='h-3.5 w-3.5' />
                {formatSessionRange(session.start_time, session.end_time)}
                <span className='opacity-70'>· {durationMin} min</span>
              </span>
              {session.capacity && (
                <span className='inline-flex items-center gap-1'>
                  <Users className='h-3.5 w-3.5' />
                  Cap {session.capacity}
                </span>
              )}
            </div>

            {session.description && (
              <p className='mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap'>
                {session.description}
              </p>
            )}

            {session.speakers && session.speakers.length > 0 && (
              <SpeakerChips speakers={session.speakers} />
            )}
          </div>

          <div className='flex flex-col sm:items-end gap-2 shrink-0'>
            {rightSlot}
            {showInterest && memberSignedIn && (
              <SessionInterestButton
                sessionId={session.id}
                initialInterested={initialInterested}
                initialCount={session.current_interest}
              />
            )}
            {showInterest && !memberSignedIn && session.current_interest > 0 && (
              <span className='text-xs text-muted-foreground'>
                {session.current_interest} interested
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SpeakerChips({ speakers }: { speakers: SessionSpeakerWithProfile[] }) {
  return (
    <div className='mt-3 flex flex-wrap items-center gap-2'>
      {speakers.map((link) => {
        const sp = link.speaker
        if (!sp) return null
        const initials = (sp.speaker_name || 'S').charAt(0).toUpperCase()
        return (
          <div
            key={link.id}
            className='inline-flex items-center gap-2 rounded-full bg-muted/40 pr-3 pl-1 py-1'
          >
            <Avatar className='h-6 w-6'>
              <AvatarImage src={sp.photo_url || undefined} />
              <AvatarFallback className='text-[10px] bg-orange-100 text-orange-700 font-semibold'>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className='text-xs leading-tight'>
              <div className='font-medium text-foreground'>
                {sp.title ? `${sp.title} ` : ''}
                {sp.speaker_name}
              </div>
              {(sp.designation || sp.current_organization) && (
                <div className='text-[11px] text-muted-foreground'>
                  {[sp.designation, sp.current_organization]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
            {link.role && (
              <Badge variant='outline' className='text-[10px] py-0 px-1.5'>
                {link.role}
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}
