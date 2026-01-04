'use client'

/**
 * Progress Tracking Dashboard Component
 *
 * Shows planned vs completed activities with % progress toward goals
 * for all verticals in the Pathfinder AAA framework.
 */

import {
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'
import type { PathfinderDashboard, VerticalAAAStatus } from '@/types/aaa'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface ProgressDashboardProps {
  dashboard: PathfinderDashboard
}

export function ProgressDashboard({ dashboard }: ProgressDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate progress status color
  const getProgressColor = (progress: number) => {
    if (progress >= 75) return 'text-green-600'
    if (progress >= 50) return 'text-blue-600'
    if (progress >= 25) return 'text-amber-600'
    return 'text-red-600'
  }

  const getProgressBg = (progress: number) => {
    if (progress >= 75) return 'bg-green-100'
    if (progress >= 50) return 'bg-blue-100'
    if (progress >= 25) return 'bg-amber-100'
    return 'bg-red-100'
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Activity Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', getProgressBg(dashboard.overall_activity_progress))}>
                  <Activity className={cn('h-5 w-5', getProgressColor(dashboard.overall_activity_progress))} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Activity Progress</p>
                  <p className={cn('text-2xl font-bold', getProgressColor(dashboard.overall_activity_progress))}>
                    {dashboard.overall_activity_progress}%
                  </p>
                </div>
              </div>
            </div>
            <Progress value={dashboard.overall_activity_progress} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{dashboard.total_completed_activities} completed</span>
              <span>of {dashboard.total_planned_activities} planned</span>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', getProgressBg(dashboard.overall_attendance_progress))}>
                  <Users className={cn('h-5 w-5', getProgressColor(dashboard.overall_attendance_progress))} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Goal</p>
                  <p className={cn('text-2xl font-bold', getProgressColor(dashboard.overall_attendance_progress))}>
                    {dashboard.overall_attendance_progress}%
                  </p>
                </div>
              </div>
            </div>
            <Progress value={dashboard.overall_attendance_progress} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{dashboard.total_actual_attendance.toLocaleString()} actual</span>
              <span>of {dashboard.total_target_attendance_goal.toLocaleString()} target</span>
            </div>
          </CardContent>
        </Card>

        {/* Verticals On Track */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">On Track</p>
                  <p className="text-2xl font-bold text-green-600">
                    {dashboard.verticals_on_track}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Verticals with 50%+ activity completion
            </p>
          </CardContent>
        </Card>

        {/* Verticals Behind */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-100">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Needs Attention</p>
                  <p className="text-2xl font-bold text-red-600">
                    {dashboard.verticals_behind}
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Verticals with less than 50% completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Vertical Progress */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Vertical Progress Details</CardTitle>
                <CardDescription>
                  Planned vs actual activities by vertical
                </CardDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {dashboard.verticals
                  .filter(v => v.has_plan)
                  .sort((a, b) => b.activity_progress - a.activity_progress)
                  .map((vertical) => (
                    <VerticalProgressRow key={vertical.vertical_id} vertical={vertical} />
                  ))}

                {/* Verticals without plans */}
                {dashboard.verticals.filter(v => !v.has_plan).length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">
                      Verticals without AAA plans:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dashboard.verticals
                        .filter(v => !v.has_plan)
                        .map(v => (
                          <Badge key={v.vertical_id} variant="outline" className="text-amber-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {v.vertical_name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>

          {/* Summary row when collapsed */}
          {!isExpanded && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {dashboard.verticals
                  .filter(v => v.has_plan)
                  .sort((a, b) => b.activity_progress - a.activity_progress)
                  .map((v) => (
                    <Badge
                      key={v.vertical_id}
                      variant="outline"
                      className={cn(
                        'gap-1',
                        v.activity_progress >= 75 && 'bg-green-50 border-green-200 text-green-700',
                        v.activity_progress >= 50 && v.activity_progress < 75 && 'bg-blue-50 border-blue-200 text-blue-700',
                        v.activity_progress >= 25 && v.activity_progress < 50 && 'bg-amber-50 border-amber-200 text-amber-700',
                        v.activity_progress < 25 && 'bg-red-50 border-red-200 text-red-700'
                      )}
                    >
                      <span className="text-sm">{v.vertical_icon || '📊'}</span>
                      {v.vertical_name}: {v.activity_progress}%
                    </Badge>
                  ))}
              </div>
            </CardContent>
          )}
        </Card>
      </Collapsible>
    </div>
  )
}

function VerticalProgressRow({ vertical }: { vertical: VerticalAAAStatus }) {
  const activityColor =
    vertical.activity_progress >= 75 ? 'text-green-600' :
    vertical.activity_progress >= 50 ? 'text-blue-600' :
    vertical.activity_progress >= 25 ? 'text-amber-600' : 'text-red-600'

  const attendanceColor =
    vertical.attendance_progress >= 75 ? 'text-green-600' :
    vertical.attendance_progress >= 50 ? 'text-blue-600' :
    vertical.attendance_progress >= 25 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${vertical.vertical_color}20` || '#6366f120' }}
        >
          <span className="text-lg">{vertical.vertical_icon || '📊'}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{vertical.vertical_name}</h4>
            {vertical.activity_progress >= 50 ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                On Track
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Needs Attention
              </Badge>
            )}
          </div>
          {vertical.ec_chair_name && (
            <p className="text-sm text-muted-foreground">{vertical.ec_chair_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Activities Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Activities</span>
            <span className={cn('font-medium', activityColor)}>
              {vertical.completed_activities}/{vertical.planned_activities} ({vertical.activity_progress}%)
            </span>
          </div>
          <Progress value={vertical.activity_progress} className="h-2" />
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Logged: {vertical.actual_activities}</span>
          </div>
        </div>

        {/* Attendance Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Attendance</span>
            <span className={cn('font-medium', attendanceColor)}>
              {vertical.actual_attendance.toLocaleString()}/{vertical.target_attendance.toLocaleString()} ({vertical.attendance_progress}%)
            </span>
          </div>
          <Progress value={vertical.attendance_progress} className="h-2" />
          {vertical.target_attendance === 0 && (
            <p className="text-xs text-muted-foreground italic">No targets set</p>
          )}
        </div>
      </div>

      {/* Activity breakdown */}
      <div className="flex gap-4 mt-3 pt-3 border-t">
        <div className="flex items-center gap-1 text-xs">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Awareness:</span>
          <span className="font-medium">{vertical.awareness_count}/3</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-muted-foreground">Action:</span>
          <span className="font-medium">{vertical.action_count}/2</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-muted-foreground">Advocacy:</span>
          <span className="font-medium">{vertical.advocacy_done ? '1/1' : '0/1'}</span>
        </div>
      </div>
    </div>
  )
}
