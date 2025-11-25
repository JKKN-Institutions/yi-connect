import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Vote, Edit, Calendar, MapPin, Link as LinkIcon, FileText } from 'lucide-react'
import { getMeetingById, getVoteResultsByPosition } from '@/lib/data/succession'
import { MeetingStatusBadge, MeetingTypeBadge } from '@/components/succession/displays/succession-status-badges'
import { VoteResults } from '@/components/succession/displays/vote-results'
import { requireRole } from '@/lib/auth'
import { format } from 'date-fns'

export const metadata = {
  title: 'Meeting Details | Admin',
  description: 'View meeting details and voting results',
}

interface MeetingDetailsPageProps {
  params: Promise<{ id: string }>
}

interface VoteResult {
  position: {
    id: string
    title: string
    hierarchy_level: number
  }
  nominee: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string
  }
  votes: {
    yes: number
    no: number
    abstain: number
  }
}

async function MeetingDetailsContent({ meetingId }: { meetingId: string }) {
  const meeting = await getMeetingById(meetingId)

  if (!meeting) {
    notFound()
  }

  const voteResults = (await getVoteResultsByPosition(meetingId)) as VoteResult[]

  // Count total voters (unique voters in this meeting)
  // For simplicity, we'll calculate this from the cycle's selection committee
  // In a real implementation, you'd query the actual voters
  const totalVoters = meeting.cycle?.selection_committee_ids?.length || 0

  const formatMeetingDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPpp') // e.g., "Jan 1, 2024, 2:30 PM"
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <MeetingTypeBadge type={meeting.meeting_type} />
                <MeetingStatusBadge status={meeting.status} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  {meeting.meeting_type.replace(/_/g, ' ').toUpperCase()} Meeting
                </h2>
                <p className="text-muted-foreground mt-1">
                  {meeting.cycle.cycle_name} - {meeting.cycle.year}
                </p>
              </div>
            </div>
            {(meeting.status === 'scheduled' || meeting.status === 'in_progress') && (
              <div className="flex gap-2">
                <Link href={`/succession/admin/meetings/${meeting.id}/vote`}>
                  <Button>
                    <Vote className="mr-2 h-4 w-4" />
                    Cast Votes
                  </Button>
                </Link>
                <Link href={`/succession/admin/meetings/${meeting.id}/edit`}>
                  <Button variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Date & Time</div>
                  <div className="text-sm text-muted-foreground">
                    {formatMeetingDate(meeting.meeting_date)}
                  </div>
                </div>
              </div>

              {meeting.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Location</div>
                    <div className="text-sm text-muted-foreground">{meeting.location}</div>
                  </div>
                </div>
              )}

              {meeting.meeting_link && (
                <div className="flex items-start gap-3">
                  <LinkIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Meeting Link</div>
                    <a
                      href={meeting.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Join Meeting
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Created By</div>
                  <div className="text-sm text-muted-foreground">
                    {meeting.created_by_member.first_name}{' '}
                    {meeting.created_by_member.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(meeting.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {meeting.agenda && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Agenda</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {meeting.agenda}
              </div>
            </div>
          )}

          {meeting.notes && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Notes</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {meeting.notes}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voting Results</CardTitle>
          <CardDescription>
            {voteResults.length === 0
              ? 'No votes have been cast yet'
              : `Results from ${totalVoters} eligible voters`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VoteResults results={voteResults} totalVoters={totalVoters} />
        </CardContent>
      </Card>
    </div>
  )
}

function MeetingDetailsLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function MeetingDetailsPage({ params }: MeetingDetailsPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  const { id } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meeting Details</h1>
        <p className="text-muted-foreground mt-2">View meeting information and voting results</p>
      </div>

      <Suspense fallback={<MeetingDetailsLoading />}>
        <MeetingDetailsContent meetingId={id} />
      </Suspense>
    </div>
  )
}
