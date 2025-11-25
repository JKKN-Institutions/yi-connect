/**
 * Speakers List Page
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Mic2, Activity, DollarSign, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSpeakers } from '@/lib/data/stakeholder'
import { SpeakersTable } from '@/components/stakeholders/speakers-table'
import { getCurrentChapterId, requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Speakers',
  description: 'Manage your speaker network',
}

async function SpeakersStats() {
  // Super admins without chapter_id will see aggregated stats from all chapters
  const chapterId = await getCurrentChapterId()
  const speakers = await getSpeakers(chapterId)
  const totalSpeakers = speakers.length
  const activeSpeakers = speakers.filter((s) => s.status === 'active').length
  const availableSpeakers = speakers.filter((s) => s.availability_status === 'available').length
  const avgHealthScore = speakers.reduce((sum, s) => sum + (s.health_score || 0), 0) / (speakers.filter((s) => s.health_score).length || 1)

  const stats = [
    { title: 'Total Speakers', value: totalSpeakers, icon: Mic2, description: 'In your network' },
    { title: 'Active', value: activeSpeakers, icon: Activity, description: 'Currently engaged' },
    { title: 'Available', value: availableSpeakers, icon: DollarSign, description: 'Ready to speak' },
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

async function SpeakersTableWrapper() {
  // Super admins without chapter_id will see aggregated data from all chapters
  const chapterId = await getCurrentChapterId()
  const speakers = await getSpeakers(chapterId)
  return <SpeakersTable data={speakers} />
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

export default async function SpeakersPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Speakers</h1>
          <p className="text-muted-foreground">Manage your speaker network</p>
        </div>
        <Button asChild>
          <Link href="/stakeholders/speakers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Speaker
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatsSkeleton />}>
          <SpeakersStats />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Speakers</CardTitle>
          <CardDescription>View and manage all speakers in your network</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TableSkeleton />}>
            <SpeakersTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
