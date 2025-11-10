/**
 * Edit Chapter Page
 *
 * Form for editing an existing Yi chapter (National Admin only).
 */

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getChapterById } from '@/lib/data/chapters';
import { ChapterForm } from '@/components/admin/chapter-form';

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

export default async function EditChapterPage({
  params
}: EditChapterPageProps) {
  // Require National Admin role
  await requireRole(['National Admin']);

  // Get chapter ID from params (Next.js 16 async params)
  const { id } = await params;

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
