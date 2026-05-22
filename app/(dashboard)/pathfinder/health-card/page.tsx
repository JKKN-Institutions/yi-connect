/**
 * Health Card List Page
 *
 * View and manage health card activity entries.
 * Shows entries by vertical with filtering and CRUD operations.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, FileText, Users, Calendar, Building2, Trash2, Pencil, Activity } from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import {
  getHealthCardEntries,
  getChapterById,
  getChapterHealthStats,
  getCurrentCalendarYear,
} from '@/lib/data/health-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { REGION_NAMES, SUBMITTER_ROLES, type YiRegion, type SubmitterRole } from '@/types/health-card'

export const metadata = {
  title: 'Health Card',
  description: 'Activity reporting by vertical',
}

export default async function HealthCardPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Vertical Head', 'EC Member'])

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Card</h1>
          <p className="text-muted-foreground mt-1">
            Activity reporting by vertical for {getCurrentCalendarYear()}
          </p>
        </div>
        <Button asChild>
          <Link href="/pathfinder/health-card/new">
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Link>
        </Button>
      </div>

      {/* Content */}
      <Suspense fallback={<HealthCardSkeleton />}>
        <HealthCardContent />
      </Suspense>
    </div>
  )
}

async function HealthCardContent() {
  const chapterId = await getCurrentChapterId()

  if (!chapterId) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Chapter Found</h2>
        <p className="text-muted-foreground">
          You need to be associated with a chapter to view health card entries.
        </p>
      </div>
    )
  }

  const chapter = await getChapterById(chapterId)
  const calendarYear = getCurrentCalendarYear()
  const stats = await getChapterHealthStats(chapterId, calendarYear)
  const { entries, total } = await getHealthCardEntries(chapterId, { calendar_year: calendarYear }, { limit: 50 })

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_activities}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activities_this_month} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">EC Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_ec_participants}</div>
              <p className="text-xs text-muted-foreground">Executive Committee</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Non-EC Participants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_non_ec_participants}</div>
              <p className="text-xs text-muted-foreground">Regular members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total_participants}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activities_this_week} activities this week
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Entries</CardTitle>
              <CardDescription>
                {total} entries for {chapter?.name || 'your chapter'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Activities Logged</h3>
              <p className="text-muted-foreground mb-4">
                Start by logging your first activity.
              </p>
              <Button asChild>
                <Link href="/pathfinder/health-card/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Activity
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Submitter</TableHead>
                    <TableHead className="text-center">EC</TableHead>
                    <TableHead className="text-center">Non-EC</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {new Date(entry.activity_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <div className="font-medium truncate">{entry.activity_name}</div>
                          {entry.activity_description && (
                            <div className="text-sm text-muted-foreground truncate">
                              {entry.activity_description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: entry.vertical?.color || undefined,
                            color: entry.vertical?.color || undefined,
                          }}
                        >
                          {entry.vertical?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{entry.submitter_name}</div>
                          <div className="text-muted-foreground">
                            {SUBMITTER_ROLES.find((r) => r.value === entry.submitter_role)?.label ||
                              entry.submitter_role}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{entry.ec_members_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{entry.non_ec_members_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/pathfinder/health-card/${entry.id}`}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HealthCardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      {/* Table */}
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
