import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getNominations, getCurrentActiveCycle } from '@/lib/data/succession'
import { AdminNominationsTable } from '@/components/succession/tables/admin-nominations-table'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Review Nominations | Admin',
  description: 'Review and approve member nominations',
}

async function NominationsContent() {
  const [activeCycle, nominations] = await Promise.all([
    getCurrentActiveCycle(),
    getNominations(),
  ])

  return (
    <div className="space-y-6">
      {activeCycle && (
        <Card>
          <CardHeader>
            <CardTitle>Active Succession Cycle</CardTitle>
            <CardDescription>
              {activeCycle.cycle_name} - {activeCycle.year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>{' '}
                <span className="font-medium">
                  {activeCycle.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Nominations</CardTitle>
          <CardDescription>
            Review and manage nominations from all cycles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminNominationsTable nominations={nominations} />
        </CardContent>
      </Card>
    </div>
  )
}

function NominationsLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminNominationsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Nominations</h1>
        <p className="text-muted-foreground mt-2">
          Review, approve, or reject member nominations for leadership positions
        </p>
      </div>

      <Suspense fallback={<NominationsLoading />}>
        <NominationsContent />
      </Suspense>
    </div>
  )
}
