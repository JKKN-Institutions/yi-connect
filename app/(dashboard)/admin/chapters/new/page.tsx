/**
 * Create New Chapter Page
 *
 * Multi-step wizard for creating a new Yi chapter with chair invitation
 * and feature configuration (Super Admin and National Admin only).
 */

import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { CreateChapterWizard } from '@/components/admin/chapters/create-chapter-wizard'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Create New Chapter - Yi Connect Admin',
  description: 'Create a new Yi chapter with chair invitation',
}

// Content component that performs auth check
async function NewChapterContent() {
  // Require Super Admin or National Admin role
  await requireRole(['Super Admin', 'National Admin'])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Chapter</h1>
        <p className="text-muted-foreground">
          Set up a new Yi chapter with chair invitation and feature configuration
        </p>
      </div>

      {/* Chapter Creation Wizard */}
      <div className="max-w-3xl">
        <CreateChapterWizard />
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
