/**
 * New Event Page
 *
 * Page for creating a new event.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/data/auth';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getVenues } from '@/lib/data/events';
import { getEventTemplates } from '@/lib/data/events';
import { EventForm } from '@/components/events';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default async function NewEventPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member', 'EC Member']);

  return (
    <div className='flex flex-col gap-8 max-w-9xl mx-auto'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' asChild>
          <Link href='/events'>
            <ArrowLeft className='h-5 w-5' />
          </Link>
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Create New Event
          </h1>
          <p className='text-muted-foreground'>
            Fill in the details to create a new event
          </p>
        </div>
      </div>

      {/* Form */}
      <Suspense fallback={<FormSkeleton />}>
        <NewEventFormWrapper />
      </Suspense>
    </div>
  );
}

async function NewEventFormWrapper() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's hierarchy level and profile
  const supabase = await createClient();
  const { data: hierarchyLevel } = await supabase.rpc(
    'get_user_hierarchy_level',
    {
      user_id: user.id
    }
  );
  const userHierarchyLevel = hierarchyLevel || 0;

  // Get user's profile for chapter_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('chapter_id')
    .eq('id', user.id)
    .single();

  // Only allow EC Members and above to create events (hierarchy level >= 2)
  // Lower numbers = lower hierarchy, higher numbers = higher hierarchy
  // Super Admins (7), National Admins (6), and Executive Members (5) should have full access
  if (userHierarchyLevel < 2) {
    redirect('/events');
  }

  // Fetch venues and templates
  const [venues, templates] = await Promise.all([
    getVenues({ is_active: true }),
    getEventTemplates()
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Information</CardTitle>
        <CardDescription>
          Create a new event by filling out the form below. You can save it as a
          draft and publish it later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EventForm
          venues={venues}
          templates={templates}
          chapterId={profile?.chapter_id || undefined}
        />
      </CardContent>
    </Card>
  );
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-7 w-48' />
        <Skeleton className='h-4 w-full max-w-9xl' />
      </CardHeader>
      <CardContent className='space-y-6'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-10 w-full' />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
