/**
 * Bulk Member Upload Page
 *
 * Multi-step wizard for bulk uploading members from Excel files.
 * Steps: Upload → Preview → Options → Process → Summary
 */

import { Suspense } from 'react';
import { getAllChapters } from '@/lib/data/chapters';
import { BulkUploadWizard } from './bulk-upload-wizard';

export const metadata = {
  title: 'Bulk Upload Members | Yi Connect',
  description: 'Upload multiple members at once from an Excel file'
};

async function BulkUploadContent() {
  const chapters = await getAllChapters();

  return <BulkUploadWizard chapters={chapters} />;
}

export default function BulkUploadPage() {
  return (
    <div className='container py-6 max-w-9xl'>
      <Suspense
        fallback={
          <div className='flex items-center justify-center py-12'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
          </div>
        }
      >
        <BulkUploadContent />
      </Suspense>
    </div>
  );
}
