import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDocumentById, getCategories } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { requireRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentEditForm } from '@/components/knowledge/document-edit-form';
import { ArrowLeft, FileEdit } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function EditFormWrapper({ documentId }: { documentId: string }) {
  const [document, chapter] = await Promise.all([
    getDocumentById(documentId),
    getCurrentUserChapter()
  ]);

  if (!document) {
    notFound();
  }

  if (!chapter) {
    return (
      <Card>
        <CardContent className='p-6'>
          <p className='text-muted-foreground'>
            Unable to load categories. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const categories = await getCategories(chapter.id);

  return <DocumentEditForm document={document} categories={categories} />;
}

export default async function EditDocumentPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  const { id } = await params;

  return (
    <div className='max-w-9xl mx-auto space-y-6'>
      {/* Back Button */}
      <Button variant='ghost' size='sm' asChild>
        <Link href={`/knowledge/documents/${id}`}>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Document
        </Link>
      </Button>

      {/* Header */}
      <div className='flex items-center gap-3'>
        <div className='h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center'>
          <FileEdit className='h-6 w-6 text-primary' />
        </div>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Edit Document</h1>
          <p className='text-muted-foreground'>
            Update document details and metadata
          </p>
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
          <CardDescription>
            Modify the document information below
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
            <EditFormWrapper documentId={id} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const document = await getDocumentById(id);

  if (!document) {
    return {
      title: 'Document Not Found'
    };
  }

  return {
    title: `Edit ${document.title}`,
    description: `Edit document: ${document.title}`
  };
}
