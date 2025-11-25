/**
 * NGOs List Page
 *
 * Displays all NGOs with stats, filtering, and search
 */

import { Suspense } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { Plus, Heart, Activity, FileCheck, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getNGOs } from '@/lib/data/stakeholder'
import { NGOsTable } from '@/components/stakeholders/ngos-table'
import { getCurrentChapterId, requireRole } from '@/lib/auth'

export const metadata = {
  title: 'NGOs',
  description: 'Manage your NGO stakeholder relationships',
}

async function NGOsStats() {
  noStore()
  // Super admins without chapter_id will see aggregated stats from all chapters
  const chapterId = await getCurrentChapterId()
  const ngos = await getNGOs(chapterId)

  const totalNGOs = ngos.length
  const activeNGOs = ngos.filter((n) => n.status === 'active').length
  const mouSigned = ngos.filter((n) => n.mou_status === 'signed').length
  const avgHealthScore =
    ngos.reduce((sum, n) => sum + (n.health_score || 0), 0) /
    (ngos.filter((n) => n.health_score).length || 1)

  const stats = [
    {
      title: 'Total NGOs',
      value: totalNGOs,
      icon: Heart,
      description: 'In your network',
    },
    {
      title: 'Active',
      value: activeNGOs,
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

async function NGOsTableWrapper() {
  // Super admins without chapter_id will see aggregated data from all chapters
  const chapterId = await getCurrentChapterId()
  const ngos = await getNGOs(chapterId)

  return <NGOsTable data={ngos} />
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

export default async function NGOsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NGOs</h1>
          <p className="text-muted-foreground">
            Manage your NGO stakeholder relationships
          </p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/ngos/new">
            <Plus className="mr-2 h-4 w-4" />
            Add NGO
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatsSkeleton />}>
          <NGOsStats />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All NGOs</CardTitle>
          <CardDescription>
            View and manage all NGO stakeholder relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <NGOsTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
