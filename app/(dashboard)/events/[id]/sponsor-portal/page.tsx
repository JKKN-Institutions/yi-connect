/**
 * Sponsor Portal — Lead Capture (Stutzee Feature 3D)
 *
 * EC Member+ operates this portal on behalf of sponsors to capture leads
 * at events. Flow:
 *  1. Pick sponsor (dropdown of sponsors tied to this event via
 *     sponsorship_deals).
 *  2. Scan attendee QR or manually enter details.
 *  3. Submit → success → capture another.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ListChecks, Users } from 'lucide-react'

import { requireRole } from '@/lib/auth'
import { getEventById } from '@/lib/data/events'
import {
  getEventSponsorOptions,
  getEventLeadsSummary,
} from '@/lib/data/sponsor-leads'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

import { LeadCaptureForm } from '@/components/events/lead-capture-form'
import {
  INTEREST_LEVEL_COLORS,
  INTEREST_LEVEL_LABELS,
  type InterestLevel,
} from '@/types/sponsor-lead'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sponsor?: string }>
}

export const metadata = {
  title: 'Sponsor Portal | Yi Connect',
  description: 'Capture leads for sponsors at this event.',
}

export async function generateStaticParams() {
  return [{ id: '00000000-0000-0000-0000-000000000000' }]
}

export default async function SponsorPortalPage({
  params,
  searchParams,
}: PageProps) {
  // Role gate: EC Member or higher operates the portal
  await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Executive Member',
    'EC Member',
  ])

  return (
    <Suspense fallback={<PortalSkeleton />}>
      <PortalContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function PortalContent({ params, searchParams }: PageProps) {
  const { id: eventId } = await params
  const { sponsor: preselectedSponsorId } = await searchParams

  const [event, sponsors, summary] = await Promise.all([
    getEventById(eventId),
    getEventSponsorOptions(eventId),
    getEventLeadsSummary(eventId),
  ])

  if (!event) {
    notFound()
  }

  const activeSponsor =
    sponsors.find(s => s.id === preselectedSponsorId) ?? sponsors[0] ?? null

  const totalLeads = Object.values(summary).reduce((a, b) => a + b, 0)

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
        <div className='flex items-center gap-4'>
          <Link href={`/events/${eventId}`}>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold tracking-tight'>
              Sponsor Portal
            </h1>
            <p className='text-sm text-muted-foreground'>{event.title}</p>
          </div>
        </div>
        <div className='flex gap-2'>
          <Link href={`/events/${eventId}/sponsor-portal/leads`}>
            <Button variant='outline'>
              <ListChecks className='h-4 w-4 mr-2' />
              View leads ({totalLeads})
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary badges */}
      {totalLeads > 0 && (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground mr-1'>
            <Users className='h-3.5 w-3.5 inline mr-1' />
            Leads so far:
          </span>
          {(Object.keys(INTEREST_LEVEL_LABELS) as InterestLevel[]).map(level => (
            <Badge
              key={level}
              variant='outline'
              className={INTEREST_LEVEL_COLORS[level]}
            >
              {INTEREST_LEVEL_LABELS[level]}: {summary[level] ?? 0}
            </Badge>
          ))}
        </div>
      )}

      {/* No sponsors attached */}
      {sponsors.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sponsors attached to this event</CardTitle>
            <CardDescription>
              Add a sponsorship deal for this event first, then come back to
              capture leads on their behalf.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/finance/sponsorships/new?event_id=${eventId}`}>
              <Button>Create sponsorship deal</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Capture a lead</CardTitle>
            <CardDescription>
              Select which sponsor this lead is for, then scan their ticket QR
              or enter details manually.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            {/* Step 1: Sponsor selector */}
            <SponsorSelector
              eventId={eventId}
              sponsors={sponsors}
              selectedId={activeSponsor?.id ?? null}
            />

            {/* Step 2 + 3: Form (uses selected sponsor) */}
            {activeSponsor ? (
              <LeadCaptureForm
                key={activeSponsor.id}
                eventId={eventId}
                sponsorId={activeSponsor.id}
                sponsorName={activeSponsor.organization_name}
              />
            ) : (
              <p className='text-sm text-muted-foreground'>
                Pick a sponsor above to continue.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Server-rendered sponsor selector. Uses a native HTML form + select so it
 * works without client JS and GETs back to the same page with ?sponsor=id.
 */
function SponsorSelector({
  eventId,
  sponsors,
  selectedId,
}: {
  eventId: string
  sponsors: { id: string; organization_name: string }[]
  selectedId: string | null
}) {
  return (
    <form
      action={`/events/${eventId}/sponsor-portal`}
      method='GET'
      className='flex flex-col sm:flex-row sm:items-end gap-3'
    >
      <div className='flex-1 space-y-1.5'>
        <label htmlFor='sponsor' className='text-sm font-medium'>
          Capture lead for sponsor
        </label>
        <select
          id='sponsor'
          name='sponsor'
          defaultValue={selectedId ?? ''}
          className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring'
        >
          <option value='' disabled>
            Select sponsor…
          </option>
          {sponsors.map(s => (
            <option key={s.id} value={s.id}>
              {s.organization_name}
            </option>
          ))}
        </select>
      </div>
      <Button type='submit' variant='outline'>
        Switch sponsor
      </Button>
    </form>
  )
}

function PortalSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-4'>
        <Skeleton className='h-10 w-10' />
        <div className='space-y-2'>
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-4 w-40' />
        </div>
      </div>
      <Skeleton className='h-96 w-full' />
    </div>
  )
}
