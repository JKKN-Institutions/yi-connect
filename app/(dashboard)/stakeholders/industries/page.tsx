/**
 * Industries List Page
 *
 * Displays all industries with stats, filtering, and search
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Factory, Activity, FileCheck, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getIndustries } from '@/lib/data/stakeholder'
import { IndustriesTable } from '@/components/stakeholders/industries-table'

export const metadata = {
  title: 'Industries',
  description: 'Manage your industry stakeholder relationships',
}

async function IndustriesStats() {
  const industries = await getIndustries()

  const totalIndustries = industries.length
  const activeIndustries = industries.filter((i) => i.status === 'active').length
  const mouSigned = industries.filter((i) => i.mou_status === 'signed').length
  const avgHealthScore =
    industries.reduce((sum, i) => sum + (i.health_score || 0), 0) /
    (industries.filter((i) => i.health_score).length || 1)

  const stats = [
    {
      title: 'Total Industries',
      value: totalIndustries,
      icon: Factory,
      description: 'In your network',
    },
    {
      title: 'Active',
      value: activeIndustries,
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

async function IndustriesTableWrapper() {
  const industries = await getIndustries()

  return <IndustriesTable data={industries} />
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

export default function IndustriesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Industries</h1>
          <p className="text-muted-foreground">
            Manage your industry stakeholder relationships
          </p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/industries/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Industry
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatsSkeleton />}>
          <IndustriesStats />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Industries</CardTitle>
          <CardDescription>
            View and manage all industry stakeholder relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <IndustriesTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
