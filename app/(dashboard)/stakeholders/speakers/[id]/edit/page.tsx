/**
 * Speaker Edit Page
 *
 * Allows editing an existing speaker stakeholder
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
import { SpeakerForm } from '@/components/stakeholders/speaker-form'
import { getSpeakerById } from '@/lib/data/stakeholder'
import { getCurrentChapterId, requireRole } from '@/lib/auth'

interface SpeakerEditPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Edit Speaker | Yi Connect',
  description: 'Edit speaker stakeholder information',
}

async function SpeakerEditForm({ speakerId }: { speakerId: string }) {
  const [speaker, chapterId] = await Promise.all([
    getSpeakerById(speakerId),
    getCurrentChapterId(),
  ])

  if (!speaker) {
    notFound()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Speaker</CardTitle>
        <CardDescription>
          Update the information for {speaker.speaker_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SpeakerForm
          chapterId={chapterId}
          initialData={speaker}
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

export default async function SpeakerEditPage({ params }: SpeakerEditPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])

  const { id } = await params

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/stakeholders/speakers/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Speaker</h1>
          <p className="text-muted-foreground">
            Update speaker stakeholder information
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <SpeakerEditForm speakerId={id} />
      </Suspense>
    </div>
  )
}
