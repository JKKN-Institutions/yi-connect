import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getWikiPages } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { WikiPageCard } from '@/components/knowledge/wiki-page-card';
import { Plus, BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Wiki Pages',
  description: 'Browse collaborative wiki pages',
};

async function WikiPagesList() {
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const { data: pages } = await getWikiPages(chapter.id);

  if (pages.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No wiki pages yet. Create your first page to start documenting knowledge.
        </p>
        <Button asChild className="mt-4">
          <Link href="/knowledge/wiki/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Wiki Page
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
        <WikiPageCard key={page.id} wikiPage={page} />
      ))}
    </div>
  );
}

export default function WikiPagesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wiki Pages</h1>
          <p className="text-muted-foreground">
            Collaborative knowledge documentation
          </p>
        </div>
        <Button asChild>
          <Link href="/knowledge/wiki/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Wiki Page
          </Link>
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </Card>
            ))}
          </div>
        }
      >
        <WikiPagesList />
      </Suspense>
    </div>
  );
}
