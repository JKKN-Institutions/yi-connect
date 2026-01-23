/**
 * Admin Users List Page
 *
 * Main page for managing all users in the system.
 * Restricted to Super Admin, National Admin, and Chair.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

import { requireRole } from '@/lib/auth'
import { getUsers, getUserStats } from '@/lib/data/users'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserListItem } from '@/types/user'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UsersTable } from '@/components/admin/users/users-table'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    role_id?: string
    chapter_id?: string
    is_active?: string
    has_member_record?: string
    sort_field?: string
    sort_direction?: string
  }>
}

async function UsersStats() {
  const stats = await getUserStats()

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Total Users</CardTitle>
          <Users className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats.total_users}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Active Users</CardTitle>
          <Users className='h-4 w-4 text-green-600' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats.active_users}</div>
          <p className='text-xs text-muted-foreground'>
            {stats.inactive_users} inactive
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>New This Month</CardTitle>
          <Users className='h-4 w-4 text-blue-600' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats.new_users_this_month}</div>
          <p className='text-xs text-muted-foreground'>
            {stats.new_users_this_week} this week
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>With Roles</CardTitle>
          <Users className='h-4 w-4 text-purple-600' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>
            {Object.values(stats.users_by_role).reduce((a, b) => a + b, 0)}
          </div>
          <p className='text-xs text-muted-foreground'>
            {Object.keys(stats.users_by_role).length} different roles
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function UsersTableWrapper({ searchParamsPromise }: { searchParamsPromise: PageProps['searchParams'] }) {
  const params = await searchParamsPromise
  const page = Number(params.page) || 1
  const pageSize = 20

  // Parse filters
  const filters: any = {}
  if (params.search) filters.search = params.search
  if (params.role_id) filters.role_id = params.role_id
  if (params.chapter_id) filters.chapter_id = params.chapter_id
  if (params.is_active) filters.is_active = params.is_active === 'true'
  if (params.has_member_record)
    filters.has_member_record = params.has_member_record === 'true'

  // Parse sorting
  const sort = params.sort_field
    ? {
        field: params.sort_field as keyof UserListItem | 'role' | 'chapter',
        direction: (params.sort_direction as 'asc' | 'desc') || 'desc'
      }
    : undefined

  // Fetch data
  const { data: users, totalPages } = await getUsers({
    page,
    pageSize,
    filters,
    sort
  })

  // Fetch roles and chapters for filters
  const supabase = await createServerSupabaseClient()

  const [{ data: roles }, { data: chapters }] = await Promise.all([
    supabase.from('roles').select('*').order('hierarchy_level', { ascending: false }),
    supabase
      .from('chapters')
      .select('id, name, location')
      .order('name', { ascending: true })
  ])

  return (
    <UsersTable
      data={users}
      pageCount={totalPages}
      roles={roles || []}
      chapters={chapters || []}
    />
  )
}

async function PageContent(props: PageProps) {
  // Require Super Admin, National Admin, or Chair
  await requireRole(['Super Admin', 'National Admin', 'Chair'])

  return (
    <div className='flex flex-1 flex-col gap-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>User Management</h1>
          <p className='text-muted-foreground'>
            Manage all users, roles, and permissions in the system
          </p>
        </div>
        <Button asChild>
          <Link href='/admin/users/invite'>
            <Plus className='mr-2 h-4 w-4' />
            Invite User
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <Suspense
        fallback={
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className='h-4 w-24' />
                </CardHeader>
                <CardContent>
                  <Skeleton className='h-8 w-16' />
                </CardContent>
              </Card>
            ))}
          </div>
        }
      >
        <UsersStats />
      </Suspense>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage all registered users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className='space-y-4'>
                <div className='flex gap-4'>
                  <Skeleton className='h-9 w-[300px]' />
                  <Skeleton className='h-9 w-[180px]' />
                  <Skeleton className='h-9 w-[180px]' />
                </div>
                <Skeleton className='h-[400px] w-full' />
              </div>
            }
          >
            <UsersTableWrapper searchParamsPromise={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UsersPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className='flex flex-1 flex-col gap-6 p-6'>
          <div className='flex items-center justify-between'>
            <Skeleton className='h-10 w-64' />
            <Skeleton className='h-10 w-32' />
          </div>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className='h-4 w-24' />
                </CardHeader>
                <CardContent>
                  <Skeleton className='h-8 w-16' />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className='h-6 w-32' />
              <Skeleton className='h-4 w-64' />
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='flex gap-4'>
                  <Skeleton className='h-9 w-[300px]' />
                  <Skeleton className='h-9 w-[180px]' />
                  <Skeleton className='h-9 w-[180px]' />
                </div>
                <Skeleton className='h-[400px] w-full' />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PageContent {...props} />
    </Suspense>
  )
}
