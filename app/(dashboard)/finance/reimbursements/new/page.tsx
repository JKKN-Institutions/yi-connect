import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentChapterId } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ReimbursementRequestForm } from '@/components/finance/reimbursement-request-form';

export const metadata = {
  title: 'New Reimbursement Request',
  description: 'Submit a new expense reimbursement request'
};

async function NewRequestFormWrapper() {
  const chapterId = await getCurrentChapterId();

  // If no chapter ID (super admin), show a warning
  if (!chapterId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New Reimbursement Request</CardTitle>
          <CardDescription>
            Submit a request to get reimbursed for approved chapter expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6'>
            <p className='text-sm text-amber-800'>
              As a super admin, you need to select a chapter context first to create reimbursement requests.
            </p>
          </div>
          <div className='rounded-lg border-2 border-dashed p-12 text-center'>
            <p className='text-muted-foreground'>
              Please select a chapter from the sidebar to proceed with creating a reimbursement request.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Reimbursement Request</CardTitle>
        <CardDescription>
          Submit a request to get reimbursed for approved chapter expenses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReimbursementRequestForm chapterId={chapterId} />
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
        {[...Array(6)].map((_, i) => (
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

export default function NewReimbursementPage() {
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/finance/reimbursements'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            New Reimbursement Request
          </h1>
          <p className='text-muted-foreground'>
            Request reimbursement for approved chapter expenses
          </p>
        </div>
      </div>

      <Suspense fallback={<FormSkeleton />}>
        <NewRequestFormWrapper />
      </Suspense>
    </div>
  );
}
