/**
 * Create CMP Targets Page
 *
 * Set new CMP targets for verticals
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import { getVerticalsForForm } from '@/lib/data/health-card'
import { hasTargetsForYear } from '@/lib/data/cmp-targets'
import { Button } from '@/components/ui/button'
import { CMPTargetForm } from '@/components/pathfinder/cmp-target-form'
import { CALENDAR_YEAR_OPTIONS } from '@/types/cmp-targets'

export const metadata = {
  title: 'Set CMP Targets - Pathfinder',
  description: 'Set Common Minimum Program targets for verticals',
}

export default async function NewCMPTargetPage() {
  const { user, roles } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
  ])

  const chapterId = await getCurrentChapterId()
  const verticals = await getVerticalsForForm()
  const currentYear = new Date().getFullYear()

  // Check which years already have targets
  const yearsWithTargets = await Promise.all(
    CALENDAR_YEAR_OPTIONS.map(async (option) => ({
      year: option.value,
      hasTargets: await hasTargetsForYear(option.value, chapterId || undefined),
    }))
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/pathfinder/cmp-targets">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set CMP Targets</h1>
          <p className="text-muted-foreground">
            Define minimum activity targets for each vertical
          </p>
        </div>
      </div>

      {/* Form */}
      <CMPTargetForm
        verticals={verticals}
        chapterId={chapterId}
        yearsWithTargets={yearsWithTargets}
      />
    </div>
  )
}
