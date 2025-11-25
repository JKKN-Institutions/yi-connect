import { Suspense } from 'react'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getAwardCycles } from '@/lib/data/awards'
import { CycleCard } from '@/components/awards'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Calendar, Archive, Trophy } from 'lucide-react'

async function CyclesSection({ status }: { status?: string }) {
  const filters = status ? { status: status as any } : undefined
  const { data: cycles } = await getAwardCycles(filters)

  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No cycles found
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {status
              ? `No ${status} cycles at the moment`
              : 'Create your first award cycle to get started'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {cycles.map((cycle) => (
        <CycleCard key={cycle.id} cycle={cycle} />
      ))}
    </div>
  )
}

export default async function CyclesManagementPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Manage Award Cycles</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage award cycles for your chapter
          </p>
        </div>
        <Button asChild>
          <Link href="/awards/admin/cycles/new">
            <Plus className="mr-2 h-4 w-4" />
            New Cycle
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Cycles</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="judging">Judging</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Suspense
            fallback={
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-[300px]" />
                <Skeleton className="h-[300px]" />
                <Skeleton className="h-[300px]" />
              </div>
            }
          >
            <CyclesSection />
          </Suspense>
        </TabsContent>

        <TabsContent value="draft" className="mt-6">
          <Suspense fallback={<Skeleton className="h-[300px]" />}>
            <CyclesSection status="draft" />
          </Suspense>
        </TabsContent>

        <TabsContent value="open" className="mt-6">
          <Suspense fallback={<Skeleton className="h-[300px]" />}>
            <CyclesSection status="open" />
          </Suspense>
        </TabsContent>

        <TabsContent value="judging" className="mt-6">
          <Suspense fallback={<Skeleton className="h-[300px]" />}>
            <CyclesSection status="judging" />
          </Suspense>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <Suspense fallback={<Skeleton className="h-[300px]" />}>
            <CyclesSection status="completed" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
