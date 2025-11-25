/**
 * Vertical Members Page
 *
 * Manage members and chair assignments for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Plus, Users, Crown, UserMinus } from 'lucide-react'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { getVerticalById, getVerticalMembers } from '@/lib/data/vertical'
import { createClient } from '@/lib/supabase/server'
import type { VerticalChair } from '@/types/vertical'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format } from 'date-fns'

export const metadata = {
  title: 'Vertical Members',
  description: 'Manage members for this vertical',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MembersPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <MembersHeader params={params} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        <MembersContent params={params} />
      </Suspense>
    </div>
  )
}

async function MembersHeader({ params }: PageProps) {
  const { id } = await params
  const vertical = await getVerticalById(id)

  if (!vertical) notFound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-muted-foreground mt-1">
          Manage the team for {vertical.name}
        </p>
      </div>
      <Button asChild>
        <Link href={`/verticals/${id}/members/assign`}>
          <Plus className="h-4 w-4 mr-2" />
          Assign Member
        </Link>
      </Button>
    </div>
  )
}

async function MembersContent({ params }: PageProps) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const vertical = await getVerticalById(id)
  if (!vertical) notFound()

  const members = await getVerticalMembers(id)

  // Get chairs from the database
  const supabase = await createClient()
  const { data: chairsData } = await supabase
    .from('vertical_chairs')
    .select('*')
    .eq('vertical_id', id)
    .order('start_date', { ascending: false })

  const chairs: VerticalChair[] = chairsData || []
  const currentChair = chairs.find((c: VerticalChair) => c.is_active)

  // Get member details for each vertical member (join with profiles for name/email)
  const memberIds = members.map((m) => m.member_id)
  const chairIds = chairs.map((c: VerticalChair) => c.member_id)
  const allIds = [...new Set([...memberIds, ...chairIds])]

  const { data: memberDetailsData } = await supabase
    .from('members')
    .select(`
      id,
      avatar_url,
      profile:profiles!inner(full_name, email)
    `)
    .in('id', allIds)

  // Transform the data to a flat structure
  const memberDetails = (memberDetailsData || []).map((m: any) => ({
    id: m.id,
    full_name: m.profile?.full_name || 'Unknown',
    email: m.profile?.email || null,
    avatar_url: m.avatar_url,
  }))

  const getMemberDetail = (memberId: string) => {
    return memberDetails?.find((m) => m.id === memberId)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-6">
      {/* Chair Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Vertical Chair
          </CardTitle>
          <CardDescription>
            Current leadership for this vertical
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentChair ? (
            <div className="flex items-center gap-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <Avatar className="h-16 w-16">
                <AvatarImage src={getMemberDetail(currentChair.member_id)?.avatar_url || ''} />
                <AvatarFallback className="text-lg">
                  {getMemberDetail(currentChair.member_id)?.full_name
                    ? getInitials(getMemberDetail(currentChair.member_id)!.full_name)
                    : '??'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold text-lg">
                  {getMemberDetail(currentChair.member_id)?.full_name || 'Unknown Member'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {getMemberDetail(currentChair.member_id)?.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge>{currentChair.role}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Since {format(new Date(currentChair.start_date), 'MMM yyyy')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Crown className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No chair assigned yet</p>
              <Button asChild>
                <Link href={`/verticals/${id}/members/assign`}>Assign Chair</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({members.filter((m) => m.is_active).length})
          </CardTitle>
          <CardDescription>
            Active members contributing to this vertical
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.filter((m) => m.is_active).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No members assigned yet</p>
              <Button asChild>
                <Link href={`/verticals/${id}/members/assign`}>Add Members</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {members
                .filter((m) => m.is_active)
                .map((member) => {
                  const detail = getMemberDetail(member.member_id)
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={detail?.avatar_url || ''} />
                          <AvatarFallback>
                            {detail?.full_name ? getInitials(detail.full_name) : '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{detail?.full_name || 'Unknown Member'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {member.role_in_vertical && <Badge variant="secondary">{member.role_in_vertical}</Badge>}
                            <span>
                              Joined {format(new Date(member.joined_date), 'MMM yyyy')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Chairs */}
      {chairs.filter((c: VerticalChair) => !c.is_active).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Chairs</CardTitle>
            <CardDescription>Historical leadership</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chairs
                .filter((c: VerticalChair) => !c.is_active)
                .map((chair: VerticalChair) => {
                  const detail = getMemberDetail(chair.member_id)
                  return (
                    <div
                      key={chair.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={detail?.avatar_url || ''} />
                          <AvatarFallback>
                            {detail?.full_name ? getInitials(detail.full_name) : '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{detail?.full_name || 'Unknown Member'}</p>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(chair.start_date), 'MMM yyyy')}
                            {chair.end_date && (
                              <> - {format(new Date(chair.end_date), 'MMM yyyy')}</>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{chair.role}</Badge>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-9 w-48 mb-1" />
        <Skeleton className="h-5 w-64" />
      </div>
      <Skeleton className="h-10 w-36" />
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
