import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, PlayCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { getSuccessionCycleWithPositions } from '@/lib/data/succession'
import { SuccessionPositionsTable } from '@/components/succession/tables/succession-positions-table'
import { SuccessionCycleStatusStepper } from '@/components/succession/displays/succession-cycle-status-stepper'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  active: 'bg-blue-500',
  nominations_open: 'bg-green-500',
  nominations_closed: 'bg-yellow-500',
  applications_open: 'bg-green-500',
  applications_closed: 'bg-yellow-500',
  evaluations: 'bg-purple-500',
  evaluations_closed: 'bg-purple-500',
  interviews: 'bg-indigo-500',
  interviews_closed: 'bg-indigo-500',
  selection: 'bg-orange-500',
  approval_pending: 'bg-amber-500',
  completed: 'bg-emerald-500',
  archived: 'bg-gray-400',
}

async function CycleDetailContent({ id }: { id: string }) {
  const cycle = await getSuccessionCycleWithPositions(id)

  if (!cycle) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{cycle.cycle_name}</h1>
            <Badge className={statusColors[cycle.status]}>
              {cycle.status.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </div>
          {cycle.description && (
            <p className="text-muted-foreground">{cycle.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/succession/admin/cycles/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Cycle
            </Link>
          </Button>
          {cycle.status === 'draft' && (
            <Button>
              <PlayCircle className="mr-2 h-4 w-4" />
              Activate Cycle
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cycle Timeline</CardTitle>
          <CardDescription>Track the progress of this succession cycle</CardDescription>
        </CardHeader>
        <CardContent>
          <SuccessionCycleStatusStepper currentStatus={cycle.status} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Cycle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Year</div>
              <div className="text-2xl font-bold">{cycle.year}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Timeline</div>
              {cycle.start_date && cycle.end_date ? (
                <div className="mt-1">
                  <div className="text-sm">{new Date(cycle.start_date).toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground">
                    to {new Date(cycle.end_date).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Not set</div>
              )}
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Published</div>
              <div className="text-sm mt-1">
                {cycle.is_published ? (
                  <Badge variant="outline" className="bg-green-50">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline">Draft</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Positions</div>
              <div className="text-2xl font-bold">{cycle.position_count}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Nominations</div>
              <div className="text-2xl font-bold">{cycle.nomination_count}</div>
            </div>
            <Separator />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Applications</div>
              <div className="text-2xl font-bold">{cycle.application_count}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selection Committee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {cycle.selection_committee_ids.length > 0 ? (
                <div>
                  <div className="text-2xl font-bold mb-1">
                    {cycle.selection_committee_ids.length}
                  </div>
                  <div className="text-muted-foreground">members assigned</div>
                </div>
              ) : (
                <div className="text-muted-foreground">No committee assigned yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leadership Positions</CardTitle>
              <CardDescription>
                Manage positions available in this succession cycle
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href={`/succession/admin/cycles/${id}/positions/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SuccessionPositionsTable positions={cycle.positions} cycleId={cycle.id} />
        </CardContent>
      </Card>
    </div>
  )
}

function CycleDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-96" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function SuccessionCycleDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/succession/admin/cycles">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cycles
        </Link>
      </Button>

      <Suspense fallback={<CycleDetailLoading />}>
        <CycleDetailContent id={params.id} />
      </Suspense>
    </div>
  )
}
