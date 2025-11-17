/**
 * Government Stakeholders List Page
 *
 * Displays all government stakeholders with stats, filtering, and search
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Shield, Activity, FileCheck, TrendingUp } from 'lucide-react'

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
import { getGovernmentStakeholders } from '@/lib/data/stakeholder'
import { GovernmentStakeholdersTable } from '@/components/stakeholders/government-stakeholders-table'

export const metadata = {
  title: 'Government Stakeholders',
  description: 'Manage your government stakeholder relationships',
}

async function GovernmentStats() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see aggregated stats from all chapters
  const stakeholders = await getGovernmentStakeholders(chapterId)

  const totalStakeholders = stakeholders.length
  const activeStakeholders = stakeholders.filter((s) => s.status === 'active').length
  const mouSigned = stakeholders.filter((s) => s.mou_status === 'signed').length
  const avgHealthScore =
    stakeholders.reduce((sum, s) => sum + (s.health_score || 0), 0) /
    (stakeholders.filter((s) => s.health_score).length || 1)

  const stats = [
    {
      title: 'Total Officials',
      value: totalStakeholders,
      icon: Shield,
      description: 'In your network',
    },
    {
      title: 'Active',
      value: activeStakeholders,
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

async function GovernmentTableWrapper() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see all government stakeholders
  const stakeholders = await getGovernmentStakeholders(chapterId)

  return <GovernmentStakeholdersTable data={stakeholders} />
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

export default function GovernmentStakeholdersPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Government Stakeholders</h1>
          <p className="text-muted-foreground">
            Manage your government stakeholder relationships
          </p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/government/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Government Official
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatsSkeleton />}>
          <GovernmentStats />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Government Officials</CardTitle>
          <CardDescription>
            View and manage all government stakeholder relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <GovernmentTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
