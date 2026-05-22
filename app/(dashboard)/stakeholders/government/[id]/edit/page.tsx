/**
 * Government Stakeholder Edit Page
 *
 * Allows editing an existing government stakeholder
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GovernmentStakeholderForm } from '@/components/stakeholders/government-stakeholder-form'
import { getGovernmentStakeholderById } from '@/lib/data/stakeholder'
import { getCurrentChapterId, requireRole } from '@/lib/auth'

interface GovernmentEditPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Edit Government Stakeholder | Yi Connect',
  description: 'Edit government stakeholder information',
}

async function GovernmentEditForm({ stakeholderId }: { stakeholderId: string }) {
  const [stakeholder, chapterId] = await Promise.all([
    getGovernmentStakeholderById(stakeholderId),
    getCurrentChapterId(),
  ])

  if (!stakeholder) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Government Stakeholder</CardTitle>
        <CardDescription>
          Update the information for {stakeholder.official_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GovernmentStakeholderForm
          chapterId={chapterId}
          initialData={stakeholder}
          mode="edit"
        />
      </CardContent>
    </Card>
  )
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </CardHeader>
      <CardContent className="space-y-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default async function GovernmentEditPage({ params }: GovernmentEditPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  const { id } = await params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/stakeholders/government/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Government Stakeholder</h1>
          <p className="text-muted-foreground">
            Update government stakeholder information
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <GovernmentEditForm stakeholderId={id} />
      </Suspense>
    </div>
  )
}
