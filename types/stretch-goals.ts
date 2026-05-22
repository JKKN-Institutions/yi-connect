/**
 * Stretch Goals Types
 * Ambitious targets beyond CMP minimums for verticals
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export interface StretchGoal {
  id: string
  cmp_target_id: string | null
  vertical_id: string
  chapter_id: string | null
  calendar_year: number

  // Stretch targets
  stretch_activities: number
  stretch_participants: number
  stretch_ec_participation: number

  // AAA stretch targets (optional)
  stretch_awareness: number | null
  stretch_action: number | null
  stretch_advocacy: number | null

  // Goal metadata
  name: string
  description: string | null
  reward_description: string | null

  // Status
  is_achieved: boolean
  achieved_at: string | null

  // Metadata
  created_by: string | null
  created_at: string
  updated_at: string

  // Joined data
  vertical?: {
    id: string
    name: string
    color: string | null
  }
  chapter?: {
    id: string
    name: string
  } | null
  cmp_target?: {
    id: string
    min_activities: number
    min_participants: number
    min_ec_participation: number
  } | null
}

export interface StretchGoalProgress {
  stretch_goal_id: string
  vertical_id: string
  vertical_name: string
  vertical_color: string | null
  chapter_id: string | null
  chapter_name: string | null
  calendar_year: number
  goal_name: string
  description: string | null
  reward_description: string | null

  // CMP Targets (baseline)
  cmp_activities: number
  cmp_participants: number
  cmp_ec_participation: number

  // Stretch Targets
  stretch_activities: number
  stretch_participants: number
  stretch_ec_participation: number
  stretch_awareness: number | null
  stretch_action: number | null
  stretch_advocacy: number | null

  // Actuals
  actual_activities: number
  actual_participants: number
  actual_ec_participation: number
  awareness_count: number
  action_count: number
  advocacy_count: number

  // Progress percentages
  cmp_progress_pct: number
  stretch_progress_pct: number

  // Status
  is_achieved: boolean
  achieved_at: string | null
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateStretchGoalInput {
  cmp_target_id?: string | null
  vertical_id: string
  chapter_id?: string | null
  calendar_year?: number

  stretch_activities: number
  stretch_participants: number
  stretch_ec_participation: number

  stretch_awareness?: number | null
  stretch_action?: number | null
  stretch_advocacy?: number | null

  name?: string
  description?: string | null
  reward_description?: string | null
}

export interface UpdateStretchGoalInput {
  id: string

  stretch_activities?: number
  stretch_participants?: number
  stretch_ec_participation?: number

  stretch_awareness?: number | null
  stretch_action?: number | null
  stretch_advocacy?: number | null

  name?: string
  description?: string | null
  reward_description?: string | null
  is_achieved?: boolean
}

export interface StretchGoalFilters {
  vertical_id?: string
  chapter_id?: string
  calendar_year?: number
  is_achieved?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate stretch progress status
 */
export function getStretchProgressStatus(
  progress: StretchGoalProgress
): 'not_started' | 'cmp_progress' | 'stretch_progress' | 'stretch_achieved' {
  if (progress.actual_activities === 0) return 'not_started'
  if (progress.stretch_progress_pct >= 100) return 'stretch_achieved'
  if (progress.cmp_progress_pct >= 100) return 'stretch_progress'
  return 'cmp_progress'
}

/**
 * Get color class for stretch progress
 */
export function getStretchProgressColor(
  status: ReturnType<typeof getStretchProgressStatus>
): string {
  switch (status) {
    case 'not_started':
      return 'text-muted-foreground'
    case 'cmp_progress':
      return 'text-amber-600'
    case 'stretch_progress':
      return 'text-blue-600'
    case 'stretch_achieved':
      return 'text-emerald-600'
  }
}

/**
 * Calculate stretch multiplier from CMP baseline
 */
export function calculateStretchMultiplier(
  stretchValue: number,
  cmpValue: number
): number {
  if (cmpValue === 0) return 0
  return Math.round((stretchValue / cmpValue) * 10) / 10
}

/**
 * Get stretch goal badge text
 */
export function getStretchBadgeText(
  progress: StretchGoalProgress
): string {
  const status = getStretchProgressStatus(progress)
  switch (status) {
    case 'not_started':
      return 'Not Started'
    case 'cmp_progress':
      return `${progress.cmp_progress_pct}% to CMP`
    case 'stretch_progress':
      return `${progress.stretch_progress_pct}% to Stretch`
    case 'stretch_achieved':
      return '🎯 Stretch Achieved!'
  }
}

/**
 * Default stretch multipliers
 */
export const DEFAULT_STRETCH_MULTIPLIERS = {
  activities: 1.5, // 150% of CMP
  participants: 1.5,
  ec_participation: 2.0,
} as const

/**
 * Calculate default stretch targets from CMP
 */
export function calculateDefaultStretchTargets(cmpTarget: {
  min_activities: number
  min_participants: number
  min_ec_participation: number
}): {
  stretch_activities: number
  stretch_participants: number
  stretch_ec_participation: number
} {
  return {
    stretch_activities: Math.ceil(
      cmpTarget.min_activities * DEFAULT_STRETCH_MULTIPLIERS.activities
    ),
    stretch_participants: Math.ceil(
      cmpTarget.min_participants * DEFAULT_STRETCH_MULTIPLIERS.participants
    ),
    stretch_ec_participation: Math.ceil(
      cmpTarget.min_ec_participation * DEFAULT_STRETCH_MULTIPLIERS.ec_participation
    ),
  }
}
