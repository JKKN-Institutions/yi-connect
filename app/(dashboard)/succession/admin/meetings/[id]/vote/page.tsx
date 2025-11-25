import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { getMeetingById, getNominations } from '@/lib/data/succession'
import { VotingBallot } from '@/components/succession/forms/voting-ballot'
import { MeetingStatusBadge, MeetingTypeBadge } from '@/components/succession/displays/succession-status-badges'
import { requireRole } from '@/lib/auth'
import { format } from 'date-fns'

export const metadata = {
  title: 'Cast Votes | Admin',
  description: 'Vote on succession candidates',
}

interface VotingPageProps {
  params: Promise<{ id: string }>
}

async function VotingContent({ meetingId }: { meetingId: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const meeting = await getMeetingById(meetingId)

  if (!meeting) {
    notFound()
  }

  // Get approved nominations for this cycle
  const allNominations = await getNominations(meeting.cycle_id)
  const approvedNominations = allNominations.filter(
    (n: any) => n.status === 'approved'
  )

  // Get existing votes by this user for this meeting
  const { data: existingVotes } = await supabase
    .from('succession_votes')
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('voter_member_id', user.id)

  // Format nominees for the voting ballot
  const nominees = approvedNominations.map((nomination: any) => {
    const existingVote = existingVotes?.find(
      (v: any) => v.nominee_id === nomination.nominee_id
    )

    return {
      id: nomination.id,
      position_id: nomination.position_id,
      position_title: nomination.position.title,
      position_level: nomination.position.hierarchy_level,
      nominee_id: nomination.nominee_id,
      nominee_name: `${nomination.nominee.first_name} ${nomination.nominee.last_name}`,
      nominee_email: nomination.nominee.email,
      nominee_avatar: nomination.nominee.avatar_url,
      nomination_reason: nomination.reason,
      evaluation_score: nomination.weighted_score,
      existing_vote: existingVote
        ? {
            id: existingVote.id,
            vote: existingVote.vote,
            comments: existingVote.comments,
          }
        : undefined,
    }
  })

  const formatMeetingDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPpp')
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
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
                {formatMeetingDate(meeting.meeting_date)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Instructions:</span> Please review each
              candidate carefully and cast your vote. You can vote Yes, No, or Abstain for
              each nominee. Your votes will be recorded and counted towards the final
              selection.
            </p>
          </div>
        </CardContent>
      </Card>

      {nominees.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No Approved Nominees</p>
              <p className="text-sm mt-2">
                There are no approved nominations to vote on for this meeting.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <VotingBallot meetingId={meetingId} nominees={nominees} />
      )}
    </div>
  )
}

function VotingLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function VotingPage({ params }: VotingPageProps) {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair', 'Executive Member'])
  const { id } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cast Your Votes</h1>
        <p className="text-muted-foreground mt-2">
          Review candidates and cast your votes for each position
        </p>
      </div>

      <Suspense fallback={<VotingLoading />}>
        <VotingContent meetingId={id} />
      </Suspense>
    </div>
  )
}
