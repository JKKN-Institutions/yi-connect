/**
 * /connections — My address book of scan-to-connect contacts.
 *
 * Grouped by event (most-recent event first, "direct scan" group at the end).
 * Two views: Cards (default) and Table (with CSV / XLSX export).
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { getMyConnections } from '@/lib/data/connections';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, QrCode, UsersRound } from 'lucide-react';
import { ConnectionCard } from '@/components/members/connection-card';
import { ConnectionsTable } from '@/components/members/connections-table';
import type { ConnectionWithMember } from '@/types/connection';

export const metadata = {
  title: 'My Connections · Yi Connect',
  description: 'Your personal address book of scan-to-connect members',
};

async function ConnectionsContent() {
  const user = await requireAuth();
  const groups = await getMyConnections(user.id);

  const flat: ConnectionWithMember[] = groups.flatMap((g) => g.connections);

  if (flat.length === 0) {
    return (
      <Card>
        <CardContent className='p-10 text-center'>
          <UsersRound className='mx-auto h-10 w-10 text-muted-foreground/60' />
          <h2 className='mt-3 text-lg font-semibold'>No connections yet</h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Scan another member&apos;s Yi Connect QR at an event to add them here.
          </p>
          <div className='mt-5 flex justify-center gap-2'>
            <Button asChild variant='outline'>
              <Link href='/settings/profile'>
                <QrCode className='mr-2 h-4 w-4' />
                Show my QR
              </Link>
            </Button>
            <Button asChild>
              <Link href='/events'>Browse events</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <Alert>
        <UsersRound className='h-4 w-4' />
        <AlertTitle>
          {flat.length} {flat.length === 1 ? 'connection' : 'connections'}
        </AlertTitle>
        <AlertDescription>
          Tap a name to open their profile, or switch to table view to export.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue='cards'>
        <TabsList>
          <TabsTrigger value='cards'>Cards</TabsTrigger>
          <TabsTrigger value='table'>Table</TabsTrigger>
        </TabsList>

        <TabsContent value='cards' className='space-y-8 pt-4'>
          {groups.map((group) => (
            <section
              key={group.event_id ?? '__none__'}
              className='space-y-3'
            >
              <div className='flex items-center justify-between gap-2'>
                <h3 className='flex items-center gap-2 text-base font-semibold'>
                  <CalendarDays className='h-4 w-4 text-muted-foreground' />
                  {group.event_title ?? 'Direct connections'}
                  {group.event_date && (
                    <span className='text-sm font-normal text-muted-foreground'>
                      ·{' '}
                      {new Date(group.event_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </h3>
                <Badge variant='secondary'>{group.connections.length}</Badge>
              </div>
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {group.connections.map((c) => (
                  <ConnectionCard key={c.id} connection={c} />
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value='table' className='pt-4'>
          <ConnectionsTable connections={flat} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConnectionsSkeleton() {
  return (
    <div className='space-y-4'>
      <Skeleton className='h-10 w-full' />
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-32' />
        ))}
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>My Connections</h1>
          <p className='text-muted-foreground'>
            Members you've added via QR scan at events.
          </p>
        </div>
        <Button asChild variant='outline'>
          <Link href='/settings/profile'>
            <QrCode className='mr-2 h-4 w-4' />
            My QR
          </Link>
        </Button>
      </div>

      <Suspense fallback={<ConnectionsSkeleton />}>
        <ConnectionsContent />
      </Suspense>
    </div>
  );
}
