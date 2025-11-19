/**
 * Verticals List Page
 *
 * Main verticals listing page with performance metrics and filtering.
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, TrendingUp, Award, Users, Activity } from 'lucide-react'
import { getVerticals, getCurrentFiscalYear, getVerticalRankings } from '@/lib/data/vertical'
import { getCurrentUser } from '@/lib/data/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import type { VerticalFilters, VerticalSortOptions } from '@/types/vertical'

interface PageProps {
  searchParams: Promise<{
    search?: string
    is_active?: string
    sort?: string
  }>
}

export default function VerticalsPage({ searchParams }: PageProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <VerticalsHeader />
      </Suspense>

      {/* Overview Stats */}
      <Suspense fallback={<StatsSkeleton />}>
        <VerticalStats />
      </Suspense>

      {/* Verticals List */}
      <Suspense fallback={<ListSkeleton />}>
        <VerticalsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

// Header Component
async function VerticalsHeader() {
  const user = await getCurrentUser()
  const fiscalYear = getCurrentFiscalYear()

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vertical Performance</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage vertical performance for FY{fiscalYear}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/verticals/rankings">
            <Award className="mr-2 h-4 w-4" />
            View Rankings
          </Link>
        </Button>
        {user?.role === 'admin' && (
          <Button asChild>
            <Link href="/verticals/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Vertical
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}

// Stats Component
async function VerticalStats() {
  const fiscalYear = getCurrentFiscalYear()
  const verticals = await getVerticals({ is_active: true })
  const rankings = await getVerticalRankings(fiscalYear)

  const activeVerticals = verticals.filter((v) => v.is_active).length
  const totalChairs = verticals.filter((v) => v.current_chair).length
  const avgScore = rankings.length > 0
    ? rankings.reduce((sum, r) => sum + r.total_score, 0) / rankings.length
    : 0

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Verticals</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeVerticals}</div>
          <p className="text-xs text-muted-foreground">Currently operating</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Assigned Chairs</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalChairs}</div>
          <p className="text-xs text-muted-foreground">Out of {activeVerticals} verticals</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgScore.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground">Performance metric</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {rankings.length > 0 ? rankings[0].vertical_name.substring(0, 12) : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            {rankings.length > 0 ? `Score: ${rankings[0].total_score.toFixed(1)}` : 'No data yet'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Main Content Component
async function VerticalsContent({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; is_active?: string; sort?: string }>
}) {
  // Await searchParams inside Suspense boundary
  const params = await searchParams

  // Parse filters from search params
  const filters: VerticalFilters = {
    search: params.search,
    is_active: params.is_active ? params.is_active === 'true' : undefined,
  }

  const sort: VerticalSortOptions = {
    field: params.sort === 'name' ? 'name' : 'display_order',
    direction: 'asc',
  }

  const verticals = await getVerticals(filters, sort)

  if (verticals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No verticals found</h3>
          <p className="text-sm text-muted-foreground mb-4">Get started by creating your first vertical</p>
          <Button asChild>
            <Link href="/verticals/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Vertical
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {verticals.map((vertical) => (
        <VerticalCard key={vertical.id} vertical={vertical} />
      ))}
    </div>
  )
}

// Vertical Card Component
function VerticalCard({ vertical }: { vertical: any }) {
  const fiscalYear = getCurrentFiscalYear()

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: vertical.color || '#3b82f6' }}
            >
              {vertical.name.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-lg">{vertical.name}</CardTitle>
              <CardDescription className="line-clamp-1">{vertical.description}</CardDescription>
            </div>
          </div>
          {vertical.is_active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Current Chair */}
        {vertical.current_chair && vertical.current_chair.member ? (
          <div className="flex items-center gap-2 mb-4">
            <Avatar className="h-8 w-8">
              <AvatarImage src={vertical.current_chair.member?.avatar_url} />
              <AvatarFallback>
                {vertical.current_chair.member?.profile?.full_name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {vertical.current_chair.member?.profile?.full_name}
              </p>
              <p className="text-xs text-muted-foreground">{vertical.current_chair.role}</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">No chair assigned</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="flex-1" asChild>
            <Link href={`/verticals/${vertical.id}`}>View Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/verticals/${vertical.id}/plan`}>Plan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Loading Skeletons
function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full mb-4" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
