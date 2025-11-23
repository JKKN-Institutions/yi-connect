import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WikiPageForm } from '@/components/knowledge/wiki-page-form';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Create Wiki Page',
  description: 'Create a new wiki page',
};

export default function NewWikiPagePage() {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/knowledge/wiki">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wiki Pages
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Wiki Page</h1>
        <p className="text-muted-foreground">
          Create a new wiki page to document knowledge and best practices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wiki Page Details</CardTitle>
        </CardHeader>
        <CardContent>
          <WikiPageForm />
        </CardContent>
      </Card>
    </div>
  );
}
