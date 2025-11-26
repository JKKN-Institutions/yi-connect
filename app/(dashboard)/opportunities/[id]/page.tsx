/**
 * Opportunity Detail Page
 *
 * Detailed view of an industry opportunity with application option.
 */

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Bookmark,
  Share2,
} from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import {
  getOpportunityById,
  getOpportunityWithMatchScore,
  getMemberApplication,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { format, differenceInDays, isPast } from 'date-fns'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OpportunityDetailPage({ params }: PageProps) {
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
    <Suspense fallback={<OpportunityDetailSkeleton />}>
      <OpportunityDetailContent params={params} />
    </Suspense>
  )
}

async function OpportunityDetailContent({ params }: PageProps) {
  const member = await getCurrentUserMember()
  const { id } = await params

  if (!member) {
    redirect('/login')
  }

  // Fetch opportunity with match score
  const opportunity = await getOpportunityWithMatchScore(id, member.id)

  if (!opportunity) {
    notFound()
  }

  // Check if user has already applied
  const existingApplication = await getMemberApplication(id, member.id)

  // Check deadline status
  const isExpired = opportunity.deadline ? isPast(new Date(opportunity.deadline)) : false
  const daysLeft = opportunity.deadline
    ? differenceInDays(new Date(opportunity.deadline), new Date())
    : null

  // Match score breakdown
  const matchBreakdown = opportunity.match_breakdown || {
    industry: 0,
    skills: 0,
    experience: 0,
    engagement: 0,
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/opportunities">Opportunities</BreadcrumbLink>
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
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : opportunity.type === 'project'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : opportunity.type === 'mentorship'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : opportunity.type === 'job'
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }
            >
              {opportunity.type}
            </Badge>
            {opportunity.is_featured && (
              <Badge className="bg-yellow-100 text-yellow-700">Featured</Badge>
            )}
            {isExpired ? (
              <Badge variant="destructive">Closed</Badge>
            ) : opportunity.status === 'accepting_applications' ? (
              <Badge className="bg-green-100 text-green-700">Open</Badge>
            ) : (
              <Badge variant="secondary">{opportunity.status}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{opportunity.title}</h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span>{opportunity.stakeholder?.name || 'Industry Partner'}</span>
            </div>
            {opportunity.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{opportunity.location}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline">
            <Link href="/opportunities">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>About This Opportunity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap">{opportunity.description}</p>

              {opportunity.requirements && opportunity.requirements.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Requirements</h4>
                    <ul className="space-y-1">
                      {opportunity.requirements.map((req: string, i: number) => (
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
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">What You'll Get</h4>
                    <ul className="space-y-1">
                      {opportunity.benefits.map((benefit: string, i: number) => (
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

          {/* Details Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {opportunity.duration && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">{opportunity.duration}</p>
                    </div>
                  </div>
                )}
                {opportunity.positions_available && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Users className="h-5 w-5" />
                    </div>
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
                    <div className="p-2 bg-muted rounded-lg">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Compensation</p>
                      <p className="font-medium">
                        {opportunity.compensation_type === 'paid'
                          ? `Paid ${opportunity.compensation_amount ? `- ${opportunity.compensation_amount}` : ''}`
                          : opportunity.compensation_type === 'stipend'
                          ? `Stipend ${opportunity.compensation_amount ? `- ${opportunity.compensation_amount}` : ''}`
                          : 'Unpaid/Volunteer'}
                      </p>
                    </div>
                  </div>
                )}
                {opportunity.start_date && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">
                        {format(new Date(opportunity.start_date), 'PPP')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Company Info */}
          {opportunity.stakeholder && (
            <Card>
              <CardHeader>
                <CardTitle>About the Company</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={opportunity.stakeholder.logo_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {opportunity.stakeholder.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {opportunity.stakeholder.name}
                    </h3>
                    {opportunity.stakeholder.industry_type && (
                      <p className="text-muted-foreground">
                        {opportunity.stakeholder.industry_type}
                      </p>
                    )}
                    {opportunity.stakeholder.city && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {opportunity.stakeholder.city}
                        {opportunity.stakeholder.state && `, ${opportunity.stakeholder.state}`}
                      </p>
                    )}
                    {opportunity.stakeholder.website && (
                      <Button asChild variant="link" className="px-0 mt-2">
                        <a
                          href={opportunity.stakeholder.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Visit Website
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Application Status / CTA */}
          <Card className={existingApplication ? 'border-green-200 bg-green-50' : ''}>
            <CardContent className="pt-6">
              {existingApplication ? (
                <div className="text-center space-y-3">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Application Submitted</p>
                    <p className="text-sm text-green-700">
                      Applied on {format(new Date(existingApplication.applied_at), 'PPP')}
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
                    {existingApplication.status}
                  </Badge>
                  <Button asChild variant="outline" className="w-full mt-2">
                    <Link href="/opportunities/my-applications">
                      View My Applications
                    </Link>
                  </Button>
                </div>
              ) : isExpired ? (
                <div className="text-center space-y-3">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-semibold">Applications Closed</p>
                    <p className="text-sm text-muted-foreground">
                      The deadline for this opportunity has passed
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {daysLeft !== null && (
                    <div
                      className={`text-center p-3 rounded-lg ${
                        daysLeft <= 3
                          ? 'bg-red-50 text-red-700'
                          : daysLeft <= 7
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">Application Deadline</p>
                      <p className="font-bold text-lg">
                        {daysLeft === 0
                          ? 'Today!'
                          : daysLeft === 1
                          ? '1 day left'
                          : `${daysLeft} days left`}
                      </p>
                      <p className="text-xs">
                        {format(new Date(opportunity.deadline!), 'PPP')}
                      </p>
                    </div>
                  )}
                  <Button asChild className="w-full" size="lg">
                    <Link href={`/opportunities/${id}/apply`}>
                      Apply Now
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Match Score */}
          {opportunity.match_score !== undefined && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Match Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <span
                    className={`text-4xl font-bold ${
                      opportunity.match_score >= 80
                        ? 'text-green-600'
                        : opportunity.match_score >= 60
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {opportunity.match_score}%
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Industry Match</span>
                      <span>{matchBreakdown.industry}%</span>
                    </div>
                    <Progress value={matchBreakdown.industry} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Skills Match</span>
                      <span>{matchBreakdown.skills}%</span>
                    </div>
                    <Progress value={matchBreakdown.skills} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Experience</span>
                      <span>{matchBreakdown.experience}%</span>
                    </div>
                    <Progress value={matchBreakdown.experience} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Engagement</span>
                      <span>{matchBreakdown.engagement}%</span>
                    </div>
                    <Progress value={matchBreakdown.engagement} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Posted</span>
                <span>{format(new Date(opportunity.created_at), 'PP')}</span>
              </div>
              {opportunity.applications_count !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applications</span>
                  <span>{opportunity.applications_count}</span>
                </div>
              )}
              {opportunity.skills_required && opportunity.skills_required.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Skills Required</p>
                  <div className="flex flex-wrap gap-1">
                    {opportunity.skills_required.map((skill: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function OpportunityDetailSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  )
}
