/**
 * Sponsor Portal — Leads List (Stutzee Feature 3D)
 *
 * Per-event view of captured sponsor leads with filters and CSV/XLSX export.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'

import { requireRole } from '@/lib/auth'
import { getEventById } from '@/lib/data/events'
import {
  getEventSponsorOptions,
  getSponsorLeadsForEvent,
} from '@/lib/data/sponsor-leads'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SponsorLeadsTable } from '@/components/events/sponsor-leads-table'

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Sponsor Leads | Yi Connect',
  description: 'Leads captured at this event on behalf of sponsors.',
}

export async function generateStaticParams() {
  return [{ id: '00000000-0000-0000-0000-000000000000' }]
}

export default async function SponsorLeadsListPage({ params }: PageProps) {
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member',
  ])

  return (
    <Suspense fallback={<LeadsSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}

async function Content({ params }: PageProps) {
  const { id: eventId } = await params

  const [event, leads, sponsors] = await Promise.all([
    getEventById(eventId),
    getSponsorLeadsForEvent(eventId),
    getEventSponsorOptions(eventId),
  ])

  if (!event) notFound()

  const sponsorOptions = sponsors.map(s => ({
    label: s.organization_name,
    value: s.id,
  }))

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div className='flex items-center gap-4'>
          <Link href={`/events/${eventId}/sponsor-portal`}>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold tracking-tight'>
              Sponsor Leads
            </h1>
            <p className='text-sm text-muted-foreground'>
              {event.title} — {leads.length} lead
              {leads.length === 1 ? '' : 's'} captured
            </p>
          </div>
        </div>
        <Link href={`/events/${eventId}/sponsor-portal`}>
          <Button>
            <Plus className='h-4 w-4 mr-2' />
            Capture lead
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All leads for this event</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className='py-10 text-center text-muted-foreground text-sm'>
              No leads captured yet. Head to the portal to start.
            </div>
          ) : (
            <SponsorLeadsTable
              leads={leads}
              sponsorOptions={sponsorOptions}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LeadsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Skeleton className='h-10 w-10' />
        <div className='space-y-2'>
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-4 w-40' />
        </div>
      </div>
      <Skeleton className='h-[500px] w-full' />
    </div>
  )
}
