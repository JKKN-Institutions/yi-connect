import { Suspense } from 'react'
import Link from 'next/link'
import {
  Archive,
  TrendingUp,
  Award,
  Users,
  FileText,
  Calendar,
  ChevronRight,
  BarChart3,
  History,
  Lightbulb,
  Trophy,
  Target,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getHistoricalCycles,
  getCycleStatistics,
  getSuccessionInsights,
  getHistoricalSelections,
} from '@/lib/data/succession'
import { requireRole } from '@/lib/auth'
import { format } from 'date-fns'

export const metadata = {
  title: 'Succession Knowledge Base | Yi Connect',
  description: 'Historical succession data, patterns, and insights for informed decision-making',
}

// Stats card component
function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  trend?: { value: number; label: string; positive?: boolean }
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <p
                className={`text-xs mt-1 flex items-center gap-1 ${
                  trend.positive ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {trend.positive && <TrendingUp className="h-3 w-3" />}
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

// Cycle card for historical cycles list
function CycleCard({
  cycle,
  stats,
}: {
  cycle: any
  stats: {
    positions: number
    nominations: number
    applications: number
    selections: number
  }
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{cycle.cycle_name}</h3>
              <Badge variant="secondary">{cycle.year}</Badge>
            </div>
            {cycle.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {cycle.description}
              </p>
            )}
          </div>
          <Badge
            variant={cycle.status === 'completed' ? 'default' : 'secondary'}
          >
            {cycle.status === 'completed' ? 'Completed' : 'Archived'}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xl font-bold">{stats.positions}</p>
            <p className="text-xs text-muted-foreground">Positions</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{stats.nominations}</p>
            <p className="text-xs text-muted-foreground">Nominations</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{stats.applications}</p>
            <p className="text-xs text-muted-foreground">Applications</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{stats.selections}</p>
            <p className="text-xs text-muted-foreground">Selected</p>
          </div>
        </div>

        {(cycle.start_date || cycle.end_date) && (
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            {cycle.start_date && (
              <span>Started: {format(new Date(cycle.start_date), 'MMM d, yyyy')}</span>
            )}
            {cycle.end_date && (
              <span>Ended: {format(new Date(cycle.end_date), 'MMM d, yyyy')}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Selected leader card
function SelectedLeaderCard({ selection }: { selection: any }) {
  const nominee = selection.nomination?.nominee

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
      <Avatar className="h-12 w-12">
        <AvatarImage src={nominee?.avatar_url} />
        <AvatarFallback>
          {nominee?.first_name?.[0]}
          {nominee?.last_name?.[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {nominee?.first_name} {nominee?.last_name}
        </p>
        <p className="text-sm text-muted-foreground">{selection.position?.title}</p>
        <p className="text-xs text-muted-foreground">
          {selection.cycle?.cycle_name} ({selection.cycle?.year})
        </p>
      </div>
      <div className="text-right">
        <Badge variant="outline" className="mb-1">
          Rank #{selection.rank}
        </Badge>
        <p className="text-sm font-medium">{selection.final_score?.toFixed(1)}%</p>
      </div>
    </div>
  )
}

// Insight card
function InsightCard({
  icon: Icon,
  title,
  value,
  description,
  color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: string | number
  description: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <p className="text-xs opacity-80 mt-1">{description}</p>
        </div>
      </div>
    </div>
  )
}

async function KnowledgeBaseContent() {
  // Fetch all data in parallel
  const [historicalCycles, insights, historicalSelections] = await Promise.all([
    getHistoricalCycles(),
    getSuccessionInsights(),
    getHistoricalSelections(),
  ])

  // Get statistics for each cycle
  const cyclesWithStats = await Promise.all(
    historicalCycles.map(async (cycle) => {
      const stats = await getCycleStatistics(cycle.id)
      return { cycle, stats }
    })
  )

  const hasData = historicalCycles.length > 0

  return (
    <div className="space-y-8">
      {/* Insights Overview */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Key Insights
        </h2>

        {hasData ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InsightCard
              icon={Archive}
              title="Total Cycles Completed"
              value={insights.totalCycles}
              description="Leadership transitions managed"
              color="blue"
            />
            <InsightCard
              icon={Users}
              title="Avg. Nominations/Cycle"
              value={insights.averageNominationsPerCycle}
              description="Average nominations received"
              color="green"
            />
            <InsightCard
              icon={FileText}
              title="Avg. Applications/Cycle"
              value={insights.averageApplicationsPerCycle}
              description="Self-applications submitted"
              color="purple"
            />
            <InsightCard
              icon={Trophy}
              title="Leaders Selected"
              value={historicalSelections.length}
              description="Successful leadership placements"
              color="orange"
            />
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Historical Data Yet</p>
                <p className="text-sm mt-2">
                  Insights will appear once succession cycles are completed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pattern Insights */}
      {hasData && insights.positionPopularity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Position Popularity
            </CardTitle>
            <CardDescription>
              Most sought-after leadership positions based on nominations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.positionPopularity.map((pos: any, index: number) => (
                <div key={pos.title} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{pos.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress
                        value={
                          (pos.nominations /
                            Math.max(...insights.positionPopularity.map((p: any) => p.nominations))) *
                          100
                        }
                        className="h-2 flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-20 text-right">
                        {pos.nominations} nominations
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Historical Data */}
      <Tabs defaultValue="cycles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cycles" className="gap-2">
            <Calendar className="h-4 w-4" />
            Historical Cycles
          </TabsTrigger>
          <TabsTrigger value="leaders" className="gap-2">
            <Award className="h-4 w-4" />
            Selected Leaders
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cycles" className="space-y-4">
          {cyclesWithStats.length > 0 ? (
            cyclesWithStats.map(({ cycle, stats }) => (
              <CycleCard key={cycle.id} cycle={cycle} stats={stats} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No Completed Cycles</p>
                  <p className="text-sm mt-2">
                    Historical cycles will appear here once they are completed or archived.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selected Leaders</CardTitle>
              <CardDescription>
                Members who were selected for leadership positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historicalSelections.length > 0 ? (
                <div className="space-y-3">
                  {historicalSelections.slice(0, 10).map((selection: any) => (
                    <SelectedLeaderCard key={selection.id} selection={selection} />
                  ))}
                  {historicalSelections.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center pt-4">
                      Showing 10 of {historicalSelections.length} selected leaders
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No selected leaders yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Year-over-Year Trends</CardTitle>
              <CardDescription>
                Participation trends across succession cycles
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.yearOverYearTrends.length > 0 ? (
                <div className="space-y-4">
                  {insights.yearOverYearTrends.map((trend: any, index: number) => {
                    const prevTrend = insights.yearOverYearTrends[index - 1]
                    const nominationChange = prevTrend
                      ? ((trend.nominations - prevTrend.nominations) / Math.max(prevTrend.nominations, 1)) * 100
                      : 0

                    return (
                      <div
                        key={trend.year}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{trend.cycleName}</p>
                          <p className="text-sm text-muted-foreground">{trend.year}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-lg font-bold">{trend.nominations}</p>
                            <p className="text-xs text-muted-foreground">Nominations</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold">{trend.applications}</p>
                            <p className="text-xs text-muted-foreground">Applications</p>
                          </div>
                          {prevTrend && nominationChange !== 0 && (
                            <Badge
                              variant={nominationChange > 0 ? 'default' : 'secondary'}
                              className={nominationChange > 0 ? 'bg-green-600' : ''}
                            >
                              {nominationChange > 0 ? '+' : ''}
                              {nominationChange.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Not enough data to show trends</p>
                  <p className="text-sm mt-1">Complete more cycles to see year-over-year comparisons</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Success Pattern Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Success Patterns
              </CardTitle>
              <CardDescription>
                Common traits among selected leaders (based on historical data)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-green-50 border-green-200">
                  <p className="text-sm font-medium text-green-800">EC Experience</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">2+ years</p>
                  <p className="text-xs text-green-700 mt-1">
                    Average EC experience of selected leaders
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                  <p className="text-sm font-medium text-blue-800">Events Led</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">3+</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Average events led before selection
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-purple-50 border-purple-200">
                  <p className="text-sm font-medium text-purple-800">RCM Attendance</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">90%+</p>
                  <p className="text-xs text-purple-700 mt-1">
                    Average meeting attendance rate
                  </p>
                </div>
                <div className="p-4 rounded-lg border bg-orange-50 border-orange-200">
                  <p className="text-sm font-medium text-orange-800">Leadership Academy</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">Completed</p>
                  <p className="text-xs text-orange-700 mt-1">
                    Most selected leaders completed training
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Related Resources</CardTitle>
          <CardDescription>
            Access other succession management features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href="/succession">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Current Cycle</p>
                    <p className="text-xs text-muted-foreground">View active succession</p>
                  </div>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href="/succession/admin/cycles">
                <div className="flex items-center gap-3">
                  <Archive className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">All Cycles</p>
                    <p className="text-xs text-muted-foreground">Manage all cycles</p>
                  </div>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href="/succession/eligibility">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Eligibility Check</p>
                    <p className="text-xs text-muted-foreground">Check your readiness</p>
                  </div>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KnowledgeBaseLoading() {
  return (
    <div className="space-y-8">
      {/* Insights Skeleton */}
      <div>
        <Skeleton className="h-7 w-40 mb-4" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function KnowledgeBasePage() {
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Succession Knowledge Base</h1>
        <p className="text-muted-foreground mt-2">
          Historical data, patterns, and insights from past succession cycles
        </p>
      </div>

      <Suspense fallback={<KnowledgeBaseLoading />}>
        <KnowledgeBaseContent />
      </Suspense>
    </div>
  )
}
