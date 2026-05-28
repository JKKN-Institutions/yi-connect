/**
 * Chapter Lead Events Page
 *
 * View and manage sub-chapter events.
 */

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { getSubChapterEvents } from '@/lib/data/sub-chapters'
import {
  SUB_CHAPTER_EVENT_TYPE_INFO,
  SUB_CHAPTER_EVENT_STATUS_INFO,
  type SubChapterEventFull,
} from '@/types/sub-chapter'

export const metadata = {
  title: 'Events | Chapter Lead Portal',
  description: 'Manage your chapter events',
}

async function getSession() {
  const cookieStore = await cookies()
  const leadId = cookieStore.get('chapter_lead_id')?.value
  const subChapterId = cookieStore.get('sub_chapter_id')?.value

  if (!leadId || !subChapterId) {
    return null
  }

  return { leadId, subChapterId }
}

function EventCard({ event }: { event: SubChapterEventFull }) {
  const typeInfo = SUB_CHAPTER_EVENT_TYPE_INFO[event.event_type]
  const statusInfo = SUB_CHAPTER_EVENT_STATUS_INFO[event.status]

  const eventDate = new Date(event.event_date)
  const isPast = eventDate < new Date()

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{event.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {typeInfo.label}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs ${statusInfo.color} ${statusInfo.bgColor}`}
              >
                {statusInfo.label}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>
              {eventDate.toLocaleDateString('en-IN', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
              })}
            </span>
          </div>

          {event.start_time && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {event.start_time}
                {event.end_time && ` - ${event.end_time}`}
              </span>
            </div>
          )}

          {event.venue && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              <span>{event.venue}</span>
            </div>
          )}

          {event.expected_participants && (
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{event.expected_participants} expected</span>
            </div>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}

        {event.requested_speaker && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Speaker:</span>
            <span className="font-medium">
              {event.requested_speaker.profile?.full_name}
            </span>
            {event.speaker_confirmed && (
              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700">
                Confirmed
              </Badge>
            )}
          </div>
        )}

        {event.rejection_reason && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Rejection reason:</p>
            <p>{event.rejection_reason}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/chapter-lead/events/${event.id}`}>View Details</Link>
          </Button>

          {event.status === 'draft' && (
            <Button asChild size="sm">
              <Link href={`/chapter-lead/events/${event.id}/edit`}>Edit</Link>
            </Button>
          )}

          {event.status === 'completed' && !event.actual_participants && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/chapter-lead/events/${event.id}/complete`}>
                Submit Report
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

async function EventsContent() {
  const session = await getSession()

  if (!session) {
    redirect('/chapter-lead/login')
  }

  const events = await getSubChapterEvents({ sub_chapter_id: session.subChapterId })

  const draftEvents = events.filter((e) => e.status === 'draft')
  const pendingEvents = events.filter((e) => e.status === 'pending_approval')
  const upcomingEvents = events.filter((e) =>
    ['approved', 'scheduled', 'in_progress'].includes(e.status) &&
    new Date(e.event_date) >= new Date()
  )
  const completedEvents = events.filter((e) => e.status === 'completed')
  const rejectedEvents = events.filter((e) => ['rejected', 'cancelled'].includes(e.status))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Events</h1>
          <p className="text-muted-foreground mt-1">
            Manage your chapter events and activities
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/chapter-lead/events/new">
            <Plus className="h-4 w-4" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="h-4 w-4" />
            All ({events.length})
          </TabsTrigger>
          <TabsTrigger value="draft" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Drafts ({draftEvents.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed ({completedEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <EventsList events={events} emptyMessage="No events yet. Create your first event!" />
        </TabsContent>

        <TabsContent value="draft">
          <EventsList events={draftEvents} emptyMessage="No draft events" />
        </TabsContent>

        <TabsContent value="pending">
          <EventsList events={pendingEvents} emptyMessage="No events pending approval" />
        </TabsContent>

        <TabsContent value="upcoming">
          <EventsList events={upcomingEvents} emptyMessage="No upcoming events" />
        </TabsContent>

        <TabsContent value="completed">
          <EventsList events={completedEvents} emptyMessage="No completed events" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EventsList({
  events,
  emptyMessage,
}: {
  events: SubChapterEventFull[]
  emptyMessage: string
}) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
          <p className="mt-4 text-muted-foreground">{emptyMessage}</p>
          <Button asChild className="mt-4">
            <Link href="/chapter-lead/events/new">Create Event</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}

function EventsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-10 w-full max-w-md" />

      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[250px]" />
        ))}
      </div>
    </div>
  )
}

export default function ChapterLeadEventsPage() {
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <EventsContent />
    </Suspense>
  )
}
