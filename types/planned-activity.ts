/**
 * Activity Planner Module
 * TypeScript Type Definitions
 *
 * Planned activities allow EC members to plan activities upfront before
 * reporting them as health card entries. This helps with data collection
 * checklists and pre-filling forms.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Status of a planned activity
 */
export type PlannedActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * Base Planned Activity (database row)
 */
export interface PlannedActivity {
  id: string

  // Activity Info
  activity_name: string
  activity_description: string | null
  planned_date: string // ISO date string

  // Vertical Link
  vertical_id: string

  // Expected Participation
  expected_ec_count: number
  expected_non_ec_count: number

  // Ownership
  chapter_id: string
  created_by: string

  // Status & Conversion
  status: PlannedActivityStatus
  health_card_entry_id: string | null
  converted_at: string | null // ISO timestamp

  // Optional notes
  preparation_notes: string | null

  // Metadata
  created_at: string
  updated_at: string
}

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

/**
 * Planned Activity with related data
 */
export interface PlannedActivityWithDetails extends PlannedActivity {
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
    icon: string | null
  }
  chapter?: {
    id: string
    name: string
  }
  member?: {
    id: string
    profile: {
      full_name: string
      avatar_url: string | null
    } | null
  }
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

/**
 * Input for creating a planned activity
 */
export interface CreatePlannedActivityInput {
  activity_name: string
  activity_description?: string
  planned_date: string
  vertical_id: string
  expected_ec_count: number
  expected_non_ec_count: number
  preparation_notes?: string
}

/**
 * Input for updating a planned activity
 */
export interface UpdatePlannedActivityInput {
  activity_name?: string
  activity_description?: string
  planned_date?: string
  vertical_id?: string
  expected_ec_count?: number
  expected_non_ec_count?: number
  preparation_notes?: string
  status?: PlannedActivityStatus
}

// ============================================================================
// PREFILL DATA TYPES
// ============================================================================

/**
 * Data to pre-fill health card form from planned activity
 */
export interface PlannedActivityPrefillData {
  activity_name: string
  activity_description: string | null
  activity_date: string
  vertical_id: string
  expected_ec_count: number
  expected_non_ec_count: number
  planned_activity_id: string
}

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Filters for listing planned activities
 */
export interface PlannedActivityFilters {
  status?: PlannedActivityStatus
  vertical_id?: string
  date_from?: string
  date_to?: string
  created_by?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Status options for UI
 */
export const PLANNED_ACTIVITY_STATUSES: { value: PlannedActivityStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: 'blue' },
  { value: 'in_progress', label: 'In Progress', color: 'amber' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
]

/**
 * Get status color class
 */
export function getStatusColor(status: PlannedActivityStatus): string {
  switch (status) {
    case 'planned':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'in_progress':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: PlannedActivityStatus): string {
  const statusOption = PLANNED_ACTIVITY_STATUSES.find(s => s.value === status)
  return statusOption?.label || status
}
