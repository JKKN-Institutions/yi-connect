'use client'

/**
 * Impact Metrics Card Component
 *
 * Displays industry impact metrics including opportunities provided,
 * members benefited, and engagement scores.
 */

import {
  Building2,
  Users,
  TrendingUp,
  Star,
  Briefcase,
  Calendar,
  Award,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { EngagementTier } from '@/types/industry-opportunity'

interface IndustryImpactMetrics {
  id: string
  industry_id: string
  chapter_id: string
  opportunities_provided: number
  members_benefited: number
  total_visits_completed: number
  internships_converted: number
  mentorships_active: number
  average_opportunity_rating: number | null
  average_visit_rating: number | null
  engagement_score: number | null
  engagement_tier: EngagementTier | null
  first_engagement_date: string | null
  last_engagement_date: string | null
  total_hours_contributed: number | null
  industry?: {
    company_name: string
    industry_sector: string
    city: string | null
    logo_url: string | null
  }
}

interface ImpactMetricsCardProps {
  metrics: IndustryImpactMetrics
  showIndustryInfo?: boolean
}

const TIER_CONFIG: Record<EngagementTier, { label: string; color: string; bgColor: string }> = {
  platinum: { label: 'Platinum Partner', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  gold: { label: 'Gold Partner', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  silver: { label: 'Silver Partner', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  bronze: { label: 'Bronze Partner', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  new: { label: 'New Partner', color: 'text-blue-700', bgColor: 'bg-blue-100' },
}

function MetricItem({
  icon,
  label,
  value,
  subtext,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {subtext && <span className="text-sm text-muted-foreground">{subtext}</span>}
      </div>
    </div>
  )
}

function RatingDisplay({ rating, label }: { rating: number | null; label: string }) {
  if (rating === null) {
    return (
      <div className="text-center">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="text-lg text-muted-foreground">N/A</div>
      </div>
    )
  }

  const stars = Math.round(rating)
  const percentage = (rating / 5) * 100

  return (
    <div className="text-center">
      <div className="text-muted-foreground text-sm mb-1">{label}</div>
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-4 w-4',
              star <= stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            )}
          />
        ))}
      </div>
      <div className="text-lg font-semibold">{rating.toFixed(1)}</div>
    </div>
  )
}

export function ImpactMetricsCard({
  metrics,
  showIndustryInfo = true,
}: ImpactMetricsCardProps) {
  const tier = metrics.engagement_tier || 'new'
  const tierConfig = TIER_CONFIG[tier]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            {showIndustryInfo && metrics.industry && (
              <>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {metrics.industry.company_name}
                </CardTitle>
                <CardDescription>
                  {metrics.industry.industry_sector}
                  {metrics.industry.city && ` • ${metrics.industry.city}`}
                </CardDescription>
              </>
            )}
            {!showIndustryInfo && (
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Industry Impact
              </CardTitle>
            )}
          </div>
          <Badge className={cn('gap-1', tierConfig.bgColor, tierConfig.color)}>
            <Award className="h-3 w-3" />
            {tierConfig.label}
          </Badge>
        </div>

        {/* Engagement Score */}
        {metrics.engagement_score !== null && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Engagement Score</span>
              <span className="font-medium">{metrics.engagement_score}%</span>
            </div>
            <Progress value={metrics.engagement_score} className="h-2" />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricItem
            icon={<Briefcase className="h-4 w-4" />}
            label="Opportunities"
            value={metrics.opportunities_provided}
            subtext="provided"
          />
          <MetricItem
            icon={<Users className="h-4 w-4" />}
            label="Members"
            value={metrics.members_benefited}
            subtext="benefited"
          />
          <MetricItem
            icon={<Calendar className="h-4 w-4" />}
            label="Visits"
            value={metrics.total_visits_completed}
            subtext="completed"
          />
          <MetricItem
            icon={<TrendingUp className="h-4 w-4" />}
            label="Internships"
            value={metrics.internships_converted}
            subtext="converted"
          />
        </div>

        <Separator />

        {/* Ratings */}
        <div className="grid grid-cols-2 gap-4">
          <RatingDisplay
            rating={metrics.average_opportunity_rating}
            label="Opportunity Rating"
          />
          <RatingDisplay
            rating={metrics.average_visit_rating}
            label="Visit Rating"
          />
        </div>

        <Separator />

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Active Mentorships:</span>
            <span className="ml-2 font-medium">{metrics.mentorships_active}</span>
          </div>
          {metrics.total_hours_contributed !== null && (
            <div>
              <span className="text-muted-foreground">Hours Contributed:</span>
              <span className="ml-2 font-medium">{metrics.total_hours_contributed}</span>
            </div>
          )}
          {metrics.first_engagement_date && (
            <div>
              <span className="text-muted-foreground">Partner Since:</span>
              <span className="ml-2 font-medium">
                {new Date(metrics.first_engagement_date).toLocaleDateString()}
              </span>
            </div>
          )}
          {metrics.last_engagement_date && (
            <div>
              <span className="text-muted-foreground">Last Active:</span>
              <span className="ml-2 font-medium">
                {new Date(metrics.last_engagement_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ImpactMetricsCard
