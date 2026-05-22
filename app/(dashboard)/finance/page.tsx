/**
 * Finance Module - Financial Command Center Dashboard
 * Module 4: Budgeting, expense tracking, sponsorships, and reimbursements
 */

import { Suspense } from 'react'
import Link from 'next/link'
import {
  Wallet,
  TrendingUp,
  DollarSign,
  Receipt,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getCurrentChapterId, getCurrentUser, requireRole } from '@/lib/auth'
import { getBudgets, getExpenses } from '@/lib/data/finance'
import { ExpenseStatusBadge, BudgetStatusBadge } from '@/components/finance/status-badges'
import { formatCurrency } from '@/types/finance'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Financial Command Center',
  description: 'Manage budgets, expenses, and financial operations',
}

export default async function FinancePage() {
  // Require Chair, Co-Chair, Executive Member, or higher roles to access financial data
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <FinanceHeader />
      </Suspense>

      {/* Analytics */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <FinanceAnalytics />
      </Suspense>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Budgets
            </CardTitle>
            <CardDescription>Manage annual and quarterly budgets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/finance/budgets">
                  View Budgets
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/finance/budgets/new">
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Expenses
            </CardTitle>
            <CardDescription>Track and approve expense submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/finance/expenses">
                  View Expenses
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/finance/expenses/new">
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ListSkeleton title="Recent Expenses" />}>
          <RecentExpenses />
        </Suspense>

        <Suspense fallback={<ListSkeleton title="Active Budgets" />}>
          <ActiveBudgets />
        </Suspense>
      </div>
    </div>
  )
}

async function FinanceHeader() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Financial Command Center</h1>
              <p className="text-muted-foreground">Please sign in to view financial data</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Command Center</h1>
            <p className="text-muted-foreground">
              Manage budgets, track expenses, and monitor financial health
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

async function FinanceAnalytics() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see aggregated analytics
  // Get current fiscal year budgets
  const currentYear = new Date().getFullYear()
  const budgetsResult = await getBudgets(
    chapterId,
    {
      calendar_year: currentYear,
      status: ['active', 'approved'],
    },
    1,
    100
  )

  // Get all expenses for current year
  const expensesResult = await getExpenses(
    chapterId,
    {
      date_from: `${currentYear}-01-01`,
      date_to: `${currentYear}-12-31`,
    },
    1,
    1000
  )

  // Calculate totals
  const totalBudget = budgetsResult.data.reduce((sum, budget) => sum + budget.total_amount, 0)
  const totalSpent = budgetsResult.data.reduce((sum, budget) => sum + budget.spent_amount, 0)
  const totalAllocated = budgetsResult.data.reduce((sum, budget) => sum + budget.allocated_amount, 0)
  const availableFunds = totalBudget - totalSpent
  const pendingExpenses = expensesResult.data.filter((e) => e.status === 'submitted').length
  const utilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {currentYear} • {budgetsResult.total} budget{budgetsResult.total !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {utilization.toFixed(1)}% utilization
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Available Funds</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(availableFunds)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(totalAllocated)} allocated
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingExpenses}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {expensesResult.total} total expense{expensesResult.total !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function RecentExpenses() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see recent expenses from all chapters
  const result = await getExpenses(chapterId, {}, 1, 5)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Expenses</CardTitle>
            <CardDescription>Latest expense submissions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/expenses">
              View All
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {result.data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No expenses recorded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {result.data.map((expense, index) => (
              <div key={expense.id}>
                {index > 0 && <Separator className="my-4" />}
                <Link
                  href={`/finance/expenses/${expense.id}`}
                  className="flex items-center justify-between hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{expense.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <ExpenseStatusBadge status={expense.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(expense.expense_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function ActiveBudgets() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see active budgets from all chapters
  const result = await getBudgets(
    chapterId,
    {
      status: ['active', 'approved'],
    },
    1,
    5
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Budgets</CardTitle>
            <CardDescription>Current budget allocations</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/budgets">
              View All
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {result.data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active budgets</p>
          </div>
        ) : (
          <div className="space-y-4">
            {result.data.map((budget, index) => (
              <div key={budget.id}>
                {index > 0 && <Separator className="my-4" />}
                <Link
                  href={`/finance/budgets/${budget.id}`}
                  className="block hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{budget.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <BudgetStatusBadge status={budget.status} />
                        <span className="text-xs text-muted-foreground">{budget.calendar_year}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{formatCurrency(budget.total_amount)}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Utilization</span>
                      <span>{budget.utilization_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          budget.is_overbudget
                            ? 'bg-red-500'
                            : budget.is_near_limit
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(budget.utilization_percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ListSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
