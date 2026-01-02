/**
 * CMP Targets Management Page
 *
 * Manage Common Minimum Program targets per vertical
 */

import Link from 'next/link'
import { Plus, Target, TrendingUp, Users, AlertCircle } from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import { getCMPTargets, getCMPProgressSummary } from '@/lib/data/cmp-targets'
import { getVerticalsForForm } from '@/lib/data/health-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  calculateOverallProgress,
  getProgressStatus,
  getProgressColor,
  FISCAL_YEAR_OPTIONS,
  type CMPProgress,
  type CMPTarget,
} from '@/types/cmp-targets'

export const metadata = {
  title: 'CMP Targets - Pathfinder',
  description: 'Manage Common Minimum Program targets per vertical',
}

export default async function CMPTargetsPage() {
  const { user, roles } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Vertical Head',
    'Executive Member',
  ])

  const chapterId = await getCurrentChapterId()
  const userRoles = roles || []
  const canManageTargets =
    userRoles.includes('Chair') ||
    userRoles.includes('Super Admin') ||
    userRoles.includes('National Admin')

  const currentYear = new Date().getFullYear()

  // Get targets and progress
  const [targets, progressSummary] = await Promise.all([
    getCMPTargets({ fiscal_year: currentYear }),
    chapterId
      ? getCMPProgressSummary(chapterId, currentYear)
      : { totalTargets: 0, completedTargets: 0, inProgressTargets: 0, overallProgress: 0, verticalProgress: [] },
  ])

  const hasTargets = targets.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CMP Targets</h1>
          <p className="text-muted-foreground">
            Common Minimum Program targets for FY {currentYear}-{currentYear + 1}
          </p>
        </div>
        {canManageTargets && (
          <Button asChild>
            <Link href="/pathfinder/cmp-targets/new">
              <Plus className="mr-2 h-4 w-4" />
              Set Targets
            </Link>
          </Button>
        )}
      </div>

      {/* Progress Summary */}
      {hasTargets && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressSummary.overallProgress}%</div>
              <Progress value={progressSummary.overallProgress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verticals Tracked</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressSummary.totalTargets}</div>
              <p className="text-xs text-muted-foreground">
                With active targets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Badge variant="outline" className="text-green-600 border-green-600">
                100%+
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {progressSummary.completedTargets}
              </div>
              <p className="text-xs text-muted-foreground">
                Verticals at or above target
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                1-99%
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {progressSummary.inProgressTargets}
              </div>
              <p className="text-xs text-muted-foreground">
                Verticals with some progress
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Targets Alert */}
      {!hasTargets && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No targets set</AlertTitle>
          <AlertDescription>
            CMP targets haven&apos;t been set for this fiscal year yet.
            {canManageTargets
              ? ' Click "Set Targets" to create targets for each vertical.'
              : ' Please contact your Chapter Chair to set targets.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Vertical Progress Cards */}
      {progressSummary.verticalProgress.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress by Vertical</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {progressSummary.verticalProgress.map((progress: CMPProgress) => {
              const overallPct = calculateOverallProgress(progress)
              const status = getProgressStatus(overallPct)
              const colorClass = getProgressColor(status)

              return (
                <Card key={progress.target_id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: progress.vertical_color || '#6b7280' }}
                        />
                        {progress.vertical_name}
                      </CardTitle>
                      <Badge
                        variant={status === 'completed' || status === 'exceeded' ? 'default' : 'outline'}
                        className={colorClass}
                      >
                        {overallPct}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Activities */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Activities</span>
                        <span className="font-medium">
                          {progress.actual_activities} / {progress.min_activities}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(progress.activity_progress_pct, 100)}
                        className="h-2"
                      />
                    </div>

                    {/* Participants */}
                    {progress.min_participants > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Participants</span>
                          <span className="font-medium">
                            {progress.actual_participants} / {progress.min_participants}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(progress.participant_progress_pct, 100)}
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* AAA Breakdown */}
                    {(progress.awareness_count > 0 ||
                      progress.action_count > 0 ||
                      progress.advocacy_count > 0) && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Badge variant="secondary" className="text-xs">
                          A1: {progress.awareness_count}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          A2: {progress.action_count}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          A3: {progress.advocacy_count}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* All Targets Table */}
      {targets.length > 0 && canManageTargets && (
        <Card>
          <CardHeader>
            <CardTitle>All Targets</CardTitle>
            <CardDescription>
              Manage targets for each vertical
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {targets.map((target: CMPTarget) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: target.vertical?.color || '#6b7280' }}
                    />
                    <div>
                      <p className="font-medium">{target.vertical?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {target.min_activities} activities •{' '}
                        {target.min_participants} participants •{' '}
                        {target.min_ec_participation} EC members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {target.is_national_target && (
                      <Badge variant="outline">National</Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/pathfinder/cmp-targets/${target.id}`}>
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
