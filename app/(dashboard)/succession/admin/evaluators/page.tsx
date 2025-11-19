import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { getEvaluators, getCurrentActiveCycle } from '@/lib/data/succession'
import { EvaluatorsTable } from '@/components/succession/tables/evaluators-table'
import { EvaluatorAssignmentForm } from '@/components/succession/forms/evaluator-assignment-form'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Manage Evaluators | Admin',
  description: 'Assign and manage evaluators for succession cycles',
}

async function EvaluatorsContent() {
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
              Create a succession cycle to assign evaluators.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const evaluators = await getEvaluators(activeCycle.id)

  // Get all members for assignment
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .is('deleted_at', null)
    .order('first_name')

  const existingEvaluatorIds = evaluators.map((e: any) => e.evaluator.id)

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
              <span className="text-muted-foreground">Total Evaluators:</span>{' '}
              <span className="font-medium">{evaluators.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evaluators</CardTitle>
              <CardDescription>
                Manage evaluators assigned to review nominations and applications
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Evaluator
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Evaluator</DialogTitle>
                  <DialogDescription>
                    Select a member to assign as an evaluator for this cycle
                  </DialogDescription>
                </DialogHeader>
                <EvaluatorAssignmentForm
                  cycleId={activeCycle.id}
                  members={members || []}
                  existingEvaluatorIds={existingEvaluatorIds}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <EvaluatorsTable evaluators={evaluators} />
        </CardContent>
      </Card>
    </div>
  )
}

function EvaluatorsLoading() {
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

export default function AdminEvaluatorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Evaluators</h1>
        <p className="text-muted-foreground mt-2">
          Assign members to evaluate nominations and applications
        </p>
      </div>

      <Suspense fallback={<EvaluatorsLoading />}>
        <EvaluatorsContent />
      </Suspense>
    </div>
  )
}
