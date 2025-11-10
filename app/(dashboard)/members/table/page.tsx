/**
 * Members Table Page
 *
 * Advanced data table view for members with filtering, sorting, and bulk actions.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { getMembers, getMemberAnalytics, getSkills } from '@/lib/data/members'
import { DataTable } from '@/components/data-table/data-table'
import { memberColumns } from '@/components/members/members-table-columns'
import { MemberStats } from '@/components/members'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Grid3x3, Table as TableIcon } from 'lucide-react'
import type { DataTableFilterField } from '@/lib/table/types'
import type { MemberListItem } from '@/types/member'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    city?: string
  }>
}

// Loading skeleton for table
function TableSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-8 w-[300px]" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Loading skeleton for stats
function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <div className="p-6 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        </Card>
      ))}
    </div>
  )
}

// Members table component (Server Component)
async function MembersTable() {
  // Fetch all members (for client-side table)
  // In production with large datasets, use server-side pagination
  const { data: members } = await getMembers({ pageSize: 1000 })

  // Fetch skills for filtering
  const skills = await getSkills()

  // Define filter fields
  const filterFields: DataTableFilterField<MemberListItem>[] = [
    {
      label: 'Search',
      value: 'full_name',
      placeholder: 'Search members...',
    },
    {
      label: 'Status',
      value: 'membership_status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Alumni', value: 'alumni' },
      ],
    },
  ]

  return (
    <DataTable
      columns={memberColumns}
      data={members}
      filterFields={filterFields}
    />
  )
}

// Stats component (Server Component)
async function StatsSection() {
  const analytics = await getMemberAnalytics()
  return <MemberStats analytics={analytics} />
}

// Main page component
export default async function MembersTablePage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            Manage member profiles, skills, and engagement metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/members">
              <Grid3x3 className="h-4 w-4 mr-2" />
              Card View
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/members/table">
              <TableIcon className="h-4 w-4 mr-2" />
              Table View
            </Link>
          </Button>
          <Button asChild>
            <Link href="/members/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Section with Suspense */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      {/* Members Table with Suspense */}
      <Suspense fallback={<TableSkeleton />}>
        <MembersTable />
      </Suspense>
    </div>
  )
}

// Generate metadata
export const metadata = {
  title: 'Members Table - Yi Connect',
  description: 'Member Intelligence Hub - Advanced table view with filtering and sorting',
}
