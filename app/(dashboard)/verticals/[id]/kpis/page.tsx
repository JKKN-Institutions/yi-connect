/**
 * KPI Management Page
 *
 * View and record KPI actuals for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { getCurrentUser, requireRole } from '@/lib/auth'
import {
  getVerticalById,
  getPlanKPIs,
  getCurrentFiscalYear,
  getVerticalPlans,
} from '@/lib/data/vertical'
import type { VerticalKPIActual } from '@/types/vertical'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { QUARTER_LABELS, METRIC_TYPE_LABELS } from '@/types/vertical'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'KPI Management',
  description: 'Track and record KPI actuals',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function KPIManagementPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <KPIHeader params={params} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        <KPIContent params={params} />
      </Suspense>
    </div>
  )
}

async function KPIHeader({ params }: PageProps) {
  const { id } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">KPI Tracking</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and record KPI progress for {vertical.name}
        </p>
      </div>
    </div>
  )
}

async function KPIContent({ params }: PageProps) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const vertical = await getVerticalById(id)
  if (!vertical) notFound()

  const fiscalYear = getCurrentFiscalYear()
  const plans = await getVerticalPlans(id)
  const currentPlan = plans.find((p) => p.fiscal_year === fiscalYear)

  if (!currentPlan) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No Active Plan</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create an annual plan to define KPIs for this vertical
          </p>
          <Button asChild>
            <Link href={`/verticals/${id}/plan?new=true`}>Create Plan</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const kpis = await getPlanKPIs(currentPlan.id)

  if (kpis.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">No KPIs Defined</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add KPIs to your annual plan to start tracking
          </p>
          <Button asChild>
            <Link href={`/verticals/${id}/plan/edit`}>Edit Plan</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Process KPIs - they already have actuals from getPlanKPIs
  // The actuals are in a nested structure: { q1?: VerticalKPIActual, q2?: ..., q3?: ..., q4?: ... }
  const kpisWithActuals = kpis.map((kpi) => {
    // Get actuals from the embedded q1-q4 data structure
    const actuals: VerticalKPIActual[] = []
    if (kpi.actuals?.q1) actuals.push(kpi.actuals.q1)
    if (kpi.actuals?.q2) actuals.push(kpi.actuals.q2)
    if (kpi.actuals?.q3) actuals.push(kpi.actuals.q3)
    if (kpi.actuals?.q4) actuals.push(kpi.actuals.q4)

    const annualTarget = kpi.target_q1 + kpi.target_q2 + kpi.target_q3 + kpi.target_q4
    const totalActual = actuals.reduce((sum: number, a: VerticalKPIActual) => sum + a.actual_value, 0)
    const achievement = annualTarget > 0 ? (totalActual / annualTarget) * 100 : 0

    return {
      ...kpi,
      actualsArray: actuals,
      annualTarget,
      totalActual,
      achievement,
    }
  })

  // Calculate overall achievement
  const weightedAchievement = kpisWithActuals.reduce((sum, kpi) => {
    return sum + (kpi.achievement * kpi.weight) / 100
  }, 0)

  // Current quarter
  const currentQuarter = (() => {
    const month = new Date().getMonth() + 1
    if (month >= 4 && month <= 6) return 1
    if (month >= 7 && month <= 9) return 2
    if (month >= 10 && month <= 12) return 3
    return 4
  })()

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>FY{fiscalYear} Performance Summary</CardTitle>
          <CardDescription>
            Overall KPI achievement for {currentPlan.plan_title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Overall Achievement</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">
                  {weightedAchievement.toFixed(1)}%
                </span>
                {weightedAchievement >= 100 ? (
                  <CheckCircle className="h-6 w-6 text-green-500 mb-1" />
                ) : weightedAchievement < 50 ? (
                  <AlertTriangle className="h-6 w-6 text-yellow-500 mb-1" />
                ) : (
                  <TrendingUp className="h-6 w-6 text-blue-500 mb-1" />
                )}
              </div>
              <Progress value={Math.min(weightedAchievement, 100)} />
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Quarter</p>
              <p className="text-3xl font-bold">
                {QUARTER_LABELS[currentQuarter as keyof typeof QUARTER_LABELS]}
              </p>
              <p className="text-sm text-muted-foreground">
                {kpisWithActuals.filter((k) => k.actualsArray.some((a) => a.quarter === currentQuarter)).length} / {kpis.length} KPIs recorded
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total KPIs</p>
              <p className="text-3xl font-bold">{kpis.length}</p>
              <p className="text-sm text-muted-foreground">
                {kpisWithActuals.filter((k) => k.achievement >= 100).length} on track
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">KPI Details</h2>
        </div>

        {kpisWithActuals.map((kpi) => (
          <Card key={kpi.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {kpi.kpi_name}
                  </CardTitle>
                  <CardDescription>
                    {METRIC_TYPE_LABELS[kpi.metric_type as keyof typeof METRIC_TYPE_LABELS]} · Weight: {kpi.weight}%
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    kpi.achievement >= 100 ? 'default' :
                    kpi.achievement >= 75 ? 'secondary' :
                    kpi.achievement >= 50 ? 'outline' : 'destructive'
                  }
                >
                  {kpi.achievement.toFixed(1)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Annual Progress</span>
                    <span>
                      {kpi.totalActual} / {kpi.annualTarget}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(kpi.achievement, 100)}
                    className={cn(
                      kpi.achievement < 50 && 'bg-red-100'
                    )}
                  />
                </div>

                {/* Quarterly Breakdown */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((q) => {
                    const target = q === 1 ? kpi.target_q1 :
                                   q === 2 ? kpi.target_q2 :
                                   q === 3 ? kpi.target_q3 : kpi.target_q4
                    const actual = kpi.actualsArray.find((a) => a.quarter === q)
                    const rate = target > 0 && actual ? (actual.actual_value / target) * 100 : 0
                    const isCurrentQuarter = q === currentQuarter

                    return (
                      <div
                        key={q}
                        className={cn(
                          'p-3 rounded-lg text-center',
                          isCurrentQuarter ? 'border-2 border-primary' : 'border',
                          actual ? 'bg-muted' : 'bg-background'
                        )}
                      >
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          {QUARTER_LABELS[q as keyof typeof QUARTER_LABELS]}
                        </div>
                        <div className="text-sm font-semibold">
                          {actual ? actual.actual_value : '-'} / {target}
                        </div>
                        {actual && (
                          <div className={cn(
                            'text-xs mt-1',
                            rate >= 100 ? 'text-green-600' :
                            rate >= 75 ? 'text-blue-600' :
                            rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                          )}>
                            {rate.toFixed(0)}%
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                  <Button size="sm" asChild>
                    <Link href={`/verticals/${id}/kpis/${kpi.id}/record`}>
                      Record Actual
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-9 w-48 mb-1" />
        <Skeleton className="h-5 w-64" />
      </div>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
