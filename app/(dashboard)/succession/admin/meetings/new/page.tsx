import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentActiveCycle } from '@/lib/data/succession'
import { MeetingForm } from '@/components/succession/forms/meeting-form'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Schedule New Meeting | Admin',
  description: 'Schedule a new steering committee meeting',
}

async function NewMeetingContent() {
  const activeCycle = await getCurrentActiveCycle()

  if (!activeCycle) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-lg font-medium text-muted-foreground">
              No Active Succession Cycle
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Create an active succession cycle before scheduling meetings.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Schedule Meeting</CardTitle>
          <CardDescription>
            Create a new steering committee meeting for succession voting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MeetingForm cycleId={activeCycle.id} mode="create" />
        </CardContent>
      </Card>
    </div>
  )
}

function NewMeetingLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function NewMeetingPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule New Meeting</h1>
        <p className="text-muted-foreground mt-2">
          Schedule a steering committee meeting to vote on succession candidates
        </p>
      </div>

      <Suspense fallback={<NewMeetingLoading />}>
        <NewMeetingContent />
      </Suspense>
    </div>
  )
}
