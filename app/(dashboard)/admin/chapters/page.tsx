/**
 * Admin Chapters List Page
 *
 * Display all chapters with management actions (Super Admin and National Admin only).
 * Following Next.js 16 patterns with Suspense boundaries and cached data.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getChapters } from '@/lib/data/chapters'
import { ChaptersTable } from '@/components/admin/chapters-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export const metadata = {
  title: 'Manage Chapters - Yi Connect Admin',
  description: 'Manage Yi chapters across different regions',
}

async function ChaptersContent() {
  // Require Super Admin or National Admin role
  await requireRole(['Super Admin', 'National Admin'])

  // Get chapters with pagination
  const { data: chapters, total, pageSize } = await getChapters(1, 10)
  const pageCount = Math.ceil(total / pageSize)

  return <ChaptersTable data={chapters} pageCount={pageCount} />
}

function ChaptersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-8 w-[120px]" />
      </div>
      <Card>
        <div className="p-4 space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[100px]" />
        <Skeleton className="h-8 w-[200px]" />
      </div>
    </div>
  )
}

export default async function AdminChaptersPage() {
  // Opt out of static prerendering
  await connection()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chapter Management</h1>
          <p className="text-muted-foreground">
            Create and manage Yi chapters across different regions
          </p>
        </div>
      </div>

      {/* Chapters Table with Suspense */}
      <Suspense fallback={<ChaptersTableSkeleton />}>
        <ChaptersContent />
      </Suspense>
    </div>
  )
}
