/**
 * Visit Request Detail Page
 *
 * View and manage individual visit requests.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  User,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import { getVisitRequestById } from '@/lib/data/industry-opportunity'
import { VisitRequestActions } from './visit-request-actions'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { format, formatDistanceToNow } from 'date-fns'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function VisitRequestDetailPage({ params }: PageProps) {
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
    <Suspense fallback={<VisitRequestDetailSkeleton />}>
      <VisitRequestDetailContent params={params} />
    </Suspense>
  )
}

async function VisitRequestDetailContent({ params }: PageProps) {
  const member = await getCurrentUserMember()
  const { id } = await params

  if (!member) {
    redirect('/login')
  }

  const request = await getVisitRequestById(id)

  if (!request) {
    notFound()
  }

  const isAdmin = ['Super Admin', 'National Admin', 'Chair', 'Co-Chair'].includes(
    member.role || ''
  )
  const isOwner = request.requested_by === member.id

  // Check if user can view this request
  if (!isAdmin && !isOwner) {
    notFound()
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
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'approved':
      case 'scheduled':
        return <Calendar className="h-5 w-5 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5" />
    }
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/visit-requests">Visit Requests</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Request Details</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                request.visit_type === 'solo'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }
            >
              {request.visit_type === 'solo' ? 'Individual Visit' : 'Group Visit'}
            </Badge>
            <Badge variant="outline" className={getStatusBadge(request.status)}>
              {getStatusIcon(request.status)}
              <span className="ml-1 capitalize">{request.status}</span>
            </Badge>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {request.industry?.company_name || 'Industry Visit'}
          </h1>
          <p className="text-muted-foreground">
            Requested {formatDistanceToNow(new Date(request.created_at))} ago
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/visit-requests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Purpose */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Visit Purpose
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{request.visit_purpose}</p>
              {request.additional_notes && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">Additional Notes</h4>
                    <p className="text-muted-foreground">{request.additional_notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.scheduled_date ? (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">Confirmed Date</p>
                  <p className="text-lg font-bold text-green-800">
                    {format(new Date(request.scheduled_date), 'PPPP')}
                  </p>
                  {request.scheduled_time && (
                    <p className="text-green-700">{request.scheduled_time}</p>
                  )}
                </div>
              ) : request.preferred_dates && request.preferred_dates.length > 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Preferred Dates</p>
                  <div className="flex flex-wrap gap-2">
                    {request.preferred_dates.map((dateObj, i) => (
                      <Badge key={i} variant="outline">
                        {format(new Date(dateObj.date), 'PPP')} ({dateObj.time_slot})
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No dates specified</p>
              )}

              {request.visit_type === 'group' && request.expected_participants && (
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span>Expected participants: {request.expected_participants} people</span>
                </div>
              )}

              {request.participant_profile && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Participant Profile</h4>
                    <p className="text-muted-foreground">{request.participant_profile}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Admin Notes */}
          {request.yi_approval_notes && (isAdmin || isOwner) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Review Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{request.yi_approval_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {isAdmin && request.status === 'pending_yi_review' && (
            <VisitRequestActions requestId={id} />
          )}

          {/* Industry Partner */}
          {request.industry && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Industry Partner</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {request.industry.company_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{request.industry.company_name}</h4>
                    {request.industry.industry_sector && (
                      <p className="text-sm text-muted-foreground">
                        {request.industry.industry_sector}
                      </p>
                    )}
                    {request.industry.city && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {request.industry.city}
                      </p>
                    )}
                  </div>
                </div>
                              </CardContent>
            </Card>
          )}

          {/* Requester Info */}
          {isAdmin && request.member && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Requester</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={request.member.avatar_url || undefined} />
                    <AvatarFallback>
                      {request.member.full_name?.substring(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {request.member.full_name || 'Unknown'}
                    </p>
                    {request.member.email && (
                      <p className="text-sm text-muted-foreground">
                        {request.member.email}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested</span>
                  <span>{format(new Date(request.created_at), 'PP')}</span>
                </div>
                {request.yi_reviewed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reviewed</span>
                    <span>{format(new Date(request.yi_reviewed_at), 'PP')}</span>
                  </div>
                )}
                {request.scheduled_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scheduled</span>
                    <span>{format(new Date(request.scheduled_date), 'PP')}</span>
                  </div>
                )}
                {request.converted_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span>{format(new Date(request.converted_at), 'PP')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function VisitRequestDetailSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  )
}
