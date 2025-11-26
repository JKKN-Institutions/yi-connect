'use client'

/**
 * Opportunity Card Component
 *
 * Displays an industry opportunity with match score and key details.
 * Used in opportunity listings and search results.
 */

import { formatDistanceToNow, differenceInDays } from 'date-fns'
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  Briefcase,
  Clock,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  TrendingUp,
  Banknote,
  Globe,
  Tag,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { OpportunityListItem, OpportunityType, OpportunityStatus } from '@/types/industry-opportunity'

// Flexible opportunity type that accepts various data shapes
interface FlexibleOpportunity {
  id: string
  title: string
  description: string
  opportunity_type?: OpportunityType | string
  status?: OpportunityStatus | string
  application_deadline?: string | null
  deadline?: string | null
  location?: string | null
  is_remote?: boolean | null
  is_paid?: boolean | null
  is_featured?: boolean | null
  created_at?: string
  duration_description?: string | null
  max_applications?: number | null
  current_applications?: number
  // Industry/stakeholder can come in multiple shapes
  industry_name?: string | null
  industry_sector?: string | null
  industry_logo_url?: string | null
  stakeholder?: {
    id?: string
    name?: string
    industry_type?: string | null
    city?: string | null
    logo_url?: string | null
  } | null
  // Match related
  match_score?: number
  has_applied?: boolean
  is_bookmarked?: boolean
  spots_remaining?: number | null
  days_until_deadline?: number
  tags?: string[] | null
  type?: string // UI-friendly alias
}

interface OpportunityCardProps {
  opportunity: FlexibleOpportunity | OpportunityListItem
  matchScore?: number // Allow passing match score separately
  onBookmark?: (id: string) => void
  showMatchScore?: boolean
  showActions?: boolean
}

const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  industrial_visit: 'Industrial Visit',
  internship: 'Internship',
  mentorship: 'Mentorship',
  guest_lecture: 'Guest Lecture',
  job_opening: 'Job Opening',
  project_collaboration: 'Project',
  training_program: 'Training',
  sponsorship: 'Sponsorship',
  csr_partnership: 'CSR Partnership',
  other: 'Other',
}

const OPPORTUNITY_TYPE_COLORS: Record<OpportunityType, string> = {
  industrial_visit: 'bg-blue-100 text-blue-700 border-blue-200',
  internship: 'bg-purple-100 text-purple-700 border-purple-200',
  mentorship: 'bg-green-100 text-green-700 border-green-200',
  guest_lecture: 'bg-orange-100 text-orange-700 border-orange-200',
  job_opening: 'bg-red-100 text-red-700 border-red-200',
  project_collaboration: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  training_program: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  sponsorship: 'bg-pink-100 text-pink-700 border-pink-200',
  csr_partnership: 'bg-teal-100 text-teal-700 border-teal-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
}

const STATUS_BADGES: Record<OpportunityStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  published: { label: 'Open', className: 'bg-blue-100 text-blue-700' },
  accepting_applications: { label: 'Accepting', className: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-500' },
}

