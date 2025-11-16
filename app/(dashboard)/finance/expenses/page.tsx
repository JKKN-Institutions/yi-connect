import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ExpensesTable } from '@/components/finance/expenses-table'
import { getExpenses } from '@/lib/data/finance'
import { getCurrentChapterId } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Expenses',
  description: 'Track and manage chapter expenses',
}

async function ExpensesTableWrapper() {
  const chapterId = await getCurrentChapterId()

  // Super admins without chapter_id will see all expenses
  const result = await getExpenses(chapterId, {}, 1, 50)

  return (
    <ExpensesTable
      data={result.data}
      pageCount={result.totalPages}
    />
  )
}

export default async function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Track and manage all chapter expenses
          </p>
        </div>
        <Link href="/finance/expenses/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </Link>
      </div>

      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <ExpensesTableWrapper />
      </Suspense>
    </div>
  )
}
