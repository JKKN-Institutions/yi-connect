import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Award,
  Users,
  FileText,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserPlus,
  ClipboardList,
  Settings,
  History,
  Vote,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { createClient } from '@/lib/supabase/server'
import {
  getCurrentActiveCycle,
  getSuccessionPositions,
  getTimelineSteps,
  getMyNominations,
  getMyApplications,
  getNominationsForMe,
  isSuccessionAdmin,
} from '@/lib/data/succession'
import { requireRole } from '@/lib/auth'
import { format, differenceInDays, isWithinInterval } from 'date-fns'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Succession & Leadership Pipeline | Yi Connect',
  description: 'Manage leadership succession cycles, nominations, and selection processes',
}

// Status badge component
function CycleStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    active: { label: 'Active', variant: 'default' },
    nominations_open: { label: 'Nominations Open', variant: 'default' },
    nominations_closed: { label: 'Nominations Closed', variant: 'secondary' },
    applications_open: { label: 'Applications Open', variant: 'default' },
    applications_closed: { label: 'Applications Closed', variant: 'secondary' },
    evaluations: { label: 'Evaluations', variant: 'default' },
    evaluations_closed: { label: 'Evaluations Closed', variant: 'secondary' },
    interviews: { label: 'Interviews', variant: 'default' },
    interviews_closed: { label: 'Interviews Closed', variant: 'secondary' },
    selection: { label: 'Selection', variant: 'default' },
    approval_pending: { label: 'Approval Pending', variant: 'outline' },
    completed: { label: 'Completed', variant: 'secondary' },
    archived: { label: 'Archived', variant: 'secondary' },
  }

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Timeline step indicator
function TimelineStepIndicator({ steps }: { steps: any[] }) {
  const now = new Date()

  const currentStep = steps.find((step) => {
    const startDate = new Date(step.start_date)
    const endDate = new Date(step.end_date)
    return isWithinInterval(now, { start: startDate, end: endDate })
  })

  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const totalSteps = steps.length
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Timeline Progress</span>
        <span className="text-sm text-muted-foreground">{progressPercentage}%</span>
      </div>
      <Progress value={progressPercentage} className="h-2" />

      {currentStep && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-sm font-medium text-blue-900">
              Week {currentStep.step_number}: {currentStep.step_name}
            </span>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            {format(new Date(currentStep.start_date), 'MMM d')} -{' '}
            {format(new Date(currentStep.end_date), 'MMM d, yyyy')}
          </p>
        </div>
      )}

      <div className="flex gap-1">
        {steps.map((step, index) => {
          const isCurrent = currentStep?.id === step.id
          const isCompleted = step.status === 'completed'
          const isOverdue = step.status === 'overdue'

          return (
            <div
              key={step.id}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                isCompleted && 'bg-green-500',
                isCurrent && 'bg-blue-500 animate-pulse',
                isOverdue && 'bg-red-500',
                !isCompleted && !isCurrent && !isOverdue && 'bg-gray-200'
              )}
              title={`Week ${step.step_number}: ${step.step_name}`}
            />
          )
        })}
      </div>
    </div>
  )
}

// Quick action card component
function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  disabled = false,
  badge,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  disabled?: boolean
  badge?: string
}) {
  const content = (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-md',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {badge && (
                <Badge variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  )

  if (disabled) {
    return content
  }

  return <Link href={href}>{content}</Link>
}

