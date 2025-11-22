/**
 * Vertical Activities Page
 *
 * List and manage activities for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Plus, Calendar, Users, Clock, IndianRupee } from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import { getVerticalById, getVerticalActivities, getCurrentFiscalYear } from '@/lib/data/vertical'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACTIVITY_TYPE_LABELS } from '@/types/vertical'
import { format } from 'date-fns'

export const metadata = {
  title: 'Vertical Activities',
  description: 'Manage activities for this vertical',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ActivitiesPage({ params }: PageProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <ActivitiesHeader params={params} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        <ActivitiesContent params={params} />
      </Suspense>
    </div>
  )
}

async function ActivitiesHeader({ params }: PageProps) {
  const { id } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
        <p className="text-muted-foreground mt-1">
          Track activities and events for {vertical.name}
        </p>
      </div>
      <Button asChild>
        <Link href={`/verticals/${id}/activities/new`}>
          <Plus className="h-4 w-4 mr-2" />
          New Activity
        </Link>
      </Button>
    </div>
  )
}

async function ActivitiesContent({ params }: PageProps) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const vertical = await getVerticalById(id)
  if (!vertical) notFound()

  const fiscalYear = getCurrentFiscalYear()
  const activities = await getVerticalActivities(id, { fiscal_year: fiscalYear })

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No Activities Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Record your first activity to start tracking progress
          </p>
          <Button asChild>
            <Link href={`/verticals/${id}/activities/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Create Activity
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Calculate totals
  const totals = activities.reduce(
    (acc, activity) => ({
      beneficiaries: acc.beneficiaries + (activity.beneficiaries_count || 0),
      hours: acc.hours + (activity.volunteer_hours || 0),
      cost: acc.cost + (activity.cost_incurred || 0),
    }),
    { beneficiaries: 0, hours: 0, cost: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Activities</span>
            </div>
            <p className="text-2xl font-bold mt-2">{activities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Beneficiaries</span>
            </div>
            <p className="text-2xl font-bold mt-2">{totals.beneficiaries.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Volunteer Hours</span>
            </div>
            <p className="text-2xl font-bold mt-2">{totals.hours.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Cost</span>
            </div>
            <p className="text-2xl font-bold mt-2">₹{totals.cost.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>FY{fiscalYear} Activities</CardTitle>
          <CardDescription>
            {activities.length} activities recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{activity.activity_title}</h4>
                    <Badge variant="secondary">
                      {ACTIVITY_TYPE_LABELS[activity.activity_type as keyof typeof ACTIVITY_TYPE_LABELS]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{format(new Date(activity.activity_date), 'dd MMM yyyy')}</span>
                    {activity.beneficiaries_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {activity.beneficiaries_count}
                      </span>
                    )}
                    {activity.volunteer_hours > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {activity.volunteer_hours}h
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/verticals/${id}/activities/${activity.id}`}>
                    View
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-9 w-48 mb-1" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
