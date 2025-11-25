import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { getCurrentActiveCycle, getSuccessionPositions } from '@/lib/data/succession'
import { ApproachForm } from '@/components/succession/forms/approach-form'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Record New Approach | Admin',
  description: 'Record a candidate approach for a leadership position',
}

async function NewApproachContent() {
  const supabase = await createClient()
  const activeCycle = await getCurrentActiveCycle()

  if (!activeCycle) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-lg font-medium text-muted-foreground">
              No Active Succession Cycle
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Create an active succession cycle before recording approaches.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const positions = await getSuccessionPositions(activeCycle.id)

  // Get all members (potential candidates)
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .is('deleted_at', null)
    .order('first_name')

  return (
    <div className="space-y-6">
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
              <span className="font-medium capitalize">
                {activeCycle.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Positions:</span>{' '}
              <span className="font-medium">{positions.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record Candidate Approach</CardTitle>
          <CardDescription>
            Document when a candidate is approached for a leadership position
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApproachForm
            cycleId={activeCycle.id}
            positions={positions}
            nominees={members || []}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function NewApproachLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function NewApproachPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record New Approach</h1>
        <p className="text-muted-foreground mt-2">
          Document outreach to a candidate for a leadership position
        </p>
      </div>

      <Suspense fallback={<NewApproachLoading />}>
        <NewApproachContent />
      </Suspense>
    </div>
  )
}
