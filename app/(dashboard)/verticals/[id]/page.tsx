/**
 * Vertical Dashboard Page
 *
 * Individual vertical performance dashboard with KPIs, activities, and analytics.
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  Clock,
  Target,
  Award,
  Settings,
  Plus,
} from 'lucide-react'
import {
  getVerticalById,
  getVerticalDashboard,
  getCurrentFiscalYear,
  getCurrentQuarter,
  getKPIAlerts,
} from '@/lib/data/vertical'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  QUARTER_LABELS,
  METRIC_TYPE_LABELS,
  ACTIVITY_TYPE_LABELS,
  ACHIEVEMENT_CATEGORY_LABELS,
} from '@/types/vertical'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function VerticalDashboardPage({ params }: PageProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <VerticalHeader params={params} />
      </Suspense>

      {/* Dashboard Content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent params={params} />
      </Suspense>
    </div>
  )
}

// Header Component
async function VerticalHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/verticals">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
            style={{ backgroundColor: vertical.color || '#3b82f6' }}
          >
            {vertical.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{vertical.name}</h1>
            {vertical.description && (
              <p className="text-sm text-muted-foreground">{vertical.description}</p>
            )}
          </div>
        </div>
        {vertical.is_active ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href={`/verticals/${id}/plan`}>
            <Target className="mr-2 h-4 w-4" />
            Manage Plan
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/verticals/${id}/settings`}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Dashboard Content Component
async function DashboardContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const fiscalYear = getCurrentFiscalYear()
  const currentQuarter = getCurrentQuarter()

  const dashboard = await getVerticalDashboard(id, fiscalYear)
  const alerts = await getKPIAlerts(id, currentQuarter)

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="kpis">KPIs</TabsTrigger>
        <TabsTrigger value="activities">Activities</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* KPI Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <Alert
                key={idx}
                variant={
                  alert.alert_type === 'danger'
                    ? 'destructive'
                    : alert.alert_type === 'warning'
                      ? 'default'
                      : 'default'
                }
              >
                <AlertTitle>{alert.kpi_name}</AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Current Chair */}
        {dashboard.current_chair && dashboard.current_chair.member && (
          <Card>
            <CardHeader>
              <CardTitle>Current Chair</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={dashboard.current_chair.member?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {dashboard.current_chair.member?.profile?.full_name?.charAt(0) || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{dashboard.current_chair.member?.profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{dashboard.current_chair.role}</p>
                  <p className="text-xs text-muted-foreground">
                    Since {new Date(dashboard.current_chair.start_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KPI Progress</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.kpi_summary.overall_completion_percentage.toFixed(1)}%
              </div>
              <Progress value={dashboard.kpi_summary.overall_completion_percentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.kpi_summary.completed} of {dashboard.kpi_summary.total_kpis} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget Used</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{(dashboard.budget_summary.spent / 1000).toFixed(1)}K
              </div>
              <Progress value={dashboard.budget_summary.utilization_percentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.budget_summary.utilization_percentage.toFixed(1)}% of ₹
                {(dashboard.budget_summary.allocated / 1000).toFixed(1)}K
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impact</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.impact_metrics.total_beneficiaries}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Beneficiaries from {dashboard.impact_metrics.total_activities} activities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volunteer Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.impact_metrics.total_volunteer_hours}</div>
              <p className="text-xs text-muted-foreground mt-2">
                Total hours contributed by {dashboard.active_member_count} members
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities & Achievements */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>Latest activities and events</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/verticals/${id}/activities`}>View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recent_activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No activities yet</p>
              ) : (
                <div className="space-y-4">
                  {dashboard.recent_activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="mt-1">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{activity.activity_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.activity_date).toLocaleDateString()} •{' '}
                          {ACTIVITY_TYPE_LABELS[activity.activity_type as keyof typeof ACTIVITY_TYPE_LABELS]}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{activity.beneficiaries_count} beneficiaries</span>
                          <span>{activity.volunteer_hours}h volunteer time</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Achievements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Achievements</CardTitle>
                <CardDescription>Notable accomplishments</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/verticals/${id}/achievements`}>View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {dashboard.recent_achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No achievements yet</p>
              ) : (
                <div className="space-y-4">
                  {dashboard.recent_achievements.map((achievement) => (
                    <div key={achievement.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="mt-1">
                        <Award className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{achievement.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(achievement.achievement_date).toLocaleDateString()}
                        </p>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {
                            ACHIEVEMENT_CATEGORY_LABELS[
                              achievement.category as keyof typeof ACHIEVEMENT_CATEGORY_LABELS
                            ]
                          }
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="kpis" className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>KPI Performance</CardTitle>
              <CardDescription>Track progress on key performance indicators</CardDescription>
            </div>
            <Button size="sm" asChild>
              <Link href={`/verticals/${id}/plan`}>
                <Plus className="mr-2 h-4 w-4" />
                Record Progress
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!dashboard.current_plan ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">No active plan for FY{fiscalYear}</p>
                <Button asChild>
                  <Link href={`/verticals/${id}/plan?new=true`}>Create Plan</Link>
                </Button>
              </div>
            ) : dashboard.current_plan.kpis && dashboard.current_plan.kpis.length > 0 ? (
              <div className="space-y-4">
                {dashboard.current_plan.kpis.map((kpi: any) => (
                  <div key={kpi.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{kpi.kpi_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {METRIC_TYPE_LABELS[kpi.metric_type as keyof typeof METRIC_TYPE_LABELS]} • Weight:{' '}
                          {kpi.weight}%
                        </p>
                      </div>
                      <Badge
                        variant={
                          kpi.completion_percentage >= 100
                            ? 'default'
                            : kpi.completion_percentage >= 75
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {kpi.completion_percentage?.toFixed(0)}%
                      </Badge>
                    </div>
                    <Progress value={kpi.completion_percentage || 0} className="mt-2" />
                    <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Q1</p>
                        <p className="font-medium">
                          {kpi.actuals?.q1?.actual_value || 0} / {kpi.target_q1}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Q2</p>
                        <p className="font-medium">
                          {kpi.actuals?.q2?.actual_value || 0} / {kpi.target_q2}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Q3</p>
                        <p className="font-medium">
                          {kpi.actuals?.q3?.actual_value || 0} / {kpi.target_q3}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Q4</p>
                        <p className="font-medium">
                          {kpi.actuals?.q4?.actual_value || 0} / {kpi.target_q4}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No KPIs defined yet</p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activities">
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Complete history of activities and events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Activity list will be implemented here
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="team">
        {/* Current Chair Section */}
        {dashboard.current_chair && dashboard.current_chair.member && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Vertical Chair
              </CardTitle>
              <CardDescription>Current leadership for this vertical</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={dashboard.current_chair.member?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {dashboard.current_chair.member?.profile?.full_name?.charAt(0) || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">
                    {dashboard.current_chair.member?.profile?.full_name || 'Unknown'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {dashboard.current_chair.member?.profile?.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge>{dashboard.current_chair.role === 'chair' ? 'Chair' : 'Co-Chair'}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Since {new Date(dashboard.current_chair.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Members Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>{dashboard.active_member_count} active members</CardDescription>
            </div>
            <Button size="sm" asChild>
              <Link href={`/verticals/${id}/members/assign`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard.members.filter((m) => m.is_active).length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">No team members assigned yet</p>
                <Button asChild>
                  <Link href={`/verticals/${id}/members/assign`}>Add Members</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.members
                  .filter((m) => m.is_active)
                  .map((member) => {
                    const displayName = member.member?.profile?.full_name || 'Unknown Member'
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.member?.avatar_url || undefined} />
                            <AvatarFallback>
                              {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{displayName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {member.role_in_vertical && (
                                <Badge variant="secondary">{member.role_in_vertical}</Badge>
                              )}
                              <span>
                                Joined {new Date(member.joined_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

// Loading Skeletons
function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-2 w-full mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
