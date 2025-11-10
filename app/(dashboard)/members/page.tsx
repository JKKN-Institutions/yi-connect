/**
 * Members List Page
 *
 * Display all members with filtering, sorting, and search.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { getMembers, getMemberAnalytics } from '@/lib/data/members'
import { MemberCard, MemberStats } from '@/components/members'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Users, Grid3x3, Table } from 'lucide-react'
import type { MemberQueryParams } from '@/types/member'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    city?: string
  }>
}

// Loading skeleton for member cards
function MemberCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
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

// Members list component (Server Component)
async function MembersList({ params }: { params: MemberQueryParams }) {
  const { data: members, total, page, totalPages } = await getMembers(params)

  if (members.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <Users className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
          <div>
            <h3 className="text-lg font-semibold">No members found</h3>
            <p className="text-muted-foreground">
              {params.filters?.search
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first member'}
            </p>
          </div>
          <Button asChild>
            <Link href="/members/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Link>
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={`/members?page=${page - 1}`}>Previous</Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={`/members?page=${page + 1}`}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// Stats component (Server Component)
async function StatsSection() {
  const analytics = await getMemberAnalytics()
  return <MemberStats analytics={analytics} />
}

// Content component that handles searchParams
async function MembersPageContent({ searchParams }: PageProps) {
  const params = await searchParams
  const currentPage = params.page ? parseInt(params.page) : 1

  // Build query params
  const queryParams: MemberQueryParams = {
    page: currentPage,
    pageSize: 12,
    filters: {},
  }

  if (params.search) {
    queryParams.filters!.search = params.search
  }

  if (params.status) {
    queryParams.filters!.membership_status = [params.status]
  }

  if (params.city) {
    queryParams.filters!.city = [params.city]
  }

  return (
    <>
      {/* Stats Section with Suspense */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      {/* TODO: Add filters/search bar here */}

      {/* Members List with Suspense */}
      <Suspense
        key={JSON.stringify(queryParams)}
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <MembersList params={queryParams} />
      </Suspense>
    </>
  )
}

// Main page component
export default function MembersPage({ searchParams }: PageProps) {
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
              <Table className="h-4 w-4 mr-2" />
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

      {/* Wrap async content in Suspense */}
      <Suspense
        fallback={
          <>
            <StatsSkeleton />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <MemberCardSkeleton key={i} />
              ))}
            </div>
          </>
        }
      >
        <MembersPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

// Generate metadata
export const metadata = {
  title: 'Members - Yi Connect',
  description: 'Member Intelligence Hub - Manage member profiles and engagement',
}
