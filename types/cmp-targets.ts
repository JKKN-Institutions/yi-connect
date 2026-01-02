/**
 * CMP (Common Minimum Program) Targets Types
 * Defines minimum activity targets per vertical for chapters
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export interface CMPTarget {
  id: string
  vertical_id: string
  fiscal_year: number

  // Target Metrics
  min_activities: number
  min_participants: number
  min_ec_participation: number

  // AAA Breakdown
  min_awareness_activities: number | null
  min_action_activities: number | null
  min_advocacy_activities: number | null

  // Scope
  chapter_id: string | null
  is_national_target: boolean

  // Metadata
  description: string | null
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
}

export interface CMPProgress {
  target_id: string
  vertical_id: string
  vertical_name: string
  vertical_color: string | null
  fiscal_year: number
  chapter_id: string | null
  chapter_name: string | null
  is_national_target: boolean

  // Targets
  min_activities: number
  min_participants: number
  min_ec_participation: number
  min_awareness_activities: number | null
  min_action_activities: number | null
  min_advocacy_activities: number | null

  // Actuals
  actual_activities: number
  actual_participants: number
  actual_ec_participation: number
  awareness_count: number
  action_count: number
  advocacy_count: number

  // Progress percentages
  activity_progress_pct: number
  participant_progress_pct: number
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateCMPTargetInput {
  vertical_id: string
  fiscal_year?: number

  min_activities: number
  min_participants: number
  min_ec_participation: number

  min_awareness_activities?: number | null
  min_action_activities?: number | null
  min_advocacy_activities?: number | null

  chapter_id?: string | null
  is_national_target: boolean

  description?: string
}

export interface UpdateCMPTargetInput {
  id: string

  min_activities?: number
  min_participants?: number
  min_ec_participation?: number

  min_awareness_activities?: number | null
  min_action_activities?: number | null
  min_advocacy_activities?: number | null

  description?: string | null
}

export interface CMPTargetFilters {
  vertical_id?: string
  fiscal_year?: number
  chapter_id?: string
  is_national_target?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate overall CMP progress percentage
 */
export function calculateOverallProgress(progress: CMPProgress): number {
  const activityWeight = 0.5
  const participantWeight = 0.3
  const ecWeight = 0.2

  const activityPct = Math.min(progress.activity_progress_pct, 100)
  const participantPct = Math.min(progress.participant_progress_pct, 100)
  const ecPct =
    progress.min_ec_participation > 0
      ? Math.min(
          (progress.actual_ec_participation / progress.min_ec_participation) * 100,
          100
        )
      : 100

  return Math.round(
    activityPct * activityWeight +
      participantPct * participantWeight +
      ecPct * ecWeight
  )
}

/**
 * Get progress status based on percentage
 */
export function getProgressStatus(
  percentage: number
): 'not_started' | 'behind' | 'on_track' | 'completed' | 'exceeded' {
  if (percentage === 0) return 'not_started'
  if (percentage < 50) return 'behind'
  if (percentage < 100) return 'on_track'
  if (percentage === 100) return 'completed'
  return 'exceeded'
}

/**
 * Get status color for progress
 */
export function getProgressColor(status: ReturnType<typeof getProgressStatus>): string {
  switch (status) {
    case 'not_started':
      return 'text-muted-foreground'
    case 'behind':
      return 'text-red-600'
    case 'on_track':
      return 'text-amber-600'
    case 'completed':
      return 'text-green-600'
    case 'exceeded':
      return 'text-emerald-600'
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const FISCAL_YEAR_OPTIONS = (() => {
  const currentYear = new Date().getFullYear()
  return [
    { value: currentYear - 1, label: `FY ${currentYear - 1}-${currentYear}` },
    { value: currentYear, label: `FY ${currentYear}-${currentYear + 1}` },
    { value: currentYear + 1, label: `FY ${currentYear + 1}-${currentYear + 2}` },
  ]
})()

export const DEFAULT_CMP_TARGETS: Record<string, Partial<CreateCMPTargetInput>> = {
  // These can be overridden by national/chapter settings
  default: {
    min_activities: 4, // 1 per quarter
    min_participants: 50,
    min_ec_participation: 10,
  },
}
