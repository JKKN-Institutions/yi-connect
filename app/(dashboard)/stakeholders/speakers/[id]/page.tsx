/**
 * Speaker Detail Page
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mic2, DollarSign, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getSpeakerById } from '@/lib/data/stakeholder'
import { StakeholderStatusBadge, HealthTierBadge } from '@/components/stakeholders/status-badges'

interface SpeakerDetailPageProps {
  params: Promise<{ id: string }>
}

async function SpeakerHeader({ speakerId }: { speakerId: string }) {
  const speaker = await getSpeakerById(speakerId)
  if (!speaker) notFound()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stakeholders/speakers"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{speaker.speaker_name}</h1>
            <StakeholderStatusBadge status={speaker.status} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            {speaker.professional_title && (
              <div className="flex items-center gap-1">
                <Mic2 className="h-4 w-4" />
                <span>{speaker.professional_title}</span>
              </div>
            )}
            {speaker.availability_status && (
              <div className="flex items-center gap-1">
                <CalendarCheck className="h-4 w-4" />
                <Badge variant={speaker.availability_status === 'available' ? 'default' : 'secondary'} className="capitalize">
                  {speaker.availability_status.replace('_', ' ')}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
      <Button asChild>
        <Link href={`/stakeholders/speakers/${speaker.id}/edit`}>Edit Speaker</Link>
      </Button>
    </div>
  )
}

async function SpeakerInformation({ speakerId }: { speakerId: string }) {
  const speaker = await getSpeakerById(speakerId)
  if (!speaker) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speaker Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {speaker.bio && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Biography</p>
            <p className="text-sm">{speaker.bio}</p>
          </div>
        )}

        {speaker.expertise_areas && speaker.expertise_areas.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Expertise Areas</p>
            <div className="flex flex-wrap gap-2">
              {speaker.expertise_areas.map((area) => (
                <Badge key={area} variant="secondary">{area}</Badge>
              ))}
            </div>
          </div>
        )}

        {speaker.suitable_topics && speaker.suitable_topics.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Suitable Topics</p>
            <div className="flex flex-wrap gap-2">
              {speaker.suitable_topics.map((topic) => (
                <Badge key={topic} variant="outline">{topic}</Badge>
              ))}
            </div>
          </div>
        )}

        {speaker.session_formats && speaker.session_formats.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Session Formats</p>
            <div className="flex flex-wrap gap-2">
              {speaker.session_formats.map((format) => (
                <Badge key={format} variant="outline">{format}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Fee Status</p>
            <div className="flex items-center gap-2 mt-1">
              <DollarSign className={`h-4 w-4 ${speaker.charges_fee ? 'text-green-600' : 'text-muted-foreground'}`} />
              <p>{speaker.charges_fee ? 'Paid' : 'Pro Bono'}</p>
              {speaker.charges_fee && speaker.fee_range && (
                <span className="text-sm text-muted-foreground">({speaker.fee_range})</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Availability</p>
            <div className="flex items-center gap-2 mt-1">
              <CalendarCheck className="h-4 w-4" />
              <Badge variant={speaker.availability_status === 'available' ? 'default' : 'secondary'} className="capitalize">
                {speaker.availability_status?.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {speaker.website && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Website</p>
              <a
                href={speaker.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline mt-1 block"
              >
                {speaker.website}
              </a>
            </div>
          )}

          {speaker.linkedin_profile && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">LinkedIn</p>
              <a
                href={speaker.linkedin_profile}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline mt-1 block"
              >
                View Profile
              </a>
            </div>
          )}
        </div>

        {speaker.past_engagements && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Past Engagements</p>
            <p className="text-sm whitespace-pre-line">{speaker.past_engagements}</p>
          </div>
        )}

        {speaker.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Internal Notes</p>
            <p className="text-sm whitespace-pre-line">{speaker.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default async function SpeakerDetailPage({ params }: SpeakerDetailPageProps) {
  const { id } = await params
  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={<div>Loading...</div>}>
        <SpeakerHeader speakerId={id} />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <SpeakerInformation speakerId={id} />
      </Suspense>
    </div>
  )
}
