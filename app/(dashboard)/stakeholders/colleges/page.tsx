/**
 * Colleges List Page
 *
 * Displays all colleges with stats, filtering, and search
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, GraduationCap, Activity, FileCheck, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentChapterId } from '@/lib/auth'
import { getColleges } from '@/lib/data/stakeholder'
import { CollegesTable } from '@/components/stakeholders/colleges-table'

export const metadata = {
  title: 'Colleges',
  description: 'Manage your college stakeholder relationships',
}

async function CollegesStats() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see aggregated stats from all chapters
  const colleges = await getColleges(chapterId)

  const totalColleges = colleges.length
  const activeColleges = colleges.filter((c) => c.status === 'active').length
  const mouSigned = colleges.filter((c) => c.mou_status === 'signed').length
  const avgHealthScore =
    colleges.reduce((sum, c) => sum + (c.health_score || 0), 0) /
    (colleges.filter((c) => c.health_score).length || 1)

  const stats = [
    {
      title: 'Total Colleges',
      value: totalColleges,
      icon: GraduationCap,
      description: 'In your network',
    },
    {
      title: 'Active',
      value: activeColleges,
      icon: Activity,
      description: 'Currently engaged',
    },
    {
      title: 'MoU Signed',
      value: mouSigned,
      icon: FileCheck,
      description: 'Active partnerships',
    },
    {
      title: 'Avg Health Score',
      value: avgHealthScore.toFixed(0),
      icon: TrendingUp,
      description: 'Relationship health',
    },
  ]

  return (
    <>
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}

async function CollegesTableWrapper() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see all colleges
  const colleges = await getColleges(chapterId)

  return <CollegesTable data={colleges} />
}

function StatsSkeleton() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[60px] mb-2" />
            <Skeleton className="h-3 w-[120px]" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="rounded-md border">
        <div className="p-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CollegesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colleges</h1>
          <p className="text-muted-foreground">
            Manage your college stakeholder relationships
          </p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/colleges/new">
            <Plus className="mr-2 h-4 w-4" />
            Add College
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatsSkeleton />}>
          <CollegesStats />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Colleges</CardTitle>
          <CardDescription>
            View and manage all college stakeholder relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <CollegesTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
