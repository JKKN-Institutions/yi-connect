/**
 * Event Call List (leaders)
 *
 * Every invitee (member RSVPs + guests) with caller, call result and note.
 * Leaders invite the whole chapter, hand names to callers, add guests and
 * record results. Works on draft events.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Lock, Phone } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getCallListAccess, getCallList, getCallerOptions } from '@/lib/data/event-call-list';
import { CallListManager } from '@/components/events/call-list/call-list-manager';
import { eventServesMeal } from '@/lib/event-call-list';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventCallListPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const access = await getCallListAccess(id, user.id);
  if (!access.event) notFound();
  const event = access.event;

  if (!access.canManage) {
    return (
      <div className='mx-auto max-w-xl py-10'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Lock className='h-5 w-5' /> You don&apos;t have access to this call list
            </CardTitle>
            <CardDescription>
              The call list for &ldquo;{event.title}&rdquo; is open to this event&apos;s organizers and the
              Chair / Co-Chair of its chapter. Ask your Chair if you need it. If names were given to you to call,
              open <Link className='underline' href={`/events/${id}/my-calls`}>My calls</Link>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [rows, callers] = await Promise.all([getCallList(id), getCallerOptions(event, user.id)]);

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <Button variant='ghost' size='sm' asChild className='-ml-2 mb-1'>
            <Link href={`/events/${id}`}>
              <ArrowLeft className='mr-1 h-4 w-4' /> Back to event
            </Link>
          </Button>
          <h1 className='text-2xl font-bold tracking-tight flex items-center gap-2'>
            <Phone className='h-6 w-6 text-orange-500' /> Call list
          </h1>
          <p className='text-sm text-muted-foreground'>
            {event.title} &middot; {format(new Date(event.start_date), 'EEE, d MMM yyyy, h:mm a')}{' '}
            <Badge variant='outline' className='ml-1 capitalize'>{event.status}</Badge>
          </p>
        </div>
        <Button variant='outline' size='sm' asChild>
          <Link href={`/events/${id}/my-calls`}>My calls</Link>
        </Button>
      </div>

      <CallListManager eventId={id} rows={rows} callers={callers} mealOn={eventServesMeal(event.custom_fields)} />
    </div>
  );
}
