import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Calendar } from 'lucide-react'
import { getMeetings, getCurrentActiveCycle } from '@/lib/data/succession'
import { MeetingsTable } from '@/components/succession/tables/meetings-table'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Steering Committee Meetings | Admin',
  description: 'Manage succession meetings and voting sessions',
}

async function MeetingsContent() {
  const [activeCycle, meetings] = await Promise.all([
    getCurrentActiveCycle(),
    getMeetings(),
  ])

  // Calculate statistics
  const stats = {
    total: meetings.length,
    scheduled: meetings.filter((m: any) => m.status === 'scheduled').length,
    inProgress: meetings.filter((m: any) => m.status === 'in_progress').length,
    completed: meetings.filter((m: any) => m.status === 'completed').length,
    cancelled: meetings.filter((m: any) => m.status === 'cancelled').length,
  }

  // Get upcoming meetings
  const now = new Date()
  const upcomingMeetings = meetings
    .filter((m: any) => new Date(m.meeting_date) > now && m.status !== 'cancelled')
    .sort((a: any, b: any) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
    .slice(0, 3)

  return (
    <div className="space-y-6">
      {activeCycle && (
        <Card>
          <CardHeader>
            <CardTitle>Active Succession Cycle</CardTitle>
            <CardDescription>
              {activeCycle.cycle_name} - {activeCycle.year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                <span className="font-medium capitalize">
                  {activeCycle.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {upcomingMeetings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
            <CardDescription>
              Next scheduled meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMeetings.map((meeting: any) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium">
                        {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {meeting.meeting_type.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <Link href={`/succession/admin/meetings/${meeting.id}`}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Meetings</CardTitle>
              <CardDescription>
                Manage steering committee meetings and voting sessions
              </CardDescription>
            </div>
            {activeCycle && (
              <Link href="/succession/admin/meetings/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule Meeting
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MeetingsTable meetings={meetings} />
        </CardContent>
      </Card>
    </div>
  )
}

function MeetingsLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminMeetingsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Steering Committee Meetings</h1>
        <p className="text-muted-foreground mt-2">
          Schedule meetings and manage voting sessions for succession decisions
        </p>
      </div>

      <Suspense fallback={<MeetingsLoading />}>
        <MeetingsContent />
      </Suspense>
    </div>
  )
}
