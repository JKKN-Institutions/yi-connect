/**
 * New College Form Page
 *
 * Form page for creating a new college stakeholder
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
import { CollegeForm } from '@/components/stakeholders/college-form';

export const metadata = {
  title: 'Add New College',
  description: 'Add a new college to your stakeholder network'
};

async function NewCollegeFormWrapper() {
  const chapterId = await getCurrentChapterId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New College</CardTitle>
        <CardDescription>
          Create a new college stakeholder record
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CollegeForm chapterId={chapterId} />
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

export default async function NewCollegePage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/stakeholders/colleges'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Add New College</h1>
          <p className='text-muted-foreground'>
            Add a new college to your stakeholder network
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewCollegeFormWrapper />
      </Suspense>
    </div>
  );
}
