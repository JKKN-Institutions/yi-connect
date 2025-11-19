import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getBestPractices } from '@/lib/data/knowledge';
import { getCurrentUserChapter } from '@/lib/data/members';
import { BestPracticeCard } from '@/components/knowledge/best-practice-card';
import { Plus, Lightbulb } from 'lucide-react';

export const metadata = {
  title: 'Best Practices',
  description: 'Browse and share best practices',
};

async function BestPracticesList() {
  const chapter = await getCurrentUserChapter();
  if (!chapter) return null;

  const { data: practices } = await getBestPractices(chapter.id, {
    status: 'published',
  });

  if (practices.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No published best practices yet. Share your first practice to help others learn.
        </p>
        <Button asChild className="mt-4">
          <Link href="/knowledge/best-practices/new">
            <Plus className="mr-2 h-4 w-4" />
            Share Best Practice
          </Link>
        </Button>
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

export default function BestPracticesPage() {
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
        <BestPracticesList />
      </Suspense>
    </div>
  );
}
