import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { getCurrentActiveCycle } from '@/lib/data/succession'
import { EvaluatorNominationsTable } from '@/components/succession/tables/evaluator-nominations-table'

export const metadata = {
  title: 'My Evaluations | Succession',
  description: 'Score and evaluate nominations assigned to you',
}

async function EvaluationsContent() {
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
              There is currently no active succession cycle.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Check if user is an evaluator for the active cycle
  const { data: evaluator } = await supabase
    .from('succession_evaluators')
    .select('id')
    .eq('cycle_id', activeCycle.id)
    .eq('member_id', user.id)
    .single()

  if (!evaluator) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-lg font-medium text-muted-foreground">Not an Evaluator</p>
            <p className="text-sm text-muted-foreground mt-2">
              You are not assigned as an evaluator for the current cycle.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get nominations assigned to this evaluator with criteria
  const { data: nominations } = await supabase
    .from('succession_nominations')
    .select(
      `
      id,
      nomination_type,
      reason,
      status,
      created_at,
      nominee:members!succession_nominations_nominee_id_fkey (
        id,
        first_name,
        last_name,
        email,
        avatar_url
      ),
      position:succession_positions (
        id,
        title,
        hierarchy_level,
        criteria:succession_evaluation_criteria (
          id,
          criterion_name,
          description,
          weight,
          max_score,
          display_order
        )
      )
    `
    )
    .eq('cycle_id', activeCycle.id)
    .order('created_at', { ascending: false })

  // For each nomination, check if this evaluator has scored it
  const nominationsWithScoring = await Promise.all(
    (nominations || []).map(async (nomination: any) => {
      const { data: scores } = await supabase
        .from('succession_evaluation_scores')
        .select('id, created_at')
        .eq('nomination_id', nomination.id)
        .eq('evaluator_id', evaluator.id)

      let weightedScore = 0
      if (scores && scores.length > 0) {
        const { data: detailedScores } = await supabase
          .from('succession_evaluation_scores')
          .select(
            `
            score,
            criterion:succession_evaluation_criteria (
              weight,
              max_score
            )
          `
          )
          .eq('nomination_id', nomination.id)
          .eq('evaluator_id', evaluator.id)

        if (detailedScores) {
          detailedScores.forEach((s: any) => {
            const normalizedScore = (s.score / s.criterion.max_score) * 100
            const weighted = (normalizedScore * s.criterion.weight) / 100
            weightedScore += weighted
          })
        }
      }

      return {
        ...nomination,
        has_scored: scores && scores.length > 0,
        scored_at: scores && scores.length > 0 ? scores[0].created_at : null,
        weighted_score: weightedScore,
      }
    })
  )

  // Sort criteria by display_order
  nominationsWithScoring.forEach((nomination: any) => {
    if (nomination.position?.criteria) {
      nomination.position.criteria.sort(
        (a: any, b: any) => a.display_order - b.display_order
      )
    }
  })

  const pendingCount = nominationsWithScoring.filter((n) => !n.has_scored).length
  const completedCount = nominationsWithScoring.filter((n) => n.has_scored).length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nominationsWithScoring.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Evaluations</CardTitle>
          <CardDescription>
            {activeCycle.cycle_name} - {activeCycle.year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EvaluatorNominationsTable
            nominations={nominationsWithScoring}
            evaluatorId={evaluator.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function EvaluationsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function EvaluationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Evaluations</h1>
        <p className="text-muted-foreground mt-2">
          Score and evaluate nominations assigned to you
        </p>
      </div>

      <Suspense fallback={<EvaluationsLoading />}>
        <EvaluationsContent />
      </Suspense>
    </div>
  )
}
