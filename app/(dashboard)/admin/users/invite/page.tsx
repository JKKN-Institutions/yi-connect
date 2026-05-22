/**
 * Invite User Page
 *
 * Page for inviting new users to the system.
 * Restricted to Super Admin and National Admin only.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth';
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
import { InviteUserForm } from '@/components/admin/users/invite-user-form';

async function InviteFormData() {
  // Require Super Admin or National Admin
  await requireRole(['Super Admin', 'National Admin']);

  // Fetch roles and chapters for the form
  const supabase = await createServerSupabaseClient();

  const [{ data: roles }, { data: chapters }] = await Promise.all([
    supabase
      .from('roles')
      .select('*')
      .order('hierarchy_level', { ascending: false }),
    supabase
      .from('chapters')
      .select('id, name, location')
      .order('name', { ascending: true })
  ]);

  return <InviteUserForm roles={roles || []} chapters={chapters || []} />;
}

export default function InviteUserPage() {
  return (
    <div className='flex flex-1 flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/admin/users'>
            <ArrowLeft className='h-4 w-4' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Invite User</h1>
          <p className='text-muted-foreground'>
            Add a new user to the approved emails list
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className='mx-auto w-full'>
        <Card>
          <CardHeader>
            <CardTitle>User Invitation</CardTitle>
            <CardDescription>
              Enter the user&apos;s email to add them to the approved list. They
              will be able to sign up using this email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className='space-y-6'>
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                  <div className='space-y-2'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-10 w-full' />
                  </div>
                  <Skeleton className='h-10 w-32' />
                </div>
              }
            >
              <InviteFormData />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
