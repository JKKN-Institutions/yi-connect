/**
 * New Member Page
 *
 * Create new member profile.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAllChapters } from '@/lib/data/chapters';
import { MemberForm } from '@/components/members';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';

// Loading skeleton
function FormSkeleton() {
  return (
    <Card>
      <CardContent className='pt-6 space-y-6'>
        {[...Array(8)].map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-10 w-full' />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Form wrapper component (Server Component)
async function NewMemberForm() {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user roles to check if they're an admin
  const { data: userRoles } = await supabase.rpc('get_user_roles', {
    p_user_id: user.id
  });

  const roleNames =
    userRoles?.map((r: { role_name: string }) => r.role_name) || [];
  const isAdmin = roleNames.some(
    (role: string) =>
      role === 'Super Admin' ||
      role === 'National Admin' ||
      role === 'Executive Member'
  );

  // Only redirect if user is NOT an admin and already has a member profile
  // Admins should be able to create new members even if they have their own profile
  if (!isAdmin) {
    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existingMember) {
      redirect(`/members/${existingMember.id}`);
    }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch chapters for the form
  const chapters = await getAllChapters();

  return (
    <MemberForm
      chapters={chapters}
      userId={isAdmin ? undefined : user.id} // Don't pre-fill for admins
      userEmail={isAdmin ? '' : profile?.email || user.email || ''} // Don't pre-fill for admins
      userName={isAdmin ? '' : profile?.full_name || ''} // Don't pre-fill for admins
    />
  );
}

// Main page component
export default async function NewMemberPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])

  return (
    <div className='space-y-6 max-w-9xl mx-auto'>
      {/* Back Button */}
      <Button variant='ghost' asChild>
        <Link href='/members'>
          <ArrowLeft className='h-4 w-4 mr-2' />
          Back to Members
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Add New Member</h1>
        <p className='text-muted-foreground'>
          Create a new member profile with professional and personal details
        </p>
      </div>

      {/* Form with Suspense */}
      <Suspense fallback={<FormSkeleton />}>
        <NewMemberForm />
      </Suspense>
    </div>
  );
}

// Generate metadata
export const metadata = {
  title: 'New Member - Yi Connect',
  description: 'Add a new member to Yi Connect'
};
