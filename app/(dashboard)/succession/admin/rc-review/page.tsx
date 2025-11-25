import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Award,
  Briefcase,
  Calendar,
  Star,
  Video,
  FileText,
  User,
  Building,
  Phone,
  Mail,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  getCurrentActiveCycle,
  getCandidatesPendingRCReview,
  getApproaches,
  getVoteResultsByPosition,
  getMeetings,
} from '@/lib/data/succession'
import { requireRole } from '@/lib/auth'
import { format, formatDistanceToNow } from 'date-fns'

export const metadata = {
  title: 'RC Review Portal | Succession Admin',
  description: 'Regional Chair review portal for succession candidates',
}

// Candidate card with details
function CandidateCard({ candidate }: { candidate: any }) {
  const nominee = candidate.nominee
  const position = candidate.position

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={nominee?.avatar_url} />
            <AvatarFallback className="text-lg">
              {nominee?.first_name?.[0]}
              {nominee?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {nominee?.first_name} {nominee?.last_name}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {nominee?.designation || 'Member'} at {nominee?.company || 'Yi'}
                </p>
              </div>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Pending RC Approval
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {nominee?.email}
              </span>
              {nominee?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {nominee?.phone}
                </span>
              )}
              {nominee?.member_since && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Member since {format(new Date(nominee.member_since), 'MMM yyyy')}
                </span>
              )}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="font-medium">{position?.title}</p>
                </div>
                <Badge variant="secondary">Level {position?.hierarchy_level}</Badge>
              </div>
              {position?.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {position.description}
                </p>
              )}
            </div>

            {candidate.notes && (
              <div className="mt-3 p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground mb-1">Approach Notes</p>
                <p className="text-sm">{candidate.notes}</p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Accepted {formatDistanceToNow(new Date(candidate.approached_at))} ago
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/members/${nominee?.id}`}>
                    <User className="h-4 w-4 mr-1" />
                    View Profile
                  </Link>
                </Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Approach status card
function ApproachStatusCard({ approach }: { approach: any }) {
  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Pending Response' },
    accepted: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Accepted' },
    declined: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Declined' },
    conditional: { icon: AlertCircle, color: 'text-blue-600 bg-blue-50', label: 'Conditional' },
  }

  const config = statusConfig[approach.response_status] || statusConfig.pending
  const Icon = config.icon

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={approach.nominee?.avatar_url} />
          <AvatarFallback>
            {approach.nominee?.first_name?.[0]}
            {approach.nominee?.last_name?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">
            {approach.nominee?.first_name} {approach.nominee?.last_name}
          </p>
          <p className="text-sm text-muted-foreground">{approach.position?.title}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${config.color}`}>
        <Icon className="h-4 w-4" />
        <span>{config.label}</span>
      </div>
    </div>
  )
}

