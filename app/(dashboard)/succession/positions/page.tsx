import { Suspense } from 'react'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getCurrentActiveCycle, getSuccessionPositions } from '@/lib/data/succession'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, Users } from 'lucide-react'

export const metadata = {
  title: 'Succession Positions | Yi Connect',
  description: 'Open leadership positions in the active succession cycle',
}

async function PositionsList() {
  const activeCycle = await getCurrentActiveCycle()

  if (!activeCycle) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No active cycle</p>
          <p className="text-sm text-muted-foreground mt-2">
            There is no succession cycle currently open for positions
          </p>
        </CardContent>
      </Card>
    )
  }

  const positions = await getSuccessionPositions(activeCycle.id)

  if (!positions || positions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No positions defined</p>
          <p className="text-sm text-muted-foreground mt-2">
            This cycle has no positions configured yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {positions.map((p: any) => (
        <Card key={p.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg">{p.position_name || p.title}</CardTitle>
              <Badge variant={p.status === 'open' ? 'default' : 'secondary'}>{p.status}</Badge>
            </div>
            {p.description && <CardDescription>{p.description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {p.seats_available ?? 1} seat(s) available
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href={`/succession/apply?position=${p.id}`}>Apply</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/succession/nominate?position=${p.id}`}>Nominate</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default async function SuccessionPositionsPage() {
  await requireAuth()

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Open Positions</h1>
          <p className="text-muted-foreground mt-2">
            Leadership positions available in the current succession cycle
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/succession">Back to Overview</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[180px]" />
          </div>
        }
      >
        <PositionsList />
      </Suspense>
    </div>
  )
}
