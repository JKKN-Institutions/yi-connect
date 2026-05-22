/**
 * School Edit Page
 *
 * Allows editing an existing school stakeholder
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
import { SchoolForm } from '@/components/stakeholders/school-form'
import { getSchoolById } from '@/lib/data/stakeholder'
import { getCurrentChapterId, requireRole } from '@/lib/auth'

interface SchoolEditPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Edit School | Yi Connect',
  description: 'Edit school stakeholder information',
}

async function SchoolEditForm({ schoolId }: { schoolId: string }) {
  const [school, chapterId] = await Promise.all([
    getSchoolById(schoolId),
    getCurrentChapterId(),
  ])

  if (!school) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit School</CardTitle>
        <CardDescription>
          Update the information for {school.school_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SchoolForm
          chapterId={chapterId}
          initialData={school}
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

export default async function SchoolEditPage({ params }: SchoolEditPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  const { id } = await params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/stakeholders/schools/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit School</h1>
          <p className="text-muted-foreground">
            Update school stakeholder information
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <SchoolEditForm schoolId={id} />
      </Suspense>
    </div>
  )
}
