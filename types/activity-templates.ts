/**
 * Activity Templates Types
 * Pre-defined templates for quick activity logging
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export interface ActivityTemplate {
  id: string
  name: string
  description: string | null

  // Vertical association
  vertical_id: string | null
  vertical?: {
    id: string
    name: string
    color: string | null
  }

  // Default values for health card
  default_title: string | null
  default_activity_type: string | null
  default_aaa_classification: AAAClassification | null
  default_target_audience: string | null
  default_duration_hours: number | null

  // Expected metrics
  expected_participants: number | null
  expected_ec_count: number | null

  // Template metadata
  icon: string | null
  color: string | null
  tags: string[]

  // Scope
  is_national: boolean
  chapter_id: string | null

  // Status
  is_active: boolean
  usage_count: number

  // Metadata
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AAAClassification = 'awareness' | 'action' | 'advocacy'

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateActivityTemplateInput {
  name: string
  description?: string | null
  vertical_id?: string | null

  default_title?: string | null
  default_activity_type?: string | null
  default_aaa_classification?: AAAClassification | null
  default_target_audience?: string | null
  default_duration_hours?: number | null

  expected_participants?: number | null
  expected_ec_count?: number | null

  icon?: string | null
  color?: string | null
  tags?: string[]

  is_national?: boolean
  chapter_id?: string | null
}

export interface UpdateActivityTemplateInput {
  id: string
  name?: string
  description?: string | null
  vertical_id?: string | null

  default_title?: string | null
  default_activity_type?: string | null
  default_aaa_classification?: AAAClassification | null
  default_target_audience?: string | null
  default_duration_hours?: number | null

  expected_participants?: number | null
  expected_ec_count?: number | null

  icon?: string | null
  color?: string | null
  tags?: string[]

  is_active?: boolean
}

export interface ActivityTemplateFilters {
  vertical_id?: string
  is_national?: boolean
  is_active?: boolean
  search?: string
  tags?: string[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get AAA classification color
 */
export function getAAAColor(classification: AAAClassification | null): string {
  switch (classification) {
    case 'awareness':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'action':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'advocacy':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

/**
 * Get AAA classification label
 */
export function getAAALabel(classification: AAAClassification | null): string {
  switch (classification) {
    case 'awareness':
      return 'A1: Awareness'
    case 'action':
      return 'A2: Action'
    case 'advocacy':
      return 'A3: Advocacy'
    default:
      return 'Not Classified'
  }
}

/**
 * Get AAA short label
 */
export function getAAAShortLabel(classification: AAAClassification | null): string {
  switch (classification) {
    case 'awareness':
      return 'A1'
    case 'action':
      return 'A2'
    case 'advocacy':
      return 'A3'
    default:
      return '-'
  }
}

// ============================================================================
// ICON MAPPING
// ============================================================================

// Map of template icons to display
export const TEMPLATE_ICONS = [
  'Shield', 'GraduationCap', 'Landmark', 'TreePine', 'Leaf', 'Zap',
  'Car', 'HardHat', 'Heart', 'Droplet', 'Brain', 'Users', 'School',
  'Wrench', 'HeartHandshake', 'Mic', 'Factory', 'Globe', 'BookOpen',
  'Target', 'Trophy', 'Lightbulb', 'Megaphone', 'Camera', 'Music',
] as const

export type TemplateIconName = typeof TEMPLATE_ICONS[number]

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export const ACTIVITY_TYPES = [
  'Workshop',
  'Training',
  'Session',
  'Meeting',
  'Drive',
  'Distribution',
  'Camp',
  'Visit',
  'Service',
  'Event',
  'Seminar',
  'Conference',
  'Competition',
  'Exhibition',
  'Rally',
  'Other',
] as const

export type ActivityType = typeof ACTIVITY_TYPES[number]
