/**
 * CMP (Common Minimum Program) Targets Types
 * Defines minimum activity targets per vertical for chapters
 */

// ============================================================================
// ENUM TYPES
// ============================================================================

/**
 * CMP Target Category - based on Yi verticals/program areas
 * Maps to the verticals table
 */
export type CMPTargetCategory =
  | 'masoom'        // Child safety
  | 'climate'       // Climate change / environment
  | 'health'        // Healthcare awareness
  | 'road_safety'   // Road safety awareness
  | 'education'     // Education initiatives
  | 'entrepreneurship' // Business/startup support
  | 'youth_leadership' // Youth development
  | 'rural'         // Rural initiatives
  | 'women_empowerment' // Women's initiatives
  | 'other'         // Other verticals

/**
 * AAA Category - Activity types
 */
export type AAAType = 'awareness' | 'action' | 'advocacy'

/**
 * Progress status based on percentage
 */
export type CMPProgressStatus =
  | 'not_started'
  | 'behind'
  | 'on_track'
  | 'completed'
  | 'exceeded'

// ============================================================================
// BASE TYPES
// ============================================================================

export interface CMPTarget {
  id: string
  vertical_id: string
  calendar_year: number

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
  calendar_year: number
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
// LIST ITEM TYPES
// ============================================================================

export interface CMPTargetListItem {
  id: string
  vertical_name: string
  vertical_color: string | null
  calendar_year: number
  min_activities: number
  min_participants: number
  min_ec_participation: number
  is_national_target: boolean
  chapter_name: string | null
  actual_activities: number
  activity_progress_pct: number
  status: CMPProgressStatus
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateCMPTargetInput {
  vertical_id: string
  calendar_year?: number

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
  calendar_year?: number
  chapter_id?: string
  is_national_target?: boolean
  search?: string
}

export interface RecordCMPProgressInput {
  target_id: string
  activity_count: number
  participant_count: number
  ec_members_count: number
  non_ec_members_count: number
  aaa_type: AAAType
  activity_date: string
  description?: string
  event_id?: string
}

// ============================================================================
// PAGINATED RESPONSE TYPES
// ============================================================================

export interface PaginatedCMPTargets {
  data: CMPTarget[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface CMPProgressSummary {
  totalTargets: number
  completedTargets: number
  inProgressTargets: number
  notStartedTargets: number
  overallProgress: number
  verticalProgress: CMPProgress[]
}

export interface CMPAnalytics {
  total_verticals: number
  total_activities_target: number
  total_activities_actual: number
  total_participants_target: number
  total_participants_actual: number
  overall_progress: number
  verticals_completed: number
  verticals_in_progress: number
  verticals_not_started: number
  progress_by_vertical: {
    vertical_id: string
    vertical_name: string
    vertical_color: string | null
    target: number
    actual: number
    progress_pct: number
    status: CMPProgressStatus
  }[]
  aaa_breakdown: {
    awareness: { target: number; actual: number }
    action: { target: number; actual: number }
    advocacy: { target: number; actual: number }
  }
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
): CMPProgressStatus {
  if (percentage === 0) return 'not_started'
  if (percentage < 50) return 'behind'
  if (percentage < 100) return 'on_track'
  if (percentage === 100) return 'completed'
  return 'exceeded'
}

/**
 * Get status color for progress
 */
export function getProgressColor(status: CMPProgressStatus): string {
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

/**
 * Get status badge variant for progress
 */
export function getProgressBadgeVariant(status: CMPProgressStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'not_started':
      return 'secondary'
    case 'behind':
      return 'destructive'
    case 'on_track':
      return 'outline'
    case 'completed':
    case 'exceeded':
      return 'default'
  }
}

/**
 * Get status label for display
 */
export function getProgressStatusLabel(status: CMPProgressStatus): string {
  switch (status) {
    case 'not_started':
      return 'Not Started'
    case 'behind':
      return 'Behind'
    case 'on_track':
      return 'On Track'
    case 'completed':
      return 'Completed'
    case 'exceeded':
      return 'Exceeded'
  }
}

// ============================================================================
// CALENDAR YEAR HELPERS
// ============================================================================

/**
 * Get the current calendar year
 */
export function getCurrentCalendarYear(): number {
  return new Date().getFullYear()
}

/**
 * Format calendar year for display (e.g., "2026")
 */
export function formatCalendarYear(year: number): string {
  return year.toString()
}

/**
 * Get calendar year options for dropdowns
 */
export function getCalendarYearOptions(range: number = 2): {
  value: number
  label: string
}[] {
  const currentYear = getCurrentCalendarYear()
  const options: { value: number; label: string }[] = []

  for (let i = -range; i <= range; i++) {
    const year = currentYear + i
    options.push({
      value: year,
      label: formatCalendarYear(year),
    })
  }

  return options
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CALENDAR_YEAR_OPTIONS = (() => {
  const currentYear = getCurrentCalendarYear()
  return [
    { value: currentYear - 1, label: formatCalendarYear(currentYear - 1) },
    { value: currentYear, label: formatCalendarYear(currentYear) },
    { value: currentYear + 1, label: formatCalendarYear(currentYear + 1) },
  ]
})()

export const DEFAULT_CMP_TARGETS: Record<string, Partial<CreateCMPTargetInput>> = {
  // These can be overridden by national/chapter settings
  default: {
    min_activities: 4, // 1 per quarter
    min_participants: 50,
    min_ec_participation: 10,
    min_awareness_activities: 1,
    min_action_activities: 2,
    min_advocacy_activities: 1,
  },
}

export const AAA_TYPES: Record<AAAType, { label: string; color: string; description: string }> = {
  awareness: {
    label: 'Awareness',
    color: 'blue',
    description: 'Activities that spread awareness about issues',
  },
  action: {
    label: 'Action',
    color: 'green',
    description: 'Activities that take direct action on issues',
  },
  advocacy: {
    label: 'Advocacy',
    color: 'purple',
    description: 'Activities that advocate for policy changes',
  },
}

export const CMP_PROGRESS_STATUSES: Record<CMPProgressStatus, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'gray' },
  behind: { label: 'Behind', color: 'red' },
  on_track: { label: 'On Track', color: 'yellow' },
  completed: { label: 'Completed', color: 'green' },
  exceeded: { label: 'Exceeded', color: 'emerald' },
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format progress percentage for display
 */
export function formatProgressPercentage(percentage: number): string {
  return `${Math.round(Math.min(percentage, 100))}%`
}

/**
 * Format target value for display (e.g., "4/10" or "40%")
 */
export function formatTargetProgress(actual: number, target: number): string {
  if (target === 0) return `${actual} (no target)`
  return `${actual}/${target}`
}

/**
 * Calculate remaining to target
 */
export function calculateRemaining(actual: number, target: number): number {
  return Math.max(0, target - actual)
}

/**
 * Check if target is achieved
 */
export function isTargetAchieved(actual: number, target: number): boolean {
  return actual >= target
}
