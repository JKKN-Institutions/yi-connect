/**
 * Vendors List Page
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Store, Activity, Star, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getVendors } from '@/lib/data/stakeholder'
import { VendorsTable } from '@/components/stakeholders/vendors-table'
import { getCurrentChapterId } from '@/lib/auth'

export const metadata = {
  title: 'Vendors',
  description: 'Manage your vendor relationships',
}

async function VendorsStats() {
  // Super admins without chapter_id will see aggregated stats from all chapters
  const chapterId = await getCurrentChapterId()
  const vendors = await getVendors(chapterId)
  const totalVendors = vendors.length
  const activeVendors = vendors.filter((v) => v.status === 'active').length
  const avgRating = vendors.reduce((sum, v) => sum + (v.quality_rating || 0), 0) / (vendors.filter((v) => v.quality_rating).length || 1)
  const avgHealthScore = vendors.reduce((sum, v) => sum + (v.health_score || 0), 0) / (vendors.filter((v) => v.health_score).length || 1)

  const stats = [
    { title: 'Total Vendors', value: totalVendors, icon: Store, description: 'In your network' },
    { title: 'Active', value: activeVendors, icon: Activity, description: 'Currently engaged' },
    { title: 'Avg Rating', value: avgRating.toFixed(1), icon: Star, description: 'Quality score' },
    { title: 'Avg Health Score', value: avgHealthScore.toFixed(0), icon: TrendingUp, description: 'Relationship health' },
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

async function VendorsTableWrapper() {
  // Super admins without chapter_id will see aggregated data from all chapters
  const chapterId = await getCurrentChapterId()
  const vendors = await getVendors(chapterId)
  return <VendorsTable data={vendors} />
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

export default function VendorsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">Manage your vendor relationships</p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/vendors/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatsSkeleton />}>
          <VendorsStats />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>View and manage all vendor relationships</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <VendorsTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
