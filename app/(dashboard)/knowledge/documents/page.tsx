import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDocuments } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { DocumentsTable } from '@/components/knowledge/documents-table';
import { DocumentCard } from '@/components/knowledge/document-card';
import { Plus, Grid, List } from 'lucide-react';

export const metadata = {
  title: 'Documents',
  description: 'Browse and manage knowledge documents',
};

interface PageProps {
  searchParams: Promise<{
    view?: 'grid' | 'list';
    category?: string;
    search?: string;
  }>;
}

async function DocumentsList({ searchParams }: PageProps) {
  const params = await searchParams;
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const filters = {
    category_id: params.category,
    search: params.search,
  };

  const { data: documents } = await getDocuments(chapter.id, filters);

  const viewMode = params.view || 'list';

  if (documents.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No documents found. Upload your first document to get started.
        </p>
        <Button asChild className="mt-4">
          <Link href="/knowledge/documents/upload">
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Link>
        </Button>
      </Card>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} />
        ))}
      </div>
    );
  }

  return <DocumentsTable data={documents} />;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const viewMode = params.view || 'list';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Browse and manage knowledge documents
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center border rounded-md">
            <Link
              href="?view=list"
              className={`p-2 ${viewMode === 'list' ? 'bg-accent' : ''}`}
            >
              <List className="h-4 w-4" />
            </Link>
            <Link
              href="?view=grid"
              className={`p-2 ${viewMode === 'grid' ? 'bg-accent' : ''}`}
            >
              <Grid className="h-4 w-4" />
            </Link>
          </div>
          <Button asChild>
            <Link href="/knowledge/documents/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload Document
            </Link>
          </Button>
        </div>
      </div>

      {/* Documents List */}
      <Suspense
        fallback={
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </Card>
            ))}
          </div>
        }
      >
        <DocumentsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
