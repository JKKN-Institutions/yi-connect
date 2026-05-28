/**
 * Chapter Lead Dashboard
 *
 * Main dashboard for Yuva/Thalir sub-chapter leads.
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
import {
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import {
  getSubChapterById,
  getSubChapterDashboardStats,
  getUpcomingSubChapterEvents,
} from '@/lib/data/sub-chapters'
import {
  SUB_CHAPTER_TYPE_INFO,
  SUB_CHAPTER_EVENT_STATUS_INFO,
} from '@/types/sub-chapter'

export const metadata = {
  title: 'Dashboard | Chapter Lead Portal',
  description: 'Manage your Yuva/Thalir chapter',
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

async function DashboardContent() {
  const session = await getSession()

  if (!session) {
    redirect('/chapter-lead/login')
  }

  const [subChapter, stats, upcomingEvents] = await Promise.all([
    getSubChapterById(session.subChapterId),
    getSubChapterDashboardStats(session.subChapterId),
    getUpcomingSubChapterEvents(session.subChapterId, 5),
  ])

  if (!subChapter) {
    redirect('/chapter-lead/login')
  }

  const typeInfo = SUB_CHAPTER_TYPE_INFO[subChapter.type]

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {subChapter.name}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Badge variant="outline">{typeInfo.label}</Badge>
            {subChapter.vertical && (
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: subChapter.vertical.color
                    ? `${subChapter.vertical.color}20`
                    : undefined,
                }}
              >
                {subChapter.vertical.name}
              </Badge>
            )}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/chapter-lead/events/new">
            <Plus className="h-4 w-4" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_events}</div>
            <p className="text-xs text-muted-foreground">
              {stats.upcoming_events} upcoming
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_members}</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Students Reached</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.students_reached}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Events</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_events}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Your scheduled events</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/chapter-lead/events" className="gap-1">
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event) => {
                  const statusInfo = SUB_CHAPTER_EVENT_STATUS_INFO[event.status]
                  return (
                    <div
                      key={event.id}
                      className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.event_date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {event.start_time && ` at ${event.start_time}`}
                        </p>
                        {event.venue && (
                          <p className="text-xs text-muted-foreground">
                            {event.venue}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${statusInfo.color} ${statusInfo.bgColor}`}
                      >
                        {statusInfo.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                <p className="mt-4 text-muted-foreground">No upcoming events</p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/chapter-lead/events/new">Create Event</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for chapter management</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild variant="outline" className="justify-start gap-2 h-auto py-3">
              <Link href="/chapter-lead/events/new">
                <Calendar className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Create New Event</p>
                  <p className="text-xs text-muted-foreground">
                    Schedule a campus event or request a speaker
                  </p>
                </div>
              </Link>
            </Button>

            <Button asChild variant="outline" className="justify-start gap-2 h-auto py-3">
              <Link href="/chapter-lead/members/add">
                <Users className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Add Members</p>
                  <p className="text-xs text-muted-foreground">
                    Add new students to your chapter
                  </p>
                </div>
              </Link>
            </Button>

            <Button asChild variant="outline" className="justify-start gap-2 h-auto py-3">
              <Link href="/chapter-lead/events?status=completed">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Submit Event Report</p>
                  <p className="text-xs text-muted-foreground">
                    Record outcomes for completed events
                  </p>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Yi Mentor Info */}
        {subChapter.yi_mentor && (
          <Card>
            <CardHeader>
              <CardTitle>Your Yi Mentor</CardTitle>
              <CardDescription>Contact for guidance and approvals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">
                    {subChapter.yi_mentor.profile?.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">
                    {subChapter.yi_mentor.profile?.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subChapter.yi_mentor.profile?.email}
                  </p>
                  {subChapter.yi_mentor.profile?.phone && (
                    <p className="text-sm text-muted-foreground">
                      {subChapter.yi_mentor.profile.phone}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[110px]" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  )
}

export default function ChapterLeadDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
