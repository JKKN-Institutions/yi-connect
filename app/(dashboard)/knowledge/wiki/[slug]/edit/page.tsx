import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { requireRole } from '@/lib/auth';
import { WikiPageForm } from '@/components/knowledge/wiki-page-form';
import { getWikiPageBySlug } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function EditWikiPageContent({ slug }: { slug: string }) {
  const chapter = await getCurrentUserChapter();
  if (!chapter) {
    notFound();
  }

  const wikiPage = await getWikiPageBySlug(chapter.id, slug);

  if (!wikiPage) {
    notFound();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Wiki Page</CardTitle>
      </CardHeader>
      <CardContent>
        <WikiPageForm wikiPage={wikiPage} />
      </CardContent>
    </Card>
  );
}

export default async function EditWikiPagePage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  const { slug } = await params;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/knowledge/wiki/${slug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wiki Page
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Wiki Page</h1>
        <p className="text-muted-foreground">
          Update the wiki page content and settings
        </p>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        }
      >
        <EditWikiPageContent slug={slug} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const chapter = await getCurrentUserChapter();

  if (!chapter) {
    return { title: 'Wiki Page Not Found' };
  }

  const wikiPage = await getWikiPageBySlug(chapter.id, slug);

  if (!wikiPage) {
    return { title: 'Wiki Page Not Found' };
  }

  return {
    title: `Edit: ${wikiPage.title}`,
    description: `Edit wiki page: ${wikiPage.title}`,
  };
}
