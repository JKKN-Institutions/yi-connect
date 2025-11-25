/**
 * Assign Members Page
 *
 * Assign new members or chair to a vertical
 * Module 9: Vertical Performance Tracker
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser, requireRole } from '@/lib/auth';
import { getVerticalById, getVerticalMembers } from '@/lib/data/vertical';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MemberAssignmentForm } from '@/components/verticals/member-assignment-form';

export const metadata = {
  title: 'Assign Members',
  description: 'Assign members to a vertical'
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssignMembersPage({ params }: PageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <Suspense fallback={<HeaderSkeleton />}>
        <AssignMembersHeader params={params} />
      </Suspense>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <AssignMembersFormWrapper params={params} />
      </Suspense>
    </div>
  );
}

async function AssignMembersHeader({ params }: PageProps) {
  const { id } = await params;
  const vertical = await getVerticalById(id);

  if (!vertical) notFound();

  return (
    <div className='flex items-center justify-between'>
      <div>
        <div className='flex items-center gap-2 mb-2'>
          <Button variant='ghost' size='sm' asChild>
            <Link href={`/verticals/${id}/members`}>
              <ArrowLeft className='h-4 w-4 mr-1' />
              Back to Members
            </Link>
          </Button>
        </div>
        <h1 className='text-3xl font-bold tracking-tight'>Assign Members</h1>
        <p className='text-muted-foreground mt-1'>
          Add members to {vertical.name}
        </p>
      </div>
    </div>
  );
}

async function AssignMembersFormWrapper({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const vertical = await getVerticalById(id);
  if (!vertical) notFound();

  // Get existing vertical members
  const existingMembers = await getVerticalMembers(id);

  // Get all chapter members with their profile info
  const supabase = await createClient();
  const { data: membersData } = await supabase
    .from('members')
    .select(`
      id,
      avatar_url,
      profile:profiles!inner(full_name, email)
    `)
    .eq('chapter_id', vertical.chapter_id)
    .eq('membership_status', 'active');

  // Transform the data to match the expected format
  const chapterMembers = (membersData || []).map((m: any) => ({
    id: m.id,
    full_name: m.profile?.full_name || 'Unknown',
    email: m.profile?.email || null,
    avatar_url: m.avatar_url,
  })).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));

  return (
    <MemberAssignmentForm
      verticalId={id}
      verticalName={vertical.name}
      availableMembers={chapterMembers || []}
      existingMembers={existingMembers}
    />
  );
}

function HeaderSkeleton() {
  return (
    <div className='flex items-center justify-between'>
      <div>
        <Skeleton className='h-9 w-32 mb-2' />
        <Skeleton className='h-9 w-48 mb-1' />
        <Skeleton className='h-5 w-64' />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='rounded-lg border p-6'>
        <Skeleton className='h-6 w-48 mb-2' />
        <Skeleton className='h-4 w-64 mb-6' />
        <Skeleton className='h-10 w-full' />
      </div>
      <div className='rounded-lg border p-6'>
        <Skeleton className='h-6 w-32 mb-2' />
        <Skeleton className='h-4 w-56 mb-6' />
        <div className='space-y-4'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      </div>
    </div>
  );
}
