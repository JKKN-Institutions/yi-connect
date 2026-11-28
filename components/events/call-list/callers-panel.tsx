'use client';

/**
 * Leader panel: tick the chapter members who may use this event's call list
 * (My calls, phone numbers, recording results). Stored in
 * events.custom_fields.callers. Nothing is sent to anyone.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Users } from 'lucide-react';
import { setEventCaller } from '@/app/actions/event-call-list';
import type { CallerOption } from '@/lib/event-call-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function CallersPanel({
  eventId,
  members,
  callerIds
}: {
  eventId: string;
  members: CallerOption[];
  callerIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ticked, setTicked] = useState(new Set(callerIds));

  function toggle(m: CallerOption, on: boolean) {
    startTransition(async () => {
      const res = await setEventCaller(eventId, m.id, on);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setTicked((prev) => {
        const next = new Set(prev);
        if (on) next.add(m.id);
        else next.delete(m.id);
        return next;
      });
      toast.success(on ? `${m.name} can now make calls.` : `${m.name} removed from callers.`);
      router.refresh();
    });
  }

  function copyLink() {
    const url = `${window.location.origin}/events/${eventId}/my-calls`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Caller link copied. Share it with your callers yourself.'),
      () => toast.error(url)
    );
  }

  return (
    <Card data-testid='callers-panel'>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Users className='h-4 w-4' /> Callers (EC) &middot; {ticked.size}
          </CardTitle>
          <Button variant='outline' size='sm' onClick={copyLink}>
            <Copy className='mr-2 h-4 w-4' /> Copy caller link
          </Button>
        </div>
        <CardDescription>
          Ticked members open My calls, see every name with its phone number and mark calls. Everyone else is told
          to ask the Chair.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className='text-sm text-muted-foreground'>No active members in this chapter.</p>
        ) : (
          <ul className='grid max-h-72 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2'>
            {members.map((m) => (
              <li key={m.id}>
                <label className='flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted'>
                  <Checkbox
                    checked={ticked.has(m.id)}
                    disabled={pending}
                    onCheckedChange={(v) => toggle(m, v === true)}
                    aria-label={`Caller: ${m.name}`}
                  />
                  {m.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
