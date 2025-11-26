/**
 * Trainer Type Definitions
 *
 * Type definitions for Trainer Profile feature.
 */

// ============================================================================
// Distribution Status
// ============================================================================

export type TrainerDistributionStatus = 'active' | 'inactive' | 'on_leave' | 'maxed_out'

// ============================================================================
// Base Types (explicit definition since tables were just created)
// ============================================================================

export interface TrainerProfile {
  id: string
  member_id: string
  chapter_id: string
  is_trainer_eligible: boolean
  eligible_verticals: string[] | null
  eligible_session_types: string[] | null
  total_sessions: number
  total_students_impacted: number
  average_rating: number | null
  last_session_date: string | null
  sessions_this_month: number
  sessions_this_quarter: number
  days_since_last_session: number | null
  distribution_status: TrainerDistributionStatus | null
  preferred_session_types: string[] | null
  preferred_age_groups: string[] | null
  max_sessions_per_month: number | null
  created_at: string
  updated_at: string
}

export interface TrainerCertification {
  id: string
  trainer_profile_id: string
  certification_name: string
  issuing_organization: string
  certificate_number: string | null
  issued_date: string
  expiry_date: string | null
  document_url: string | null
  is_verified: boolean
  verified_by: string | null
  verified_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Extended Types (with relationships)
// ============================================================================

export interface TrainerProfileFull extends TrainerProfile {
  member?: {
    id: string
    profile?: {
      full_name: string
      email: string
      avatar_url: string | null
      phone: string | null
    }
    company: string | null
    designation: string | null
  }
  certifications?: TrainerCertificationWithDetails[]
}

export interface TrainerCertificationWithDetails extends TrainerCertification {
  is_expiring_soon: boolean
  days_until_expiry: number | null
}

// ============================================================================
// UI/Display Types
// ============================================================================

export interface TrainerProfileSummary {
  id: string
  member_id: string
  full_name: string
  email: string
  avatar_url: string | null
  is_trainer_eligible: boolean
  distribution_status: TrainerDistributionStatus | null
  eligible_verticals: string[]
  eligible_session_types: string[]
  total_sessions: number
  total_students_impacted: number
  average_rating: number | null
  last_session_date: string | null
  sessions_this_month: number
  sessions_this_quarter: number
  days_since_last_session: number | null
  certifications_count: number
  expiring_certifications: number
}

export interface TrainerSessionStats {
  total_sessions: number
  total_students_impacted: number
  average_rating: number | null
  sessions_this_month: number
  sessions_this_quarter: number
  sessions_by_type: Record<string, number>
  sessions_by_vertical: Record<string, number>
  rating_distribution: {
    five_star: number
    four_star: number
    three_star: number
    two_star: number
    one_star: number
  }
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateTrainerProfileInput {
  member_id: string
  chapter_id: string
  is_trainer_eligible?: boolean
  eligible_verticals?: string[]
  eligible_session_types?: string[]
  preferred_session_types?: string[]
  preferred_age_groups?: string[]
  max_sessions_per_month?: number
}

export interface UpdateTrainerProfileInput {
  id: string
  is_trainer_eligible?: boolean
  eligible_verticals?: string[]
  eligible_session_types?: string[]
  distribution_status?: TrainerDistributionStatus
  preferred_session_types?: string[]
  preferred_age_groups?: string[]
  max_sessions_per_month?: number
}

export interface AddTrainerCertificationInput {
  trainer_profile_id: string
  certification_name: string
  issuing_organization: string
  certificate_number?: string
  issued_date: string
  expiry_date?: string
  document_url?: string
  notes?: string
}

export interface UpdateTrainerCertificationInput {
  id: string
  certification_name?: string
  issuing_organization?: string
  certificate_number?: string
  issued_date?: string
  expiry_date?: string
  document_url?: string
  is_verified?: boolean
  notes?: string
}

// ============================================================================
// Constants
// ============================================================================

export const DISTRIBUTION_STATUSES = ['active', 'inactive', 'on_leave', 'maxed_out'] as const

export const AGE_GROUPS = [
  'children_6_10',
  'children_11_14',
  'teens_15_18',
  'young_adults_19_25',
  'adults_26_plus',
] as const

export const AGE_GROUP_LABELS: Record<string, string> = {
  children_6_10: 'Children (6-10 years)',
  children_11_14: 'Children (11-14 years)',
  teens_15_18: 'Teenagers (15-18 years)',
  young_adults_19_25: 'Young Adults (19-25 years)',
  adults_26_plus: 'Adults (26+ years)',
}