function MatchScoreBadge({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 border-green-200 bg-green-50'
    if (score >= 60) return 'text-blue-600 border-blue-200 bg-blue-50'
    if (score >= 40) return 'text-yellow-600 border-yellow-200 bg-yellow-50'
    return 'text-gray-600 border-gray-200 bg-gray-50'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Match'
    if (score >= 60) return 'Good Match'
    if (score >= 40) return 'Fair Match'
    return 'Low Match'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full border text-sm font-medium',
              getScoreColor(score)
            )}
          >
            <TrendingUp className="h-3 w-3" />
            <span>{score}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getScoreLabel(score)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function OpportunityCard({
  opportunity,
  matchScore,
  onBookmark,
  showMatchScore = true,
  showActions = true,
}: OpportunityCardProps) {
  // Normalize industry name from various sources (cast to flexible type for optional fields)
  const flexOpp = opportunity as FlexibleOpportunity
  const industryName = opportunity.industry_name || flexOpp.stakeholder?.name || 'Industry Partner'
  const industrySector = opportunity.industry_sector || flexOpp.stakeholder?.industry_type || ''
  const industryLogo = opportunity.industry_logo_url || flexOpp.stakeholder?.logo_url

  const industryInitials = industryName
    ?.split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'IN'

  // Get deadline from either field
  const deadlineDate = opportunity.application_deadline || flexOpp.deadline
  const daysUntilDeadline = deadlineDate
    ? differenceInDays(new Date(deadlineDate), new Date())
    : flexOpp.days_until_deadline ?? 999

  const isDeadlineSoon = daysUntilDeadline <= 7 && daysUntilDeadline >= 0
  const isDeadlinePassed = daysUntilDeadline < 0
  const spotsRemaining = opportunity.spots_remaining ?? null

  // Get effective match score (from prop or opportunity)
  const effectiveMatchScore = matchScore ?? opportunity.match_score

  // Normalize opportunity type
  const oppType = (opportunity.opportunity_type || 'other') as OpportunityType
  const oppStatus = (opportunity.status || 'published') as OpportunityStatus

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Industry Info */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={industryLogo || undefined} />
              <AvatarFallback>{industryInitials}</AvatarFallback>
            </Avatar>
            <div>
              <Link
                href={`/opportunities/${opportunity.id}`}
                className="font-semibold text-lg hover:underline line-clamp-1"
              >
                {opportunity.title}
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{industryName}</span>
                {industrySector && (
                  <>
                    <span>•</span>
                    <span>{industrySector}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Match Score & Bookmark */}
          <div className="flex items-center gap-2">
            {showMatchScore && effectiveMatchScore !== undefined && (
              <MatchScoreBadge score={effectiveMatchScore} />
            )}
            {onBookmark && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8',
                  opportunity.is_bookmarked && 'text-yellow-500'
                )}
                onClick={() => onBookmark(opportunity.id)}
              >
                {opportunity.is_bookmarked ? (
                  <BookmarkCheck className="h-5 w-5" />
                ) : (
                  <Bookmark className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Type & Status Badges */}
        <div className="flex items-center gap-2 mt-3">
          <Badge
            variant="outline"
            className={OPPORTUNITY_TYPE_COLORS[oppType] || 'bg-gray-100 text-gray-700 border-gray-200'}
          >
            {OPPORTUNITY_TYPE_LABELS[oppType] || flexOpp.type || 'Other'}
          </Badge>
          <Badge
            variant="outline"
            className={STATUS_BADGES[oppStatus]?.className || 'bg-gray-100 text-gray-700'}
          >
            {STATUS_BADGES[oppStatus]?.label || oppStatus}
          </Badge>
          {opportunity.is_featured && (
            <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-orange-500">
              Featured
            </Badge>
          )}
          {opportunity.is_paid && (
            <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
              <Banknote className="h-3 w-3" />
              Paid
            </Badge>
          )}
          {opportunity.is_remote && (
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              Remote
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {opportunity.description}
        </p>

        {/* Key Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {opportunity.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{opportunity.location}</span>
            </div>
          )}
          {opportunity.duration_description && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{opportunity.duration_description}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {spotsRemaining !== null
                ? `${spotsRemaining} spots left`
                : `${opportunity.current_applications} applied`}
            </span>
          </div>
          <div
            className={cn(
              'flex items-center gap-2',
              isDeadlineSoon && 'text-orange-600',
              isDeadlinePassed && 'text-red-500',
              !isDeadlineSoon && !isDeadlinePassed && 'text-muted-foreground'
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>
              {isDeadlinePassed
                ? 'Deadline passed'
                : isDeadlineSoon
                ? `${daysUntilDeadline} days left`
                : deadlineDate
                ? `Due ${formatDistanceToNow(new Date(deadlineDate), { addSuffix: true })}`
                : 'No deadline'}
            </span>
          </div>
        </div>

        {/* Tags */}
        {opportunity.tags && opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {opportunity.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {opportunity.tags.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{opportunity.tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Applied Indicator */}
        {opportunity.has_applied && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <Badge variant="outline" className="bg-green-50 border-green-200">
              Applied
            </Badge>
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="border-t pt-3">
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-muted-foreground">
              {opportunity.created_at
                ? `Posted ${formatDistanceToNow(new Date(opportunity.created_at), { addSuffix: true })}`
                : ''}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/opportunities/${opportunity.id}`}>
                  View Details
                  <ExternalLink className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              {!opportunity.has_applied && !isDeadlinePassed && (oppStatus === 'accepting_applications' || oppStatus === 'published') && (
                <Button size="sm" asChild>
                  <Link href={`/opportunities/${opportunity.id}/apply`}>
                    Apply Now
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

export default OpportunityCard
