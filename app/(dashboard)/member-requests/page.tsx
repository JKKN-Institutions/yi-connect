/**
 * Member Requests Dashboard (Admin Only)
 *
 * Executive Members and National Admins can review and approve membership applications
 */

import { requireRole } from '@/lib/auth';
import { getMemberRequests } from '@/app/actions/member-requests';
import { MemberRequestsTable } from '@/components/member-requests/member-requests-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Member Requests | Yi Connect',
  description: 'Review and approve membership applications'
};

interface PageProps {
  searchParams: Promise<{
    status?: 'pending' | 'approved' | 'rejected' | 'withdrawn';
    page?: string;
  }>;
}

export default async function MemberRequestsPage({ searchParams }: PageProps) {
  // Require leadership roles to access member requests - must be at page level, not inside Suspense
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Membership Applications</h1>
          <p className='text-muted-foreground'>
            Review and approve new member applications
          </p>
        </div>
      </div>

      {/* Content wrapped in Suspense */}
      <Suspense fallback={<PageSkeleton />}>
        <MemberRequestsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MemberRequestsContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status || 'pending';
  const page = parseInt(params.page || '1');

  return (
    <Tabs defaultValue={status} className='w-full'>
      <TabsList>
        <TabsTrigger value='pending'>Pending</TabsTrigger>
        <TabsTrigger value='approved'>Approved</TabsTrigger>
        <TabsTrigger value='rejected'>Rejected</TabsTrigger>
        <TabsTrigger value='withdrawn'>Withdrawn</TabsTrigger>
      </TabsList>

      <TabsContent value='pending' className='mt-6'>
        <Suspense fallback={<TableSkeleton />}>
          <RequestsContent status='pending' page={page} />
        </Suspense>
      </TabsContent>

      <TabsContent value='approved' className='mt-6'>
        <Suspense fallback={<TableSkeleton />}>
          <RequestsContent status='approved' page={page} />
        </Suspense>
      </TabsContent>

      <TabsContent value='rejected' className='mt-6'>
        <Suspense fallback={<TableSkeleton />}>
          <RequestsContent status='rejected' page={page} />
        </Suspense>
      </TabsContent>

      <TabsContent value='withdrawn' className='mt-6'>
        <Suspense fallback={<TableSkeleton />}>
          <RequestsContent status='withdrawn' page={page} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

async function RequestsContent({
  status,
  page
}: {
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  page: number;
}) {
  const { data: requests, count } = await getMemberRequests({
    status,
    limit: 20,
    offset: (page - 1) * 20
  });

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No {status} applications</CardTitle>
          <CardDescription>
            There are no {status} membership applications at the moment.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <MemberRequestsTable
      requests={requests}
      totalCount={count || 0}
      currentPage={page}
      pageSize={20}
    />
  );
}

function TableSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-64 w-full' />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className='h-10 w-full max-w-md' />
      <Skeleton className='h-64 w-full' />
    </div>
  );
}
