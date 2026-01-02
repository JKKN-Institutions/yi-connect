/**
 * Pathfinder Dashboard Page
 *
 * Chair's view of all verticals' AAA status for Pathfinder.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Plus, FileSignature, Target, ClipboardList } from 'lucide-react'
import { requireRole, getCurrentUser, getCurrentChapterId } from '@/lib/auth'
import { getPathfinderDashboard, getCurrentFiscalYear } from '@/lib/data/aaa'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AAADashboard } from '@/components/pathfinder/aaa-dashboard'

export const metadata = {
  title: 'Pathfinder Dashboard',
  description: 'AAA Framework tracking for all verticals',
}

export default async function PathfinderPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pathfinder Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            AAA Framework tracking for FY{getCurrentFiscalYear()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/pathfinder/health-card">
              <ClipboardList className="h-4 w-4 mr-2" />
              Health Card
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pathfinder/commitment">
              <FileSignature className="h-4 w-4 mr-2" />
              My Commitment
            </Link>
          </Button>
          <Button asChild>
            <Link href="/pathfinder/plans/new">
              <Plus className="h-4 w-4 mr-2" />
              New AAA Plan
            </Link>
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

async function DashboardContent() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Get chapter from user's member profile
  const chapterId = await getCurrentChapterId()

  if (!chapterId) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Chapter Found</h2>
        <p className="text-muted-foreground">
          You need to be associated with a chapter to view the Pathfinder dashboard.
        </p>
      </div>
    )
  }

  const fiscalYear = getCurrentFiscalYear()
  const dashboard = await getPathfinderDashboard(chapterId, fiscalYear)

  if (!dashboard) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
        <p className="text-muted-foreground">
          No Pathfinder data found for this chapter and fiscal year.
        </p>
      </div>
    )
  }

  return <AAADashboard dashboard={dashboard} />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>
      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-lg" />
        ))}
      </div>
    </div>
  )
}
