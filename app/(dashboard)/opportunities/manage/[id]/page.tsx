/**
 * Opportunity Management Detail Page
 *
 * View and manage a specific opportunity.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  ArrowLeft,
  Briefcase,
  Pencil,
  Users,
  BarChart3,
  Eye,
  Clock,
  Calendar,
  MapPin,
  Building2,
  DollarSign,
  CheckCircle,
  Pause,
  Play,
  Archive,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import {
  getOpportunityById,
  getOpportunityApplications,
} from '@/lib/data/industry-opportunity'
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
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { format, isPast, differenceInDays } from 'date-fns'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OpportunityManageDetailPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <Suspense fallback={<ManageDetailSkeleton />}>
      <ManageDetailContent params={params} />
    </Suspense>
  )
}

async function ManageDetailContent({ params }: PageProps) {
  const user = await getCurrentUser()
  const { id } = await params

  if (!user) {
    redirect('/login')
  }

  const opportunity = await getOpportunityById(id)

  if (!opportunity) {
    notFound()
  }

  // Get applications summary
  const applications = await getOpportunityApplications(id)
  const applicationStats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
  }

  const isExpired = opportunity.deadline
    ? isPast(new Date(opportunity.deadline))
    : false
  const daysLeft = opportunity.deadline
    ? differenceInDays(new Date(opportunity.deadline), new Date())
    : null

  const getStatusBadge = () => {
    if (isExpired) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700">
          Expired
        </Badge>
      )
    }

    switch (opportunity.status) {
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
      case 'completed':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            Completed
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Cancelled
          </Badge>
        )
      default:
        return <Badge variant="outline">{opportunity.status}</Badge>
    }
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/opportunities/manage">
              Manage Opportunities
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{opportunity.title}</BreadcrumbPage>
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
                opportunity.type === 'internship'
                  ? 'bg-blue-50 text-blue-700'
                  : opportunity.type === 'project'
                  ? 'bg-purple-50 text-purple-700'
                  : opportunity.type === 'mentorship'
                  ? 'bg-green-50 text-green-700'
                  : opportunity.type === 'job'
                  ? 'bg-orange-50 text-orange-700'
                  : 'bg-gray-50 text-gray-700'
              }
            >
              {opportunity.type}
            </Badge>
            {getStatusBadge()}
            {opportunity.is_featured && (
              <Badge className="bg-yellow-100 text-yellow-700">Featured</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{opportunity.title}</h1>
          <p className="text-muted-foreground">
            Created {format(new Date(opportunity.created_at), 'PPP')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/opportunities/${id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/opportunities/manage/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/opportunities/manage">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/opportunities/manage/${id}/applications`}>
                <Users className="mr-2 h-4 w-4" />
                View Applications
                {applicationStats.pending > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {applicationStats.pending} new
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/opportunities/manage/${id}/analytics`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
            {opportunity.status === 'accepting_applications' && (
              <Button variant="outline">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            {opportunity.status === 'draft' && (
              <Button variant="outline">
                <Play className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
            {opportunity.status === 'accepting_applications' && (
              <Button variant="outline">
                <Archive className="mr-2 h-4 w-4" />
                Close
              </Button>
            )}
          </div>

          {/* Application Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Application Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold">{applicationStats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600">
                    {applicationStats.pending}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">
                    {applicationStats.shortlisted}
                  </p>
                  <p className="text-sm text-muted-foreground">Shortlisted</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {applicationStats.accepted}
                  </p>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Button asChild variant="link">
                  <Link href={`/opportunities/manage/${id}/applications`}>
                    View all applications
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{opportunity.description}</p>

              {opportunity.requirements && opportunity.requirements.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">Requirements</h4>
                    <ul className="space-y-1">
                      {opportunity.requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {opportunity.benefits && opportunity.benefits.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">Benefits</h4>
                    <ul className="space-y-1">
                      {opportunity.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Deadline */}
          {opportunity.deadline && (
            <Card
              className={
                isExpired
                  ? 'border-gray-200 bg-gray-50'
                  : daysLeft !== null && daysLeft <= 7
                  ? 'border-red-200 bg-red-50'
                  : ''
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar
                    className={`h-8 w-8 ${
                      isExpired
                        ? 'text-gray-400'
                        : daysLeft !== null && daysLeft <= 7
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-bold">
                      {format(new Date(opportunity.deadline), 'PPP')}
                    </p>
                    {!isExpired && daysLeft !== null && (
                      <p
                        className={`text-sm ${
                          daysLeft <= 7 ? 'text-red-600' : 'text-muted-foreground'
                        }`}
                      >
                        {daysLeft === 0
                          ? 'Closes today!'
                          : daysLeft === 1
                          ? '1 day left'
                          : `${daysLeft} days left`}
                      </p>
                    )}
                    {isExpired && (
                      <p className="text-sm text-gray-600">Expired</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {opportunity.duration && (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{opportunity.duration}</p>
                  </div>
                </div>
              )}
              {opportunity.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{opportunity.location}</p>
                  </div>
                </div>
              )}
              {opportunity.positions_available && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Positions</p>
                    <p className="font-medium">
                      {opportunity.positions_available} available
                    </p>
                  </div>
                </div>
              )}
              {opportunity.compensation_type && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Compensation</p>
                    <p className="font-medium">
                      {opportunity.compensation_type === 'paid'
                        ? `Paid ${opportunity.compensation_amount || ''}`
                        : opportunity.compensation_type === 'stipend'
                        ? `Stipend ${opportunity.compensation_amount || ''}`
                        : 'Unpaid/Volunteer'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Industry Partner */}
          {opportunity.stakeholder && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Industry Partner</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={opportunity.stakeholder.logo_url || undefined}
                    />
                    <AvatarFallback>
                      {opportunity.stakeholder.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{opportunity.stakeholder.name}</h4>
                    {opportunity.stakeholder.industry_type && (
                      <p className="text-sm text-muted-foreground">
                        {opportunity.stakeholder.industry_type}
                      </p>
                    )}
                    {opportunity.stakeholder.city && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {opportunity.stakeholder.city}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {opportunity.skills_required && opportunity.skills_required.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Required Skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {opportunity.skills_required.map((skill, i) => (
                    <Badge key={i} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ManageDetailSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  )
}
