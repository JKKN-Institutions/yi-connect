import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Plus, DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReimbursementsTable } from '@/components/finance/reimbursements-table'
import { getReimbursementRequests, getReimbursementAnalytics } from '@/lib/data/finance'
import { getCurrentChapterId, requireRole } from '@/lib/auth'
import { formatCurrency } from '@/types/finance'

export const metadata: Metadata = {
  title: 'Reimbursement Requests',
  description: 'Manage and track member reimbursement requests',
}

async function ReimbursementsTableWrapper() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see all reimbursement requests
  const result = await getReimbursementRequests(chapterId, {}, 1, 50)

  return (
    <ReimbursementsTable
      data={result.data}
      pageCount={result.totalPages}
    />
  )
}

async function ReimbursementStats() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see aggregated reimbursement stats
  const analytics = await getReimbursementAnalytics(chapterId)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.total_requests}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(analytics.total_amount)} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.requests_by_status.pending_approval || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(analytics.pending_amount)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(analytics.requests_by_status.approved || 0) + (analytics.requests_by_status.paid || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(analytics.approved_amount)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Paid</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.requests_by_status.paid || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(analytics.paid_amount)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ReimbursementsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reimbursement Requests</h1>
          <p className="text-muted-foreground">
            Track and approve member expense reimbursement requests
          </p>
        </div>
        <Link href="/finance/reimbursements/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </Link>
      </div>

      <Suspense fallback={
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      }>
        <ReimbursementStats />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <ReimbursementsTableWrapper />
      </Suspense>
    </div>
  )
}
