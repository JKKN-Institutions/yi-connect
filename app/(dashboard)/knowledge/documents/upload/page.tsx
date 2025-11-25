import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCategories } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { requireRole } from '@/lib/auth';
import { DocumentUploadForm } from '@/components/knowledge/document-upload-form';
import { FileUp } from 'lucide-react';

export const metadata = {
  title: 'Upload Document',
  description: 'Upload a new document to the knowledge base'
};

async function UploadFormWrapper() {
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const categories = await getCategories(chapter.id);

  return <DocumentUploadForm categories={categories} />;
}

export default async function UploadDocumentPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='max-w-9xl mx-auto space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <div className='h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center'>
          <FileUp className='h-6 w-6 text-primary' />
        </div>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Upload Document</h1>
          <p className='text-muted-foreground'>
            Add a new document to your knowledge base
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
          <CardDescription>
            Fill in the details and upload your document
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className='space-y-4'>
                {[...Array(5)].map((_, i) => (
                  <div key={i}>
                    <Skeleton className='h-4 w-24 mb-2' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                ))}
              </div>
            }
          >
            <UploadFormWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
