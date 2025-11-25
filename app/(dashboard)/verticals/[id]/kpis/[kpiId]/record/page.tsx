/**
 * Record KPI Actual Page
 *
 * Form for recording KPI actual values
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { getVerticalById } from '@/lib/data/vertical'
import { createClient } from '@/lib/supabase/server'
import type { VerticalKPIActual } from '@/types/vertical'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { KPIActualForm } from '@/components/verticals/kpi-actual-form'

export const metadata = {
  title: 'Record KPI Actual',
  description: 'Record actual value for a KPI',
}

interface PageProps {
  params: Promise<{ id: string; kpiId: string }>
}

export default async function RecordKPIPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  return (
    <div className="flex flex-col gap-8 max-w-9xl mx-auto">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <RecordKPIHeader params={params} />
      </Suspense>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <RecordKPIFormWrapper params={params} />
      </Suspense>
    </div>
  )
}

async function RecordKPIHeader({ params }: PageProps) {
  const { id, kpiId } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  // Get KPI details
  const supabase = await createClient()
  const { data: kpi } = await supabase
    .from('vertical_kpis')
    .select('kpi_name')
    .eq('id', kpiId)
    .single()

  if (!kpi) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/verticals/${id}/kpis`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to KPIs
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Record KPI Actual</h1>
        <p className="text-muted-foreground mt-1">
          {kpi.kpi_name} - {vertical.name}
        </p>
      </div>
    </div>
  )
}

async function RecordKPIFormWrapper({ params }: PageProps) {
  const { id, kpiId } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const vertical = await getVerticalById(id)
  if (!vertical) notFound()

  // Get KPI details
  const supabase = await createClient()
  const { data: kpi, error } = await supabase
    .from('vertical_kpis')
    .select('*')
    .eq('id', kpiId)
    .single()

  if (error || !kpi) notFound()

  // Get existing actuals
  const { data: actualsData } = await supabase
    .from('vertical_kpi_actuals')
    .select('*')
    .eq('kpi_id', kpiId)

  const actuals: VerticalKPIActual[] = actualsData || []

  return (
    <KPIActualForm
      kpi={kpi}
      verticalId={id}
      verticalName={vertical.name}
      userId={user.id}
      existingActuals={actuals}
    />
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-9 w-64 mb-1" />
        <Skeleton className="h-5 w-48" />
      </div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="rounded-lg border p-6">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <div className="flex justify-end gap-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
