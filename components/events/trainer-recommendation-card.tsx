'use client'

/**
 * Trainer Recommendation Card Component
 *
 * Displays a trainer with their match score and breakdown.
 * Used in the trainer assignment interface.
 */

import { useState } from 'react'
import { Check, MapPin, Calendar, Star, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { TrainerRecommendation, TrainerScoreBreakdown } from '@/types/event'

interface TrainerRecommendationCardProps {
  trainer: TrainerRecommendation
  isSelected?: boolean
  onSelect?: (trainerId: string) => void
  onDeselect?: (trainerId: string) => void
  disabled?: boolean
  showDetails?: boolean
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Low'
}

function ScoreBreakdownItem({
  label,
  score,
  maxScore,
  icon,
}: {
  label: string
  score: number
  maxScore: number
  icon: React.ReactNode
}) {
  const percentage = (score / maxScore) * 100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-medium">
          {score}/{maxScore}
        </span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  )
}

export function TrainerRecommendationCard({
  trainer,
  isSelected = false,
  onSelect,
  onDeselect,
  disabled = false,
  showDetails = true,
}: TrainerRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    if (disabled) return
    if (isSelected) {
      onDeselect?.(trainer.trainer_profile_id)
    } else {
      onSelect?.(trainer.trainer_profile_id)
    }
  }

  const initials = trainer.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card
      className={cn(
        'transition-all',
        isSelected && 'ring-2 ring-primary',
        !disabled && 'cursor-pointer hover:shadow-md',
        disabled && 'opacity-60'
      )}
      onClick={handleToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar & Selection */}
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={trainer.avatar_url || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {isSelected && (
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Trainer Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium truncate">{trainer.full_name}</h4>
                <p className="text-sm text-muted-foreground truncate">{trainer.email}</p>
              </div>

              {/* Match Score */}
              <div className="flex flex-col items-end">
                <div
                  className={cn(
                    'text-2xl font-bold',
                    getScoreColor(trainer.match_score)
                  )}
                >
                  {trainer.match_score}
                </div>
                <span className="text-xs text-muted-foreground">
                  {getScoreLabel(trainer.match_score)}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-2 mt-3">
              {trainer.trainer_stats.average_rating !== null && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3 w-3" />
                  {trainer.trainer_stats.average_rating.toFixed(1)}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {trainer.trainer_stats.total_sessions} sessions
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Trophy className="h-3 w-3" />
                {trainer.certifications_count} certs
              </Badge>
              {!trainer.is_available && (
                <Badge variant="destructive">Unavailable</Badge>
              )}
            </div>

            {/* Session Types */}
            {trainer.eligible_session_types.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {trainer.eligible_session_types.slice(0, 3).map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}
                  </Badge>
                ))}
                {trainer.eligible_session_types.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{trainer.eligible_session_types.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Score Breakdown */}
        {showDetails && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 gap-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Score Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View Score Details
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
              <ScoreBreakdownItem
                label="Location"
                score={trainer.score_breakdown.location_score}
                maxScore={30}
                icon={<MapPin className="h-3 w-3" />}
              />
              <ScoreBreakdownItem
                label="Fair Distribution"
                score={trainer.score_breakdown.distribution_score}
                maxScore={30}
                icon={<Calendar className="h-3 w-3" />}
              />
              <ScoreBreakdownItem
                label="Performance"
                score={trainer.score_breakdown.performance_score}
                maxScore={25}
                icon={<Star className="h-3 w-3" />}
              />
              <ScoreBreakdownItem
                label="Engagement"
                score={trainer.score_breakdown.engagement_score}
                maxScore={15}
                icon={<Trophy className="h-3 w-3" />}
              />

              {/* Additional Stats */}
              <div className="pt-2 border-t text-sm text-muted-foreground">
                {trainer.trainer_stats.days_since_last_session !== null ? (
                  <p>
                    Last session: {trainer.trainer_stats.days_since_last_session} days ago
                  </p>
                ) : (
                  <p>No previous sessions</p>
                )}
                <p>Sessions this month: {trainer.trainer_stats.sessions_this_month}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

export default TrainerRecommendationCard
