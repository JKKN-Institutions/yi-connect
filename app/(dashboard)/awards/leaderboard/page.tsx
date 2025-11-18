import { Suspense, use } from 'react'
import { getLeaderboard, getAwardCategories } from '@/lib/data/awards'
import { LeaderboardTable } from '@/components/awards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, TrendingUp, Award, Medal } from 'lucide-react'
import { LeaderboardFilters } from './filters'

interface LeaderboardPageProps {
  searchParams: Promise<{
    category?: string
    year?: string
  }>
}

async function LeaderboardStats({ categoryId, year }: { categoryId?: string; year?: number }) {
  if (!categoryId) return null
  const leaderboard = await getLeaderboard(categoryId, year)

  if (!leaderboard || leaderboard.length === 0) {
    return null
  }

  const totalWinners = leaderboard.length
  const totalAwards = leaderboard.reduce((sum, entry) => sum + entry.total_wins, 0)
  const mostWins = leaderboard[0]

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Winners</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalWinners}</div>
          <p className="text-xs text-muted-foreground">
            Unique award recipients
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Awards</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAwards}</div>
          <p className="text-xs text-muted-foreground">
            Awards distributed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold truncate">{mostWins.member_name}</div>
          <p className="text-xs text-muted-foreground">
            {mostWins.total_wins} {mostWins.total_wins === 1 ? 'win' : 'wins'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">First Place Wins</CardTitle>
          <Medal className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {leaderboard.reduce((sum, entry) => sum + entry.first_place_count, 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Gold medal recipients
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function LeaderboardSection({ categoryId, year }: { categoryId?: string; year?: number }) {
  if (!categoryId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Select a category to view leaderboard
          </p>
        </CardContent>
      </Card>
    )
  }

  const leaderboard = await getLeaderboard(categoryId, year)

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No winners yet
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Winners will appear here once awards are announced
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <Suspense fallback={<Skeleton className="h-[140px]" />}>
        <LeaderboardStats categoryId={categoryId} year={year} />
      </Suspense>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard Rankings</CardTitle>
          <CardDescription>
            All-time award winners ranked by total wins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeaderboardTable entries={leaderboard} showCycleDetails={true} />
        </CardContent>
      </Card>
    </div>
  )
}

async function FiltersWrapper({ categoryId, year }: { categoryId?: string; year?: string }) {
  const { data: categories } = await getAwardCategories()

  return (
    <LeaderboardFilters
      categoryId={categoryId}
      year={year}
      categories={categories}
    />
  )
}

export default function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = use(searchParams)
  const categoryId = params.category
  const year = params.year ? parseInt(params.year) : undefined

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Trophy className="h-10 w-10 text-yellow-500" />
            Awards Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2">
            View all-time award winners and rankings
          </p>
        </div>

        {/* Filters */}
        <Suspense fallback={<Skeleton className="h-[80px]" />}>
          <FiltersWrapper categoryId={categoryId} year={params.year} />
        </Suspense>
      </div>

      {/* Leaderboard Content */}
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <LeaderboardSection categoryId={categoryId} year={year} />
      </Suspense>
    </div>
  )
}
