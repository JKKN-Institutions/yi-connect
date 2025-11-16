/**
 * Schools Listing Page
 *
 * Display all schools in a data table with analytics and quick actions
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Building2, MapPin, Award, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentChapterId } from '@/lib/auth'
import { getSchools } from '@/lib/data/stakeholder'
import { SchoolsTable } from '@/components/stakeholders/schools-table'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Schools CRM',
  description: 'Manage school stakeholder relationships',
}

async function SchoolsStats() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see aggregated stats from all chapters
  const schools = await getSchools(chapterId)

  const stats = {
    total: schools.length,
    active: schools.filter((s) => s.status === 'active').length,
    withMou: schools.filter((s) => s.mou_status === 'signed').length,
    avgHealth: schools.length > 0
      ? schools
          .filter((s) => s.health_score !== undefined)
          .reduce((acc, s) => acc + (s.health_score || 0), 0) / schools.filter((s) => s.health_score).length
      : 0,
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {stats.active} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Schools</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.active}</div>
          <p className="text-xs text-muted-foreground">
            {((stats.active / stats.total) * 100 || 0).toFixed(0)}% of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MoU Signed</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.withMou}</div>
          <p className="text-xs text-muted-foreground">
            {((stats.withMou / stats.total) * 100 || 0).toFixed(0)}% coverage
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgHealth.toFixed(0)}/100</div>
          <p className="text-xs text-muted-foreground">
            {stats.avgHealth >= 80 ? 'Excellent' : stats.avgHealth >= 60 ? 'Good' : 'Needs work'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function SchoolsListWrapper() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see all schools
  const schools = await getSchools(chapterId)

  return <SchoolsTable data={schools} />
}

function StatsSkeletons() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[60px]" />
            <Skeleton className="h-3 w-[100px] mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[100px]" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-8 w-[100px]" />
      </div>
    </div>
  )
}

export default function SchoolsPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schools CRM</h1>
          <p className="text-muted-foreground">
            Manage relationships with schools for Yi programs and events
          </p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/schools/new">
            <Plus className="mr-2 h-4 w-4" />
            Add School
          </Link>
        </Button>
      </div>

      {/* Statistics */}
      <Suspense fallback={<StatsSkeletons />}>
        <SchoolsStats />
      </Suspense>

      {/* Schools Table */}
      <Suspense fallback={<TableSkeleton />}>
        <SchoolsListWrapper />
      </Suspense>
    </div>
  )
}
