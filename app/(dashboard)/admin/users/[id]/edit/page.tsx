/**
 * Admin Edit User Page
 *
 * Form for editing user profile information.
 * Restricted to Super Admin and National Admin only.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth';
import { getUserById } from '@/lib/data/users';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EditUserForm } from '@/components/admin/users/edit-user-form';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function EditFormData({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  // Await params inside Suspense boundary
  const params = await paramsPromise;

  // Require Super Admin or National Admin
  await requireRole(['Super Admin', 'National Admin']);

  const user = await getUserById(params.id);

  if (!user) {
    notFound();
  }

  // Fetch chapters for dropdown
  const supabase = await createServerSupabaseClient();
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, name, location')
    .order('name', { ascending: true });

  return (
    <>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href={`/admin/users/${user.id}`}>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Edit User Profile
          </h1>
          <p className='text-muted-foreground'>
            Update profile information for {user.full_name}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className='mx-auto w-full'>
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update the user&apos;s basic profile information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditUserForm user={user} chapters={chapters || []} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function EditUserPage(props: PageProps) {
  return (
    <div className='flex flex-1 flex-col gap-6 p-6'>
      <Suspense
        fallback={
          <div className='space-y-6'>
            <div className='flex items-center gap-4'>
              <Skeleton className='h-10 w-10' />
              <div className='space-y-2'>
                <Skeleton className='h-8 w-64' />
                <Skeleton className='h-4 w-48' />
              </div>
            </div>
            <div className='mx-auto w-full max-w-2xl'>
              <Card>
                <CardHeader>
                  <Skeleton className='h-6 w-40' />
                  <Skeleton className='h-4 w-64' />
                </CardHeader>
                <CardContent>
                  <div className='space-y-6'>
                    <Skeleton className='h-10 w-full' />
                    <Skeleton className='h-10 w-full' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        }
      >
        <EditFormData paramsPromise={props.params} />
      </Suspense>
    </div>
  );
}
