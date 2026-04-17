import { Suspense } from 'react'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { getSuccessionCycles } from '@/lib/data/succession'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Users, ChevronRight } from 'lucide-react'

export const metadata = {
  title: 'Succession Cycles | Yi Connect',
  description: 'Browse succession planning cycles',
}

async function CyclesList() {
  const cycles = await getSuccessionCycles()

  if (!cycles || cycles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No succession cycles yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your chapter has not opened any succession cycles yet
          </p>
        </CardContent>
      </Card>
    )
  }

  const statusColor = (s: string) => {
    if (s === 'active') return 'default'
    if (s === 'nominations_open' || s === 'applications_open') return 'default'
    if (s === 'evaluation') return 'secondary'
    if (s === 'completed') return 'outline'
    return 'secondary'
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cycles.map((cycle: any) => (
        <Link key={cycle.id} href={`/succession`} className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{cycle.name || cycle.cycle_name || `FY ${cycle.fiscal_year}`}</CardTitle>
                <Badge variant={statusColor(cycle.status)}>{cycle.status?.replace(/_/g, ' ')}</Badge>
              </div>
              {cycle.fiscal_year && (
                <CardDescription>Fiscal Year {cycle.fiscal_year}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {cycle.position_count ?? 'View'} positions
                </span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

export default async function SuccessionCyclesPage() {
  await requireUser()

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Succession Cycles</h1>
          <p className="text-muted-foreground mt-2">
            Browse active and past leadership succession cycles in your chapter
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/succession">Back to Overview</Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[200px]" />
          </div>
        }
      >
        <CyclesList />
      </Suspense>
    </div>
  )
}
