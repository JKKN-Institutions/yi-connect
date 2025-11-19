import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, CheckCircle2, Clock, FileText, Star } from 'lucide-react'

async function PageContent() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      {/* Stats */}
      <JuryStats userId={user.id} />

      {/* Nominations Table */}
      <JuryNominationsTable userId={user.id} />
    </>
  )
}

async function JuryStats({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()

  // Get jury member assignments
  const { data: juryAssignments } = await supabase
    .from('jury_members')
    .select(`
      id,
      cycle:award_cycles(
        id,
        cycle_name,
        _count:nominations(count)
      )
    `)
    .eq('member_id', userId)

  if (!juryAssignments || juryAssignments.length === 0) {
    return null
  }

  // Get total scores submitted by this jury member
  const { data: scores } = await supabase
    .from('jury_scores')
    .select('id, jury_member_id')
    .in(
      'jury_member_id',
      juryAssignments.map((j) => j.id)
    )

  const totalAssignments = juryAssignments.reduce(
    (sum, j) => sum + ((j.cycle as any)?._count || 0),
    0
  )
  const completedScores = scores?.length || 0
  const pendingScores = totalAssignments - completedScores

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Cycles</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{juryAssignments.length}</div>
          <p className="text-xs text-muted-foreground">
            Jury assignments
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Nominations</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAssignments}</div>
          <p className="text-xs text-muted-foreground">
            To evaluate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{completedScores}</div>
          <p className="text-xs text-muted-foreground">
            Scores submitted
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{pendingScores}</div>
          <p className="text-xs text-muted-foreground">
            Remaining evaluations
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function JuryNominationsTable({ userId }: { userId: string }) {
  const supabase = await createServerSupabaseClient()

  // Get all jury assignments for this user
  const { data: juryMembers } = await supabase
    .from('jury_members')
    .select('id, cycle_id')
    .eq('member_id', userId)

  if (!juryMembers || juryMembers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No jury assignments
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You are not currently assigned as a jury member for any award cycles
          </p>
        </CardContent>
      </Card>
    )
  }

  const juryMemberIds = juryMembers.map((j) => j.id)
  const cycleIds = juryMembers.map((j) => j.cycle_id)

  // Get all nominations for these cycles with jury scores
  const { data: nominations } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles(
        id,
        cycle_name,
        category:award_categories(name)
      ),
      nominee:members!nominations_nominee_id_fkey(
        id, full_name, avatar_url, company, designation
      ),
      jury_scores(
        id,
        jury_member_id,
        total_score,
        weighted_score
      )
    `)
    .in('cycle_id', cycleIds)
    .eq('status', 'verified')
    .order('created_at', { ascending: false })

  if (!nominations || nominations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No nominations to evaluate
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Nominations will appear here once they are verified and ready for judging
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nominations to Evaluate</CardTitle>
        <CardDescription>
          Review and score the following nominations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nominee</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nominations.map((nomination: any) => {
                const nominee = nomination.nominee
                const cycle = nomination.cycle
                const myScore = nomination.jury_scores?.find(
                  (s: any) => juryMemberIds.includes(s.jury_member_id)
                )
                const isScored = !!myScore

                const initials = nominee?.full_name
                  ? nominee.full_name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                  : '??'

                return (
                  <TableRow key={nomination.id}>
                    {/* Nominee */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {nominee?.avatar_url && (
                            <AvatarImage src={nominee.avatar_url} alt={nominee.full_name} />
                          )}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{nominee?.full_name || 'Unknown'}</p>
                          {nominee?.designation && nominee?.company && (
                            <p className="text-xs text-muted-foreground">
                              {nominee.designation} at {nominee.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Cycle */}
                    <TableCell>{cycle?.cycle_name || 'Unknown'}</TableCell>

                    {/* Category */}
                    <TableCell>
                      <Badge variant="outline">
                        {cycle?.category?.name || 'Unknown'}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {isScored ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Scored
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <Button
                        asChild
                        size="sm"
                        variant={isScored ? 'outline' : 'default'}
                      >
                        <Link href={`/awards/jury/${nomination.id}/score`}>
                          {isScored ? 'Edit Score' : 'Score Now'}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default function JuryDashboardPage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Star className="h-10 w-10 text-yellow-500" />
          Jury Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Evaluate nominations and submit your scores
        </p>
      </div>

      {/* Content */}
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[120px]" />
              ))}
            </div>
            <Skeleton className="h-[400px]" />
          </div>
        }
      >
        <PageContent />
      </Suspense>
    </div>
  )
}
