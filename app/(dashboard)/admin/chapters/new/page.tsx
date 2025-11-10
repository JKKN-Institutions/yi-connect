/**
 * Create New Chapter Page
 *
 * Form for creating a new Yi chapter (National Admin only).
 */

import { requireRole } from '@/lib/auth'
import { ChapterForm } from '@/components/admin/chapter-form'

export const metadata = {
  title: 'Create New Chapter - Yi Connect Admin',
  description: 'Create a new Yi chapter',
}

export default async function NewChapterPage() {
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
