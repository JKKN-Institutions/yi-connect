'use client';

/**
 * Leader view of an event's call list: totals, invite-all, add guest,
 * filters, batch "Assign to", and per-row result + note.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Phone, UserPlus, Users, Copy } from 'lucide-react';
import {
  inviteAllChapterMembers,
  assignCaller,
  recordCallResult,
  addCallListGuest
} from '@/app/actions/event-call-list';
import {
  CALL_RESULTS,
  CALL_RESULT_LABELS,
  computeCallTotals,
  telHref,
  type CallListRow,
  type CallerOption,
  type CallResult
} from '@/lib/event-call-list';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const ALL = '__all__';
const UNASSIGNED = '__unassigned__';
const NOBODY = '__nobody__';

const rowKey = (r: Pick<CallListRow, 'kind' | 'id'>) => `${r.kind}:${r.id}`;

function resultVariant(result: CallResult): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (result === 'coming') return 'default';
  if (result === 'not_coming') return 'destructive';
  if (result === 'not_called') return 'outline';
  return 'secondary';
}

interface Props {
  eventId: string;
  rows: CallListRow[];
  callers: CallerOption[];
}

export function CallListManager({ eventId, rows, callers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [callerFilter, setCallerFilter] = useState<string>(ALL);
  const [resultFilter, setResultFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);

  const totals = useMemo(() => computeCallTotals(rows), [rows]);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (callerFilter === UNASSIGNED && r.callerId) return false;
        if (callerFilter !== ALL && callerFilter !== UNASSIGNED && r.callerId !== callerFilter) return false;
        if (resultFilter !== ALL && r.result !== resultFilter) return false;
        return true;
      }),
    [rows, callerFilter, resultFilter]
  );

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(rowKey(r)));

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAllVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (on) next.add(rowKey(r));
        else next.delete(rowKey(r));
      }
      return next;
    });
  }

  function run<T>(fn: () => Promise<{ success: boolean; error?: string; data?: T }>, ok: (data?: T) => string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.success) {
        toast.error(res.error || 'Something went wrong');
        return;
      }
      toast.success(ok(res.data));
      router.refresh();
    });
  }

  function onInviteAll() {
    run(
      () => inviteAllChapterMembers(eventId),
      (d) =>
        d && d.added > 0
          ? `Added ${d.added} member${d.added === 1 ? '' : 's'} to the list. No messages were sent.`
          : d && d.alreadyInvited > 0
            ? 'Everyone in the chapter is already on the list.'
            : 'No active members found in this chapter.'
    );
  }

  function onAssign() {
    if (!assignTo) {
      toast.error('Pick who should call');
      return;
    }
    const invitees = rows
      .filter((r) => selected.has(rowKey(r)))
      .map((r) => ({ kind: r.kind, id: r.id }));
    const caller = assignTo === NOBODY ? null : assignTo;
    run(
      () => assignCaller(eventId, invitees, caller),
      () => {
        setSelected(new Set());
        return caller
          ? `Gave ${invitees.length} name${invitees.length === 1 ? '' : 's'} to ${callers.find((c) => c.id === caller)?.name ?? 'the caller'}`
          : `Removed the caller from ${invitees.length} name${invitees.length === 1 ? '' : 's'}`;
      }
    );
  }

  function onAddGuest(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => addCallListGuest(eventId, { full_name: guestName, phone: guestPhone }),
      () => {
        const name = guestName;
        setGuestName('');
        setGuestPhone('');
        return `Added ${name} as a guest`;
      }
    );
  }

  function copyCallerLink() {
    const url = `${window.location.origin}/events/${eventId}/my-calls`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Caller link copied. Share it with your callers yourself.'),
      () => toast.error(url)
    );
  }

  const stats: Array<[string, number, string]> = [
    ['Invited', totals.invited, 'invited'],
    ['Called', totals.called, 'called'],
    ['Coming', totals.coming, 'coming'],
    ['Not coming', totals.notComing, 'not-coming'],
    ['No answer', totals.noAnswer, 'no-answer'],
    ['Call back', totals.callBack, 'call-back']
  ];

  return (
    <div className='flex flex-col gap-4'>
      {/* Totals */}
      <div className='grid grid-cols-3 gap-2 sm:grid-cols-6'>
        {stats.map(([label, value, id]) => (
          <Card key={id} className='border shadow-none'>
            <CardContent className='p-3'>
              <div className='text-xs text-muted-foreground'>{label}</div>
              <div className='text-2xl font-semibold tabular-nums' data-testid={`total-${id}`}>
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {totals.unassigned > 0 && (
        <p className='text-sm text-muted-foreground'>
          {totals.unassigned === 1 ? '1 name still needs a caller.' : `${totals.unassigned} names still need a caller.`}
        </p>
      )}

      {/* Actions */}
      <div className='flex flex-wrap gap-2'>
        <Button onClick={onInviteAll} disabled={pending} data-testid='invite-all'>
          <Users className='mr-2 h-4 w-4' /> Invite all active chapter members
        </Button>
        <Button variant='outline' onClick={() => setShowGuestForm((v) => !v)} disabled={pending}>
          <UserPlus className='mr-2 h-4 w-4' /> Add guest
        </Button>
        <Button variant='ghost' onClick={copyCallerLink}>
          <Copy className='mr-2 h-4 w-4' /> Copy caller link
        </Button>
      </div>
      <p className='text-xs text-muted-foreground -mt-2'>
        Inviting only adds names to this list. It sends no WhatsApp, email or app message.
      </p>

      {showGuestForm && (
        <form onSubmit={onAddGuest} className='flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end'>
          <div className='flex-1'>
            <label className='text-xs text-muted-foreground' htmlFor='guest-name'>Full name</label>
            <Input id='guest-name' value={guestName} onChange={(e) => setGuestName(e.target.value)} required minLength={2} placeholder='e.g. a past chair' />
          </div>
          <div className='sm:w-48'>
            <label className='text-xs text-muted-foreground' htmlFor='guest-phone'>Phone</label>
            <Input id='guest-phone' value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} inputMode='tel' placeholder='98xxxxxxxx' />
          </div>
          <Button type='submit' disabled={pending || guestName.trim().length < 2}>Add</Button>
        </form>
      )}

      {/* Filters + batch assign */}
      <div className='flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-wrap gap-2'>
          <Select value={callerFilter} onValueChange={setCallerFilter}>
            <SelectTrigger className='w-48' aria-label='Filter by caller'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All callers</SelectItem>
              <SelectItem value={UNASSIGNED}>No caller yet</SelectItem>
              {callers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger className='w-40' aria-label='Filter by result'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All results</SelectItem>
              {CALL_RESULTS.map((r) => (
                <SelectItem key={r} value={r}>{CALL_RESULT_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm text-muted-foreground' data-testid='selected-count'>{selected.size} selected</span>
          <Select value={assignTo} onValueChange={setAssignTo}>
            <SelectTrigger className='w-48' aria-label='Assign to'>
              <SelectValue placeholder='Assign to…' />
            </SelectTrigger>
            <SelectContent>
              {callers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
              <SelectItem value={NOBODY}>Nobody (remove caller)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onAssign} disabled={pending || selected.size === 0 || !assignTo} data-testid='assign-btn'>
            Assign
          </Button>
        </div>
      </div>

      {/* List */}
      <div className='rounded-lg border'>
        <div className='flex items-center gap-3 border-b px-3 py-2 text-xs text-muted-foreground'>
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(v) => toggleAllVisible(v === true)}
            aria-label='Select all shown'
          />
          <span>
            Showing {visible.length} of {rows.length}
          </span>
        </div>
        {visible.length === 0 ? (
          <p className='p-6 text-center text-sm text-muted-foreground'>
            {rows.length === 0 ? 'Nobody is invited yet. Start with "Invite all active chapter members".' : 'No names match these filters.'}
          </p>
        ) : (
          <ul className='divide-y'>
            {visible.map((r) => (
              <CallRow
                key={rowKey(r)}
                row={r}
                eventId={eventId}
                checked={selected.has(rowKey(r))}
                onCheck={(on) => toggle(rowKey(r), on)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CallRow({
  row,
  eventId,
  checked,
  onCheck
}: {
  row: CallListRow;
  eventId: string;
  checked: boolean;
  onCheck: (on: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(row.note ?? '');
  const tel = telHref(row.phone);

  function save(result: CallResult, noteValue: string) {
    startTransition(async () => {
      const res = await recordCallResult(eventId, { kind: row.kind, id: row.id }, result, noteValue);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${row.name}: ${CALL_RESULT_LABELS[result]}`);
      router.refresh();
    });
  }

  return (
    <li className='flex flex-col gap-2 px-3 py-3 lg:flex-row lg:items-center' data-testid='call-row' data-name={row.name}>
      <div className='flex flex-1 items-start gap-3'>
        <Checkbox checked={checked} onCheckedChange={(v) => onCheck(v === true)} aria-label={`Select ${row.name}`} className='mt-1' />
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2 font-medium'>
            {row.name}
            {row.kind === 'guest' && <Badge variant='secondary'>Guest</Badge>}
            <Badge variant={resultVariant(row.result)} data-testid='row-result'>{CALL_RESULT_LABELS[row.result]}</Badge>
          </div>
          <div className='text-sm text-muted-foreground'>
            {tel ? (
              <a href={tel} className='inline-flex items-center gap-1 text-orange-700 underline-offset-2 hover:underline'>
                <Phone className='h-3 w-3' /> {row.phone}
              </a>
            ) : (
              <span>No phone number</span>
            )}
            {' · '}Caller: <span data-testid='row-caller'>{row.callerName ?? 'none yet'}</span>
            {row.calledByName && row.calledAt && (
              <> · Called by {row.calledByName}, {new Date(row.calledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</>
            )}
          </div>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2 pl-7 lg:pl-0'>
        <Select value={row.result} onValueChange={(v) => save(v as CallResult, note)} disabled={pending}>
          <SelectTrigger className='w-36' aria-label={`Result for ${row.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALL_RESULTS.map((r) => (
              <SelectItem key={r} value={r}>{CALL_RESULT_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Note'
          maxLength={500}
          className='w-48'
          aria-label={`Note for ${row.name}`}
        />
        {note !== (row.note ?? '') && (
          <Button size='sm' variant='outline' disabled={pending} onClick={() => save(row.result, note)}>
            Save note
          </Button>
        )}
      </div>
    </li>
  );
}
