import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getApplications, getCurrentActiveCycle } from '@/lib/data/succession'
import { AdminApplicationsTable } from '@/components/succession/tables/admin-applications-table'

export const metadata = {
  title: 'Review Applications | Admin',
  description: 'Review and approve member applications',
}

async function ApplicationsContent() {
  const [activeCycle, applications] = await Promise.all([
    getCurrentActiveCycle(),
    getApplications(),
  ])

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

      <Card>
        <CardHeader>
          <CardTitle>All Applications</CardTitle>
          <CardDescription>
            Review and manage applications from all cycles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminApplicationsTable applications={applications} />
        </CardContent>
      </Card>
    </div>
  )
}

function ApplicationsLoading() {
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

export default function AdminApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Applications</h1>
        <p className="text-muted-foreground mt-2">
          Review, approve, or reject member applications for leadership positions
        </p>
      </div>

      <Suspense fallback={<ApplicationsLoading />}>
        <ApplicationsContent />
      </Suspense>
    </div>
  )
}
