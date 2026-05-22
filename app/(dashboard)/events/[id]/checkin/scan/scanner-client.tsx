'use client';

/**
 * ScannerClient — Chair's live QR scanner for per-attendee tickets.
 *
 * Reuses the existing <QRScanner /> from components/mobile (html5-qrcode).
 * Extracts `?t=[token]` from the scanned URL, calls the server action
 * `checkInByTicketToken()`, and shows a live attendee card.
 *
 * Features:
 *   - Running counter of check-ins this session
 *   - "Scan another" resets back to camera view
 *   - Already-checked-in detection → shown as info, not error
 *   - Deep-link support via `initialToken` prop
 */

import { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, Info, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QRScanner } from '@/components/mobile/qr-scanner';
import {
  checkInByTicketToken,
  type TicketAttendeeProfile
} from '@/app/actions/events';
import type { QRScanResult } from '@/types/mobile';
import toast from 'react-hot-toast';

interface ScannerClientProps {
  eventId: string;
  initialToken: string | null;
}

type ScanState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | {
      kind: 'success';
      profile: TicketAttendeeProfile;
    }
  | { kind: 'error'; message: string };

/**
 * Extract the `t` query param from either a full URL or a bare token.
 * Accepts:
 *   - https://foo.com/events/abc/checkin/scan?t=abc123
 *   - abc123 (raw token, e.g. manual entry)
 */
function extractToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Raw hex token (32 chars)
  if (/^[a-f0-9]{32}$/i.test(trimmed)) return trimmed;

  // URL with ?t=...
  try {
    const url = new URL(trimmed, 'https://placeholder.local');
    const t = url.searchParams.get('t');
    if (t && t.length >= 16) return t;
  } catch {
    // not a URL
  }

  // Fallback: any alphanumeric segment that looks tokeny
  if (/^[a-zA-Z0-9\-_]{16,}$/.test(trimmed)) return trimmed;

  return null;
}

export function ScannerClient({ eventId, initialToken }: ScannerClientProps) {
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const [count, setCount] = useState(0);
  const [scannerKey, setScannerKey] = useState(0); // force-remount to restart camera

  const runCheckIn = useCallback(
    async (token: string) => {
      setState({ kind: 'checking' });
      const result = await checkInByTicketToken(token);
      if (!result.success || !result.data) {
        setState({ kind: 'error', message: result.error ?? 'Check-in failed' });
        return;
      }
      const { data } = result;
      // Sanity: ticket belongs to this event
      if (data.eventId !== eventId) {
        setState({
          kind: 'error',
          message: 'This ticket is for a different event'
        });
        return;
      }
      if (!data.alreadyCheckedIn) {
        setCount((c) => c + 1);
        toast.success(`Checked in: ${data.fullName}`);
      } else {
        toast(`Already checked in: ${data.fullName}`, { icon: 'ℹ️' });
      }
      setState({ kind: 'success', profile: data });
    },
    [eventId]
  );

  // Deep-link: if opened via ?t=..., auto-submit
  useEffect(() => {
    if (initialToken && state.kind === 'idle') {
      const token = extractToken(initialToken);
      if (token) void runCheckIn(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = useCallback(
    (result: QRScanResult) => {
      if (!result.success || !result.data) return;
      const token = extractToken(result.data);
      if (!token) {
        setState({ kind: 'error', message: 'QR does not look like a Yi Connect ticket' });
        return;
      }
      void runCheckIn(token);
    },
    [runCheckIn]
  );

  const reset = () => {
    setState({ kind: 'idle' });
    setScannerKey((k) => k + 1);
  };

  return (
    <div className='relative flex flex-col gap-4'>
      {/* Running counter */}
      <div className='absolute right-0 top-0 z-10'>
        <Badge variant='secondary' className='gap-1.5 px-3 py-1.5 text-sm'>
          <Users className='h-4 w-4' />
          <span className='font-semibold'>{count}</span>
          <span className='text-muted-foreground'>this session</span>
        </Badge>
      </div>

      {state.kind === 'idle' && (
        <QRScanner key={scannerKey} onScan={handleScan} />
      )}

      {state.kind === 'checking' && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center gap-3 py-16'>
            <div className='h-10 w-10 animate-spin rounded-full border-b-2 border-primary' />
            <p className='text-sm text-muted-foreground'>Checking in…</p>
          </CardContent>
        </Card>
      )}

      {state.kind === 'success' && (
        <AttendeeResultCard
          profile={state.profile}
          onContinue={reset}
        />
      )}

      {state.kind === 'error' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-destructive'>
              <AlertCircle className='h-5 w-5' />
              Scan failed
            </CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <p className='text-sm text-muted-foreground'>{state.message}</p>
            <Button onClick={reset} className='w-full'>
              <Camera className='mr-2 h-4 w-4' />
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AttendeeResultCard({
  profile,
  onContinue
}: {
  profile: TicketAttendeeProfile;
  onContinue: () => void;
}) {
  const initials = profile.fullName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const StatusIcon = profile.alreadyCheckedIn ? Info : CheckCircle2;
  const statusColor = profile.alreadyCheckedIn
    ? 'text-blue-600'
    : 'text-green-600';
  const statusText = profile.alreadyCheckedIn
    ? 'Already checked in'
    : 'Checked in';

  const checkInTime = new Date(profile.checkedInAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Card className={profile.alreadyCheckedIn ? '' : 'border-green-500/60'}>
      <CardContent className='flex flex-col items-center gap-4 p-6'>
        <div className={`flex items-center gap-2 ${statusColor}`}>
          <StatusIcon className='h-6 w-6' />
          <span className='text-lg font-semibold'>{statusText}</span>
        </div>

        <Avatar className='h-20 w-20'>
          {profile.avatarUrl ? (
            <AvatarImage src={profile.avatarUrl} alt={profile.fullName} />
          ) : null}
          <AvatarFallback className='text-xl'>{initials || '?'}</AvatarFallback>
        </Avatar>

        <div className='text-center'>
          <div className='text-xl font-semibold'>{profile.fullName}</div>
          {profile.designation || profile.company ? (
            <div className='mt-1 text-sm text-muted-foreground'>
              {[profile.designation, profile.company].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          <div className='mt-2 flex flex-wrap items-center justify-center gap-2'>
            <Badge variant={profile.attendeeType === 'member' ? 'default' : 'secondary'}>
              {profile.attendeeType === 'member' ? 'Member' : 'Guest'}
            </Badge>
            <Badge variant='outline'>At {checkInTime}</Badge>
          </div>
        </div>

        <Button onClick={onContinue} className='w-full' size='lg'>
          <Camera className='mr-2 h-4 w-4' />
          Scan another
        </Button>
      </CardContent>
    </Card>
  );
}
