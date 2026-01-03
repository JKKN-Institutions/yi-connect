/**
 * Budget Detail Page
 *
 * Display full budget details with allocations and utilization metrics.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit, Trash, CheckCircle, TrendingUp, Wallet, AlertTriangle } from 'lucide-react'
import { requireRole } from '@/lib/auth'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { BudgetStatusBadge, BudgetPeriodBadge } from '@/components/finance/status-badges'
import { BudgetUtilization } from '@/components/finance/budget-utilization'
import { getBudgetById } from '@/lib/data/finance'
import { formatCurrency } from '@/types/finance'

interface PageProps {
  params: Promise<{ id: string }>
}

// Provide placeholder ID for build-time validation
export async function generateStaticParams() {
  return [
    { id: '00000000-0000-0000-0000-000000000000' } // Placeholder UUID
  ]
}

async function BudgetDetail({ budgetId }: { budgetId: string }) {
  const budget = await getBudgetById(budgetId)

  if (!budget) {
    notFound()
  }

  const startDate = new Date(budget.start_date)
  const endDate = new Date(budget.end_date)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/finance/budgets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{budget.name}</h1>
            <p className="text-muted-foreground">
              {budget.calendar_year} • {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BudgetStatusBadge status={budget.status} />
          <BudgetPeriodBadge period={budget.period} quarter={budget.quarter} />
          {budget.status === 'draft' && (
            <Button>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          )}
          <Link href={`/finance/budgets/${budget.id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(budget.total_amount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Allocated for {budget.calendar_year}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(budget.spent_amount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((budget.spent_amount / budget.total_amount) * 100).toFixed(1)}% utilized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(budget.total_amount - budget.spent_amount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Remaining balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Utilization</CardTitle>
          <CardDescription>Track spending against allocated budget</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetUtilization
            totalAmount={budget.total_amount}
            spentAmount={budget.spent_amount}
            allocatedAmount={budget.allocated_amount}
            showDetails={true}
          />
        </CardContent>
      </Card>

      {/* Description */}
      {budget.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{budget.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Budget Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Calendar Year</p>
              <p className="text-sm text-muted-foreground">{budget.calendar_year}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Period</p>
              <p className="text-sm text-muted-foreground capitalize">{budget.period}</p>
            </div>
            {budget.quarter && (
              <div>
                <p className="text-sm font-medium">Quarter</p>
                <p className="text-sm text-muted-foreground">Q{budget.quarter}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium">Status</p>
              <div className="mt-1">
                <BudgetStatusBadge status={budget.status} />
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Start Date</p>
              <p className="text-sm text-muted-foreground">{startDate.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium">End Date</p>
              <p className="text-sm text-muted-foreground">{endDate.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">
                {new Date(budget.created_at).toLocaleDateString()}
              </p>
            </div>
            {budget.approved_at && (
              <div>
                <p className="text-sm font-medium">Approved</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(budget.approved_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function BudgetPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      }
    >
      <BudgetDetail budgetId={id} />
    </Suspense>
  )
}
