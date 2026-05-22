/**
 * Chair QR Scanner Page — /events/[id]/checkin/scan
 *
 * Chair/Co-Chair/EC Member+ scan attendee ticket QRs here.
 * Each QR encodes a URL with `?t=[ticket_token]`. The client component
 * extracts the token and calls `checkInByTicketToken()`.
 *
 * Supports deep-link shortcut: if the page is opened via ?t=..., the
 * client auto-submits that token (lets a Chair tap an emailed ticket
 * link and instantly register the member).
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getEventFull } from '@/lib/data/events';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { ScannerClient } from './scanner-client';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function EventScanPage({ params, searchParams }: PageProps) {
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member'
  ]);

  return (
    <Suspense fallback={<ScanPageSkeleton />}>
      <ScanPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ScanPageContent({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { t } = await searchParams;

  const event = await getEventFull(id);
  if (!event) notFound();

  return (
    <div className='flex flex-col gap-6'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href='/dashboard'>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href='/events'>Events</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/events/${id}`}>{event.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Scan tickets</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Scan attendee tickets</h1>
          <p className='text-muted-foreground mt-2'>{event.title}</p>
        </div>
        <Button variant='outline' asChild>
          <Link href={`/events/${id}/checkin`}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to check-in
          </Link>
        </Button>
      </div>

      <ScannerClient eventId={id} initialToken={t ?? null} />
    </div>
  );
}

function ScanPageSkeleton() {
  return (
    <div className='flex flex-col gap-6'>
      <Skeleton className='h-4 w-80' />
      <Skeleton className='h-9 w-64' />
      <Skeleton className='h-[480px] w-full rounded-xl' />
    </div>
  );
}
