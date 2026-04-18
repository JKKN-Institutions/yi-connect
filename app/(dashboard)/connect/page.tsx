/**
 * /connect?token=X&event=Y  — Scan landing page (Stutzee Feature 4A).
 *
 * Authenticated-only. The QR in a member's wallet encodes this URL with
 * their permanent `profile_qr_token`. When another member scans it, we:
 *   1. Require auth (redirect to /login with returnTo preserved)
 *   2. Resolve the profile via `getMemberByQrToken`
 *   3. Respect privacy opt-out
 *   4. Refuse self-scan (friendly message, not an error)
 *   5. Otherwise show the profile card + "Add to My Connections" CTA
 *
 * Hitting this page without being the target member is harmless: the worst
 * a malicious scanner can do is add the card-holder to *their own* address
 * book. No data flows the other way.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Building2, Linkedin, MapPin, ShieldAlert, UserX } from 'lucide-react';
import { getCurrentUser } from '@/lib/data/auth';
import { getMemberByQrToken } from '@/lib/data/connections';
import { ConnectForm } from './connect-form';

interface PageProps {
  searchParams: Promise<{ token?: string; event?: string }>;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

async function ConnectContent({
  token,
  eventId,
}: {
  token: string;
  eventId: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // Preserve the scan link through the login redirect.
    const returnTo = encodeURIComponent(
      `/connect?token=${token}${eventId ? `&event=${eventId}` : ''}`
    );
    redirect(`/login?redirectTo=${returnTo}`);
  }

  if (!token || typeof token !== 'string') {
    return (
      <Alert variant='destructive'>
        <ShieldAlert className='h-4 w-4' />
        <AlertTitle>Missing QR token</AlertTitle>
        <AlertDescription>
          This link is not a valid Yi Connect networking QR.
        </AlertDescription>
      </Alert>
    );
  }

  const target = await getMemberByQrToken(token);

  if (!target) {
    return (
      <Alert variant='destructive'>
        <UserX className='h-4 w-4' />
        <AlertTitle>Member not found</AlertTitle>
        <AlertDescription>
          This QR is not recognised, or the member has turned off networking scans.
        </AlertDescription>
      </Alert>
    );
  }

  const isSelf = target.id === user.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isSelf ? 'This is your own QR' : 'Add to your connections'}
        </CardTitle>
        <CardDescription>
          {isSelf
            ? 'Other members will land here when they scan your code.'
            : 'Yi Connect found this member. Add them to your personal address book.'}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='flex items-start gap-4'>
          <Avatar className='h-20 w-20'>
            <AvatarImage src={target.avatar_url ?? undefined} alt={target.full_name} />
            <AvatarFallback className='bg-primary/10 text-primary text-xl'>
              {initials(target.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0 flex-1 space-y-1'>
            <h2 className='text-xl font-semibold'>{target.full_name}</h2>
            {(target.designation || target.company) && (
              <p className='text-sm text-muted-foreground'>
                {[target.designation, target.company].filter(Boolean).join(' at ')}
              </p>
            )}
            <div className='flex flex-wrap gap-2 pt-1'>
              {target.chapter_name && (
                <Badge variant='outline'>
                  <MapPin className='mr-1 h-3 w-3' />
                  {target.chapter_name}
                </Badge>
              )}
              {target.industry && (
                <Badge variant='outline'>
                  <Building2 className='mr-1 h-3 w-3' />
                  {target.industry}
                </Badge>
              )}
              {target.linkedin_url && (
                <a
                  href={target.linkedin_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1 text-xs text-primary hover:underline'
                >
                  <Linkedin className='h-3 w-3' />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {isSelf ? (
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Button asChild variant='outline' className='flex-1'>
              <Link href='/settings/profile'>Manage my QR</Link>
            </Button>
            <Button asChild className='flex-1'>
              <Link href='/connections'>My connections</Link>
            </Button>
          </div>
        ) : (
          <ConnectForm
            targetQrToken={token}
            targetMemberId={target.id}
            targetName={target.full_name}
            eventId={eventId}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ConnectSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Looking up member…</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='h-24 animate-pulse rounded-md bg-muted' />
      </CardContent>
    </Card>
  );
}

export default async function ConnectPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';
  const eventId = typeof sp.event === 'string' && sp.event.length > 0 ? sp.event : null;

  return (
    <div className='mx-auto max-w-2xl space-y-6 p-4 sm:p-6'>
      <Button variant='ghost' size='sm' asChild>
        <Link href='/dashboard'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back
        </Link>
      </Button>

      <Suspense fallback={<ConnectSkeleton />}>
        <ConnectContent token={token} eventId={eventId} />
      </Suspense>
    </div>
  );
}

export const metadata = {
  title: 'Connect · Yi Connect',
};
