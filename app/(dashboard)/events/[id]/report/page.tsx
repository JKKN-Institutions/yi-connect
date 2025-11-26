/**
 * Session Report Page
 *
 * Post-session report submission for service events.
 * Captures attendance, feedback, and outcomes.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { ArrowLeft, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import { getServiceEventById, getEventSessionReport } from '@/lib/data/service-events'
import { SessionReportForm } from '@/components/events/session-report-form'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SessionReportPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member'])

  return (
    <Suspense fallback={<ReportPageSkeleton />}>
      <ReportPageContent params={params} />
    </Suspense>
  )
}

async function ReportPageContent({ params }: PageProps) {
  const user = await getCurrentUser()
  const { id } = await params

  if (!user) {
    redirect('/login')
  }

  // Fetch event details
  const event = await getServiceEventById(id)

  if (!event) {
    notFound()
  }

  // Check if this is a service event
  if (!event.is_service_event) {
    return (
      <div className="container py-6 space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not a Service Event</AlertTitle>
          <AlertDescription>
            Session reports are only available for service events (Masoom, Thalir, Yuva, etc.)
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href={`/events/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>
    )
  }

  // Check if event is completed or in the past
  const eventDate = new Date(event.end_date || event.start_date)
  const isPast = eventDate < new Date()

  if (!isPast && event.status !== 'completed') {
    return (
      <div className="container py-6 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/events">Events</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/events/${id}`}>{event.title}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Session Report</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Event Not Yet Completed</AlertTitle>
          <AlertDescription>
            Session reports can only be submitted after the event has concluded.
            This event is scheduled for {format(eventDate, 'PPP')}.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href={`/events/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>
    )
  }

  // Check if report already exists
  const existingReport = await getEventSessionReport(id)

  if (existingReport) {
    return (
      <div className="container py-6 space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/events">Events</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/events/${id}`}>{event.title}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Session Report</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Session Report
            </h1>
            <p className="text-muted-foreground mt-1">{event.title}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/events/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Event
            </Link>
          </Button>
        </div>

        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Report Submitted</AlertTitle>
          <AlertDescription className="text-green-700">
            A session report has already been submitted for this event on{' '}
            {format(new Date(existingReport.submitted_at), 'PPP')}.
          </AlertDescription>
        </Alert>

        {/* Display existing report summary */}
        <Card>
          <CardHeader>
            <CardTitle>Report Summary</CardTitle>
            <CardDescription>
              Submitted by trainer on {format(new Date(existingReport.submitted_at), 'PPP')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Expected</p>
                <p className="text-2xl font-bold">{existingReport.expected_attendance || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actual Attendance</p>
                <p className="text-2xl font-bold text-green-600">{existingReport.actual_attendance}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Male</p>
                <p className="text-2xl font-bold">{existingReport.male_count || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Female</p>
                <p className="text-2xl font-bold">{existingReport.female_count || '-'}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Engagement Level</p>
                <Badge variant="secondary">{existingReport.engagement_level || 'Not rated'}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Coordinator Rating</p>
                <div className="flex items-center gap-1">
                  {existingReport.coordinator_rating ? (
                    <>
                      <span className="text-lg font-bold">{existingReport.coordinator_rating}</span>
                      <span className="text-muted-foreground">/5</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not rated</span>
                  )}
                </div>
              </div>
            </div>

            {existingReport.highlights && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Highlights</p>
                  <p className="text-muted-foreground">{existingReport.highlights}</p>
                </div>
              </>
            )}

            {existingReport.challenges_faced && (
              <div>
                <p className="text-sm font-medium mb-2">Challenges</p>
                <p className="text-muted-foreground">{existingReport.challenges_faced}</p>
              </div>
            )}

            {existingReport.recommendations && (
              <div>
                <p className="text-sm font-medium mb-2">Recommendations</p>
                <p className="text-muted-foreground">{existingReport.recommendations}</p>
              </div>
            )}

            {/* Verification Status */}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Verification Status</p>
                <p className="text-sm text-muted-foreground">
                  {existingReport.verified_at
                    ? `Verified on ${format(new Date(existingReport.verified_at), 'PPP')}`
                    : 'Pending verification'}
                </p>
              </div>
              <Badge variant={existingReport.verified_at ? 'default' : 'secondary'}>
                {existingReport.verified_at ? 'Verified' : 'Pending'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show form for new report
  return (
    <div className="container py-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/events">Events</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/events/${id}`}>{event.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Session Report</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Submit Session Report
          </h1>
          <p className="text-muted-foreground mt-1">
            {event.title}
            {event.service_type && ` - ${event.service_type.toUpperCase()}`}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/events/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>

      <SessionReportForm
        eventId={id}
        expectedAttendance={event.expected_students || 0}
        eventTitle={event.title}
      />
    </div>
  )
}

function ReportPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
