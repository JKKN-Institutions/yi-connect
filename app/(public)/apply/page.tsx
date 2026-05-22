/**
 * Public Membership Application Page
 *
 * Allows anyone to apply for Yi membership
 */

import { MemberForm } from '@/components/members/member-form';
import { getAllChapters } from '@/lib/data/chapters';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply for Membership',
  description: 'Submit your application to join Young Indians'
};

export default function ApplyPage() {
  return (
    <div className='max-w-4xl mx-auto'>
      {/* Header */}
      <div className='mb-8 text-center space-y-2'>
        <h1 className='text-4xl font-bold'>Apply for Yi Membership</h1>
        <p className='text-lg text-muted-foreground'>
          Join Young Indians and be part of a vibrant community of young leaders
        </p>
      </div>

      {/* Info Card */}
      <div className='mb-8 p-6 bg-muted/50 rounded-lg border space-y-2'>
        <h2 className='font-semibold text-lg'>What happens next?</h2>
        <ol className='list-decimal list-inside space-y-1 text-sm text-muted-foreground'>
          <li>Submit your application with complete details</li>
          <li>
            Our team will review your application (usually within 3-5 business
            days)
          </li>
          <li>
            If approved, you&apos;ll receive an email with login instructions
          </li>
          <li>
            Sign in with your Google account to access your member dashboard
          </li>
        </ol>
      </div>

      {/* Form with Suspense */}
      <Suspense fallback={<FormSkeleton />}>
        <ApplicationForm />
      </Suspense>
    </div>
  );
}

async function ApplicationForm() {
  const chapters = await getAllChapters();
  return <MemberForm chapters={chapters} mode='apply' />;
}

function FormSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-64 w-full' />
      <Skeleton className='h-12 w-32' />
    </div>
  );
}
