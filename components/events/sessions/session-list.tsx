'use client'

/**
 * SessionList
 *
 * Management list of sessions for Chair+/organizer. Arrow-button reorder
 * (no external dnd library), edit via Sheet, and destructive delete.
 */

import { useState, useTransition, useMemo } from 'react'
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  Calendar,
  Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { SessionCard } from './session-card'
import { SessionForm, type SpeakerOption } from './session-form'
import { formatSessionDateShort } from './session-time'
import type { EventSessionWithRelations } from '@/types/event'
import { deleteSession, reorderSessions } from '@/app/actions/events'

interface SessionListProps {
  eventId: string
  initialSessions: EventSessionWithRelations[]
  speakers: SpeakerOption[]
}

export function SessionList({
  eventId,
  initialSessions,
  speakers,
}: SessionListProps) {
  const [sessions, setSessions] = useState<EventSessionWithRelations[]>(
    initialSessions
  )
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const grouped = useMemo(() => groupByDay(sessions), [sessions])

  const persistOrder = (next: EventSessionWithRelations[]) => {
    setSessions(next)
    startTransition(async () => {
      const result = await reorderSessions({
        event_id: eventId,
        session_ids: next.map((s) => s.id),
      })
      if (!result.success) {
        toast.error(result.error || 'Failed to save order')
      }
    })
  }

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= sessions.length) return
    const next = [...sessions]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    persistOrder(next)
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteSession(id)
      if (result.success) {
        toast.success('Session deleted')
        setSessions((curr) => curr.filter((s) => s.id !== id))
      } else {
        toast.error(result.error || 'Failed to delete session')
      }
      setDeletingId(null)
    })
  }

  if (sessions.length === 0) {
    return (
      <div className='rounded-xl border border-dashed p-10 text-center'>
        <div className='w-12 h-12 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-3'>
          <Calendar className='h-6 w-6 text-muted-foreground/60' />
        </div>
        <p className='text-sm font-medium text-foreground'>No sessions yet</p>
        <p className='text-xs text-muted-foreground mt-1'>
          Add the first session to start building your agenda.
        </p>
        <div className='mt-4 inline-block'>
          <SessionForm eventId={eventId} speakers={speakers} />
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-base font-semibold'>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </h3>
          <p className='text-xs text-muted-foreground'>
            Use the arrow buttons to reorder. Times shown in IST.
          </p>
        </div>
        <SessionForm eventId={eventId} speakers={speakers} />
      </div>

      <div className='space-y-6'>
        {grouped.map(({ dayLabel, items }) => (
          <div key={dayLabel}>
            <div className='text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium'>
              {dayLabel}
            </div>
            <div className='space-y-3'>
              {items.map(({ session, globalIndex }) => (
                <div key={session.id} className='relative'>
                  <SessionCard
                    session={session}
                    rightSlot={
                      <div className='flex items-center gap-1'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          disabled={globalIndex === 0 || isPending}
                          onClick={() => move(globalIndex, -1)}
                          aria-label='Move up'
                        >
                          <ArrowUp className='h-4 w-4' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          disabled={globalIndex === sessions.length - 1 || isPending}
                          onClick={() => move(globalIndex, 1)}
                          aria-label='Move down'
                        >
                          <ArrowDown className='h-4 w-4' />
                        </Button>
                        <SessionForm
                          eventId={eventId}
                          session={session}
                          speakers={speakers}
                          trigger={
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                            >
                              Edit
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 text-destructive hover:text-destructive'
                              disabled={deletingId === session.id}
                              aria-label='Delete session'
                            >
                              {deletingId === session.id ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                              ) : (
                                <Trash2 className='h-4 w-4' />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove "{session.title}" from the agenda.
                                Member interest records for this session will also be deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className='bg-destructive text-white hover:bg-destructive/90'
                                onClick={() => handleDelete(session.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function groupByDay(
  sessions: EventSessionWithRelations[]
): Array<{
  dayLabel: string
  items: { session: EventSessionWithRelations; globalIndex: number }[]
}> {
  const map = new Map<
    string,
    { session: EventSessionWithRelations; globalIndex: number }[]
  >()
  sessions.forEach((s, idx) => {
    const key = formatSessionDateShort(s.start_time)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({ session: s, globalIndex: idx })
  })
  return Array.from(map.entries()).map(([dayLabel, items]) => ({
    dayLabel,
    items,
  }))
}
