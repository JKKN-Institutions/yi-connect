'use client';

/**
 * Caller's phone view: one card per name, big tap-to-call button, quick
 * result buttons and a short note. Saving sets called_by and called_at.
 *
 * When the event serves a meal, tapping Coming opens a head-count stepper and
 * Veg / Non-veg buttons in the same card; tapping one saves Coming + meal + heads.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Minus, Phone, Plus } from 'lucide-react';
import { recordCallResult } from '@/app/actions/event-call-list';
import {
  CALL_RESULT_LABELS,
  MEAL_LABELS,
  telHref,
  type CallListRow,
  type CallResult,
  type MealChoice
} from '@/lib/event-call-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const QUICK: CallResult[] = ['coming', 'not_coming', 'no_answer', 'call_back'];

export function MyCallsList({
  eventId,
  rows,
  mealOn,
  currentUserId
}: {
  eventId: string;
  rows: CallListRow[];
  mealOn: boolean;
  currentUserId: string;
}) {
  // Names given to me first; then not-yet-called, call-backs, and the rest.
  const order: Record<CallResult, number> = { not_called: 0, call_back: 1, no_answer: 2, coming: 3, not_coming: 4 };
  const mineFirst = (r: CallListRow) => (r.callerId === currentUserId ? 0 : 1);
  const sorted = [...rows].sort(
    (a, b) => mineFirst(a) - mineFirst(b) || order[a.result] - order[b.result] || a.name.localeCompare(b.name)
  );
  return (
    <ul className='flex flex-col gap-3'>
      {sorted.map((r) => (
        <MyCallCard
          key={`${r.kind}:${r.id}`}
          eventId={eventId}
          row={r}
          mealOn={mealOn}
          givenToMe={r.callerId === currentUserId}
        />
      ))}
    </ul>
  );
}

function MyCallCard({
  eventId,
  row,
  mealOn,
  givenToMe
}: {
  eventId: string;
  row: CallListRow;
  mealOn: boolean;
  givenToMe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(row.note ?? '');
  const [heads, setHeads] = useState(row.heads ?? 1);
  // Meal step is open after tapping Coming, or when Coming was saved without a meal.
  const [askingMeal, setAskingMeal] = useState(mealOn && row.result === 'coming' && !row.meal);
  const tel = telHref(row.phone);

  function save(result: CallResult, meal: MealChoice | null = null) {
    startTransition(async () => {
      const res = await recordCallResult(eventId, { kind: row.kind, id: row.id }, result, note, {
        choice: meal,
        heads
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setAskingMeal(false);
      toast.success(
        meal ? `${row.name}: Coming, ${MEAL_LABELS[meal]} × ${heads}` : `${row.name}: ${CALL_RESULT_LABELS[result]}`
      );
      router.refresh();
    });
  }

  function onQuick(result: CallResult) {
    if (result === 'coming' && mealOn) {
      setAskingMeal(true);
      return;
    }
    save(result);
  }

  return (
    <li data-testid='my-call' data-name={row.name}>
      <Card className='shadow-sm'>
        <CardContent className='flex flex-col gap-3 p-4'>
          <div className='flex items-start justify-between gap-2'>
            <div>
              <div className='text-base font-semibold'>{row.name}</div>
              <div className='text-sm text-muted-foreground' data-testid='my-call-phone'>
                {row.phone || 'No phone number on file'}
              </div>
              {(givenToMe || row.callerName) && (
                <div className='text-xs text-muted-foreground' data-testid='my-call-given'>
                  {givenToMe ? 'Given to you' : `Given to ${row.callerName}`}
                </div>
              )}
            </div>
            <div className='flex flex-col items-end gap-1'>
              <Badge variant={row.result === 'not_called' ? 'outline' : 'secondary'} data-testid='my-call-result'>
                {CALL_RESULT_LABELS[row.result]}
              </Badge>
              {mealOn && row.result === 'coming' && row.meal && (
                <Badge variant='outline' data-testid='my-call-meal'>
                  {MEAL_LABELS[row.meal]} × {row.heads ?? 1}
                </Badge>
              )}
            </div>
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
                variant={row.result === r || (r === 'coming' && askingMeal) ? 'default' : 'outline'}
                disabled={pending}
                onClick={() => onQuick(r)}
                className='h-11'
              >
                {CALL_RESULT_LABELS[r]}
              </Button>
            ))}
          </div>

          {mealOn && (askingMeal || row.result === 'coming') && (
            <div className='flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20' data-testid='meal-step'>
              <div className='flex items-center justify-between gap-2'>
                <span className='text-sm font-medium'>How many people coming?</span>
                <div className='flex items-center gap-2'>
                  <Button
                    size='icon'
                    variant='outline'
                    className='h-10 w-10'
                    aria-label='One fewer person'
                    disabled={pending || heads <= 1}
                    onClick={() => setHeads((h) => Math.max(1, h - 1))}
                  >
                    <Minus className='h-4 w-4' />
                  </Button>
                  <span className='w-8 text-center text-lg font-semibold tabular-nums' data-testid='heads'>
                    {heads}
                  </span>
                  <Button
                    size='icon'
                    variant='outline'
                    className='h-10 w-10'
                    aria-label='One more person'
                    disabled={pending || heads >= 20}
                    onClick={() => setHeads((h) => Math.min(20, h + 1))}
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                {(['veg', 'non_veg'] as MealChoice[]).map((m) => (
                  <Button
                    key={m}
                    className='h-11'
                    variant={row.result === 'coming' && row.meal === m ? 'default' : 'outline'}
                    disabled={pending}
                    onClick={() => save('coming', m)}
                  >
                    {MEAL_LABELS[m]}
                  </Button>
                ))}
              </div>
              {row.result !== 'coming' && (
                <button
                  type='button'
                  className='text-left text-xs text-muted-foreground underline'
                  disabled={pending}
                  onClick={() => save('coming', null)}
                >
                  Save Coming now, ask the meal later
                </button>
              )}
            </div>
          )}

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
