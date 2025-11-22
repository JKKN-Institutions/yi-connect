/**
 * New Vertical Page
 *
 * Form for creating a new vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VerticalForm } from '@/components/verticals/vertical-form';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Create New Vertical',
  description: 'Add a new vertical to your chapter'
};

export default function NewVerticalPage() {
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Button variant='ghost' size='sm' asChild>
              <Link href='/verticals'>
                <ArrowLeft className='h-4 w-4 mr-1' />
                Back to Verticals
              </Link>
            </Button>
          </div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Create New Vertical
          </h1>
          <p className='text-muted-foreground mt-1'>
            Add a new vertical to your chapter
          </p>
        </div>
      </div>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <NewVerticalFormWrapper />
      </Suspense>
    </div>
  );
}

async function NewVerticalFormWrapper() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's chapter from their profile/member record
  const supabase = await createClient();
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('id', user.id)
    .single();

  if (!member?.chapter_id) {
    return (
      <div className='rounded-lg border border-dashed p-8 text-center'>
        <p className='text-sm text-muted-foreground'>
          Unable to determine your chapter. Please contact support.
        </p>
      </div>
    );
  }

  return <VerticalForm chapterId={member.chapter_id} />;
}

function FormSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='rounded-lg border p-6'>
        <Skeleton className='h-6 w-48 mb-2' />
        <Skeleton className='h-4 w-64 mb-6' />
        <div className='space-y-4'>
          <div>
            <Skeleton className='h-4 w-24 mb-2' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div>
            <Skeleton className='h-4 w-24 mb-2' />
            <Skeleton className='h-10 w-full' />
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
          <div>
            <Skeleton className='h-4 w-24 mb-2' />
            <div className='flex gap-2'>
              <Skeleton className='h-10 w-10' />
              <Skeleton className='h-10 w-32' />
            </div>
            <div className='flex gap-2 mt-2'>
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className='h-8 w-8' />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className='flex justify-end gap-4'>
        <Skeleton className='h-10 w-20' />
        <Skeleton className='h-10 w-32' />
      </div>
    </div>
  );
}
