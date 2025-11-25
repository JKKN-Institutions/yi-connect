/**
 * New Government Stakeholder Form Page
 *
 * Form page for creating a new government stakeholder
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
import { GovernmentStakeholderForm } from '@/components/stakeholders/government-stakeholder-form';

export const metadata = {
  title: 'Add New Government Official',
  description: 'Add a new government stakeholder to your network'
};

async function NewGovernmentFormWrapper() {
  const chapterId = await getCurrentChapterId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Government Official</CardTitle>
        <CardDescription>
          Create a new government stakeholder record
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GovernmentStakeholderForm chapterId={chapterId} />
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

export default async function NewGovernmentStakeholderPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/stakeholders/government'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Add New Government Official</h1>
          <p className='text-muted-foreground'>
            Add a new government stakeholder to your network
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewGovernmentFormWrapper />
      </Suspense>
    </div>
  );
}
