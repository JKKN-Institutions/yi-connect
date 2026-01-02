/**
 * Create New Stretch Goal Page
 */

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import { getVerticalsForForm } from '@/lib/data/health-card'
import { getCMPTargets } from '@/lib/data/cmp-targets'
import { getStretchGoals } from '@/lib/data/stretch-goals'
import { Button } from '@/components/ui/button'
import { StretchGoalForm } from '@/components/pathfinder/stretch-goal-form'
import { getCurrentFiscalYear, FISCAL_YEAR_OPTIONS } from '@/types/cmp-targets'

export const metadata = {
  title: 'Set Stretch Goal - Pathfinder',
  description: 'Create ambitious targets beyond CMP minimums',
}

export default async function NewStretchGoalPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  const chapterId = await getCurrentChapterId()
  const currentFiscalYear = getCurrentFiscalYear()

  // Get verticals and CMP targets
  const [verticals, cmpTargets, existingStretchGoals] = await Promise.all([
    getVerticalsForForm(),
    getCMPTargets({ fiscal_year: currentFiscalYear }),
    getStretchGoals({ fiscal_year: currentFiscalYear }),
  ])

  // Check which years already have stretch goals
  const yearsWithStretchGoals = FISCAL_YEAR_OPTIONS.map((option) => ({
    year: option.value,
    hasStretchGoals: existingStretchGoals.some(
      (g) => g.fiscal_year === option.value
    ),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pathfinder/stretch-goals">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set Stretch Goal</h1>
          <p className="text-muted-foreground">
            Create ambitious targets beyond CMP minimums
          </p>
        </div>
      </div>

      {/* Form */}
      <StretchGoalForm
        verticals={verticals}
        cmpTargets={cmpTargets}
        chapterId={chapterId}
        yearsWithStretchGoals={yearsWithStretchGoals}
      />
    </div>
  )
}
