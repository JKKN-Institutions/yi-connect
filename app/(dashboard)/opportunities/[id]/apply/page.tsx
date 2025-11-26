/**
 * Opportunity Application Page
 *
 * Form for members to apply to industry opportunities.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { ArrowLeft, Briefcase, AlertCircle, CheckCircle } from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import {
  getOpportunityById,
  getMemberApplication,
} from '@/lib/data/industry-opportunity'
import { ApplicationForm } from '@/components/industry-opportunities/application-form'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { format, isPast } from 'date-fns'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ApplyPage({ params }: PageProps) {
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
    <Suspense fallback={<ApplyPageSkeleton />}>
      <ApplyPageContent params={params} />
    </Suspense>
  )
}

async function ApplyPageContent({ params }: PageProps) {
  const member = await getCurrentUserMember()
  const { id } = await params

  if (!member) {
    redirect('/login')
  }

  // Fetch opportunity
  const opportunity = await getOpportunityById(id)

  if (!opportunity) {
    notFound()
  }

  // Check if user has already applied
  const existingApplication = await getMemberApplication(id, member.id)

  // Check if deadline has passed
  const isExpired = opportunity.deadline ? isPast(new Date(opportunity.deadline)) : false

  // If already applied, show confirmation
  if (existingApplication) {
    return (
      <div className="container py-6 space-y-6 max-w-2xl mx-auto">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/opportunities">Opportunities</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/opportunities/${id}`}>
                {opportunity.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Apply</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600" />
              <div>
                <h2 className="text-xl font-semibold text-green-800">
                  Application Already Submitted
                </h2>
                <p className="text-green-700 mt-1">
                  You applied on {format(new Date(existingApplication.applied_at), 'PPP')}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  existingApplication.status === 'accepted'
                    ? 'bg-green-100 text-green-700'
                    : existingApplication.status === 'shortlisted'
                    ? 'bg-blue-100 text-blue-700'
                    : existingApplication.status === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }
              >
                Status: {existingApplication.status}
              </Badge>
              <div className="flex justify-center gap-3 pt-4">
                <Button asChild variant="outline">
                  <Link href={`/opportunities/${id}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Opportunity
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/opportunities/my-applications">
                    View My Applications
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If deadline passed, show error
  if (isExpired) {
    return (
      <div className="container py-6 space-y-6 max-w-2xl mx-auto">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/opportunities">Opportunities</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/opportunities/${id}`}>
                {opportunity.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Apply</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Applications Closed</AlertTitle>
          <AlertDescription>
            The deadline for this opportunity was {format(new Date(opportunity.deadline!), 'PPP')}.
            Applications are no longer being accepted.
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline">
          <Link href={`/opportunities/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunity
          </Link>
        </Button>
      </div>
    )
  }

  // If opportunity is not open, show error
  if (opportunity.status !== 'accepting_applications') {
    return (
      <div className="container py-6 space-y-6 max-w-2xl mx-auto">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/opportunities">Opportunities</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/opportunities/${id}`}>
                {opportunity.title}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Apply</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Accepting Applications</AlertTitle>
          <AlertDescription>
            This opportunity is currently {opportunity.status} and not accepting applications.
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline">
          <Link href={`/opportunities/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunity
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container py-6 space-y-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/opportunities">Opportunities</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/opportunities/${id}`}>
              {opportunity.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Apply</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Apply for Opportunity
          </h1>
          <p className="text-muted-foreground mt-1">{opportunity.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/opportunities/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {/* Opportunity Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{opportunity.title}</CardTitle>
              <CardDescription>
                {opportunity.stakeholder?.name || 'Industry Partner'}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                opportunity.type === 'internship'
                  ? 'bg-blue-50 text-blue-700'
                  : opportunity.type === 'project'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-gray-50 text-gray-700'
              }
            >
              {opportunity.type}
            </Badge>
          </div>
        </CardHeader>
        {opportunity.deadline && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Application deadline: {format(new Date(opportunity.deadline), 'PPP')}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Application Form */}
      <ApplicationForm
        opportunity={opportunity}
        memberId={member.id}
      />
    </div>
  )
}

function ApplyPageSkeleton() {
  return (
    <div className="container py-6 space-y-6 max-w-2xl mx-auto">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
