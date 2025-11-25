import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getMeetingById } from '@/lib/data/succession'
import { MeetingForm } from '@/components/succession/forms/meeting-form'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Edit Meeting | Admin',
  description: 'Edit meeting details',
}

interface EditMeetingPageProps {
  params: Promise<{ id: string }>
}

async function EditMeetingContent({ meetingId }: { meetingId: string }) {
  const meeting = await getMeetingById(meetingId)

  if (!meeting) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active Succession Cycle</CardTitle>
          <CardDescription>
            {meeting.cycle.cycle_name} - {meeting.cycle.year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <span className="font-medium capitalize">
                {meeting.cycle.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit Meeting</CardTitle>
          <CardDescription>Update meeting details and information</CardDescription>
        </CardHeader>
        <CardContent>
          <MeetingForm cycleId={meeting.cycle_id} meeting={meeting} mode="edit" />
        </CardContent>
      </Card>
    </div>
  )
}

function EditMeetingLoading() {
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

export default async function EditMeetingPage({ params }: EditMeetingPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  const { id } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Meeting</h1>
        <p className="text-muted-foreground mt-2">
          Update meeting details and schedule information
        </p>
      </div>

      <Suspense fallback={<EditMeetingLoading />}>
        <EditMeetingContent meetingId={id} />
      </Suspense>
    </div>
  )
}
