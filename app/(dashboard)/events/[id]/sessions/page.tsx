/**
 * Event Sessions Management Page
 *
 * Chair+/organizer-only. Add, edit, reorder, delete sessions.
 * Attendees see the Agenda tab on the event detail page.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { requireAuth, getCurrentChapterId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getEventById, getSessions } from '@/lib/data/events'
import { Forbidden } from '@/components/forbidden'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

import { SessionList } from '@/components/events/sessions/session-list'
import type { SpeakerOption } from '@/components/events/sessions/session-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EventSessionsPage({ params }: PageProps) {
  const user = await requireAuth()
  const { id } = await params

  const event = await getEventById(id)
  if (!event) notFound()

  // CHAPTER SCOPING (BUG-leak-fix 2026-05-28): block cross-chapter access.
  // Super Admin / National Admin bypass the chapter check.
  const supabase = await createClient()
  const currentChapterId = await getCurrentChapterId()
  const { data: roleRows } = await supabase
    .schema('yi_connect')
    .rpc('get_user_roles_detailed', { p_user_id: user.id })
  const roleNames = (roleRows || []).map(
    (r: { role_name: string }) => r.role_name
  )
  const isSuperAdmin =
    roleNames.includes('Super Admin') || roleNames.includes('National Admin')

  const eventChapterId =
    (event as { chapter_id?: string | null; chapter?: { id?: string } | null })
      .chapter_id ?? (event as { chapter?: { id?: string } | null }).chapter?.id ?? null

  if (
    !isSuperAdmin &&
    eventChapterId &&
    currentChapterId &&
    eventChapterId !== currentChapterId
  ) {
    return (
      <Forbidden reason="This event's sessions belong to another chapter and are not visible to you." />
    )
  }

  // Authorization: organizer OR hierarchy >= 4 (Co-Chair+)
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    { p_user_id: user.id }
  )
  const level = (hierarchyLevel as number) || 0
  const isOrganizer = event.organizer?.id === user.id
  const canManage = isOrganizer || level >= 4

  if (!canManage) {
    return (
      <Forbidden reason="You don't have permission to manage this event's sessions. Only the organizer or Co-Chair+ can edit the agenda." />
    )
  }

  return (
    <div className='min-h-screen'>
      <Breadcrumb className='mb-6'>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/events'>Events</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className='h-4 w-4' />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/events/${id}`}>
              {event.title.length > 30
                ? event.title.slice(0, 30) + '...'
                : event.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className='h-4 w-4' />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Sessions</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex flex-wrap items-start justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-bold tracking-tight'>
            Agenda & Sessions
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Structure this event's schedule with sessions, speakers, and tracks.
          </p>
        </div>
        <Button variant='outline' asChild size='sm'>
          <Link href={`/events/${id}`}>
            <ChevronLeft className='mr-1 h-4 w-4' />
            Back to event
          </Link>
        </Button>
      </div>

      <Card className='border-0 shadow-sm'>
        <CardContent className='p-4 sm:p-6'>
          <Suspense fallback={<SessionsSkeleton />}>
            <SessionsLoader eventId={id} chapterId={event.chapter?.id || null} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

async function SessionsLoader({
  eventId,
  chapterId,
}: {
  eventId: string
  chapterId: string | null
}) {
  const [sessions, speakers] = await Promise.all([
    getSessions(eventId),
    loadSpeakers(chapterId),
  ])

  return (
    <SessionList
      eventId={eventId}
      initialSessions={sessions}
      speakers={speakers}
    />
  )
}

async function loadSpeakers(chapterId: string | null): Promise<SpeakerOption[]> {
  const supabase = await createClient()
  let query = supabase
    .schema('yi_connect').from('speakers')
    .select('id, speaker_name, current_organization, designation')
    .eq('status', 'active')
    .order('speaker_name', { ascending: true })
    .limit(500)
  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }
  const { data, error } = await query
  if (error) {
    console.error('Error loading speakers:', error)
    return []
  }
  return (data || []) as SpeakerOption[]
}

function SessionsSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className='h-8 w-48' />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-28 w-full rounded-xl' />
      ))}
    </div>
  )
}
