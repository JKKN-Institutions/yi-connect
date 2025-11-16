/**
 * New Budget Page
 *
 * Page for creating a new budget.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser, getCurrentChapterId } from '@/lib/auth';
import { BudgetForm } from '@/components/finance/budget-form';
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
  title: 'New Budget',
  description: 'Create a new budget for your chapter'
};

export default function NewBudgetPage() {
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/finance/budgets'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Create New Budget
          </h1>
          <p className='text-muted-foreground'>
            Set up a new budget for your chapter&apos;s fiscal period
          </p>
        </div>
      </div>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <NewBudgetFormWrapper />
      </Suspense>
    </div>
  );
}

async function NewBudgetFormWrapper() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's chapter ID - super admins may not have one
  const chapterId = await getCurrentChapterId();

  // Allow super admins to proceed without a chapter ID
  // They will select the chapter in the form
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Information</CardTitle>
        <CardDescription>
          Create a new budget by filling out the form below. You can save it as
          a draft and approve it later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BudgetForm chapterId={chapterId} />
      </CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-7 w-48' />
        <Skeleton className='h-4 w-full max-w-md' />
      </CardHeader>
      <CardContent className='space-y-6'>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-10 w-full' />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
