import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { BestPracticeForm } from '@/components/knowledge/best-practice-form';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Share Best Practice',
  description: 'Share a new best practice with your chapter',
};

export default async function NewBestPracticePage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/knowledge/best-practices">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Best Practices
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Share Best Practice</h1>
        <p className="text-muted-foreground">
          Share your knowledge and successful strategies with the chapter
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Best Practice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <BestPracticeForm />
        </CardContent>
      </Card>
    </div>
  );
}
