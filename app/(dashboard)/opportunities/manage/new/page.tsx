/**
 * New Opportunity Page
 *
 * Form for creating new industry opportunities.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { ArrowLeft, Briefcase } from 'lucide-react';
import { getCurrentUserMember } from '@/lib/data/members';
import { getActiveIndustryPartners } from '@/lib/data/industry-opportunity';
import { OpportunityForm } from '@/components/industry-opportunities/opportunity-form';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default async function NewOpportunityPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair']);

  return (
    <Suspense fallback={<NewOpportunityPageSkeleton />}>
      <NewOpportunityPageContent />
    </Suspense>
  );
}

async function NewOpportunityPageContent() {
  const member = await getCurrentUserMember();

  if (!member) {
    return (
      <div className='container py-6 max-w-9xl mx-auto'>
        <Card>
          <CardContent className='py-12 text-center'>
            <Briefcase className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
            <h3 className='text-lg font-medium'>Member Profile Required</h3>
            <p className='text-muted-foreground mt-1 max-w-md mx-auto'>
              Your member profile has not been set up yet. Please contact your
              chapter administrator to complete your member profile setup.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get industry partners for selection
  const partners = await getActiveIndustryPartners(
    member.chapter_id || undefined
  );

  return (
    <div className='container py-6 space-y-6 max-w-9xl mx-auto'>
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/opportunities/manage'>
              Manage Opportunities
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Opportunity</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold flex items-center gap-2'>
            <Briefcase className='h-6 w-6' />
            Create New Opportunity
          </h1>
          <p className='text-muted-foreground mt-1'>
            Post a new industry opportunity for members
          </p>
        </div>
        <Button asChild variant='outline'>
          <Link href='/opportunities/manage'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Link>
        </Button>
      </div>

      {/* Form */}
      <OpportunityForm industryId='' chapterId={member.chapter_id || ''} />
    </div>
  );
}

function NewOpportunityPageSkeleton() {
  return (
    <div className='container py-6 space-y-6 max-w-9xl mx-auto'>
      <Skeleton className='h-6 w-48' />
      <div className='flex items-center justify-between'>
        <div>
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-4 w-48 mt-2' />
        </div>
        <Skeleton className='h-10 w-24' />
      </div>
      <Card>
        <CardContent className='pt-6'>
          <Skeleton className='h-[600px] w-full' />
        </CardContent>
      </Card>
    </div>
  );
}
