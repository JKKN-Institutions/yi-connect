/**
 * New Member Page
 *
 * Create new member profile.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
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

  // Get current user (to pre-fill if creating own profile)
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user already has a member profile
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingMember) {
    redirect(`/members/${existingMember.id}`);
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // TODO: Fetch chapters for the form
  const chapters: any[] = []; // Replace with: await getChapters()

  return (
    <MemberForm
      chapters={chapters}
      userId={user.id}
      userEmail={profile?.email || user.email || ''}
      userName={profile?.full_name || ''}
    />
  );
}

// Main page component
export default function NewMemberPage() {
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
