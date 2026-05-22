'use client'

/**
 * Health Card Tracking Dashboard Component
 *
 * Comprehensive dashboard for tracking health card submissions.
 * Shows submission rates, pending entries, quality scores, and alerts.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileCheck,
  FileWarning,
  Filter,
  Info,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import type {
  HealthCardTrackingDashboard,
  PendingSubmission,
  VerticalTrackingStatus,
  TrackingAlert,
  TrackingDashboardFilters,
} from '@/types/health-card-tracking'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface HealthCardTrackingDashboardProps {
  dashboard: HealthCardTrackingDashboard
  alerts: TrackingAlert[]
  onFilterChange?: (filters: TrackingDashboardFilters) => void
}

// Status badge colors
const statusColors: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  good: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  needs_attention: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// Urgency badge colors
const urgencyColors: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  urgent: 'bg-orange-500 text-white',
  normal: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
}

// Alert severity colors
const alertSeverityColors: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50 dark:bg-red-950',
  warning: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950',
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950',
}

export function HealthCardTrackingDashboardComponent({
  dashboard,
  alerts,
  onFilterChange,
}: HealthCardTrackingDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'verticals'>('overview')
  const [periodFilter, setPeriodFilter] = useState<string>('month')

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value)
    onFilterChange?.({ period: value as TrackingDashboardFilters['period'] })
  }

  // Calculate trend icon
  const getTrendIcon = (current: number, target: number = 80) => {
    if (current >= target) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (current >= target * 0.7) return <Activity className="h-4 w-4 text-yellow-500" />
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with period filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Health Card Tracking</h2>
            <p className="text-muted-foreground">
              {dashboard.period.label} • Generated {new Date(dashboard.generated_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodFilter} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Critical Alerts Banner */}
        {alerts.filter(a => a.severity === 'critical').length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-red-900 dark:text-red-100">
                    {alerts.filter(a => a.severity === 'critical').length} Critical Alert(s)
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {alerts.filter(a => a.severity === 'critical')[0]?.title}
                  </p>
                </div>
                <Button variant="destructive" size="sm" asChild>
                  <Link href="#alerts">View All</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Submission Rate */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Submission Rate</p>
                  <p className="text-3xl font-bold">{dashboard.summary.overall_submission_rate}%</p>
                </div>
                <div className={cn(
                  "p-3 rounded-full",
                  dashboard.summary.overall_submission_rate >= 80
                    ? "bg-green-100"
                    : dashboard.summary.overall_submission_rate >= 60
                      ? "bg-yellow-100"
                      : "bg-red-100"
                )}>
                  <FileCheck className={cn(
                    "h-5 w-5",
                    dashboard.summary.overall_submission_rate >= 80
                      ? "text-green-600"
                      : dashboard.summary.overall_submission_rate >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                  )} />
                </div>
              </div>
              <Progress
                value={dashboard.summary.overall_submission_rate}
                className="mt-3 h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.summary.total_submissions} of {dashboard.summary.total_events} events
              </p>
            </CardContent>
          </Card>

          {/* Quality Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Quality Score</p>
                  <p className="text-3xl font-bold">{dashboard.summary.overall_quality_score}</p>
                </div>
                <div className={cn(
                  "p-3 rounded-full",
                  dashboard.summary.overall_quality_score >= 75
                    ? "bg-green-100"
                    : dashboard.summary.overall_quality_score >= 60
                      ? "bg-yellow-100"
                      : "bg-red-100"
                )}>
                  <Target className={cn(
                    "h-5 w-5",
                    dashboard.summary.overall_quality_score >= 75
                      ? "text-green-600"
                      : dashboard.summary.overall_quality_score >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                  )} />
                </div>
              </div>
              <Progress
                value={dashboard.summary.overall_quality_score}
                className="mt-3 h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Grade: {dashboard.quality.avg_quality_score >= 90 ? 'A' :
                        dashboard.quality.avg_quality_score >= 75 ? 'B' :
                        dashboard.quality.avg_quality_score >= 60 ? 'C' :
                        dashboard.quality.avg_quality_score >= 40 ? 'D' : 'F'}
              </p>
            </CardContent>
          </Card>

          {/* Pending Submissions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold">{dashboard.summary.pending_count}</p>
                </div>
                <div className={cn(
                  "p-3 rounded-full",
                  dashboard.summary.pending_count === 0
                    ? "bg-green-100"
                    : dashboard.summary.pending_count <= 3
                      ? "bg-yellow-100"
                      : "bg-red-100"
                )}>
                  <FileWarning className={cn(
                    "h-5 w-5",
                    dashboard.summary.pending_count === 0
                      ? "text-green-600"
                      : dashboard.summary.pending_count <= 3
                        ? "text-yellow-600"
                        : "text-red-600"
                  )} />
                </div>
              </div>
              {dashboard.summary.overdue_count > 0 && (
                <div className="mt-3 flex items-center gap-1 text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">{dashboard.summary.overdue_count} overdue</span>
                </div>
              )}
              {dashboard.summary.pending_count === 0 && (
                <div className="mt-3 flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">All caught up!</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeliness Rate */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">On-Time Rate</p>
                  <p className="text-3xl font-bold">{dashboard.timeliness.on_time_rate}%</p>
                </div>
                <div className={cn(
                  "p-3 rounded-full",
                  dashboard.timeliness.on_time_rate >= 80
                    ? "bg-green-100"
                    : dashboard.timeliness.on_time_rate >= 60
                      ? "bg-yellow-100"
                      : "bg-red-100"
                )}>
                  <Clock className={cn(
                    "h-5 w-5",
                    dashboard.timeliness.on_time_rate >= 80
                      ? "text-green-600"
                      : dashboard.timeliness.on_time_rate >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                  )} />
                </div>
              </div>
              <Progress
                value={dashboard.timeliness.on_time_rate}
                className="mt-3 h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Avg: {Math.round(dashboard.timeliness.avg_hours_to_submit)}h to submit
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="pending">
              <FileWarning className="h-4 w-4 mr-2" />
              Pending ({dashboard.summary.pending_count})
            </TabsTrigger>
            <TabsTrigger value="verticals">
              <Target className="h-4 w-4 mr-2" />
              By Vertical
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Alerts Section */}
            {alerts.length > 0 && (
              <Card id="alerts">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Alerts ({alerts.length})
                  </CardTitle>
                  <CardDescription>Action items requiring attention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-3 rounded-lg border-l-4",
                        alertSeverityColors[alert.severity]
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                        </div>
                        {alert.action_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={alert.action_url}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Trend</CardTitle>
                <CardDescription>Submission rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.monthly_trend.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.monthly_trend.slice(-6).map((month) => (
                      <div key={month.month} className="flex items-center gap-4">
                        <span className="w-20 text-sm text-muted-foreground">
                          {new Date(month.month + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' })}
                        </span>
                        <div className="flex-1">
                          <Progress value={month.rate} className="h-2" />
                        </div>
                        <span className="w-16 text-sm font-medium text-right">
                          {month.rate}%
                        </span>
                        <span className="w-24 text-xs text-muted-foreground text-right">
                          {month.submitted_count}/{month.events_count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No trend data available yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quality Insights */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.quality.strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {dashboard.quality.strengths.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Keep submitting to build strengths</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-amber-600">Areas for Improvement</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboard.quality.improvement_areas.length > 0 ? (
                    <ul className="space-y-2">
                      {dashboard.quality.improvement_areas.map((area, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{area}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No improvement areas identified</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Pending Tab */}
          <TabsContent value="pending" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Submissions</CardTitle>
                <CardDescription>
                  Events requiring health card submission
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.pending_submissions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Vertical</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time Elapsed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.pending_submissions.map((pending) => (
                        <TableRow key={pending.event_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{pending.event_name}</p>
                              {pending.aaa_type && (
                                <Badge variant="outline" className="mt-1">
                                  {pending.aaa_type}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{pending.vertical_name}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(pending.event_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.round(pending.hours_since_event)}h ago
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={urgencyColors[pending.urgency]}>
                              {pending.is_overdue ? 'Overdue' : pending.urgency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" asChild>
                              <Link href={`/pathfinder/health-card?event=${pending.event_id}`}>
                                Submit
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium">All Caught Up!</p>
                    <p className="text-muted-foreground">No pending submissions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Verticals Tab */}
          <TabsContent value="verticals" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboard.verticals.map((vertical) => (
                <Card key={vertical.vertical_id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{vertical.icon}</span>
                        {vertical.vertical_name}
                      </CardTitle>
                      <Badge className={statusColors[vertical.status]}>
                        {vertical.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Submission Rate */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Submission Rate</span>
                        <span className="font-medium">{vertical.submission_rate}%</span>
                      </div>
                      <Progress value={vertical.submission_rate} className="h-2" />
                    </div>

                    {/* Quality Score */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Quality Score</span>
                        <span className="font-medium">{vertical.quality_score}</span>
                      </div>
                      <Progress value={vertical.quality_score} className="h-2" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Events</p>
                        <p className="text-lg font-semibold">
                          {vertical.submitted_events}/{vertical.total_events}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Participants</p>
                        <p className="text-lg font-semibold flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {vertical.total_participants}
                        </p>
                      </div>
                    </div>

                    {/* Pending/Overdue */}
                    {(vertical.pending_events > 0 || vertical.overdue_events > 0) && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        {vertical.pending_events > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1">
                                <FileWarning className="h-3 w-3" />
                                {vertical.pending_events} pending
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>Events awaiting submission</TooltipContent>
                          </Tooltip>
                        )}
                        {vertical.overdue_events > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {vertical.overdue_events} overdue
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>More than 48h since event</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}

                    {/* Last Activity */}
                    {vertical.last_activity_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2">
                        <Calendar className="h-3 w-3" />
                        Last: {new Date(vertical.last_activity_date).toLocaleDateString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
