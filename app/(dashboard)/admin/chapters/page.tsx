/**
 * Admin Chapters List Page
 *
 * Display all chapters with management actions (Super Admin and National Admin only).
 * Following Next.js 16 patterns with Suspense boundaries and cached data.
 */

import { Suspense } from 'react'
import { connection } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getChapters } from '@/lib/data/chapters'
import { ChaptersTable } from '@/components/admin/chapters-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import type { ChapterListItem, ChapterSort } from '@/types/chapter'

export const metadata = {
  title: 'Manage Chapters - Yi Connect Admin',
  description: 'Manage Yi chapters across different regions',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    sort_field?: string
    sort_direction?: string
  }>
}

const PAGE_SIZE = 10

async function ChaptersContent({ searchParamsPromise }: { searchParamsPromise: PageProps['searchParams'] }) {
  await requireRole(['Super Admin', 'National Admin'])

  const params = await searchParamsPromise
  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || PAGE_SIZE
  const search = params.search?.trim() || undefined

  const sort: ChapterSort | undefined = params.sort_field
    ? {
        column: params.sort_field as keyof ChapterListItem,
        direction: (params.sort_direction as 'asc' | 'desc') || 'asc',
      }
    : undefined

  const { data: chapters, total } = await getChapters(
    page,
    pageSize,
    search ? { search } : undefined,
    sort
  )
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <ChaptersTable
      data={chapters}
      pageCount={pageCount}
      page={page}
      pageSize={pageSize}
      total={total}
      search={search ?? ''}
      sortField={sort?.column ?? null}
      sortDirection={sort?.direction ?? null}
    />
  )
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

export default async function AdminChaptersPage(props: PageProps) {
  await connection()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chapter Management</h1>
          <p className="text-muted-foreground">
            Create and manage Yi chapters across different regions
          </p>
        </div>
      </div>

      <Suspense fallback={<ChaptersTableSkeleton />}>
        <ChaptersContent searchParamsPromise={props.searchParams} />
      </Suspense>
    </div>
  )
}
