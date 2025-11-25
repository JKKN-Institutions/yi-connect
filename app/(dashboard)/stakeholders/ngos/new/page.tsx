/**
 * New NGO Form Page
 *
 * Form page for creating a new NGO stakeholder
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
import { NGOForm } from '@/components/stakeholders/ngo-form';

export const metadata = {
  title: 'Add New NGO',
  description: 'Add a new NGO to your stakeholder network'
};

async function NewNGOFormWrapper() {
  const chapterId = await getCurrentChapterId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New NGO</CardTitle>
        <CardDescription>
          Create a new NGO stakeholder record
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NGOForm chapterId={chapterId} />
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

export default async function NewNGOPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/stakeholders/ngos'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Add New NGO</h1>
          <p className='text-muted-foreground'>
            Add a new NGO to your stakeholder network
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewNGOFormWrapper />
      </Suspense>
    </div>
  );
}
