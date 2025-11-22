import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSuccessionCycleById } from '@/lib/data/succession'
import { SuccessionCycleForm } from '@/components/succession/forms/succession-cycle-form'

async function EditCycleContent({ id }: { id: string }) {
  const cycle = await getSuccessionCycleById(id)

  if (!cycle) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Cycle Information</CardTitle>
        <CardDescription>Update the details of this succession cycle</CardDescription>
      </CardHeader>
      <CardContent>
        <SuccessionCycleForm cycle={cycle} />
      </CardContent>
    </Card>
  )
}

function EditCycleLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function EditSuccessionCyclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/succession/admin/cycles/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cycle
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Succession Cycle</h1>
        <p className="text-muted-foreground mt-2">
          Update succession cycle information and configuration
        </p>
      </div>

      <Suspense fallback={<EditCycleLoading />}>
        <EditCycleContent id={id} />
      </Suspense>
    </div>
  )
}
