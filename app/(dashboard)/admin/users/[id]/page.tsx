/**
 * Admin User Detail Page
 *
 * Detailed view of a single user with full profile, roles, and activity history.
 * Restricted to Super Admin and National Admin only.
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Pencil,
  Shield,
  Mail,
  Phone,
  Calendar,
  Building2,
  Activity,
} from 'lucide-react'

import { requireRole, getUserHierarchyLevel } from '@/lib/auth'
import { getUserById } from '@/lib/data/users'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ImpersonateButtonWrapper } from '@/components/admin/impersonate-button-server'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

// Helper function to get role badge variant
function getRoleBadgeVariant(hierarchyLevel: number) {
  if (hierarchyLevel >= 7) return 'destructive' // Super Admin
  if (hierarchyLevel >= 6) return 'default' // National Admin
  if (hierarchyLevel >= 5) return 'secondary' // Executive
  if (hierarchyLevel >= 3) return 'outline' // Co-Chair, Chair
  return 'outline' // Regular members
}

async function UserDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  // Await params inside Suspense boundary
  const params = await paramsPromise

  // Require Super Admin or National Admin
  await requireRole(['Super Admin', 'National Admin'])

  // Get admin's hierarchy level for impersonation check
  const adminHierarchyLevel = await getUserHierarchyLevel()

  const user = await getUserById(params.id)

  if (!user) {
    notFound()
  }

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  // Check if admin can impersonate this user
  // Conditions: Admin level >= 6 and higher than user's level
  const canImpersonate =
    adminHierarchyLevel >= 6 && user.hierarchy_level < adminHierarchyLevel

  // Get primary role name for impersonation
  const primaryRole = user.roles[0]?.role_name || 'No Role'

  return (
    <div className='flex flex-1 flex-col gap-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' asChild>
            <Link href='/admin/users'>
              <ArrowLeft className='h-4 w-4' />
            </Link>
          </Button>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>{user.full_name}</h1>
            <p className='text-muted-foreground'>{user.email}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' asChild>
            <Link href={`/admin/users/${user.id}/edit`}>
              <Pencil className='mr-2 h-4 w-4' />
              Edit Profile
            </Link>
          </Button>
        </div>
      </div>

      <div className='grid gap-6 lg:grid-cols-3'>
        {/* Left Column - Profile Info */}
        <div className='space-y-6 lg:col-span-2'>
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center gap-4'>
                <Avatar className='h-20 w-20'>
                  <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                  <AvatarFallback className='text-2xl'>{initials}</AvatarFallback>
                </Avatar>
                <div className='flex-1 space-y-1'>
                  <div className='flex items-center gap-2'>
                    <h3 className='text-xl font-semibold'>{user.full_name}</h3>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {user.roles.map((role) => (
                      <Badge
                        key={role.id}
                        variant={getRoleBadgeVariant(role.hierarchy_level)}
                      >
                        {role.role_name}
                      </Badge>
                    ))}
                    {user.roles.length === 0 && (
                      <Badge variant='outline'>No Role</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className='grid gap-4 md:grid-cols-2'>
                <div className='flex items-center gap-3'>
                  <Mail className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-sm font-medium'>Email</p>
                    <p className='text-sm text-muted-foreground'>{user.email}</p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <Phone className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-sm font-medium'>Phone</p>
                    <p className='text-sm text-muted-foreground'>
                      {user.phone || 'Not provided'}
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <Building2 className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-sm font-medium'>Chapter</p>
                    <p className='text-sm text-muted-foreground'>
                      {user.chapter
                        ? `${user.chapter.name} - ${user.chapter.location}`
                        : 'No Chapter'}
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <Calendar className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-sm font-medium'>Joined</p>
                    <p className='text-sm text-muted-foreground'>
                      {format(new Date(user.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member Record Card */}
          {user.member && (
            <Card>
              <CardHeader>
                <CardTitle>Member Information</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <div>
                    <p className='text-sm font-medium'>Membership Number</p>
                    <p className='text-sm text-muted-foreground'>
                      {user.member.membership_number}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium'>Status</p>
                    <Badge variant='outline'>{user.member.membership_status}</Badge>
                  </div>
                  <div>
                    <p className='text-sm font-medium'>Company</p>
                    <p className='text-sm text-muted-foreground'>
                      {user.member.company || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium'>Designation</p>
                    <p className='text-sm text-muted-foreground'>
                      {user.member.designation || 'Not provided'}
                    </p>
                  </div>
                  {user.member.member_since && (
                    <div>
                      <p className='text-sm font-medium'>Member Since</p>
                      <p className='text-sm text-muted-foreground'>
                        {format(new Date(user.member.member_since), 'MMM yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role Change History */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Activity className='h-5 w-5' />
                Role Change History
              </CardTitle>
              <CardDescription>Recent role assignments and removals</CardDescription>
            </CardHeader>
            <CardContent>
              {user.role_changes.length === 0 ? (
                <div className='rounded-lg border border-dashed p-8 text-center'>
                  <Activity className='mx-auto h-12 w-12 text-muted-foreground' />
                  <p className='mt-2 text-sm text-muted-foreground'>
                    No role changes yet
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {user.role_changes.map((change) => (
                    <div
                      key={change.id}
                      className='flex items-start justify-between border-l-2 border-primary pl-4'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <Badge
                            variant={
                              change.action === 'assigned' ? 'default' : 'secondary'
                            }
                          >
                            {change.role_name}
                          </Badge>
                          <span className='text-sm font-medium'>
                            {change.action === 'assigned' ? 'Assigned' : 'Removed'}
                          </span>
                        </div>
                        <p className='mt-1 text-xs text-muted-foreground'>
                          {format(new Date(change.created_at), 'MMM dd, yyyy h:mm a')}
                          {change.changed_by_name && ` by ${change.changed_by_name}`}
                        </p>
                        {change.notes && (
                          <p className='mt-1 text-sm text-muted-foreground'>
                            {change.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Stats */}
        <div className='space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {canImpersonate && (
                <ImpersonateButtonWrapper
                  userId={user.id}
                  userName={user.full_name}
                  userRole={primaryRole}
                  userChapter={user.chapter?.name}
                  userEmail={user.email}
                  userAvatar={user.avatar_url}
                  variant='outline'
                  className='w-full justify-start'
                />
              )}
              <Button variant='outline' className='w-full justify-start' asChild>
                <Link href={`/admin/users/${user.id}/edit`}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit Profile
                </Link>
              </Button>
              <Button variant='outline' className='w-full justify-start'>
                <Shield className='mr-2 h-4 w-4' />
                Manage Roles
              </Button>
              <Button
                variant='outline'
                className='w-full justify-start'
                disabled={!user.is_active}
              >
                <Mail className='mr-2 h-4 w-4' />
                Send Email
              </Button>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <p className='text-sm font-medium'>Status</p>
                <Badge
                  variant={user.is_active ? 'default' : 'secondary'}
                  className='mt-1'
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className='text-sm font-medium'>Hierarchy Level</p>
                <p className='mt-1 text-2xl font-bold'>{user.hierarchy_level}</p>
              </div>
              <div>
                <p className='text-sm font-medium'>Member Record</p>
                <Badge
                  variant={user.has_member_record ? 'outline' : 'secondary'}
                  className='mt-1'
                >
                  {user.has_member_record ? 'Yes' : 'No'}
                </Badge>
              </div>
              {user.last_login && (
                <div>
                  <p className='text-sm font-medium'>Last Login</p>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    {format(new Date(user.last_login), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div>
                <p className='font-medium'>User ID</p>
                <p className='font-mono text-xs text-muted-foreground'>{user.id}</p>
              </div>
              <div>
                <p className='font-medium'>Created</p>
                <p className='text-muted-foreground'>
                  {format(new Date(user.created_at), 'MMM dd, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <p className='font-medium'>Last Updated</p>
                <p className='text-muted-foreground'>
                  {format(new Date(user.updated_at), 'MMM dd, yyyy h:mm a')}
                </p>
              </div>
              {user.approved_at && (
                <div>
                  <p className='font-medium'>Approved</p>
                  <p className='text-muted-foreground'>
                    {format(new Date(user.approved_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function UserDetailPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className='flex flex-1 flex-col gap-6 p-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <Skeleton className='h-10 w-10' />
              <div className='space-y-2'>
                <Skeleton className='h-8 w-64' />
                <Skeleton className='h-4 w-48' />
              </div>
            </div>
            <Skeleton className='h-10 w-32' />
          </div>

          <div className='grid gap-6 lg:grid-cols-3'>
            <div className='space-y-6 lg:col-span-2'>
              <Card>
                <CardHeader>
                  <Skeleton className='h-6 w-40' />
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    <Skeleton className='h-20 w-20 rounded-full' />
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-full' />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className='space-y-6'>
              <Card>
                <CardHeader>
                  <Skeleton className='h-6 w-32' />
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <Skeleton className='h-10 w-full' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      }
    >
      <UserDetailContent paramsPromise={props.params} />
    </Suspense>
  )
}
