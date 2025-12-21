/**
 * Skill/Will Matrix Page
 *
 * Visualize and manage member development based on their
 * skill levels and engagement/motivation (will).
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getCurrentUser } from '@/lib/data/auth';
import { getSkillWillMatrixData } from '@/lib/data/skill-will-matrix';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SkillWillMatrixClient } from './skill-will-matrix-client';

export default async function SkillWillMatrixPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-6'>
      <Suspense fallback={<HeaderSkeleton />}>
        <MatrixHeader />
      </Suspense>

      <Suspense fallback={<MatrixSkeleton />}>
        <MatrixContent />
      </Suspense>
    </div>
  );
}

async function MatrixHeader() {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Skill/Will Matrix</h1>
        <p className='text-muted-foreground'>
          Analyze member development based on capabilities and engagement
        </p>
      </div>
      <div className='flex gap-2'>
        <Button variant='outline' asChild>
          <Link href='/members'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Members
          </Link>
        </Button>
        <Button variant='outline' asChild>
          <Link href='/members/analytics'>
            Analytics
          </Link>
        </Button>
      </div>
    </div>
  );
}

async function MatrixContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <p className='text-muted-foreground'>Please sign in to view the matrix</p>
        </CardContent>
      </Card>
    );
  }

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

  const matrixData = await getSkillWillMatrixData(member.chapter_id);

  if (matrixData.members.length === 0) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <p className='text-muted-foreground mb-4'>
            No member data available for the skill/will matrix.
          </p>
          <p className='text-sm text-muted-foreground'>
            Ensure members have skills, engagement metrics, or leadership assessments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <SkillWillMatrixClient data={matrixData} />;
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div className='space-y-2'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <div className='flex gap-2'>
        <Skeleton className='h-10 w-32' />
        <Skeleton className='h-10 w-24' />
      </div>
    </div>
  );
}

function MatrixSkeleton() {
  return (
    <div className='space-y-6'>
      {/* Quadrant Cards Skeleton */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Skeleton className='h-10 w-10 rounded-lg' />
                  <div>
                    <Skeleton className='h-5 w-24' />
                    <Skeleton className='h-3 w-32 mt-1' />
                  </div>
                </div>
                <Skeleton className='h-8 w-12' />
              </div>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 gap-2 mb-4'>
                <Skeleton className='h-16 rounded-lg' />
                <Skeleton className='h-16 rounded-lg' />
              </div>
              <Skeleton className='h-4 w-full mb-2' />
              <div className='flex -space-x-2'>
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className='h-8 w-8 rounded-full' />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='h-4 w-96' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-[500px] w-full' />
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-4 w-48' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-64 w-full' />
        </CardContent>
      </Card>
    </div>
  );
}
