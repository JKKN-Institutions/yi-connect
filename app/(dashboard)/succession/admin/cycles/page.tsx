import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSuccessionCycles } from '@/lib/data/succession'
import { SuccessionCyclesTable } from '@/components/succession/tables/succession-cycles-table'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Succession Cycles | Admin',
  description: 'Manage succession cycles and leadership selection processes',
}

async function CyclesContent() {
  const cycles = await getSuccessionCycles()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Succession Cycles</CardTitle>
            <CardDescription>
              Manage leadership succession cycles and their workflows
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/succession/admin/cycles/new">
              <Plus className="mr-2 h-4 w-4" />
              New Cycle
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <SuccessionCyclesTable cycles={cycles} />
      </CardContent>
    </Card>
  )
}

function CyclesLoading() {
  return (
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
  )
}

export default function SuccessionCyclesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Succession Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage leadership succession cycles, positions, and selection processes
        </p>
      </div>

      <Suspense fallback={<CyclesLoading />}>
        <CyclesContent />
      </Suspense>
    </div>
  )
}
