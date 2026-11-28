/**
 * My calls — the event's call list for callers, phone-first.
 *
 * Leaders and the members a leader ticked as callers for this event
 * (events.custom_fields.callers) see every invitee with phone numbers and can
 * record a result; names given to them come first, and each card shows who
 * last saved it. A member a leader gave names to sees only those names.
 * Everyone else gets an explicit no-access card.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Lock, PhoneCall } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { getCallListAccess, getCallList } from '@/lib/data/event-call-list';
import { computeCallTotals, eventServesMeal } from '@/lib/event-call-list';
import { MyCallsList } from '@/components/events/call-list/my-calls-list';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MyCallsPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  const access = await getCallListAccess(id, user.id);
  if (!access.event) notFound();
  const event = access.event;

  const all = await getCallList(id);
  const assignedToMe = all.filter((r) => r.callerId === user.id);

  if (!access.canCall && assignedToMe.length === 0) {
    return (
      <div className='mx-auto max-w-xl py-10'>
        <Card data-testid='my-calls-no-access'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Lock className='h-5 w-5' /> This call list is for the EC callers
            </CardTitle>
            <CardDescription>
              The call list for &ldquo;{event.title}&rdquo; is open to the callers the Chair has chosen. Ask your
              Chair if you should be making these calls.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Leaders and ticked callers see every name with its number; anyone else only the names given to them.
  const mine = access.canCall ? all : assignedToMe;
  const totals = computeCallTotals(mine);

  return (
    <div className='mx-auto flex w-full max-w-xl flex-col gap-4'>
      <div>
        {access.canManage && (
          <Button variant='ghost' size='sm' asChild className='-ml-2 mb-1'>
            <Link href={`/events/${id}/calls`}>
              <ArrowLeft className='mr-1 h-4 w-4' /> Full call list
            </Link>
          </Button>
        )}
        <h1 className='text-2xl font-bold tracking-tight flex items-center gap-2'>
          <PhoneCall className='h-6 w-6 text-orange-500' /> My calls
        </h1>
        <p className='text-sm text-muted-foreground'>
          {event.title} &middot; {format(new Date(event.start_date), 'EEE, d MMM, h:mm a')}
        </p>
      </div>

      {mine.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>No names on this call list yet</CardTitle>
            <CardDescription>
              When the Chair or an organizer invites people to this event, their names show up here for calling.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className='text-sm' data-testid='my-calls-summary'>
            <strong>{totals.called}</strong> of <strong>{totals.invited}</strong> called &middot;{' '}
            {totals.coming} coming &middot; {totals.notComing} not coming &middot; {totals.noAnswer} no answer
          </p>
          <MyCallsList
            eventId={id}
            rows={mine}
            mealOn={eventServesMeal(event.custom_fields)}
            currentUserId={user.id}
          />
        </>
      )}
    </div>
  );
}
