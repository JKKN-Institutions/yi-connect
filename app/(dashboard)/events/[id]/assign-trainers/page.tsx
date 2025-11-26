/**
 * Assign Trainers Page
 *
 * Interface for assigning trainers to service events.
 * Shows trainer recommendations with scoring algorithm.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { ArrowLeft, Users, Wand2, UserCheck } from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import { getServiceEventById } from '@/lib/data/service-events'
import { getEligibleTrainersForEvent, getEventTrainerAssignments } from '@/lib/data/trainer-scoring'
import { TrainerAssignmentContent } from './trainer-assignment-content'
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

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AssignTrainersPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <Suspense fallback={<AssignTrainersSkeleton />}>
      <AssignTrainersContent params={params} />
    </Suspense>
  )
}

async function AssignTrainersContent({ params }: PageProps) {
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
          <AlertTitle>Not a Service Event</AlertTitle>
          <AlertDescription>
            Trainer assignment is only available for service events (Masoom, Thalir, Yuva, etc.)
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

  // Get eligible trainers with scores
  const trainersNeeded = event.trainers_needed || Math.ceil((event.expected_students || 0) / 60)
  const eligibleTrainers = await getEligibleTrainersForEvent({
    eventId: id,
    stakeholderCity: event.stakeholder?.city || undefined,
    serviceType: event.service_type || 'masoom',
    trainersNeeded,
  })

  // Get existing assignments
  const existingAssignments = await getEventTrainerAssignments(id)
  const confirmedTrainers = existingAssignments.filter(
    (a) => a.status === 'confirmed' || a.status === 'accepted'
  )

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
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
            <BreadcrumbPage>Assign Trainers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Assign Trainers
          </h1>
          <p className="text-muted-foreground mt-1">
            {event.title} - {event.service_type?.toUpperCase()} Session
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/events/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>

      {/* Event Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Event Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Expected Students</p>
              <p className="text-2xl font-bold">{event.expected_students || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trainers Needed</p>
              <p className="text-2xl font-bold">{trainersNeeded}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold text-green-600">
                {confirmedTrainers.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {confirmedTrainers.length >= trainersNeeded ? (
                <Badge className="bg-green-100 text-green-700">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-700">
                  Need {trainersNeeded - confirmedTrainers.length} more
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Info */}
      <Alert>
        <Wand2 className="h-4 w-4" />
        <AlertTitle>Smart Trainer Matching</AlertTitle>
        <AlertDescription>
          Trainers are scored based on: Location (30pts), Fair Distribution (30pts),
          Performance Rating (25pts), and Engagement (15pts). Click on a trainer to see their score breakdown.
        </AlertDescription>
      </Alert>

      {/* Trainer Assignment Interface */}
      <TrainerAssignmentContent
        eventId={id}
        trainers={eligibleTrainers}
        trainersNeeded={trainersNeeded}
        existingAssignments={existingAssignments}
      />
    </div>
  )
}

function AssignTrainersSkeleton() {
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
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  )
}
