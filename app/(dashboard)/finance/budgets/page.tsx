import { Suspense } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BudgetsTable } from '@/components/finance/budgets-table'
import { getBudgets } from '@/lib/data/finance'
import { getCurrentChapterId } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Budgets',
  description: 'Manage chapter budgets and allocations',
}

async function BudgetsTableWrapper() {
  const chapterId = await getCurrentChapterId()
  if (!chapterId) return null

  const result = await getBudgets(chapterId, {}, 1, 50)

  return (
    <BudgetsTable 
      data={result.data} 
      pageCount={result.totalPages}
    />
  )
}

export default async function BudgetsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            Manage and track chapter budgets and allocations
          </p>
        </div>
        <Link href="/finance/budgets/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Budget
          </Button>
        </Link>
      </div>

      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <BudgetsTableWrapper />
      </Suspense>
    </div>
  )
}
