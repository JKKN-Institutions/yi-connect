'use client'

/**
 * Application Review Card Component
 *
 * Card for industry coordinators to review member applications.
 * Supports accept, shortlist, waitlist, and decline actions.
 */

import { useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Check,
  X,
  Clock,
  User,
  Star,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  Briefcase,
  MessageSquare,
} from 'lucide-react'
import { reviewApplication } from '@/app/actions/industry-opportunity'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { ApplicationStatus } from '@/types/industry-opportunity'

interface ApplicationWithMember {
  id: string
  opportunity_id?: string
  member_id?: string
  status: ApplicationStatus | string
  motivation_statement?: string | null
  learning_goals?: string | null
  relevant_experience?: string | null
  skills_to_contribute?: string | null
  availability_notes?: string | null
  resume_url?: string | null
  portfolio_url?: string | null
  match_score?: number | null
  match_breakdown?: {
    industry_score?: number
    skills_score?: number
    experience_score?: number
    engagement_score?: number
  } | null
  submitted_at?: string
  applied_at?: string
  reviewed_at?: string | null
  review_notes?: string | null
  member?: {
    id?: string
    full_name: string
    email?: string
    avatar_url?: string | null
    company?: string | null
    designation?: string | null
    industry_sector?: string | null
    engagement_score?: number | null
  } | null
}

interface ApplicationReviewCardProps {
  application: ApplicationWithMember
  onReviewComplete?: () => void
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  pending_review: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  under_review: { label: 'Under Review', className: 'bg-blue-100 text-blue-700' },
  shortlisted: { label: 'Shortlisted', className: 'bg-purple-100 text-purple-700' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700' },
  waitlisted: { label: 'Waitlisted', className: 'bg-orange-100 text-orange-700' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-600' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-100 text-gray-500' },
}

function MatchScoreDisplay({ score, breakdown }: {
  score: number
  breakdown: ApplicationWithMember['match_breakdown']
}) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-gray-600'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Match Score</span>
        <span className={cn('text-lg font-bold', getScoreColor(score))}>
          {score}%
        </span>
      </div>

