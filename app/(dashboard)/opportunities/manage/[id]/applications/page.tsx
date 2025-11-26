/**
 * Opportunity Applications Page
 *
 * Review and manage applications for an opportunity.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Filter,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/data/auth'
import {
  getOpportunityById,
  getOpportunityApplications,
} from '@/lib/data/industry-opportunity'
import { ApplicationReviewCard } from '@/components/industry-opportunities/application-review-card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OpportunityApplicationsPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <Suspense fallback={<ApplicationsPageSkeleton />}>
      <ApplicationsPageContent params={params} />
    </Suspense>
  )
}

async function ApplicationsPageContent({ params }: PageProps) {
  const user = await getCurrentUser()
  const { id } = await params

  if (!user) {
    redirect('/login')
  }

  // Get opportunity
  const opportunity = await getOpportunityById(id)

  if (!opportunity) {
    notFound()
  }

  // Get applications
  const applications = await getOpportunityApplications(id)

  // Count by status
  const statusCounts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
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
            <BreadcrumbLink href={`/opportunities/manage/${id}`}>
              {opportunity.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Applications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Applications
          </h1>
          <p className="text-muted-foreground mt-1">{opportunity.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/opportunities/manage/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
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
              <Users className="h-8 w-8 text-muted-foreground" />
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
              <Star className="h-8 w-8 text-blue-500" />
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

      {/* Applications */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium">No applications yet</h3>
            <p className="text-muted-foreground mt-1">
              Applications will appear here once members apply
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={statusCounts.pending > 0 ? 'pending' : 'all'}>
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {statusCounts.pending > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {statusCounts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shortlisted">
              Shortlisted ({statusCounts.shortlisted})
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Accepted ({statusCounts.accepted})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <ApplicationsList applications={applications} />
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <ApplicationsList
              applications={applications.filter((a) => a.status === 'pending')}
            />
          </TabsContent>

          <TabsContent value="shortlisted" className="mt-6">
            <ApplicationsList
              applications={applications.filter((a) => a.status === 'shortlisted')}
            />
          </TabsContent>

          <TabsContent value="accepted" className="mt-6">
            <ApplicationsList
              applications={applications.filter((a) => a.status === 'accepted')}
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
    match_score?: number | null
    motivation_statement?: string | null
    member?: {
      profile?: {
        full_name?: string | null
        email?: string | null
        avatar_url?: string | null
      } | null
      industry_background?: string | null
      skills?: string[] | null
    } | null
  }>
}

function ApplicationsList({ applications }: ApplicationsListProps) {
  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No applications in this category
        </CardContent>
      </Card>
    )
  }

  // Sort by match score (highest first), then by date
  const sortedApplications = [...applications].sort((a, b) => {
    const scoreA = a.match_score || 0
    const scoreB = b.match_score || 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
  })

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sortedApplications.map((application) => (
        <ApplicationReviewCard
          key={application.id}
          application={application as any}
        />
      ))}
    </div>
  )
}

function ApplicationsPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  )
}
