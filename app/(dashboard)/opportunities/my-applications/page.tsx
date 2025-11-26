/**
 * My Applications Page
 *
 * View and track all opportunity applications submitted by the member.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Building2,
  ArrowRight,
  Briefcase,
} from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import { getMemberApplications } from '@/lib/data/industry-opportunity'
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
import { format, formatDistanceToNow } from 'date-fns'

export default async function MyApplicationsPage() {
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
    <Suspense fallback={<MyApplicationsPageSkeleton />}>
      <MyApplicationsPageContent />
    </Suspense>
  )
}

async function MyApplicationsPageContent() {
  const member = await getCurrentUserMember()

  if (!member) {
    redirect('/login')
  }

  // Get all applications for the member
  const applications = await getMemberApplications(member.id)

  // Group by status
  const statusCounts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === 'pending_review' || a.status === 'under_review').length,
    shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'declined').length,
    withdrawn: applications.filter((a) => a.status === 'withdrawn').length,
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'shortlisted':
        return <AlertCircle className="h-4 w-4 text-blue-500" />
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'withdrawn':
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      shortlisted: 'bg-blue-50 text-blue-700 border-blue-200',
      accepted: 'bg-green-50 text-green-700 border-green-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      withdrawn: 'bg-gray-50 text-gray-700 border-gray-200',
    }
    return variants[status] || ''
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            My Applications
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your industry opportunity applications
          </p>
        </div>
        <Button asChild>
          <Link href="/opportunities">
            <Briefcase className="mr-2 h-4 w-4" />
            Browse Opportunities
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
              <FileText className="h-8 w-8 text-muted-foreground" />
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
                <p className="text-sm text-muted-foreground">Shortlisted</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statusCounts.shortlisted}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold text-green-600">
                  {statusCounts.accepted}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {statusCounts.rejected}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No applications yet</h3>
            <p className="text-muted-foreground mt-1">
              Start exploring opportunities and submit your first application
            </p>
            <Button asChild className="mt-4">
              <Link href="/opportunities">
                Browse Opportunities
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              All ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({statusCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="shortlisted">
              Shortlisted ({statusCounts.shortlisted})
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Accepted ({statusCounts.accepted})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <ApplicationsList
              applications={applications}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <ApplicationsList
              applications={applications.filter((a) => a.status === 'pending')}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="shortlisted" className="mt-6">
            <ApplicationsList
              applications={applications.filter((a) => a.status === 'shortlisted')}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="accepted" className="mt-6">
            <ApplicationsList
              applications={applications.filter((a) => a.status === 'accepted')}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

interface ApplicationsListProps {
  applications: Array<{
    id: string
    status: string
    applied_at: string
    reviewed_at?: string | null
    reviewer_notes?: string | null
    opportunity?: {
      id: string
      title: string
      type: string
      deadline?: string | null
      stakeholder?: {
        name: string
      } | null
    } | null
  }>
  getStatusIcon: (status: string) => React.ReactNode
  getStatusBadge: (status: string) => string
}

function ApplicationsList({
  applications,
  getStatusIcon,
  getStatusBadge,
}: ApplicationsListProps) {
  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No applications in this category
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <Card
          key={application.id}
          className="hover:shadow-md transition-shadow"
        >
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1">{getStatusIcon(application.status)}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={
                        application.opportunity?.type === 'internship'
                          ? 'bg-blue-50 text-blue-700'
                          : application.opportunity?.type === 'project'
                          ? 'bg-purple-50 text-purple-700'
                          : application.opportunity?.type === 'mentorship'
                          ? 'bg-green-50 text-green-700'
                          : application.opportunity?.type === 'job'
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-gray-50 text-gray-700'
                      }
                    >
                      {application.opportunity?.type || 'opportunity'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getStatusBadge(application.status)}
                    >
                      {application.status}
                    </Badge>
                  </div>
                  <Link href={`/opportunities/${application.opportunity?.id}`}>
                    <h3 className="font-semibold hover:text-primary">
                      {application.opportunity?.title || 'Unknown Opportunity'}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      <span>
                        {application.opportunity?.stakeholder?.name || 'Industry Partner'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Applied {formatDistanceToNow(new Date(application.applied_at))} ago
                      </span>
                    </div>
                  </div>
                  {application.reviewer_notes && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      "{application.reviewer_notes}"
                    </p>
                  )}
                </div>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/opportunities/${application.opportunity?.id}`}>
                  View
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MyApplicationsPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}
