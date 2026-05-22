/**
 * Verticals Rankings Page
 *
 * Display performance rankings across all verticals
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, TrendingUp, Award } from 'lucide-react'
import { getVerticalRankings, getCurrentCalendarYear } from '@/lib/data/vertical'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Vertical Rankings',
  description: 'Performance rankings across all verticals'
}

export default async function VerticalRankingsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/verticals">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Verticals
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Vertical Rankings</h1>
          <p className="text-muted-foreground mt-1">
            Performance comparison for {getCurrentCalendarYear()}
          </p>
        </div>
      </div>

      {/* Rankings */}
      <Suspense fallback={<RankingsSkeleton />}>
        <RankingsContent />
      </Suspense>
    </div>
  )
}

async function RankingsContent() {
  const calendarYear = getCurrentCalendarYear()
  const rankings = await getVerticalRankings(calendarYear)

  if (rankings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No rankings available</h3>
          <p className="text-sm text-muted-foreground">
            Rankings will appear once verticals have performance data
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      {/* Top 3 Podium */}
      {rankings.length >= 3 && (
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          {/* 2nd Place */}
          <Card className="md:order-1">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600">2</span>
                </div>
              </div>
              <CardTitle className="text-xl">{rankings[1]?.vertical_name}</CardTitle>
              <CardDescription>Silver</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-bold text-gray-600">
                {rankings[1]?.total_score.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Performance Score</p>
            </CardContent>
          </Card>

          {/* 1st Place */}
          <Card className="md:order-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-2">
                <div className="h-20 w-20 rounded-full bg-yellow-400 flex items-center justify-center">
                  <Trophy className="h-10 w-10 text-yellow-800" />
                </div>
              </div>
              <CardTitle className="text-2xl">{rankings[0]?.vertical_name}</CardTitle>
              <CardDescription>Champion</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-yellow-600">
                {rankings[0]?.total_score.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Performance Score</p>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          <Card className="md:order-3">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 rounded-full bg-amber-700 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
              </div>
              <CardTitle className="text-xl">{rankings[2]?.vertical_name}</CardTitle>
              <CardDescription>Bronze</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-bold text-amber-700">
                {rankings[2]?.total_score.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Performance Score</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Rankings</CardTitle>
          <CardDescription>All verticals ranked by performance score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rankings.map((ranking, index) => (
              <div
                key={ranking.vertical_id}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-12 text-center">
                  <span className="text-2xl font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>

                {/* Vertical Name */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">
                    {ranking.vertical_name}
                  </h3>
                </div>

                {/* Metrics */}
                <div className="flex gap-6 items-center">
                  <div className="text-center">
                    <div className="text-sm font-semibold">{ranking.total_score.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>

                  {ranking.kpi_achievement !== undefined && (
                    <div className="text-center">
                      <div className="text-sm font-semibold">
                        {ranking.kpi_achievement.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">KPI</div>
                    </div>
                  )}

                  {ranking.budget_utilization !== undefined && (
                    <div className="text-center">
                      <div className="text-sm font-semibold">
                        {ranking.budget_utilization.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Budget</div>
                    </div>
                  )}

                  {/* Medal Badge */}
                  {index === 0 && (
                    <Badge className="bg-yellow-500 hover:bg-yellow-600">
                      <Trophy className="h-3 w-3 mr-1" />
                      Champion
                    </Badge>
                  )}
                  {index === 1 && (
                    <Badge className="bg-gray-400 hover:bg-gray-500">
                      <Award className="h-3 w-3 mr-1" />
                      2nd
                    </Badge>
                  )}
                  {index === 2 && (
                    <Badge className="bg-amber-700 hover:bg-amber-800">
                      <Award className="h-3 w-3 mr-1" />
                      3rd
                    </Badge>
                  )}
                </div>

                {/* View Button */}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/verticals/${ranking.vertical_id}`}>
                    View
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RankingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="text-center">
              <Skeleton className="h-16 w-16 rounded-full mx-auto mb-2" />
              <Skeleton className="h-6 w-32 mx-auto" />
              <Skeleton className="h-4 w-20 mx-auto mt-1" />
            </CardHeader>
            <CardContent className="text-center">
              <Skeleton className="h-10 w-24 mx-auto" />
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
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
