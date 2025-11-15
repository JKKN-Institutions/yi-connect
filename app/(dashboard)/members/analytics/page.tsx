/**
 * Member Analytics Dashboard Page
 *
 * Comprehensive analytics with skills gap analysis and engagement metrics.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { getMemberAnalytics, getSkillGaps } from '@/lib/data/members';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AnalyticsOverview,
  SkillsGapChart,
  MemberDistributionCharts,
  LeadershipPipelineChart,
  TopCompaniesChart
} from '@/components/members/analytics';

export default function MemberAnalyticsPage() {
  return (
    <div className='flex flex-col gap-6'>
      <Suspense fallback={<HeaderSkeleton />}>
        <AnalyticsHeader />
      </Suspense>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection />
      </Suspense>

      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection />
      </Suspense>

      <Suspense fallback={<SkillsGapSkeleton />}>
        <SkillsGapSection />
      </Suspense>
    </div>
  );
}

async function AnalyticsHeader() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className='flex items-center justify-between'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Member Analytics</h1>
        <p className='text-muted-foreground'>
          Comprehensive insights into member engagement, skills, and leadership readiness
        </p>
      </div>
      <div className='flex gap-2'>
        <Button variant='outline' asChild>
          <Link href='/members'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Members
          </Link>
        </Button>
      </div>
    </div>
  );
}

async function OverviewSection() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('user_id', user.id)
    .single();

  const analytics = await getMemberAnalytics(member?.chapter_id);

  return <AnalyticsOverview analytics={analytics} />;
}

async function ChartsSection() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('user_id', user.id)
    .single();

  const analytics = await getMemberAnalytics(member?.chapter_id);

  return (
    <div className='grid gap-6 md:grid-cols-2'>
      <MemberDistributionCharts analytics={analytics} />
      <LeadershipPipelineChart analytics={analytics} />
      <TopCompaniesChart analytics={analytics} />
    </div>
  );
}

async function SkillsGapSection() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('user_id', user.id)
    .single();

  if (!member?.chapter_id) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <p className='text-muted-foreground'>No chapter data available</p>
        </CardContent>
      </Card>
    );
  }

  const skillGaps = await getSkillGaps(member.chapter_id);

  return <SkillsGapChart skillGaps={skillGaps} />;
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div className='space-y-2'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <Skeleton className='h-10 w-32' />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className='pb-3'>
            <Skeleton className='h-4 w-24' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-8 w-16 mb-2' />
            <Skeleton className='h-3 w-32' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className='grid gap-6 md:grid-cols-2'>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className='h-6 w-48' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-64 w-full' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SkillsGapSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-96 w-full' />
      </CardContent>
    </Card>
  );
}
