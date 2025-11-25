/**
 * New Industry Form Page
 *
 * Form page for creating a new industry stakeholder
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentChapterId, requireRole } from '@/lib/auth';
import { IndustryForm } from '@/components/stakeholders/industry-form';

export const metadata = {
  title: 'Add New Industry',
  description: 'Add a new industry to your stakeholder network'
};

async function NewIndustryFormWrapper() {
  const chapterId = await getCurrentChapterId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Industry</CardTitle>
        <CardDescription>
          Create a new industry stakeholder record
        </CardDescription>
      </CardHeader>
      <CardContent>
        <IndustryForm chapterId={chapterId} />
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

export default async function NewIndustryPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/stakeholders/industries'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Add New Industry</h1>
          <p className='text-muted-foreground'>
            Add a new industry to your stakeholder network
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewIndustryFormWrapper />
      </Suspense>
    </div>
  );
}
