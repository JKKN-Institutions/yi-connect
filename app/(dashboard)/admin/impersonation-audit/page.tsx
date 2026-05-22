/**
 * Impersonation Audit Log Page
 *
 * Comprehensive audit log viewer for tracking all impersonation sessions.
 * Restricted to Super Admin and National Admin only.
 */

import { Suspense } from 'react'
import { Shield, Activity, Clock, Users } from 'lucide-react'

import { requireRole } from '@/lib/auth'
import { getImpersonationAuditSessions } from '@/lib/data/impersonation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AuditLogTable } from '@/components/admin/audit-log-table'
import { AuditLogFilters } from '@/components/admin/audit-log-filters'
import type { ImpersonationAuditFilters } from '@/types/impersonation'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    start_date?: string
    end_date?: string
    admin_id?: string
    target_user_id?: string
  }>
}

// Stats component for quick overview
async function AuditStats() {
  const supabase = await createServerSupabaseClient()

  // Get total sessions count
  const { count: totalSessions } = await supabase
    .from('impersonation_sessions')
    .select('*', { count: 'exact', head: true })

  // Get active sessions count
  const { count: activeSessions } = await supabase
    .from('impersonation_sessions')
    .select('*', { count: 'exact', head: true })
    .is('ended_at', null)

  // Get sessions in last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { count: recentSessions } = await supabase
    .from('impersonation_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', sevenDaysAgo.toISOString())

  // Get total actions recorded
  const { count: totalActions } = await supabase
    .from('impersonation_action_log')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSessions ?? 0}</div>
          <p className="text-xs text-muted-foreground">All time</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
          <Users className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeSessions ?? 0}</div>
          <p className="text-xs text-muted-foreground">Currently active</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{recentSessions ?? 0}</div>
          <p className="text-xs text-muted-foreground">Sessions this week</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Actions Logged</CardTitle>
          <Activity className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalActions ?? 0}</div>
          <p className="text-xs text-muted-foreground">Total recorded actions</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Table wrapper component
async function AuditTableWrapper({
  searchParamsPromise,
}: {
  searchParamsPromise: PageProps['searchParams']
}) {
  const params = await searchParamsPromise
  const page = Number(params.page) || 1
  const pageSize = 20

  // Build filters from search params
  const filters: ImpersonationAuditFilters = {}

  if (params.start_date) {
    filters.start_date = params.start_date
  }

  if (params.end_date) {
    // Add one day to end_date to include the entire day
    const endDate = new Date(params.end_date)
    endDate.setDate(endDate.getDate() + 1)
    filters.end_date = endDate.toISOString().split('T')[0]
  }

  if (params.admin_id) {
    filters.admin_id = params.admin_id
  }

  if (params.target_user_id) {
    filters.target_user_id = params.target_user_id
  }

  // Fetch audit sessions
  const { sessions, total } = await getImpersonationAuditSessions(filters, page, pageSize)

  // If search param exists, filter sessions client-side for now
  // (Could be moved to server-side with additional query)
  let filteredSessions = sessions
  if (params.search) {
    const searchLower = params.search.toLowerCase()
    filteredSessions = sessions.filter(
      (s) =>
        s.admin_name.toLowerCase().includes(searchLower) ||
        s.admin_email.toLowerCase().includes(searchLower) ||
        s.target_user_name.toLowerCase().includes(searchLower) ||
        s.target_user_email.toLowerCase().includes(searchLower)
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <AuditLogTable
      data={filteredSessions}
      pageCount={totalPages}
    />
  )
}

async function PageContent(props: PageProps) {
  // Require Super Admin or National Admin
  await requireRole(['Super Admin', 'National Admin'])

  const params = await props.searchParams

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Impersonation Audit Log</h1>
        <p className="text-muted-foreground">
          Monitor and review all user impersonation sessions and actions
        </p>
      </div>

      {/* Stats Cards */}
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <AuditStats />
      </Suspense>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>
            Click on a row to expand and view the action log for that session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <AuditLogFilters
            defaultFilters={{
              search: params.search,
              startDate: params.start_date,
              endDate: params.end_date,
            }}
          />

          {/* Table */}
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-[400px] w-full" />
              </div>
            }
          >
            <AuditTableWrapper searchParamsPromise={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ImpersonationAuditPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <PageContent {...props} />
    </Suspense>
  )
}
