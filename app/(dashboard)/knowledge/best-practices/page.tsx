import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getBestPractices } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { requireRole } from '@/lib/auth';
import { BestPracticeCard } from '@/components/knowledge/best-practice-card';
import { Plus } from 'lucide-react';

export const metadata = {
  title: 'Best Practices',
  description: 'Browse and share best practices',
};

async function BestPracticesList({ status }: { status?: 'draft' | 'submitted' | 'under_review' | 'published' | 'rejected' }) {
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const { data: practices } = await getBestPractices(chapter.id, {
    status,
  });

  if (practices.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          {status === 'published'
            ? 'No published best practices yet.'
            : status === 'draft'
            ? 'No draft best practices.'
            : status === 'under_review'
            ? 'No best practices under review.'
            : 'No best practices found.'}
        </p>
        {status !== 'published' && (
          <Button asChild className="mt-4">
            <Link href="/knowledge/best-practices/new">
              <Plus className="mr-2 h-4 w-4" />
              Share Best Practice
            </Link>
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {practices.map((practice) => (
        <BestPracticeCard key={practice.id} bestPractice={practice} />
      ))}
    </div>
  );
}

function BestPracticesLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </Card>
      ))}
    </div>
  );
}

export default async function BestPracticesPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member', 'Member']);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Best Practices</h1>
          <p className="text-muted-foreground">
            Learn from shared experiences and success stories
          </p>
        </div>
        <Button asChild>
          <Link href="/knowledge/best-practices/new">
            <Plus className="mr-2 h-4 w-4" />
            Share Best Practice
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">My Drafts</TabsTrigger>
          <TabsTrigger value="under_review">Under Review</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Suspense fallback={<BestPracticesLoading />}>
            <BestPracticesList />
          </Suspense>
        </TabsContent>

        <TabsContent value="published" className="mt-6">
          <Suspense fallback={<BestPracticesLoading />}>
            <BestPracticesList status="published" />
          </Suspense>
        </TabsContent>

        <TabsContent value="draft" className="mt-6">
          <Suspense fallback={<BestPracticesLoading />}>
            <BestPracticesList status="draft" />
          </Suspense>
        </TabsContent>

        <TabsContent value="under_review" className="mt-6">
          <Suspense fallback={<BestPracticesLoading />}>
            <BestPracticesList status="under_review" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
