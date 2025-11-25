import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { getApproaches, getCurrentActiveCycle } from '@/lib/data/succession'
import { ApproachesTable } from '@/components/succession/tables/approaches-table'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'Candidate Approaches | Admin',
  description: 'Track candidate outreach and responses for leadership positions',
}

async function ApproachesContent() {
  const [activeCycle, approaches] = await Promise.all([
    getCurrentActiveCycle(),
    getApproaches(),
  ])

  // Calculate statistics
  const stats = {
    total: approaches.length,
    pending: approaches.filter((a: any) => a.response_status === 'pending').length,
    accepted: approaches.filter((a: any) => a.response_status === 'accepted').length,
    declined: approaches.filter((a: any) => a.response_status === 'declined').length,
    conditional: approaches.filter((a: any) => a.response_status === 'conditional').length,
  }

  return (
    <div className="space-y-6">
      {activeCycle && (
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
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Approaches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Declined</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conditional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.conditional}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Candidate Approaches</CardTitle>
              <CardDescription>
                Track outreach to candidates and monitor their responses
              </CardDescription>
            </div>
            {activeCycle && (
              <Link href="/succession/admin/approaches/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Record New Approach
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ApproachesTable approaches={approaches} />
        </CardContent>
      </Card>
    </div>
  )
}

function ApproachesLoading() {
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
      <div className="grid gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
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
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminApproachesPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Candidate Approaches</h1>
        <p className="text-muted-foreground mt-2">
          Track candidate outreach for leadership positions and monitor acceptance rates
        </p>
      </div>

      <Suspense fallback={<ApproachesLoading />}>
        <ApproachesContent />
      </Suspense>
    </div>
  )
}
