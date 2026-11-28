'use client';

/**
 * Caller's phone view: one card per name, big tap-to-call button, quick
 * result buttons and a short note. Saving sets called_by and called_at.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Phone } from 'lucide-react';
import { recordCallResult } from '@/app/actions/event-call-list';
import {
  CALL_RESULT_LABELS,
  telHref,
  type CallListRow,
  type CallResult
} from '@/lib/event-call-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const QUICK: CallResult[] = ['coming', 'not_coming', 'no_answer', 'call_back'];

export function MyCallsList({ eventId, rows }: { eventId: string; rows: CallListRow[] }) {
  // Not-yet-called first, then call-backs, then the rest.
  const order: Record<CallResult, number> = { not_called: 0, call_back: 1, no_answer: 2, coming: 3, not_coming: 4 };
  const sorted = [...rows].sort((a, b) => order[a.result] - order[b.result] || a.name.localeCompare(b.name));
  return (
    <ul className='flex flex-col gap-3'>
      {sorted.map((r) => (
        <MyCallCard key={`${r.kind}:${r.id}`} eventId={eventId} row={r} />
      ))}
    </ul>
  );
}

function MyCallCard({ eventId, row }: { eventId: string; row: CallListRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(row.note ?? '');
  const tel = telHref(row.phone);

  function save(result: CallResult) {
    startTransition(async () => {
      const res = await recordCallResult(eventId, { kind: row.kind, id: row.id }, result, note);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${row.name}: ${CALL_RESULT_LABELS[result]}`);
      router.refresh();
    });
  }

  return (
    <li data-testid='my-call' data-name={row.name}>
      <Card className='shadow-sm'>
        <CardContent className='flex flex-col gap-3 p-4'>
          <div className='flex items-start justify-between gap-2'>
            <div>
              <div className='text-base font-semibold'>{row.name}</div>
              <div className='text-sm text-muted-foreground'>{row.phone || 'No phone number on file'}</div>
            </div>
            <Badge variant={row.result === 'not_called' ? 'outline' : 'secondary'} data-testid='my-call-result'>
              {CALL_RESULT_LABELS[row.result]}
            </Badge>
          </div>

          {tel && (
            <Button asChild size='lg' className='w-full bg-green-600 hover:bg-green-700 text-white'>
              <a href={tel}>
                <Phone className='mr-2 h-5 w-5' /> Call {row.name.split(' ')[0]}
              </a>
            </Button>
          )}

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='What did they say? (optional)'
            maxLength={500}
            aria-label={`Note for ${row.name}`}
          />

          <div className='grid grid-cols-2 gap-2'>
            {QUICK.map((r) => (
              <Button
                key={r}
                variant={row.result === r ? 'default' : 'outline'}
                disabled={pending}
                onClick={() => save(r)}
                className='h-11'
              >
                {CALL_RESULT_LABELS[r]}
              </Button>
            ))}
          </div>
          {row.calledAt && (
            <p className='text-xs text-muted-foreground'>
              Last saved {new Date(row.calledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              {row.calledByName ? ` by ${row.calledByName}` : ''}
            </p>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
