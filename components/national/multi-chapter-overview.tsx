/**
 * Multi-Chapter Overview Components
 *
 * Dashboard components for National Admin to see all chapters at a glance.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building,
  Users,
  Calendar,
  Clock,
  Plus,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Hourglass,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ChapterOverview {
  id: string
  name: string
  location: string
  status: string
  member_count: number
  chair_name: string | null
  created_at: string
}

interface PendingInvitation {
  id: string
  chapter_name: string
  chapter_location: string
  full_name: string
  phone: string | null
  email: string | null
  expires_at: string
  created_at: string
}

/**
 * Chapters Status Grid
 */
export function ChaptersStatusGrid() {
  const [chapters, setChapters] = useState<ChapterOverview[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchChapters() {
      try {
        const supabase = createBrowserSupabaseClient()

        const { data, error } = await supabase
          .from('chapters')
          .select(
            `
            id,
            name,
            location,
            status,
            member_count,
            created_at,
            chair:profiles!chapters_chair_id_fkey(full_name)
          `
          )
          .order('name')

        if (error) throw error

        setChapters(
          data?.map((ch) => ({
            ...ch,
            chair_name: (ch.chair as any)?.full_name || null,
          })) || []
        )
      } catch (error) {
        console.error('Error fetching chapters:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChapters()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const activeCount = chapters.filter((c) => c.status === 'active').length
  const pendingCount = chapters.filter((c) => c.status === 'pending_chair').length
  const totalMembers = chapters.reduce((acc, c) => acc + (c.member_count || 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              All Chapters
            </CardTitle>
            <CardDescription>
              {chapters.length} chapters total
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/chapters/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Chapter
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="text-2xl font-bold text-green-700">{activeCount}</div>
            <div className="text-xs text-green-600">Active</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
            <div className="text-xs text-yellow-600">Pending Chair</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="text-2xl font-bold text-blue-700">{totalMembers}</div>
            <div className="text-xs text-blue-600">Total Members</div>
          </div>
        </div>

        {/* Chapters table */}
        {chapters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No chapters yet</p>
            <Button asChild className="mt-4">
              <Link href="/admin/chapters/new">Create First Chapter</Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chair</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chapters.slice(0, 10).map((chapter) => (
                  <TableRow key={chapter.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{chapter.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {chapter.location}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={chapter.status} />
                    </TableCell>
                    <TableCell>
                      {chapter.chair_name || (
                        <span className="text-muted-foreground text-sm">
                          Not assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {chapter.member_count || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/chapters/${chapter.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {chapters.length > 10 && (
          <div className="mt-4 text-center">
            <Button variant="outline" asChild>
              <Link href="/admin/chapters">
                View All {chapters.length} Chapters
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Pending Invitations Card
 */
export function PendingInvitationsCard() {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchInvitations() {
      try {
        const supabase = createBrowserSupabaseClient()

        const { data, error } = await supabase
          .from('chapter_invitations')
          .select(
            `
            id,
            full_name,
            phone,
            email,
            token_expires_at,
            created_at,
            chapter:chapters(name, location)
          `
          )
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error

        setInvitations(
          data?.map((inv) => ({
            id: inv.id,
            chapter_name: (inv.chapter as any)?.name || 'Unknown',
            chapter_location: (inv.chapter as any)?.location || '',
            full_name: inv.full_name,
            phone: inv.phone,
            email: inv.email,
            expires_at: inv.token_expires_at,
            created_at: inv.created_at,
          })) || []
        )
      } catch (error) {
        console.error('Error fetching invitations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvitations()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hourglass className="h-5 w-5" />
          Pending Chair Invitations
        </CardTitle>
        <CardDescription>
          {invitations.length === 0
            ? 'No pending invitations'
            : `${invitations.length} invitation(s) awaiting acceptance`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50 text-green-500" />
            <p>All invitations have been accepted!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const isExpiringSoon =
                new Date(invitation.expires_at).getTime() - Date.now() <
                2 * 24 * 60 * 60 * 1000 // 2 days

              return (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {invitation.full_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      for {invitation.chapter_name}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span
                        className={isExpiringSoon ? 'text-yellow-600' : ''}
                      >
                        Expires{' '}
                        {formatDistanceToNow(new Date(invitation.expires_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpiringSoon && (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    {invitation.phone && (
                      <Button variant="outline" size="sm">
                        <Send className="h-3 w-3 mr-1" />
                        Resend
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          Active
        </Badge>
      )
    case 'pending_chair':
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
          Pending Chair
        </Badge>
      )
    case 'suspended':
      return <Badge variant="destructive">Suspended</Badge>
    case 'draft':
      return <Badge variant="outline">Draft</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
