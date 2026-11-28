/**
 * My calls — the names a leader gave to the signed-in caller for this event,
 * each with a tap-to-call link and quick result buttons. Phone-first layout.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, PhoneCall } from 'lucide-react';
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

  // Only this caller's rows leave the server.
  const mine = (await getCallList(id)).filter((r) => r.callerId === user.id);
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
            <CardTitle className='text-base'>No names given to you yet</CardTitle>
            <CardDescription>
              When the Chair or an organizer gives you names to call for this event, they show up here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className='text-sm' data-testid='my-calls-summary'>
            <strong>{totals.called}</strong> of <strong>{totals.invited}</strong> called &middot;{' '}
            {totals.coming} coming &middot; {totals.notComing} not coming &middot; {totals.noAnswer} no answer
          </p>
          <MyCallsList eventId={id} rows={mine} mealOn={eventServesMeal(event.custom_fields)} />
        </>
      )}
    </div>
  );
}
