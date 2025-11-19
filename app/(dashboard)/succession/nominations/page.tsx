import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getMyNominations, getNominationsForMe } from '@/lib/data/succession'
import { MyNominationsTable } from '@/components/succession/tables/my-nominations-table'
import { NominationsForMeTable } from '@/components/succession/tables/nominations-for-me-table'

export const metadata = {
  title: 'My Nominations | Succession',
  description: 'View and manage your nominations',
}

async function NominationsContent() {
  const [myNominations, nominationsForMe] = await Promise.all([
    getMyNominations(),
    getNominationsForMe(),
  ])

  return (
    <Tabs defaultValue="submitted" className="space-y-6">
      <TabsList>
        <TabsTrigger value="submitted">
          Nominations I Submitted ({myNominations.length})
        </TabsTrigger>
        <TabsTrigger value="received">
          Nominations I Received ({nominationsForMe.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="submitted">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Nominations I Submitted</CardTitle>
                <CardDescription>
                  Members you've nominated for leadership positions
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/succession/nominate">
                  <Plus className="mr-2 h-4 w-4" />
                  New Nomination
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MyNominationsTable nominations={myNominations} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="received">
        <Card>
          <CardHeader>
            <CardTitle>Nominations I Received</CardTitle>
            <CardDescription>
              Positions you've been nominated for by others
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NominationsForMeTable nominations={nominationsForMe} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function NominationsLoading() {
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

export default function MyNominationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Nominations</h1>
        <p className="text-muted-foreground mt-2">
          View nominations you've submitted and nominations you've received
        </p>
      </div>

      <Suspense fallback={<NominationsLoading />}>
        <NominationsContent />
      </Suspense>
    </div>
  )
}
