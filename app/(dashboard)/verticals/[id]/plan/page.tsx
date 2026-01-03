/**
 * Vertical Plan Management Page
 *
 * Create or view the annual plan for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { getCurrentUser, requireRole } from '@/lib/auth';
import {
  getVerticalById,
  getVerticalPlans,
  getCurrentCalendarYear
} from '@/lib/data/vertical';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlanForm } from '@/components/verticals/plan-form';

export const metadata = {
  title: 'Manage Vertical Plan',
  description: 'Create or manage annual plan for this vertical'
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}

export default async function VerticalPlanPage({ params, searchParams }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member'])
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <PlanHeader params={params} searchParams={searchParams} />
      </Suspense>

      {/* Content */}
      <Suspense fallback={<ContentSkeleton />}>
        <PlanContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PlanHeader({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const vertical = await getVerticalById(id);

  if (!vertical) notFound();

  return (
    <div className='flex items-center justify-between'>
      <div>
        <div className='flex items-center gap-2 mb-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link href={`/verticals/${id}`}>
              <ArrowLeft className='h-4 w-4 mr-1' />
              Back to {vertical.name}
            </Link>
          </Button>
        </div>
        <h1 className='text-3xl font-bold tracking-tight'>
          {isNew ? 'Create New Plan' : 'Manage Plan'}
        </h1>
        <p className='text-muted-foreground mt-1'>
          Annual planning for {vertical.name}
        </p>
      </div>
    </div>
  );
}

async function PlanContent({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { new: isNew } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const vertical = await getVerticalById(id);
  if (!vertical) notFound();

  const calendarYear = getCurrentCalendarYear();
  const plans = await getVerticalPlans(id);

  // Find current calendar year plan
  const currentPlan = plans.find((p) => p.calendar_year === calendarYear);

  // If explicitly creating new plan or no current plan exists
  if (isNew || !currentPlan) {
    return (
      <PlanForm
        verticalId={id}
        verticalName={vertical.name}
        calendarYear={calendarYear}
      />
    );
  }

  // Show existing plan with option to edit
  return (
    <div className='space-y-6'>
      {/* Current Plan Summary */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <FileText className='h-5 w-5' />
                {(currentPlan as any).plan_name}
              </CardTitle>
              <CardDescription>
                {currentPlan.calendar_year} (Jan - Dec)
              </CardDescription>
            </div>
            <Badge
              variant={
                currentPlan.status === 'active'
                  ? 'default'
                  : currentPlan.status === 'approved'
                  ? 'secondary'
                  : currentPlan.status === 'completed'
                  ? 'outline'
                  : 'secondary'
              }
            >
              {currentPlan.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {(currentPlan as any).vision && (
            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-1'>
                Vision
              </h4>
              <p className='text-sm'>{(currentPlan as any).vision}</p>
            </div>
          )}

          {(currentPlan as any).mission && (
            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-1'>
                Mission
              </h4>
              <p className='text-sm'>{(currentPlan as any).mission}</p>
            </div>
          )}

          <div className='grid grid-cols-2 gap-4 pt-2'>
            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-1'>
                Total Budget
              </h4>
              <p className='text-lg font-semibold'>
                ₹{((currentPlan as any).total_budget || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-1'>
                KPIs Defined
              </h4>
              <p className='text-lg font-semibold'>
                {currentPlan.kpis?.length || 0} KPIs
              </p>
            </div>
          </div>

          {/* KPIs List */}
          {currentPlan.kpis && currentPlan.kpis.length > 0 && (
            <div className='pt-4'>
              <h4 className='text-sm font-medium text-muted-foreground mb-3'>
                Key Performance Indicators
              </h4>
              <div className='space-y-2'>
                {currentPlan.kpis.map((kpi, index) => (
                  <div
                    key={kpi.id}
                    className='flex items-center justify-between p-3 rounded-lg border'
                  >
                    <div className='flex items-center gap-3'>
                      <span className='text-sm font-medium text-muted-foreground'>
                        #{index + 1}
                      </span>
                      <div>
                        <p className='font-medium'>{kpi.kpi_name}</p>
                        <p className='text-xs text-muted-foreground'>
                          Q1: {kpi.target_q1} | Q2: {kpi.target_q2} | Q3:{' '}
                          {kpi.target_q3} | Q4: {kpi.target_q4}
                        </p>
                      </div>
                    </div>
                    <Badge variant='outline'>{kpi.weight}%</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className='flex justify-end gap-4'>
        <Button variant='outline' asChild>
          <Link href={`/verticals/${id}/plan/edit`}>Edit Plan</Link>
        </Button>
        <Button asChild>
          <Link href={`/verticals/${id}/kpis`}>Manage KPIs</Link>
        </Button>
      </div>

      {/* Previous Plans */}
      {plans.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Plans</CardTitle>
            <CardDescription>Historical annual plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {plans
                .filter((p) => p.calendar_year !== calendarYear)
                .map((plan) => (
                  <div
                    key={plan.id}
                    className='flex items-center justify-between p-3 rounded-lg border'
                  >
                    <div>
                      <p className='font-medium'>{plan.plan_title}</p>
                      <p className='text-sm text-muted-foreground'>
                        {plan.calendar_year}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline'>{plan.status}</Badge>
                      <Button variant='ghost' size='sm' asChild>
                        <Link
                          href={`/verticals/${id}/plan?year=${plan.calendar_year}`}
                        >
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <Skeleton className='h-9 w-32 mb-2' />
        <Skeleton className='h-9 w-64 mb-1' />
        <Skeleton className='h-5 w-48' />
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-48 mb-2' />
          <Skeleton className='h-4 w-32' />
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <Skeleton className='h-20 w-full' />
            <div className='grid grid-cols-2 gap-4'>
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
