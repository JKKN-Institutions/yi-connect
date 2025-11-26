/**
 * Visit Requests Page
 *
 * Browse and manage industry visit requests.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  Building2,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Users,
  MapPin,
} from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import { getVisitRequests, getMyVisitRequests } from '@/lib/data/industry-opportunity'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format, formatDistanceToNow } from 'date-fns'

export default async function VisitRequestsPage() {
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member',
    'Member',
  ])

  return (
    <Suspense fallback={<VisitRequestsPageSkeleton />}>
      <VisitRequestsPageContent />
    </Suspense>
  )
}

async function VisitRequestsPageContent() {
  const member = await getCurrentUserMember()

  if (!member) {
    redirect('/login')
  }

  const isAdmin = ['Super Admin', 'National Admin', 'Chair', 'Co-Chair'].includes(
    member.role || ''
  )

  // Get visit requests based on role
  const requestsResult = isAdmin
    ? await getVisitRequests({
        filters: { chapter_id: member.chapter_id || undefined },
      })
    : await getMyVisitRequests(member.id)

  // Get the data array from paginated result or direct array
  const requests = Array.isArray(requestsResult) ? requestsResult : requestsResult.data

  // Count by status - using valid status values
  const statusCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending_yi_review').length,
    approved: requests.filter((r) => r.status === 'yi_approved' || r.status === 'industry_accepted').length,
    scheduled: requests.filter((r) => r.status === 'scheduled').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    cancelled: requests.filter((r) => r.status === 'cancelled' || r.status === 'industry_declined').length,
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      approved: 'bg-blue-50 text-blue-700 border-blue-200',
      scheduled: 'bg-purple-50 text-purple-700 border-purple-200',
      completed: 'bg-green-50 text-green-700 border-green-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    }
    return variants[status] || ''
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'approved':
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Industry Visit Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? 'Manage chapter industry visit requests'
              : 'Request and track your industry visits'}
          </p>
        </div>
        <Button asChild>
          <Link href="/visit-requests/new">
            <Plus className="mr-2 h-4 w-4" />
            New Request
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
                <p className="text-2xl font-bold">{statusCounts.all}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {statusCounts.pending}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statusCounts.approved}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold text-purple-600">
                  {statusCounts.scheduled}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {statusCounts.completed}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No visit requests yet</h3>
            <p className="text-muted-foreground mt-1">
              Submit a request to visit an industry partner
            </p>
            <Button asChild className="mt-4">
              <Link href="/visit-requests/new">
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({statusCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming ({statusCounts.approved + statusCounts.scheduled})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({statusCounts.completed})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <RequestsList
              requests={requests}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <RequestsList
              requests={requests.filter((r) => r.status === 'pending')}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            <RequestsList
              requests={requests.filter(
                (r) => r.status === 'approved' || r.status === 'scheduled'
              )}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <RequestsList
              requests={requests.filter((r) => r.status === 'completed')}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              isAdmin={isAdmin}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

interface RequestsListProps {
  requests: Array<{
    id: string
    status: string
    visit_type: string
    purpose: string
    preferred_dates?: string[] | null
    scheduled_date?: string | null
    group_size?: number | null
    created_at: string
    stakeholder?: {
      id: string
      name: string
      city?: string | null
      logo_url?: string | null
    } | null
    requester?: {
      profile?: {
        full_name?: string | null
        avatar_url?: string | null
      } | null
    } | null
  }>
  getStatusIcon: (status: string) => React.ReactNode
  getStatusBadge: (status: string) => string
  isAdmin: boolean
}

function RequestsList({
  requests,
  getStatusIcon,
  getStatusBadge,
  isAdmin,
}: RequestsListProps) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No requests in this category
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <Card key={request.id} className="hover:shadow-md transition-shadow">
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={request.stakeholder?.logo_url || undefined} />
                  <AvatarFallback>
                    {request.stakeholder?.name?.substring(0, 2).toUpperCase() || 'IV'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={
                        request.visit_type === 'solo'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }
                    >
                      {request.visit_type === 'solo' ? 'Individual' : 'Group Visit'}
                    </Badge>
                    <Badge variant="outline" className={getStatusBadge(request.status)}>
                      {getStatusIcon(request.status)}
                      <span className="ml-1">{request.status}</span>
                    </Badge>
                  </div>
                  <h3 className="font-semibold">
                    {request.stakeholder?.name || 'Industry Partner'}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {request.purpose}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {request.stakeholder?.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{request.stakeholder.city}</span>
                      </div>
                    )}
                    {request.group_size && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{request.group_size} people</span>
                      </div>
                    )}
                    {request.scheduled_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(request.scheduled_date), 'PPP')}
                        </span>
                      </div>
                    ) : request.preferred_dates && request.preferred_dates.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Preferred: {format(new Date(request.preferred_dates[0]), 'PP')}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {isAdmin && request.requester?.profile?.full_name && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Requested by {request.requester.profile.full_name}{' '}
                      {formatDistanceToNow(new Date(request.created_at))} ago
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/visit-requests/${request.id}`}>View Details</Link>
                </Button>
                {isAdmin && request.status === 'pending' && (
                  <Button size="sm">Review</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function VisitRequestsPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}
