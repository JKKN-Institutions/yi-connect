/**
 * New Vendor Form Page
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
import { getCurrentChapterId } from '@/lib/auth';
import { VendorForm } from '@/components/stakeholders/vendor-form';

export const metadata = {
  title: 'Add New Vendor',
  description: 'Add a new vendor to your network'
};

async function NewVendorFormWrapper() {
  const chapterId = await getCurrentChapterId();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Vendor</CardTitle>
        <CardDescription>Create a new vendor record</CardDescription>
      </CardHeader>
      <CardContent>
        <VendorForm chapterId={chapterId} />
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
      </CardContent>
    </Card>
  );
}

export default function NewVendorPage() {
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/stakeholders/vendors'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Add New Vendor</h1>
          <p className='text-muted-foreground'>Add a new vendor to your network</p>
        </div>
      </div>
      <Suspense fallback={<FormSkeleton />}>
        <NewVendorFormWrapper />
      </Suspense>
    </div>
  );
}