// Meeting summary card
function MeetingSummaryCard({ meeting }: { meeting: any }) {
  const isPast = new Date(meeting.meeting_date) < new Date()

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${
            meeting.status === 'completed' ? 'bg-green-50' : 'bg-blue-50'
          }`}
        >
          <Video
            className={`h-5 w-5 ${
              meeting.status === 'completed' ? 'text-green-600' : 'text-blue-600'
            }`}
          />
        </div>
        <div>
          <p className="font-medium capitalize">{meeting.meeting_type.replace(/_/g, ' ')}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(meeting.meeting_date), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>
      <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'}>
        {meeting.status}
      </Badge>
    </div>
  )
}

async function RCReviewContent() {
  const cycle = await getCurrentActiveCycle()

  if (!cycle) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
            <p className="text-lg font-medium">No Active Succession Cycle</p>
            <p className="text-sm mt-2">
              There is no active succession cycle to review.
            </p>
            <Button asChild className="mt-4">
              <Link href="/succession/admin/cycles">View All Cycles</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fetch data in parallel
  const [candidatesPending, approaches, meetings] = await Promise.all([
    getCandidatesPendingRCReview(cycle.id),
    getApproaches(cycle.id),
    getMeetings(cycle.id),
  ])

  // Calculate statistics
  const totalApproaches = approaches.length
  const acceptedCount = approaches.filter((a: any) => a.response_status === 'accepted').length
  const declinedCount = approaches.filter((a: any) => a.response_status === 'declined').length
  const pendingCount = approaches.filter((a: any) => a.response_status === 'pending').length

  const steeringMeetings = meetings.filter((m: any) => m.meeting_type === 'steering_committee')
  const completedMeetings = steeringMeetings.filter((m: any) => m.status === 'completed')

  return (
    <div className="space-y-8">
      {/* Cycle Info */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{cycle.cycle_name}</CardTitle>
              <CardDescription>
                Year {cycle.year} • Status: {cycle.status.replace(/_/g, ' ')}
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href={`/succession/admin/cycles/${cycle.id}`}>
                View Cycle Details
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending RC Review</p>
                <p className="text-3xl font-bold text-yellow-600">{candidatesPending.length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Accepted Offers</p>
                <p className="text-3xl font-bold text-green-600">{acceptedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Declined</p>
                <p className="text-3xl font-bold text-red-600">{declinedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Steering Meetings</p>
                <p className="text-3xl font-bold">{completedMeetings.length}/{steeringMeetings.length}</p>
              </div>
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates Pending RC Review */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Candidates Pending RC Approval
        </h2>

        {candidatesPending.length > 0 ? (
          <div className="space-y-4">
            {candidatesPending.map((candidate: any) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">All Caught Up!</p>
                <p className="text-sm mt-2">
                  There are no candidates pending RC approval at this time.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* All Approaches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Candidate Approaches</CardTitle>
                <CardDescription>
                  All candidate outreach status for this cycle
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/succession/admin/approaches">
                  View All <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {approaches.length > 0 ? (
              <div className="space-y-3">
                {approaches.slice(0, 5).map((approach: any) => (
                  <ApproachStatusCard key={approach.id} approach={approach} />
                ))}
                {approaches.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    +{approaches.length - 5} more approaches
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No approaches recorded yet</p>
              </div>
            )}

            {/* Response Rate Progress */}
            {totalApproaches > 0 && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Response Rate</span>
                  <span className="font-medium">
                    {Math.round(((acceptedCount + declinedCount) / totalApproaches) * 100)}%
                  </span>
                </div>
                <Progress
                  value={((acceptedCount + declinedCount) / totalApproaches) * 100}
                  className="h-2"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                  <span className="text-green-600">{acceptedCount} accepted</span>
                  <span className="text-red-600">{declinedCount} declined</span>
                  <span>{pendingCount} pending</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meeting Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Steering Meetings</CardTitle>
                <CardDescription>
                  Selection committee meeting history
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/succession/admin/meetings">
                  View All <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {steeringMeetings.length > 0 ? (
              <div className="space-y-3">
                {steeringMeetings.slice(0, 5).map((meeting: any) => (
                  <MeetingSummaryCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No steering meetings scheduled</p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/succession/admin/meetings/new">Schedule Meeting</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks for RC review process</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href="/succession/admin/meetings/new">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Schedule RC Meeting</p>
                    <p className="text-xs text-muted-foreground">Set up review meeting</p>
                  </div>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href="/succession/admin/nominations">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Review Nominations</p>
                    <p className="text-xs text-muted-foreground">See all nominations</p>
                  </div>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href="/succession/knowledge-base">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Past Selections</p>
                    <p className="text-xs text-muted-foreground">Historical data</p>
                  </div>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RCReviewLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24 w-full" />

      <div className="grid md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>

      <div>
        <Skeleton className="h-7 w-64 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function RCReviewPage() {
  await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RC Review Portal</h1>
        <p className="text-muted-foreground mt-2">
          Regional Chair dashboard for reviewing and approving succession candidates
        </p>
      </div>

      <Suspense fallback={<RCReviewLoading />}>
        <RCReviewContent />
      </Suspense>
    </div>
  )
}
