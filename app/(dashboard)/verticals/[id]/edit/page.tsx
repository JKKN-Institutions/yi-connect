/**
 * Edit Vertical Page
 *
 * Form for editing an existing vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import { getVerticalById } from '@/lib/data/vertical'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VerticalForm } from '@/components/verticals/vertical-form'

export const metadata = {
  title: 'Edit Vertical',
  description: 'Edit vertical details',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditVerticalPage({ params }: PageProps) {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <EditVerticalHeader params={params} />
      </Suspense>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <EditVerticalFormWrapper params={params} />
      </Suspense>
    </div>
  )
}

async function EditVerticalHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Edit {vertical.name}</h1>
        <p className="text-muted-foreground mt-1">Update vertical details and settings</p>
      </div>
    </div>
  )
}

async function EditVerticalFormWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const vertical = await getVerticalById(id)

  if (!vertical) {
    notFound()
  }

  return <VerticalForm vertical={vertical} chapterId={vertical.chapter_id} />
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-9 w-64 mb-1" />
        <Skeleton className="h-5 w-48" />
      </div>
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-6">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
