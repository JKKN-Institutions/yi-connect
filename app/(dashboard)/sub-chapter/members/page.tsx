/**
 * Chapter Lead Members Page
 *
 * View and manage sub-chapter members.
 */

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Users, Plus, MoreHorizontal, UserMinus, Mail } from 'lucide-react'
import { getSubChapterMembers } from '@/lib/data/sub-chapters'
import { updateMemberStatus } from '@/app/actions/sub-chapters'

export const metadata = {
  title: 'Members | Chapter Lead Portal',
  description: 'Manage your chapter members',
}

async function getSession() {
  const cookieStore = await cookies()
  const leadId = cookieStore.get('chapter_lead_id')?.value
  const subChapterId = cookieStore.get('sub_chapter_id')?.value

  if (!leadId || !subChapterId) {
    return null
  }

  return { leadId, subChapterId }
}

async function MembersContent() {
  const session = await getSession()

  if (!session) {
    redirect('/chapter-lead/login')
  }

  const members = await getSubChapterMembers(session.subChapterId)

  const activeMembers = members.filter((m) => m.is_active)
  const inactiveMembers = members.filter((m) => !m.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Members</h1>
          <p className="text-muted-foreground mt-1">
            Manage students in your chapter ({activeMembers.length} active)
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/chapter-lead/members/add">
            <Plus className="h-4 w-4" />
            Add Members
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeMembers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Events Participated</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeMembers.reduce((sum, m) => sum + m.events_participated, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>
            Students enrolled in your chapter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const initials = member.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.full_name}</p>
                            {member.email && (
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{member.student_id || '-'}</TableCell>
                      <TableCell>{member.department || '-'}</TableCell>
                      <TableCell>{member.year_of_study || '-'}</TableCell>
                      <TableCell>{member.events_participated}</TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? 'default' : 'secondary'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <MemberActions memberId={member.id} isActive={member.is_active} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-muted-foreground">No members yet</p>
              <Button asChild className="mt-4">
                <Link href="/chapter-lead/members/add">Add Members</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MemberActions({
  memberId,
  isActive,
}: {
  memberId: string
  isActive: boolean
}) {
  async function handleStatusChange() {
    'use server'
    await updateMemberStatus(memberId, !isActive)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <form action={handleStatusChange}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full flex items-center gap-2">
              <UserMinus className="h-4 w-4" />
              {isActive ? 'Mark Inactive' : 'Mark Active'}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MembersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>

      <Skeleton className="h-[400px]" />
    </div>
  )
}

export default function ChapterLeadMembersPage() {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersContent />
    </Suspense>
  )
}
