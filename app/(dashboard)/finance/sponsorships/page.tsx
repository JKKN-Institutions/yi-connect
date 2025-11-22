import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Plus, TrendingUp, DollarSign, Target, Award } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SponsorshipsTable } from '@/components/finance/sponsorships-table'
import { getSponsorshipDeals, getSponsorshipPipelineValue } from '@/lib/data/finance'
import { getCurrentChapterId } from '@/lib/auth'
import { formatCurrency } from '@/types/finance'

export const metadata: Metadata = {
  title: 'Sponsorship Pipeline',
  description: 'Manage sponsorship deals and track fundraising progress',
}

async function SponsorshipsTableWrapper() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see all sponsorship deals
  const result = await getSponsorshipDeals(chapterId, {}, 1, 50)

  return (
    <SponsorshipsTable
      data={result.data}
      pageCount={result.totalPages}
    />
  )
}

async function PipelineStats() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see aggregated pipeline stats
  const pipelineValue = await getSponsorshipPipelineValue(chapterId)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(pipelineValue.total_pipeline_value)}</div>
          <p className="text-xs text-muted-foreground">
            {pipelineValue.active_count} active deals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Weighted Value</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(pipelineValue.weighted_pipeline_value)}</div>
          <p className="text-xs text-muted-foreground">
            Probability-adjusted
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Committed</CardTitle>
          <Award className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(pipelineValue.total_committed)}</div>
          <p className="text-xs text-muted-foreground">
            {pipelineValue.committed_count} deals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Received</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(pipelineValue.total_received)}</div>
          <p className="text-xs text-muted-foreground">
            {pipelineValue.win_rate.toFixed(1)}% win rate
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function SponsorshipsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sponsorship Pipeline</h1>
          <p className="text-muted-foreground">
            Track and manage sponsorship deals from prospect to payment
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/finance/sponsorships/sponsors/new">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Sponsor
            </Button>
          </Link>
          <Link href="/finance/sponsorships/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Deal
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      }>
        <PipelineStats />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <SponsorshipsTableWrapper />
      </Suspense>
    </div>
  )
}
