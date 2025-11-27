/**
 * Manage Opportunities Page
 *
 * Admin/Coordinator interface for managing industry opportunities.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  Briefcase,
  Plus,
  Users,
  Clock,
  CheckCircle,
  Eye,
  Pencil,
  MoreHorizontal,
  BarChart3,
} from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import { getOpportunitiesForManagement } from '@/lib/data/industry-opportunity'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format, isPast } from 'date-fns'

export default async function ManageOpportunitiesPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <Suspense fallback={<ManageOpportunitiesPageSkeleton />}>
      <ManageOpportunitiesPageContent />
    </Suspense>
  )
}

async function ManageOpportunitiesPageContent() {
  const member = await getCurrentUserMember()

  if (!member) {
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">Member Profile Required</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Your member profile has not been set up yet. Please contact your chapter administrator to complete your member profile setup.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get opportunities for management
  const opportunities = await getOpportunitiesForManagement(
    member.chapter_id || undefined
  )

  // Count stats
  const stats = {
    total: opportunities.length,
    active: opportunities.filter((o) => o.status === 'accepting_applications').length,
    closed: opportunities.filter((o) => o.status === 'closed').length,
    totalApplications: opportunities.reduce(
      (sum, o) => sum + (o.applications_count || 0),
      0
    ),
    pendingReview: opportunities.reduce(
      (sum, o) => sum + (o.pending_applications || 0),
      0
    ),
  }

  const getStatusBadge = (status: string, deadline?: string | null) => {
    if (deadline && isPast(new Date(deadline))) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700">
          Expired
        </Badge>
      )
    }

    switch (status) {
      case 'accepting_applications':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Open
          </Badge>
        )
      case 'closed':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            Closed
          </Badge>
        )
      case 'draft':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            Draft
          </Badge>
        )
      case 'paused':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700">
            Paused
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      internship: 'bg-blue-50 text-blue-700',
      project: 'bg-purple-50 text-purple-700',
      mentorship: 'bg-green-50 text-green-700',
      training: 'bg-cyan-50 text-cyan-700',
      job: 'bg-orange-50 text-orange-700',
      visit: 'bg-pink-50 text-pink-700',
    }
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type}
      </Badge>
    )
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Manage Opportunities
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage industry opportunities
          </p>
        </div>
        <Button asChild>
          <Link href="/opportunities/manage/new">
            <Plus className="mr-2 h-4 w-4" />
            New Opportunity
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applications</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.totalApplications}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.pendingReview}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities Table */}
      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No opportunities yet</h3>
            <p className="text-muted-foreground mt-1">
              Create your first industry opportunity
            </p>
            <Button asChild className="mt-4">
              <Link href="/opportunities/manage/new">
                <Plus className="mr-2 h-4 w-4" />
                New Opportunity
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({stats.closed})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <OpportunitiesTable
              opportunities={opportunities}
              getStatusBadge={getStatusBadge}
              getTypeBadge={getTypeBadge}
            />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <OpportunitiesTable
              opportunities={opportunities.filter((o) => o.status === 'accepting_applications')}
              getStatusBadge={getStatusBadge}
              getTypeBadge={getTypeBadge}
            />
          </TabsContent>

          <TabsContent value="closed" className="mt-6">
            <OpportunitiesTable
              opportunities={opportunities.filter((o) => o.status === 'closed')}
              getStatusBadge={getStatusBadge}
              getTypeBadge={getTypeBadge}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

interface OpportunitiesTableProps {
  opportunities: Array<{
    id: string
    title: string
    type: string
    status: string
    deadline?: string | null
    created_at: string
    applications_count?: number
    pending_applications?: number
    stakeholder?: {
      name: string
    } | null
  }>
  getStatusBadge: (status: string, deadline?: string | null) => React.ReactNode
  getTypeBadge: (type: string) => React.ReactNode
}

function OpportunitiesTable({
  opportunities,
  getStatusBadge,
  getTypeBadge,
}: OpportunitiesTableProps) {
  if (opportunities.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No opportunities in this category
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opportunity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="text-center">Applications</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.map((opportunity) => (
              <TableRow key={opportunity.id}>
                <TableCell>
                  <div>
                    <Link
                      href={`/opportunities/manage/${opportunity.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {opportunity.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {opportunity.stakeholder?.name || 'No partner'}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{getTypeBadge(opportunity.type)}</TableCell>
                <TableCell>
                  {getStatusBadge(opportunity.status, opportunity.deadline)}
                </TableCell>
                <TableCell>
                  {opportunity.deadline
                    ? format(new Date(opportunity.deadline), 'PP')
                    : '-'}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>{opportunity.applications_count || 0}</span>
                    {(opportunity.pending_applications || 0) > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {opportunity.pending_applications} new
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/opportunities/${opportunity.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/opportunities/manage/${opportunity.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/opportunities/manage/${opportunity.id}/applications`}>
                          <Users className="mr-2 h-4 w-4" />
                          Applications
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/opportunities/manage/${opportunity.id}/analytics`}>
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analytics
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ManageOpportunitiesPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}
