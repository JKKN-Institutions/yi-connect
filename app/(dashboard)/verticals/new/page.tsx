/**
 * New Vertical Page
 *
 * Form for creating a new vertical
 * Module 9: Vertical Performance Tracker
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

export const metadata = {
  title: 'Create New Vertical',
  description: 'Add a new vertical to your chapter'
};

export default function NewVerticalPage() {
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Button variant='ghost' size='sm' asChild>
              <Link href='/verticals'>
                <ArrowLeft className='h-4 w-4 mr-1' />
                Back to Verticals
              </Link>
            </Button>
          </div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Create New Vertical
          </h1>
          <p className='text-muted-foreground mt-1'>
            Add a new vertical to your chapter
          </p>
        </div>
      </div>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <NewVerticalForm />
      </Suspense>
    </div>
  );
}

async function NewVerticalForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vertical Information</CardTitle>
        <CardDescription>
          Enter the details for the new vertical
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {/* Form fields will be added here */}
          <div className='rounded-lg border border-dashed p-8 text-center'>
            <p className='text-sm text-muted-foreground'>
              Vertical creation form is under development.
            </p>
            <p className='text-xs text-muted-foreground mt-2'>
              This feature will allow you to create and configure new verticals
              for your chapter.
            </p>
          </div>

          <div className='flex gap-2 justify-end'>
            <Button variant='outline' asChild>
              <Link href='/verticals'>Cancel</Link>
            </Button>
            <Button disabled>Create Vertical</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-64 mt-2' />
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-20 w-full' />
          <div className='flex gap-2 justify-end'>
            <Skeleton className='h-10 w-20' />
            <Skeleton className='h-10 w-32' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
