import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, AlertCircle, CheckCircle2, PlayCircle } from 'lucide-react'
import { getCurrentActiveCycle } from '@/lib/data/succession'
import { createClient } from '@/lib/supabase/server'
import { TimelineVisualization, TimelineProgress } from '@/components/succession/displays/timeline-visualization'
import { requireRole } from '@/lib/auth'
import { format, differenceInDays } from 'date-fns'
import { SeedTimelineButton } from '@/components/succession/actions/seed-timeline-button'

export const metadata = {
  title: 'Timeline & Workflow | Admin',
  description: 'View and manage succession cycle timeline',
}

interface TimelineStep {
  id: string
  step_number: number
  step_name: string
  description: string | null
  start_date: string
  end_date: string
  status: 'pending' | 'active' | 'completed' | 'overdue'
  auto_trigger_action: string | null
}

async function TimelineContent() {
  const cycle = await getCurrentActiveCycle()

  if (!cycle) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
            <p className="text-lg font-medium">No Active Succession Cycle</p>
            <p className="text-sm mt-2">
              Create a succession cycle to view and manage the timeline.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const supabase = await createClient()

  // Fetch timeline steps for this cycle
  const { data: steps, error } = await supabase
    .from('succession_timeline_steps')
    .select('*')
    .eq('cycle_id', cycle.id)
    .order('step_number', { ascending: true })

  if (error) {
    console.error('Error fetching timeline steps:', error)
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-destructive">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium">Error Loading Timeline</p>
            <p className="text-sm mt-2">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const timelineSteps: TimelineStep[] = steps || []

  // Calculate cycle progress
  const now = new Date()
  const cycleStart = cycle.start_date ? new Date(cycle.start_date) : new Date()
  const cycleEnd = cycle.end_date ? new Date(cycle.end_date) : new Date()
  const totalDays = differenceInDays(cycleEnd, cycleStart)
  const elapsedDays = differenceInDays(now, cycleStart)
  const cycleProgressPercentage = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))

  // Find current step
  const currentStep = timelineSteps.find((step) => {
    const stepStart = new Date(step.start_date)
    const stepEnd = new Date(step.end_date)
    return now >= stepStart && now <= stepEnd
  })

  // Calculate statistics
  const totalSteps = timelineSteps.length
  const completedSteps = timelineSteps.filter((s) => s.status === 'completed').length
  const activeSteps = timelineSteps.filter((s) => s.status === 'active').length
  const overdueSteps = timelineSteps.filter((s) => s.status === 'overdue').length
  const pendingSteps = timelineSteps.filter((s) => s.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Cycle Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{cycle.cycle_name}</h2>
                <Badge variant={cycle.status === 'active' ? 'default' : 'secondary'}>
                  {cycle.status.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              <p className="text-muted-foreground">{cycle.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Start:</span>{' '}
                  <span className="font-medium">
                    {cycle.start_date && format(new Date(cycle.start_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">End:</span>{' '}
                  <span className="font-medium">
                    {cycle.end_date && format(new Date(cycle.end_date), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
            {timelineSteps.length === 0 && cycle.start_date && (
              <SeedTimelineButton cycleId={cycle.id} cycleStartDate={cycle.start_date} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Cycle Progress</span>
                <span className="text-sm text-muted-foreground">{cycleProgressPercentage}%</span>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 rounded-full"
                  style={{ width: `${cycleProgressPercentage}%` }}
                />
              </div>
            </div>

            {currentStep && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5 animate-pulse" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-blue-900">Current Step:</span>
                      <Badge className="bg-blue-600">
                        Week {currentStep.step_number}
                      </Badge>
                    </div>
                    <p className="text-sm text-blue-900 font-medium">
                      {currentStep.step_name}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {format(new Date(currentStep.start_date), 'MMM d')} -{' '}
                      {format(new Date(currentStep.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {timelineSteps.length > 0 && (
        <>
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Steps</p>
                    <p className="text-2xl font-bold">{totalSteps}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{completedSteps}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-blue-600">{activeSteps}</p>
                  </div>
                  <PlayCircle className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{overdueSteps}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-gray-600">{pendingSteps}</p>
                  </div>
                  <Clock className="h-8 w-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline Progress</CardTitle>
              <CardDescription>Overall workflow completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <TimelineProgress steps={timelineSteps} />
            </CardContent>
          </Card>

          {/* Timeline Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>7-Week Succession Workflow</CardTitle>
              <CardDescription>
                Automated timeline with key milestones and deadlines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimelineVisualization steps={timelineSteps} />
            </CardContent>
          </Card>
        </>
      )}

      {timelineSteps.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-blue-500" />
              <p className="text-lg font-medium">No Timeline Steps</p>
              <p className="text-sm mt-2 mb-6">
                This cycle doesn't have timeline steps yet. Click the button above to seed the
                standard 7-week workflow.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TimelineLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function TimelinePage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timeline & Workflow</h1>
        <p className="text-muted-foreground mt-2">
          View and track the 7-week succession cycle timeline with automated milestones
        </p>
      </div>

      <Suspense fallback={<TimelineLoading />}>
        <TimelineContent />
      </Suspense>
    </div>
  )
}
