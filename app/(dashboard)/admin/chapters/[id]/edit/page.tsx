/**
 * Edit Chapter Page
 *
 * Form for editing an existing Yi chapter (Super Admin and National Admin only).
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getChapterById } from '@/lib/data/chapters';
import { ChapterForm } from '@/components/admin/chapter-form';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Edit Chapter - Yi Connect Admin',
  description: 'Edit chapter information'
};

// Provide a placeholder ID for build-time validation with Cache Components
// The actual page will be rendered dynamically at request time
export async function generateStaticParams() {
  return [
    { id: '00000000-0000-0000-0000-000000000000' } // Placeholder UUID for build validation
  ];
}

interface EditChapterPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Content component that fetches data
async function EditChapterContent({ id }: { id: string }) {
  // Require Super Admin or National Admin role
  await requireRole(['Super Admin', 'National Admin']);

  // Fetch chapter data
  const chapter = await getChapterById(id);

  if (!chapter) {
    notFound();
  }

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Edit Chapter</h1>
        <p className='text-muted-foreground'>
          Update information for {chapter.name}
        </p>
      </div>

      {/* Chapter Form */}
      <div className='max-w-7xl'>
        <ChapterForm chapter={chapter} />
      </div>
    </div>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='h-5 w-96' />
      </div>
      <div className='max-w-7xl space-y-4'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-32 w-full' />
      </div>
    </div>
  );
}

export default async function EditChapterPage({
  params
}: EditChapterPageProps) {
  // Get chapter ID from params (Next.js 16 async params)
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <EditChapterContent id={id} />
    </Suspense>
  );
}
