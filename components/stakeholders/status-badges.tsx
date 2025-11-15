/**
 * Stakeholder Status Badge Components
 *
 * Reusable badge components for displaying stakeholder statuses, health tiers, MoU status, etc.
 */

import { Badge } from '@/components/ui/badge'
import {
  formatStakeholderStatus,
  formatHealthTier,
  formatMouStatus,
  formatInteractionOutcome,
  type StakeholderStatus,
  type HealthTier,
  type MouStatus,
  type InteractionOutcome,
} from '@/types/stakeholder'

interface StakeholderStatusBadgeProps {
  status: StakeholderStatus
}

export function StakeholderStatusBadge({ status }: StakeholderStatusBadgeProps) {
  const { label, variant } = formatStakeholderStatus(status)

  return <Badge variant={variant}>{label}</Badge>
}

interface HealthTierBadgeProps {
  tier: HealthTier
}

export function HealthTierBadge({ tier }: HealthTierBadgeProps) {
  const { label, variant } = formatHealthTier(tier)

  return <Badge variant={variant}>{label}</Badge>
}

interface MouStatusBadgeProps {
  status: MouStatus
}

export function MouStatusBadge({ status }: MouStatusBadgeProps) {
  const { label, variant } = formatMouStatus(status)

  return <Badge variant={variant}>{label}</Badge>
}

interface InteractionOutcomeBadgeProps {
  outcome: InteractionOutcome
}

export function InteractionOutcomeBadge({ outcome }: InteractionOutcomeBadgeProps) {
  const { label, color } = formatInteractionOutcome(outcome)

  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

interface HealthScoreBadgeProps {
  score: number
}

export function HealthScoreBadge({ score }: HealthScoreBadgeProps) {
  let variant: 'default' | 'secondary' | 'destructive' = 'default'

  if (score >= 80) variant = 'default'
  else if (score >= 60) variant = 'secondary'
  else variant = 'destructive'

  return (
    <Badge variant={variant}>
      {score.toFixed(0)}/100
    </Badge>
  )
}
