/**
 * Opportunities Browse Page
 *
 * Main page for members to discover and browse industry opportunities.
 * Features filtering, search, and personalized recommendations.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { Briefcase, Filter, Sparkles, Search } from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import {
  getOpportunities,
  getOpportunitiesForMember,
  getOpportunityCategories,
} from '@/lib/data/industry-opportunity'
import { OpportunitiesContent } from './opportunities-content'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface PageProps {
  searchParams: Promise<{
    type?: string
    industry?: string
    status?: string
    search?: string
    page?: string
  }>
}

export default async function OpportunitiesPage({ searchParams }: PageProps) {
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
    <Suspense fallback={<OpportunitiesPageSkeleton />}>
      <OpportunitiesPageContent searchParams={searchParams} />
    </Suspense>
  )
}

async function OpportunitiesPageContent({ searchParams }: PageProps) {
  const member = await getCurrentUserMember()
  const params = await searchParams

  if (!member) {
    redirect('/login')
  }

  // Get opportunities with member match scores
  const opportunities = await getOpportunitiesForMember(member.id, {
    type: params.type as 'internship' | 'project' | 'mentorship' | 'training' | 'job' | 'visit' | undefined,
    industry: params.industry,
    status: 'open',
    search: params.search,
  })

  // Get categories for filters
  const categories = await getOpportunityCategories()

  // Count by type
  const typeCounts = {
    all: opportunities.length,
    internship: opportunities.filter((o) => o.type === 'internship').length,
    project: opportunities.filter((o) => o.type === 'project').length,
    mentorship: opportunities.filter((o) => o.type === 'mentorship').length,
    training: opportunities.filter((o) => o.type === 'training').length,
    job: opportunities.filter((o) => o.type === 'job').length,
    visit: opportunities.filter((o) => o.type === 'visit').length,
  }

  // Get recommended opportunities (high match score)
  const recommended = opportunities
    .filter((o) => (o.match_score || 0) >= 70)
    .slice(0, 3)

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Industry Opportunities
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover internships, projects, mentorships, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {opportunities.length} opportunities
          </Badge>
        </div>
      </div>

      {/* Recommended Section */}
      {recommended.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recommended for You
            </CardTitle>
            <CardDescription>
              Based on your skills, industry, and experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {recommended.map((opp) => (
                <Card key={opp.id} className="bg-background">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant="outline"
                        className={
                          opp.type === 'internship'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : opp.type === 'project'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : opp.type === 'mentorship'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : opp.type === 'job'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }
                      >
                        {opp.type}
                      </Badge>
                      <Badge className="bg-green-100 text-green-700">
                        {opp.match_score}% match
                      </Badge>
                    </div>
                    <h3 className="font-semibold line-clamp-1">{opp.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {opp.stakeholder?.name || 'Industry Partner'}
                    </p>
                    <Button asChild variant="link" className="px-0 mt-2">
                      <a href={`/opportunities/${opp.id}`}>View Details</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-6">
        <Card className={!params.type ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4 text-center cursor-pointer">
            <a href="/opportunities">
              <p className="text-2xl font-bold">{typeCounts.all}</p>
              <p className="text-sm text-muted-foreground">All</p>
            </a>
          </CardContent>
        </Card>
        <Card className={params.type === 'internship' ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4 text-center cursor-pointer">
            <a href="/opportunities?type=internship">
              <p className="text-2xl font-bold text-blue-600">{typeCounts.internship}</p>
              <p className="text-sm text-muted-foreground">Internships</p>
            </a>
          </CardContent>
        </Card>
        <Card className={params.type === 'project' ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4 text-center cursor-pointer">
            <a href="/opportunities?type=project">
              <p className="text-2xl font-bold text-purple-600">{typeCounts.project}</p>
              <p className="text-sm text-muted-foreground">Projects</p>
            </a>
          </CardContent>
        </Card>
        <Card className={params.type === 'mentorship' ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4 text-center cursor-pointer">
            <a href="/opportunities?type=mentorship">
              <p className="text-2xl font-bold text-green-600">{typeCounts.mentorship}</p>
              <p className="text-sm text-muted-foreground">Mentorships</p>
            </a>
          </CardContent>
        </Card>
        <Card className={params.type === 'job' ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4 text-center cursor-pointer">
            <a href="/opportunities?type=job">
              <p className="text-2xl font-bold text-orange-600">{typeCounts.job}</p>
              <p className="text-sm text-muted-foreground">Jobs</p>
            </a>
          </CardContent>
        </Card>
        <Card className={params.type === 'training' ? 'ring-2 ring-primary' : ''}>
          <CardContent className="pt-4 text-center cursor-pointer">
            <a href="/opportunities?type=training">
              <p className="text-2xl font-bold text-cyan-600">{typeCounts.training}</p>
              <p className="text-sm text-muted-foreground">Training</p>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <OpportunitiesContent
        opportunities={opportunities}
        categories={categories}
        currentFilters={{
          type: params.type,
          industry: params.industry,
          search: params.search,
        }}
      />
    </div>
  )
}

function OpportunitiesPageSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-6 w-32" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}
