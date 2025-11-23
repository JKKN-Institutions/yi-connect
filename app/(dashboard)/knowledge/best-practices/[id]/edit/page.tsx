import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BestPracticeForm } from '@/components/knowledge/best-practice-form';
import { getBestPracticeById } from '@/lib/data/knowledge';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function EditBestPracticeContent({ practiceId }: { practiceId: string }) {
  const bestPractice = await getBestPracticeById(practiceId);

  if (!bestPractice) {
    notFound();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Best Practice</CardTitle>
      </CardHeader>
      <CardContent>
        <BestPracticeForm bestPractice={bestPractice} />
      </CardContent>
    </Card>
  );
}

export default async function EditBestPracticePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/knowledge/best-practices/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Best Practice
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Best Practice</h1>
        <p className="text-muted-foreground">
          Update your best practice content and impact metrics
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
        <EditBestPracticeContent practiceId={id} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const bestPractice = await getBestPracticeById(id);

  if (!bestPractice) {
    return { title: 'Best Practice Not Found' };
  }

  return {
    title: `Edit: ${bestPractice.title}`,
    description: `Edit best practice: ${bestPractice.title}`,
  };
}