      {breakdown && (
        <div className="space-y-2 text-sm">
          {breakdown.industry_score !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Industry Match</span>
                <span>{breakdown.industry_score}%</span>
              </div>
              <Progress value={breakdown.industry_score} className="h-1.5" />
            </div>
          )}
          {breakdown.skills_score !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skills Match</span>
                <span>{breakdown.skills_score}%</span>
              </div>
              <Progress value={breakdown.skills_score} className="h-1.5" />
            </div>
          )}
          {breakdown.experience_score !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Experience</span>
                <span>{breakdown.experience_score}%</span>
              </div>
              <Progress value={breakdown.experience_score} className="h-1.5" />
            </div>
          )}
          {breakdown.engagement_score !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Engagement</span>
                <span>{breakdown.engagement_score}%</span>
              </div>
              <Progress value={breakdown.engagement_score} className="h-1.5" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ApplicationReviewCard({
  application,
  onReviewComplete,
}: ApplicationReviewCardProps) {
  const [isPending, startTransition] = useTransition()
  const [isExpanded, setIsExpanded] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewAction, setReviewAction] = useState<'accept' | 'shortlist' | 'waitlist' | 'decline'>('accept')
  const [reviewNotes, setReviewNotes] = useState('')

  const isPendingReview = application.status === 'pending_review' || application.status === 'under_review'
  const member = application.member || { full_name: 'Unknown', email: '', avatar_url: null, company: null, designation: null, industry_sector: null, engagement_score: null }

  const memberInitials = member.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const handleReview = () => {
    startTransition(async () => {
      try {
        // Map action to status
        const statusMap: Record<string, 'shortlisted' | 'accepted' | 'waitlisted' | 'declined'> = {
          accept: 'accepted',
          shortlist: 'shortlisted',
          waitlist: 'waitlisted',
          decline: 'declined',
        }

        const result = await reviewApplication({
          application_id: application.id,
          status: statusMap[reviewAction],
          reviewer_notes: reviewNotes || undefined,
        })

        if (result.success) {
          const actionLabels = {
            accept: 'accepted',
            shortlist: 'shortlisted',
            waitlist: 'waitlisted',
            decline: 'declined',
          }
          toast.success(`Application ${actionLabels[reviewAction]} successfully`)
          setReviewDialogOpen(false)
          setReviewNotes('')
          onReviewComplete?.()
        } else {
          toast.error(result.error || 'Failed to review application')
        }
      } catch (error) {
        console.error('Error reviewing application:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  const openReviewDialog = (action: 'accept' | 'shortlist' | 'waitlist' | 'decline') => {
    setReviewAction(action)
    setReviewDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {/* Member Info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.avatar_url || undefined} />
              <AvatarFallback>{memberInitials}</AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-medium">{member.full_name}</h4>
              <p className="text-sm text-muted-foreground">{member.email}</p>
              {(member.designation || member.company) && (
                <p className="text-sm text-muted-foreground">
                  {member.designation}
                  {member.designation && member.company && ' at '}
                  {member.company}
                </p>
              )}
            </div>
          </div>

          {/* Status & Score */}
          <div className="flex items-center gap-2">
            {application.match_score != null && (
              <Badge
                variant="outline"
                className={cn(
                  'text-sm',
                  (application.match_score ?? 0) >= 80 && 'bg-green-50 text-green-700 border-green-200',
                  (application.match_score ?? 0) >= 60 && (application.match_score ?? 0) < 80 && 'bg-blue-50 text-blue-700 border-blue-200',
                  (application.match_score ?? 0) < 60 && 'bg-gray-50 text-gray-700 border-gray-200'
                )}
              >
                {application.match_score}% match
              </Badge>
            )}
            <Badge
              variant="outline"
              className={STATUS_CONFIG[application.status as ApplicationStatus]?.className || 'bg-gray-100 text-gray-600'}
            >
              {STATUS_CONFIG[application.status as ApplicationStatus]?.label || application.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Motivation Statement */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Motivation
          </h5>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {application.motivation_statement}
          </p>
        </div>

        {/* Member Stats */}
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          {member.industry_sector && (
            <div className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {member.industry_sector}
            </div>
          )}
          {member.engagement_score !== null && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {member.engagement_score}% engagement
            </div>
          )}
          {application.submitted_at && (
            <span>
              Applied {formatDistanceToNow(new Date(application.submitted_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-3">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            <Separator />

            {/* Match Score Breakdown */}
            {application.match_score != null && application.match_breakdown && (
              <>
                <MatchScoreDisplay
                  score={application.match_score ?? 0}
                  breakdown={application.match_breakdown}
                />
                <Separator />
              </>
            )}

            {/* Learning Goals */}
            {application.learning_goals && (
              <div className="space-y-1">
                <h5 className="text-sm font-medium">Learning Goals</h5>
                <p className="text-sm text-muted-foreground">{application.learning_goals}</p>
              </div>
            )}

            {/* Experience */}
            {application.relevant_experience && (
              <div className="space-y-1">
                <h5 className="text-sm font-medium">Relevant Experience</h5>
                <p className="text-sm text-muted-foreground">{application.relevant_experience}</p>
              </div>
            )}

            {/* Skills */}
            {application.skills_to_contribute && (
              <div className="space-y-1">
                <h5 className="text-sm font-medium">Skills to Contribute</h5>
                <p className="text-sm text-muted-foreground">{application.skills_to_contribute}</p>
              </div>
            )}

            {/* Links */}
            {(application.resume_url || application.portfolio_url) && (
              <div className="flex gap-2">
                {application.resume_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={application.resume_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-1" />
                      Resume
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
                {application.portfolio_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={application.portfolio_url} target="_blank" rel="noopener noreferrer">
                      <User className="h-4 w-4 mr-1" />
                      Profile
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Review Notes (if already reviewed) */}
            {application.review_notes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h5 className="text-sm font-medium">Review Notes</h5>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    {application.review_notes}
                  </p>
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Actions */}
      {isPendingReview && (
        <CardFooter className="border-t pt-3 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => openReviewDialog('decline')}
          >
            <X className="h-4 w-4 mr-1" />
            Decline
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            onClick={() => openReviewDialog('waitlist')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Waitlist
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            onClick={() => openReviewDialog('shortlist')}
          >
            <Star className="h-4 w-4 mr-1" />
            Shortlist
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => openReviewDialog('accept')}
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
        </CardFooter>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'accept' && 'Accept Application'}
              {reviewAction === 'shortlist' && 'Shortlist Application'}
              {reviewAction === 'waitlist' && 'Waitlist Application'}
              {reviewAction === 'decline' && 'Decline Application'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'accept' && 'This applicant will be confirmed for the opportunity.'}
              {reviewAction === 'shortlist' && 'This applicant will be added to your shortlist for final selection.'}
              {reviewAction === 'waitlist' && 'This applicant will be placed on the waitlist.'}
              {reviewAction === 'decline' && 'This applicant will be notified that their application was not selected.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="review_notes">Notes (Optional)</Label>
              <Textarea
                id="review_notes"
                placeholder="Add any notes about your decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={isPending}
              className={cn(
                reviewAction === 'accept' && 'bg-green-600 hover:bg-green-700',
                reviewAction === 'shortlist' && 'bg-purple-600 hover:bg-purple-700',
                reviewAction === 'waitlist' && 'bg-orange-600 hover:bg-orange-700',
                reviewAction === 'decline' && 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {reviewAction === 'accept' && <Check className="mr-2 h-4 w-4" />}
                  {reviewAction === 'shortlist' && <Star className="mr-2 h-4 w-4" />}
                  {reviewAction === 'waitlist' && <Clock className="mr-2 h-4 w-4" />}
                  {reviewAction === 'decline' && <X className="mr-2 h-4 w-4" />}
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default ApplicationReviewCard
