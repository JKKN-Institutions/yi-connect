/**
 * New Visit Request Page
 *
 * Form for submitting industry visit requests.
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { ArrowLeft, Building2 } from 'lucide-react'
import { getCurrentUserMember } from '@/lib/data/members'
import { getActiveIndustryPartners } from '@/lib/data/industry-opportunity'
import { VisitRequestForm } from '@/components/industry-opportunities/visit-request-form'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default async function NewVisitRequestPage() {
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
    <Suspense fallback={<NewVisitRequestPageSkeleton />}>
      <NewVisitRequestPageContent />
    </Suspense>
  )
}

async function NewVisitRequestPageContent() {
  const member = await getCurrentUserMember()

  if (!member) {
    redirect('/login')
  }

  // Get active industry partners for selection
  const partners = await getActiveIndustryPartners(member.chapter_id || undefined)

  // Transform partners to match the form's Industry type
  const industries = partners.map((p) => ({
    id: p.id,
    company_name: p.name,
    industry_sector: p.industry_type || 'Other',
    city: p.city || null,
  }))

  return (
    <div className="container py-6 space-y-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/visit-requests">Visit Requests</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Request</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Request Industry Visit
          </h1>
          <p className="text-muted-foreground mt-1">
            Submit a request to visit an industry partner
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/visit-requests">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      {/* Form */}
      <VisitRequestForm
        memberId={member.id}
        industries={industries}
      />
    </div>
  )
}

function NewVisitRequestPageSkeleton() {
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
        <CardContent className="pt-6">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
