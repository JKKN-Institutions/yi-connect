/**
 * New Achievement Page
 *
 * Record a new achievement for a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { getVerticalById } from '@/lib/data/vertical';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AchievementForm } from '@/components/verticals/achievement-form';

export const metadata = {
  title: 'New Achievement',
  description: 'Record a new achievement'
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function NewAchievementPage({ params }: PageProps) {
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <NewAchievementHeader params={params} />
      </Suspense>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <NewAchievementFormWrapper params={params} />
      </Suspense>
    </div>
  );
}

async function NewAchievementHeader({ params }: PageProps) {
  const { id } = await params;
  const vertical = await getVerticalById(id);

  if (!vertical) notFound();

  return (
    <div className='flex items-center justify-between'>
      <div>
        <div className='flex items-center gap-2 mb-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link href={`/verticals/${id}/achievements`}>
              <ArrowLeft className='h-4 w-4 mr-1' />
              Back to Achievements
            </Link>
          </Button>
        </div>
        <h1 className='text-3xl font-bold tracking-tight'>New Achievement</h1>
        <p className='text-muted-foreground mt-1'>
          Record an achievement for {vertical.name}
        </p>
      </div>
    </div>
  );
}

async function NewAchievementFormWrapper({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const vertical = await getVerticalById(id);
  if (!vertical) notFound();

  return (
    <AchievementForm
      verticalId={id}
      verticalName={vertical.name}
      userId={user.id}
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
          <Skeleton className='h-10 w-full' />
          <div className='grid gap-4 sm:grid-cols-2'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-32 w-full' />
        </div>
      </div>
      <div className='flex justify-end gap-4'>
        <Skeleton className='h-10 w-20' />
        <Skeleton className='h-10 w-40' />
      </div>
    </div>
  );
}
