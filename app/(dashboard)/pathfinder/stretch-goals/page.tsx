/**
 * Stretch Goals Management Page
 *
 * Set ambitious targets beyond CMP minimums
 */

import Link from 'next/link'
import {
  Plus,
  Rocket,
  Trophy,
  Target,
  TrendingUp,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import { getStretchGoals, getStretchGoalsSummary } from '@/lib/data/stretch-goals'
import { getCMPTargets } from '@/lib/data/cmp-targets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getCurrentFiscalYear, formatFiscalYear } from '@/types/cmp-targets'
import {
  getStretchProgressStatus,
  getStretchProgressColor,
  getStretchBadgeText,
  type StretchGoalProgress,
} from '@/types/stretch-goals'

export const metadata = {
  title: 'Stretch Goals - Pathfinder',
  description: 'Set ambitious targets beyond CMP minimums',
}

export default async function StretchGoalsPage() {
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
  const canManageGoals =
    userRoles.includes('Chair') ||
    userRoles.includes('Super Admin') ||
    userRoles.includes('National Admin') ||
    userRoles.includes('Co-Chair')

  const currentFiscalYear = getCurrentFiscalYear()

  // Get stretch goals and summary
  const [stretchGoals, summary, cmpTargets] = await Promise.all([
    getStretchGoals({ fiscal_year: currentFiscalYear }),
    getStretchGoalsSummary(chapterId, currentFiscalYear),
    getCMPTargets({ fiscal_year: currentFiscalYear }),
  ])

  const hasStretchGoals = stretchGoals.length > 0
  const hasCMPTargets = cmpTargets.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-6 w-6 text-purple-600" />
            Stretch Goals
          </h1>
          <p className="text-muted-foreground">
            Ambitious targets beyond CMP minimums for {formatFiscalYear(currentFiscalYear)}
          </p>
        </div>
        {canManageGoals && (
          <Button asChild>
            <Link href="/pathfinder/stretch-goals/new">
              <Plus className="mr-2 h-4 w-4" />
              Set Stretch Goal
            </Link>
          </Button>
        )}
      </div>

      {/* No CMP Targets Alert */}
      {!hasCMPTargets && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>CMP Targets Required</AlertTitle>
          <AlertDescription>
            You need to set CMP targets before creating stretch goals.{' '}
            <Link href="/pathfinder/cmp-targets/new" className="underline font-medium">
              Set CMP Targets first →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {hasStretchGoals && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stretch Goals</CardTitle>
              <Rocket className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalStretchGoals}</div>
              <p className="text-xs text-muted-foreground">
                Beyond CMP targets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Achieved</CardTitle>
              <Trophy className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {summary.achievedCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Stretch targets met
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {summary.inProgressCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Working towards stretch
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Achievement Rate</CardTitle>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalStretchGoals > 0
                  ? Math.round((summary.achievedCount / summary.totalStretchGoals) * 100)
                  : 0}%
              </div>
              <Progress
                value={
                  summary.totalStretchGoals > 0
                    ? (summary.achievedCount / summary.totalStretchGoals) * 100
                    : 0
                }
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Stretch Goals Alert */}
      {!hasStretchGoals && hasCMPTargets && (
        <Alert>
          <Rocket className="h-4 w-4" />
          <AlertTitle>No stretch goals set</AlertTitle>
          <AlertDescription>
            Push your chapter further! Set stretch goals to go beyond CMP minimums.
            {canManageGoals && (
              <>
                {' '}
                <Link href="/pathfinder/stretch-goals/new" className="underline font-medium">
                  Create stretch goals →
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Stretch Goal Progress Cards */}
      {summary.progressItems.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Progress by Vertical</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summary.progressItems.map((progress: StretchGoalProgress) => {
              const status = getStretchProgressStatus(progress)
              const colorClass = getStretchProgressColor(status)
              const badgeText = getStretchBadgeText(progress)

              return (
                <Card
                  key={progress.stretch_goal_id}
                  className={progress.is_achieved ? 'border-emerald-500 bg-emerald-50/50' : ''}
                >
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
                        variant={progress.is_achieved ? 'default' : 'outline'}
                        className={colorClass}
                      >
                        {badgeText}
                      </Badge>
                    </div>
                    {progress.goal_name !== 'Stretch Goal' && (
                      <CardDescription>{progress.goal_name}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* CMP vs Stretch comparison */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>CMP Target</span>
                        <span>Stretch Target</span>
                      </div>

                      {/* Activities */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Activities</span>
                          <span className="font-medium">
                            {progress.actual_activities} / {progress.stretch_activities}
                          </span>
                        </div>
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          {/* CMP threshold marker */}
                          <div
                            className="absolute h-full w-0.5 bg-amber-500 z-10"
                            style={{
                              left: `${Math.min((progress.cmp_activities / progress.stretch_activities) * 100, 100)}%`,
                            }}
                          />
                          {/* Actual progress */}
                          <div
                            className={`h-full transition-all ${
                              progress.stretch_progress_pct >= 100
                                ? 'bg-emerald-500'
                                : progress.cmp_progress_pct >= 100
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{
                              width: `${Math.min(progress.stretch_progress_pct, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{progress.cmp_activities} CMP</span>
                          <span>{progress.stretch_activities} Stretch</span>
                        </div>
                      </div>

                      {/* Participants */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Participants</span>
                          <span className="font-medium">
                            {progress.actual_participants} / {progress.stretch_participants}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(
                            (progress.actual_participants / progress.stretch_participants) * 100,
                            100
                          )}
                          className="h-2"
                        />
                      </div>
                    </div>

                    {/* Reward description */}
                    {progress.reward_description && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          <Trophy className="inline h-3 w-3 mr-1" />
                          {progress.reward_description}
                        </p>
                      </div>
                    )}

                    {/* Achieved badge */}
                    {progress.is_achieved && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium text-emerald-600">
                          Stretch Goal Achieved!
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* All Stretch Goals Table */}
      {stretchGoals.length > 0 && canManageGoals && (
        <Card>
          <CardHeader>
            <CardTitle>All Stretch Goals</CardTitle>
            <CardDescription>
              Manage stretch targets for each vertical
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stretchGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: goal.vertical?.color || '#6b7280' }}
                    />
                    <div>
                      <p className="font-medium">
                        {goal.vertical?.name}
                        {goal.name !== 'Stretch Goal' && ` - ${goal.name}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {goal.stretch_activities} activities •{' '}
                        {goal.stretch_participants} participants •{' '}
                        {goal.stretch_ec_participation} EC members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {goal.is_achieved && (
                      <Badge className="bg-emerald-500">
                        <Trophy className="h-3 w-3 mr-1" />
                        Achieved
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/pathfinder/stretch-goals/${goal.id}`}>
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
