/**
 * My calls — the event's call list for callers, phone-first.
 *
 * Any active member of the event's chapter sees every invitee and can record
 * a result; names given to them come first, and each card shows who last
 * called it. A caller from outside the chapter sees only names given to them.
 *
 * Phone numbers are shown only to leaders and to the caller a name was given
 * to: plain members have no member directory with phones, so open callers see
 * names and call status, not numbers.
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
              <Lock className='h-5 w-5' /> You don&apos;t have access to this call list
            </CardTitle>
            <CardDescription>
              Calls for &ldquo;{event.title}&rdquo; are open to active members of the event&apos;s chapter.
              Contact your chapter Chair if you should be making these calls.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Chapter members see every name; outside callers only the names given to them.
  // Numbers leave the server only for leaders and the assigned caller.
  const visible = access.canCall ? all : assignedToMe;
  const mine = visible.map((r) =>
    access.canManage || r.callerId === user.id ? r : { ...r, phone: null, phoneHidden: !!r.phone }
  );
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
