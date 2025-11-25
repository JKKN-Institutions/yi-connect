import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getMyApplications, getCurrentActiveCycle } from '@/lib/data/succession'
import { MyApplicationsTable } from '@/components/succession/tables/my-applications-table'
import { Plus } from 'lucide-react'
import { requireRole } from '@/lib/auth'

export const metadata = {
  title: 'My Applications | Succession',
  description: 'View and manage your leadership position applications',
}

async function ApplicationsContent() {
  const [applications, activeCycle] = await Promise.all([
    getMyApplications(),
    getCurrentActiveCycle(),
  ])

  const canApply = activeCycle && activeCycle.status === 'applications_open'

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span className="font-medium capitalize">
                    {activeCycle.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
              {canApply && (
                <Button asChild>
                  <Link href="/succession/apply">
                    <Plus className="h-4 w-4 mr-2" />
                    Apply for Position
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>My Applications</CardTitle>
              <CardDescription>
                View and manage your leadership position applications
              </CardDescription>
            </div>
            {!activeCycle && (
              <Button asChild variant="outline">
                <Link href="/succession/apply">
                  <Plus className="h-4 w-4 mr-2" />
                  Apply for Position
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MyApplicationsTable applications={applications} />
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

export default async function ApplicationsPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
        <p className="text-muted-foreground mt-2">
          View and manage your applications for leadership positions
        </p>
      </div>

      <Suspense fallback={<ApplicationsLoading />}>
        <ApplicationsContent />
      </Suspense>
    </div>
  )
}
