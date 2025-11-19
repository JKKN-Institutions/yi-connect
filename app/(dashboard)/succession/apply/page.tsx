import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentActiveCycle, getSuccessionPositions } from '@/lib/data/succession'
import { ApplicationForm } from '@/components/succession/forms/application-form'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Apply for Position | Succession',
  description: 'Submit your application for a leadership position',
}

async function ApplicationContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
              Applications are not currently being accepted. Please check back later.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeCycle.status !== 'applications_open') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-lg font-medium text-muted-foreground">
              Applications Not Yet Open
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              The current cycle ({activeCycle.cycle_name}) is in {activeCycle.status.replace(/_/g, ' ')} phase.
              Applications will open soon.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const positions = await getSuccessionPositions(activeCycle.id)

  if (positions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-lg font-medium text-muted-foreground">No Positions Available</p>
            <p className="text-sm text-muted-foreground mt-2">
              There are currently no open positions to apply for.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

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
              <span className="text-muted-foreground">Positions Available:</span>{' '}
              <span className="font-medium">{positions.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit Your Application</CardTitle>
          <CardDescription>
            Apply for a leadership position by completing the form below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationForm cycleId={activeCycle.id} positions={positions} />
        </CardContent>
      </Card>
    </div>
  )
}

function ApplicationLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ApplyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apply for Leadership Position</h1>
        <p className="text-muted-foreground mt-2">
          Submit your application to be considered for a leadership role
        </p>
      </div>

      <Suspense fallback={<ApplicationLoading />}>
        <ApplicationContent />
      </Suspense>
    </div>
  )
}
