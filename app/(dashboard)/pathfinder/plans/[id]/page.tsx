/**
 * AAA Plan Detail/Edit Page
 *
 * View and edit an existing AAA plan.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle, Shield, Clock } from 'lucide-react'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { getAAAPlanById } from '@/lib/data/aaa'
import { approveAAAPlan } from '@/app/actions/aaa'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { AAAPlanForm } from '@/components/pathfinder/aaa-plan-form'

export const metadata = {
  title: 'AAA Plan',
  description: 'View and edit AAA plan',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AAAPlanDetailPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'EC Member'])

  const { id } = await params

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <PlanHeader planId={id} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<FormSkeleton />}>
        <PlanContent planId={id} />
      </Suspense>
    </div>
  )
}

async function PlanHeader({ planId }: { planId: string }) {
  const plan = await getAAAPlanById(planId)

  if (!plan) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/pathfinder">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {plan.vertical?.name || 'AAA Plan'}
          </h1>
          <StatusBadge status={plan.status} />
        </div>
        <p className="text-muted-foreground mt-1">
          {plan.calendar_year} AAA Plan
        </p>
      </div>
      {plan.status === 'draft' || plan.status === 'submitted' ? (
        <ApproveButton planId={planId} status={plan.status} />
      ) : null}
    </div>
  )
}

async function PlanContent({ planId }: { planId: string }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const plan = await getAAAPlanById(planId)
  if (!plan) notFound()

  return (
    <AAAPlanForm
      verticalId={plan.vertical_id}
      verticalName={plan.vertical?.name || 'Unknown Vertical'}
      chapterId={plan.chapter_id}
      plan={plan}
      calendarYear={plan.calendar_year}
    />
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
    case 'active':
      return (
        <Badge className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          {status === 'active' ? 'Active' : 'Approved'}
        </Badge>
      )
    case 'submitted':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      )
    case 'draft':
    default:
      return <Badge variant="outline">Draft</Badge>
  }
}

async function ApproveButton({ planId, status }: { planId: string; status: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  // Only Chair+ can approve
  // This is a simplified check - in production, check hierarchy_level
  const canApprove = true // Implement proper role check

  if (!canApprove || status === 'approved') return null

  return (
    <form
      action={async () => {
        'use server'
        await approveAAAPlan(planId)
      }}
    >
      <Button type="submit" variant="default">
        <Shield className="h-4 w-4 mr-2" />
        Approve Plan
      </Button>
    </form>
  )
}

function HeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-10 w-64 mb-1" />
      <Skeleton className="h-5 w-48" />
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[200px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
