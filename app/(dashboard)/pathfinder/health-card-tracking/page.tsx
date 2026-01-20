/**
 * Health Card Tracking Page
 *
 * Dashboard for tracking health card submission metrics,
 * identifying pending submissions, and measuring performance.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { getHealthCardTrackingDashboard, getTrackingAlerts } from '@/lib/data/health-card-tracking'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HealthCardTrackingDashboardComponent } from '@/components/pathfinder/health-card-tracking-dashboard'

export const metadata = {
  title: 'Health Card Tracking',
  description: 'Track health card submission metrics and pending entries',
}

async function TrackingDashboardContent() {
  const [dashboard, alerts] = await Promise.all([
    getHealthCardTrackingDashboard(),
    getTrackingAlerts(),
  ])

  return (
    <HealthCardTrackingDashboardComponent
      dashboard={dashboard}
      alerts={alerts}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-lg border p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  )
}

export default async function HealthCardTrackingPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Vertical Head'])

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/pathfinder">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Health Card Tracking</h1>
            <p className="text-muted-foreground mt-1">
              Monitor submissions, quality, and timeliness across verticals
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/pathfinder/health-card/new">
              Submit Health Card
            </Link>
          </Button>
        </div>
      </div>

      {/* Dashboard Content with Suspense */}
      <Suspense fallback={<LoadingSkeleton />}>
        <TrackingDashboardContent />
      </Suspense>
    </div>
  )
}
