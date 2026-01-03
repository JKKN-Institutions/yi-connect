/**
 * Edit Vertical Plan Page
 *
 * Edit an existing annual plan for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser, requireRole } from '@/lib/auth';
import {
  getVerticalById,
  getVerticalPlans,
  getCurrentCalendarYear
} from '@/lib/data/vertical';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanForm } from '@/components/verticals/plan-form';

export const metadata = {
  title: 'Edit Vertical Plan',
  description: 'Edit annual plan for this vertical'
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}

export default async function EditPlanPage({ params, searchParams }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <EditPlanHeader params={params} />
      </Suspense>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <EditPlanFormWrapper params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function EditPlanHeader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vertical = await getVerticalById(id);

  if (!vertical) notFound();

  return (
    <div className='flex items-center justify-between'>
      <div>
        <div className='flex items-center gap-2 mb-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link href={`/verticals/${id}/plan`}>
              <ArrowLeft className='h-4 w-4 mr-1' />
              Back to Plan
            </Link>
          </Button>
        </div>
        <h1 className='text-3xl font-bold tracking-tight'>Edit Plan</h1>
        <p className='text-muted-foreground mt-1'>
          Update the annual plan for {vertical.name}
        </p>
      </div>
    </div>
  );
}

async function EditPlanFormWrapper({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { year } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const vertical = await getVerticalById(id);
  if (!vertical) notFound();

  const calendarYear = year ? parseInt(year) : getCurrentCalendarYear();
  const plans = await getVerticalPlans(id);

  // Find the plan for the specified calendar year
  const plan = plans.find((p) => p.calendar_year === calendarYear);

  if (!plan) {
    // Redirect to create new plan if no plan exists
    redirect(`/verticals/${id}/plan?new=true`);
  }

  return (
    <PlanForm
      verticalId={id}
      verticalName={vertical.name}
      plan={plan}
      calendarYear={calendarYear}
    />
  );
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <Skeleton className='h-9 w-32 mb-2' />
        <Skeleton className='h-9 w-48 mb-1' />
        <Skeleton className='h-5 w-64' />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='rounded-lg border p-6'>
        <Skeleton className='h-6 w-48 mb-2' />
        <Skeleton className='h-4 w-64 mb-6' />
        <div className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div>
              <Skeleton className='h-4 w-24 mb-2' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div>
              <Skeleton className='h-4 w-24 mb-2' />
              <Skeleton className='h-10 w-full' />
            </div>
          </div>
          <div>
            <Skeleton className='h-4 w-24 mb-2' />
            <Skeleton className='h-24 w-full' />
          </div>
        </div>
      </div>
      <div className='rounded-lg border p-6'>
        <Skeleton className='h-6 w-32 mb-2' />
        <Skeleton className='h-4 w-56 mb-6' />
        <div className='space-y-4'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-32 w-full' />
          ))}
        </div>
      </div>
      <div className='flex justify-end gap-4'>
        <Skeleton className='h-10 w-20' />
        <Skeleton className='h-10 w-32' />
      </div>
    </div>
  );
}
