import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentChapterId, requireRole } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { SponsorForm } from '@/components/finance/sponsor-form';

export const metadata = {
  title: 'Add New Sponsor',
  description: 'Add a new sponsor organization to your database'
};

async function NewSponsorFormWrapper() {
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add New Sponsor</CardTitle>
          <CardDescription>
            Add a new sponsor organization to track relationships and deals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6'>
            <p className='text-sm text-amber-800'>
              As a super admin, you need to select a chapter context first to
              add sponsors.
            </p>
          </div>
          <div className='rounded-lg border-2 border-dashed p-12 text-center'>
            <p className='text-muted-foreground'>
              Please select a chapter from the sidebar to proceed with adding a
              sponsor.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Sponsor</CardTitle>
        <CardDescription>
          Add a new sponsor organization to track relationships and deals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SponsorForm chapterId={chapterId} />
      </CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-8 w-[250px]' />
        <Skeleton className='h-4 w-[400px]' />
      </CardHeader>
      <CardContent className='space-y-4'>
        {[...Array(8)].map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-[100px]' />
            <Skeleton className='h-10 w-full' />
          </div>
        ))}
        <Skeleton className='h-10 w-[120px]' />
      </CardContent>
    </Card>
  );
}

export default async function NewSponsorPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/finance/sponsorships'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Add New Sponsor</h1>
          <p className='text-muted-foreground'>
            Add a sponsor organization to your CRM
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewSponsorFormWrapper />
      </Suspense>
    </div>
  );
}
