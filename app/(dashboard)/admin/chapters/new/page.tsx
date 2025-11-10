/**
 * Create New Chapter Page
 *
 * Form for creating a new Yi chapter (National Admin only).
 */

import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { ChapterForm } from '@/components/admin/chapter-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Create New Chapter - Yi Connect Admin',
  description: 'Create a new Yi chapter',
}

// Content component that performs auth check
async function NewChapterContent() {
  // Require National Admin role
  await requireRole(['National Admin'])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Chapter</h1>
        <p className="text-muted-foreground">
          Add a new Yi chapter to the system
        </p>
      </div>

      {/* Chapter Form */}
      <div className="max-w-2xl">
        <ChapterForm />
      </div>
    </div>
  )
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

export default function NewChapterPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <NewChapterContent />
    </Suspense>
  )
}
