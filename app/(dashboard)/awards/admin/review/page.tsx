import { Suspense } from 'react'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getActiveCycles, getRankedNominations } from '@/lib/data/awards'
import { WinnerAnnouncement } from '@/components/awards'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Medal, Award, Eye, Users, CheckCircle2 } from 'lucide-react'

interface ReviewPageProps {
  searchParams: Promise<{
    cycle?: string
  }>
}

async function CycleSelector({
  searchParamsPromise
}: {
  searchParamsPromise: Promise<{ cycle?: string }>
}) {
  const params = await searchParamsPromise
  const selectedCycleId = params.cycle
  const cycles = await getActiveCycles()

  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No active cycles
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Create an award cycle to start the review process
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Cycle to Review</CardTitle>
        <CardDescription>
          Choose an award cycle to review nominations and select winners
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={selectedCycleId}
          onValueChange={(value) => {
            window.location.href = `/awards/admin/review?cycle=${value}`
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a cycle" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.id} value={cycle.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{cycle.cycle_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {cycle.category?.name} - {cycle._count?.nominations || 0} nominations
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}

async function RankedNominationsSection({
  searchParamsPromise
}: {
  searchParamsPromise: Promise<{ cycle?: string }>
}) {
  const params = await searchParamsPromise
  const cycleId = params.cycle

  if (!cycleId) {
    return null
  }

  const rankedNominations = await getRankedNominations(cycleId)

  if (!rankedNominations || rankedNominations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No scored nominations
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Nominations must be scored by jury members before they can be ranked
          </p>
        </CardContent>
      </Card>
    )
  }

  const RANK_ICONS = {
    1: { Icon: Trophy, color: 'text-yellow-500' },
    2: { Icon: Medal, color: 'text-gray-400' },
    3: { Icon: Award, color: 'text-orange-600' },
  } as const

  return (
    <div className="space-y-6">
      {/* Rankings Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ranked Nominations</CardTitle>
              <CardDescription>
                Nominations ranked by weighted jury scores
              </CardDescription>
            </div>
            <Button asChild>
              <Link href={`/awards/admin/review/${cycleId}/select-winners`}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Select Winners
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Nominee</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Jury Count</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedNominations.map((nomination) => {
                  const rankConfig = RANK_ICONS[nomination.rank_position as 1 | 2 | 3]
                  const initials = nomination.nominee_name
                    ? nomination.nominee_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : '??'

                  return (
                    <TableRow key={nomination.nomination_id}>
                      {/* Rank */}
                      <TableCell className="font-bold">
                        <div className="flex items-center justify-center">
                          {rankConfig ? (
                            <rankConfig.Icon
                              className={`h-5 w-5 ${rankConfig.color}`}
                            />
                          ) : (
                            <span>{nomination.rank_position}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Nominee */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {nomination.nominee_name}
                          </span>
                        </div>
                      </TableCell>

                      {/* Average Score */}
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-bold text-lg">
                          {nomination.average_weighted_score.toFixed(2)}
                        </Badge>
                      </TableCell>

                      {/* Jury Count */}
                      <TableCell className="text-center">
                        <span className="text-sm text-muted-foreground">
                          {nomination.total_jury_scores} {nomination.total_jury_scores === 1 ? 'score' : 'scores'}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/awards/nominations/${nomination.nomination_id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
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
    </div>
  )
}

async function PageContent({
  searchParamsPromise
}: {
  searchParamsPromise: Promise<{ cycle?: string }>
}) {
  const params = await searchParamsPromise
  const cycleId = params.cycle

  if (!cycleId) {
    return <CycleSelector searchParamsPromise={searchParamsPromise} />
  }

  return <RankedNominationsSection searchParamsPromise={searchParamsPromise} />
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Review & Select Winners</h1>
        <p className="text-muted-foreground mt-2">
          Review ranked nominations and select award winners
        </p>
      </div>

      {/* Content */}
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <PageContent searchParamsPromise={searchParams} />
      </Suspense>
    </div>
  )
}
