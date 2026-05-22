/**
 * Planned Activities Page
 *
 * Shows all planned activities for the chapter.
 * Allows managing activities and converting them to health card entries.
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { format } from 'date-fns'
import { unstable_noStore as noStore } from 'next/cache'
import { getPlannedActivities, getPlannedActivitiesStats } from '@/app/actions/planned-activities'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  ListChecks,
  CalendarPlus
} from 'lucide-react'
import { getStatusColor, getStatusLabel } from '@/types/planned-activity'
import type { PlannedActivityWithDetails, PlannedActivityStatus } from '@/types/planned-activity'
import { PlannedActivityActions } from './planned-activity-actions'

export const metadata: Metadata = {
  title: 'Planned Activities | Yi Connect',
  description: 'View and manage your planned activities',
}

function StatCard({
  title,
  value,
  icon: Icon,
  variant
}: {
  title: string
  value: number
  icon: React.ElementType
  variant?: 'default' | 'primary' | 'warning' | 'success' | 'muted'
}) {
  const variantClasses = {
    default: 'bg-card',
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-600',
    success: 'bg-green-500/10 text-green-600',
    muted: 'bg-muted text-muted-foreground',
  }

  return (
    <Card className={variantClasses[variant || 'default']}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <Icon className="h-8 w-8 opacity-50" />
        </div>
      </CardContent>
    </Card>
  )
}

async function StatsSection() {
  const stats = await getPlannedActivitiesStats()

  if (!stats) {
    return null
  }

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <StatCard title="Planned" value={stats.planned} icon={Clock} variant="primary" />
      <StatCard title="In Progress" value={stats.in_progress} icon={ListChecks} variant="warning" />
      <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} variant="success" />
      <StatCard title="This Week" value={stats.upcoming_this_week} icon={Calendar} variant="default" />
    </div>
  )
}

function ActivityCard({ activity }: { activity: PlannedActivityWithDetails }) {
  const totalParticipants = activity.expected_ec_count + activity.expected_non_ec_count
  const isPast = new Date(activity.planned_date) < new Date()

  return (
    <Card className={activity.status === 'cancelled' ? 'opacity-60' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {activity.vertical?.icon && (
                <span className="text-lg">{activity.vertical.icon}</span>
              )}
              <h3 className="font-semibold truncate">{activity.activity_name}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className={isPast && activity.status === 'planned' ? 'text-destructive' : ''}>
                  {format(new Date(activity.planned_date), 'PPP')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{totalParticipants} expected</span>
              </div>
            </div>

            {activity.activity_description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {activity.activity_description}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor(activity.status)}>
                {getStatusLabel(activity.status)}
              </Badge>
              {activity.vertical?.name && (
                <Badge variant="secondary">{activity.vertical.name}</Badge>
              )}
              {isPast && activity.status === 'planned' && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
          </div>

          <PlannedActivityActions activity={activity} />
        </div>

        {activity.status === 'planned' && (
          <div className="mt-4 pt-4 border-t">
            <Link href={`/pathfinder/health-card/new?from=planned&id=${activity.id}`}>
              <Button className="w-full" size="sm">
                Complete Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function ActivityList({ status }: { status?: PlannedActivityStatus }) {
  noStore()
  const activities = await getPlannedActivities(status ? { status } : undefined)

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <CalendarPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No activities found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {status
              ? `No ${status.replace('_', ' ')} activities yet.`
              : 'Start planning your first activity using the floating button.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  )
}

export default async function PlannedActivitiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planned Activities</h1>
        <p className="text-muted-foreground">
          Manage your planned activities and convert them to health card entries
        </p>
      </div>

      <Suspense fallback={
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      }>
        <StatsSection />
      </Suspense>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="planned">Planned</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Suspense fallback={<ActivityListSkeleton />}>
            <ActivityList />
          </Suspense>
        </TabsContent>

        <TabsContent value="planned" className="mt-4">
          <Suspense fallback={<ActivityListSkeleton />}>
            <ActivityList status="planned" />
          </Suspense>
        </TabsContent>

        <TabsContent value="in_progress" className="mt-4">
          <Suspense fallback={<ActivityListSkeleton />}>
            <ActivityList status="in_progress" />
          </Suspense>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Suspense fallback={<ActivityListSkeleton />}>
            <ActivityList status="completed" />
          </Suspense>
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4">
          <Suspense fallback={<ActivityListSkeleton />}>
            <ActivityList status="cancelled" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
