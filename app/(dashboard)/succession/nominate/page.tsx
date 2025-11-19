import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { getCurrentActiveCycle, getSuccessionPositions } from '@/lib/data/succession'
import { NominationForm } from '@/components/succession/forms/nomination-form'
import { Award } from 'lucide-react'

export const metadata = {
  title: 'Nominate a Member | Succession',
  description: 'Nominate a member for a leadership position',
}

async function NominateContent() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const activeCycle = await getCurrentActiveCycle()

  if (!activeCycle) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No Active Succession Cycle</p>
            <p className="text-sm mt-2">
              Nominations can only be submitted during an active succession cycle.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Check if nominations are open
  if (activeCycle.status !== 'nominations_open') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nominations Not Open</p>
            <p className="text-sm mt-2">
              The current cycle is not accepting nominations at this time.
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Cycle Status: {activeCycle.status.replace(/_/g, ' ')}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const positions = await getSuccessionPositions(activeCycle.id)

  // Get all members for the dropdown
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
          {activeCycle.description && (
            <p className="text-sm text-muted-foreground">{activeCycle.description}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit Nomination</CardTitle>
          <CardDescription>
            Nominate a deserving member for a leadership position
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NominationForm
            cycleId={activeCycle.id}
            positions={positions}
            members={members || []}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function NominateLoading() {
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

export default function NominatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nominate a Member</h1>
        <p className="text-muted-foreground mt-2">
          Recommend a qualified member for a leadership position in the succession cycle
        </p>
      </div>

      <Suspense fallback={<NominateLoading />}>
        <NominateContent />
      </Suspense>
    </div>
  )
}