// Stats card
function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; label: string }
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trend && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {trend.label}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function SuccessionContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all data in parallel
  const [activeCycle, isAdmin, myNominations, myApplications, nominationsForMe] = await Promise.all([
    getCurrentActiveCycle(),
    isSuccessionAdmin(),
    getMyNominations(),
    getMyApplications(),
    getNominationsForMe(),
  ])

  // If there's an active cycle, get positions and timeline
  let positions: any[] = []
  let timelineSteps: any[] = []
  let cycleStats = { nominations: 0, applications: 0, positions: 0 }

  if (activeCycle) {
    const [positionsData, timelineData] = await Promise.all([
      getSuccessionPositions(activeCycle.id),
      getTimelineSteps(activeCycle.id),
    ])
    positions = positionsData
    timelineSteps = timelineData

    // Get cycle statistics
    const { count: nominationCount } = await supabase
      .from('succession_nominations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', activeCycle.id)

    const { count: applicationCount } = await supabase
      .from('succession_applications')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', activeCycle.id)

    cycleStats = {
      nominations: nominationCount || 0,
      applications: applicationCount || 0,
      positions: positions.length,
    }
  }

  // Check action availability based on cycle status
  const canNominate = activeCycle?.status === 'nominations_open'
  const canApply = activeCycle?.status === 'applications_open'

  // Count pending items for user
  const pendingNominationsForMe = nominationsForMe.filter((n) => n.status === 'submitted').length

  return (
    <div className="space-y-8">
      {/* Active Cycle Overview */}
      {activeCycle ? (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{activeCycle.cycle_name}</CardTitle>
                  <CycleStatusBadge status={activeCycle.status} />
                </div>
                <CardDescription className="mt-2">
                  {activeCycle.description || `Leadership succession cycle for ${activeCycle.year}`}
                </CardDescription>
              </div>
              {isAdmin && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/succession/admin/cycles/${activeCycle.id}`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Cycle
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cycle dates */}
            {(activeCycle.start_date || activeCycle.end_date) && (
              <div className="flex items-center gap-6 text-sm">
                {activeCycle.start_date && (
                  <div>
                    <span className="text-muted-foreground">Start:</span>{' '}
                    <span className="font-medium">
                      {format(new Date(activeCycle.start_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {activeCycle.end_date && (
                  <div>
                    <span className="text-muted-foreground">End:</span>{' '}
                    <span className="font-medium">
                      {format(new Date(activeCycle.end_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {activeCycle.end_date && (
                  <div>
                    <span className="text-muted-foreground">Days Remaining:</span>{' '}
                    <span className="font-medium">
                      {Math.max(0, differenceInDays(new Date(activeCycle.end_date), new Date()))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Timeline Progress */}
            {timelineSteps.length > 0 && <TimelineStepIndicator steps={timelineSteps} />}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <StatsCard title="Open Positions" value={cycleStats.positions} icon={Award} />
              <StatsCard title="Nominations" value={cycleStats.nominations} icon={Users} />
              <StatsCard title="Applications" value={cycleStats.applications} icon={FileText} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Active Succession Cycle</p>
              <p className="text-sm mt-2">
                There is no succession cycle currently in progress.
              </p>
              {isAdmin && (
                <Button asChild className="mt-4">
                  <Link href="/succession/admin/cycles/new">Create New Cycle</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions for Members */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            href="/succession/nominate"
            icon={UserPlus}
            title="Nominate a Member"
            description="Recommend a qualified member for leadership"
            disabled={!canNominate}
            badge={canNominate ? 'Open' : 'Closed'}
          />
          <QuickActionCard
            href="/succession/apply"
            icon={FileText}
            title="Apply for Position"
            description="Submit your application for a leadership role"
            disabled={!canApply}
            badge={canApply ? 'Open' : 'Closed'}
          />
          <QuickActionCard
            href="/succession/eligibility"
            icon={CheckCircle2}
            title="Check Eligibility"
            description="View your eligibility for available positions"
          />
        </div>
      </div>

      {/* My Activity Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* My Nominations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">My Nominations</CardTitle>
              <CardDescription>Members you have nominated</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/succession/nominations">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {myNominations.length > 0 ? (
              <div className="space-y-3">
                {myNominations.slice(0, 3).map((nomination: any) => (
                  <div
                    key={nomination.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">
                        {nomination.nominee?.first_name} {nomination.nominee?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {nomination.position?.title}
                      </p>
                    </div>
                    <Badge
                      variant={nomination.status === 'approved' ? 'default' : 'secondary'}
                    >
                      {nomination.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                You haven't made any nominations yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Nominations For Me */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Nominations For Me
                {pendingNominationsForMe > 0 && (
                  <Badge variant="destructive">{pendingNominationsForMe} new</Badge>
                )}
              </CardTitle>
              <CardDescription>You have been nominated for</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/succession/nominations">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {nominationsForMe.length > 0 ? (
              <div className="space-y-3">
                {nominationsForMe.slice(0, 3).map((nomination: any) => (
                  <div
                    key={nomination.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{nomination.position?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        By {nomination.nominator?.first_name} {nomination.nominator?.last_name}
                      </p>
                    </div>
                    <Badge
                      variant={nomination.status === 'approved' ? 'default' : 'secondary'}
                    >
                      {nomination.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No one has nominated you yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* My Applications */}
      {myApplications.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">My Applications</CardTitle>
              <CardDescription>Your submitted applications</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/succession/applications">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myApplications.slice(0, 3).map((application: any) => (
                <div
                  key={application.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{application.position?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {application.cycle?.cycle_name}
                    </p>
                  </div>
                  <Badge
                    variant={application.status === 'approved' ? 'default' : 'secondary'}
                  >
                    {application.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Quick Access */}
      {isAdmin && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Administration</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              href="/succession/admin/cycles"
              icon={Calendar}
              title="Manage Cycles"
              description="Create and manage succession cycles"
            />
            <QuickActionCard
              href="/succession/admin/nominations"
              icon={ClipboardList}
              title="Review Nominations"
              description="Approve or reject nominations"
            />
            <QuickActionCard
              href="/succession/admin/meetings"
              icon={Vote}
              title="Meetings & Voting"
              description="Schedule meetings and capture votes"
            />
            <QuickActionCard
              href="/succession/admin/timeline"
              icon={Clock}
              title="Timeline"
              description="View and manage the 7-week workflow"
            />
            <QuickActionCard
              href="/succession/admin/evaluators"
              icon={Users}
              title="Evaluators"
              description="Assign and manage evaluators"
            />
            <QuickActionCard
              href="/succession/admin/approaches"
              icon={UserPlus}
              title="Candidate Approaches"
              description="Track outreach to selected candidates"
            />
            <QuickActionCard
              href="/succession/admin/applications"
              icon={FileText}
              title="Applications"
              description="Review self-applications"
            />
            <QuickActionCard
              href="/succession/knowledge-base"
              icon={History}
              title="Knowledge Base"
              description="Historical data and insights"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SuccessionLoading() {
  return (
    <div className="space-y-8">
      {/* Active Cycle Skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Skeleton */}
      <div>
        <Skeleton className="h-7 w-32 mb-4" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>

      {/* Activity Skeleton */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function SuccessionPage() {
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member',
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Succession & Leadership Pipeline</h1>
        <p className="text-muted-foreground mt-2">
          Manage leadership succession, nominations, and selection processes
        </p>
      </div>

      <Suspense fallback={<SuccessionLoading />}>
        <SuccessionContent />
      </Suspense>
    </div>
  )
}
