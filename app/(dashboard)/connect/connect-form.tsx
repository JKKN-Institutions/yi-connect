'use client';

/**
 * Client form used by /connect — "Add to my connections" + optional note.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { createConnection } from '@/app/actions/connections';

interface Props {
  targetQrToken: string;
  targetMemberId: string;
  targetName: string;
  eventId: string | null;
}

export function ConnectForm({
  targetQrToken,
  targetName,
  eventId,
}: Props) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      const res = await createConnection({
        targetQrToken,
        eventId,
        note: note.trim().length > 0 ? note.trim() : null,
      });
      if (!res.success) {
        toast.error(res.error ?? 'Could not add connection.');
        return;
      }
      toast.success(`${targetName} added to your connections.`);
      router.push('/connections');
      router.refresh();
    });
  };

  return (
    <div className='space-y-3'>
      <div className='space-y-2'>
        <Label htmlFor='connect-note' className='text-sm font-medium'>
          Note <span className='text-xs text-muted-foreground'>(optional)</span>
        </Label>
        <Textarea
          id='connect-note'
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='Where you met, what you spoke about…'
        />
        <p className='text-xs text-muted-foreground'>
          Only visible to you.
        </p>
      </div>

      <Button onClick={handleAdd} disabled={isPending} className='w-full'>
        <UserPlus className='mr-2 h-4 w-4' />
        {isPending ? 'Adding…' : `Add ${targetName} to my connections`}
      </Button>
    </div>
  );
}
