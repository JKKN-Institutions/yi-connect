/**
 * Skill-Will Assessment Type Definitions
 *
 * Types for the Skill-Will Assessment System that categorizes members
 * into Star, Enthusiast, Cynic, or Dead Wood quadrants.
 */

// ============================================================================
// Enums and Constants
// ============================================================================

export type AssessmentStatus = 'pending' | 'in_progress' | 'completed' | 'expired'

export type SkillWillCategory = 'star' | 'enthusiast' | 'cynic' | 'dead_wood'

export type EnergyFocus =
  | 'teaching_mentoring'
  | 'organizing_events'
  | 'corporate_partnerships'
  | 'fieldwork'
  | 'creative_work'

export type AgeGroup =
  | 'children_5_12'
  | 'teenagers_15_22'
  | 'adults_25_plus'
  | 'all_ages'

export type SkillLevel = 'none' | 'beginner' | 'intermediate' | 'expert'

export type TimeCommitment =
  | 'under_2_hours'
  | 'hours_5_10'
  | 'hours_10_15'
  | 'hours_15_plus'

export type TravelWillingness =
  | 'city_only'
  | 'district'
  | 'neighboring'
  | 'all_state'

// ============================================================================
// Base Assessment Type
// ============================================================================

export interface SkillWillAssessment {
  id: string
  member_id: string
  chapter_id: string
  status: AssessmentStatus
  version: number
  started_at: string | null
  completed_at: string | null
  expires_at: string | null

  // Question 1: Energy Focus
  q1_energy_focus: EnergyFocus | null
  q1_ai_suggestion: string | null
  q1_ai_reason: string | null

  // Question 2: Age Group Preference
  q2_age_group: AgeGroup | null
  q2_ai_suggestion: string | null
  q2_ai_reason: string | null

  // Question 3: Skill Level
  q3_skill_level: SkillLevel | null

  // Question 4: Time Commitment
  q4_time_commitment: TimeCommitment | null

  // Question 5: Travel Willingness
  q5_travel_willingness: TravelWillingness | null

  // AI Analysis
  ai_suggestions: Record<string, any>

  // Scores (0-1 scale)
  skill_score: number | null
  will_score: number | null

  // Category (calculated from skill/will scores)
  category: SkillWillCategory | null

  // Vertical Recommendation
  recommended_vertical_id: string | null
  recommended_match_pct: number | null
  alternative_verticals: AlternativeVertical[]

  // Assignment
  assigned_vertical_id: string | null
  assigned_by: string | null
  assigned_at: string | null
  assignment_notes: string | null

  // Mentor Assignment
  mentor_id: string | null
  mentor_assigned_at: string | null
  mentor_notes: string | null

  // Development Roadmap
  roadmap: RoadmapMilestone[]

  created_at: string
  updated_at: string
}

// ============================================================================
// Extended Types (with relationships)
// ============================================================================

export interface SkillWillAssessmentFull extends SkillWillAssessment {
  member?: {
    id: string
    profile?: {
      full_name: string
      email: string
      avatar_url: string | null
    }
    company: string | null
    designation: string | null
  }
  recommended_vertical?: {
    id: string
    name: string
    color: string | null
  }
  assigned_vertical?: {
    id: string
    name: string
    color: string | null
  }
  mentor?: {
    id: string
    profile?: {
      full_name: string
      email: string
      avatar_url: string | null
    }
  }
  assigned_by_member?: {
    id: string
    profile?: {
      full_name: string
    }
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface AlternativeVertical {
  vertical_id: string
  vertical_name: string
  match_pct: number
  reason: string
}

export interface RoadmapMilestone {
  month: number
  title: string
  description: string
  tasks: string[]
  completed: boolean
  completed_at?: string
}

export interface AIVerticalSuggestion {
  vertical_id: string
  vertical_name: string
  match_pct: number
  reasons: string[]
  development_focus: string[]
}

// ============================================================================
// Form Types
// ============================================================================

export interface StartAssessmentInput {
  member_id: string
  chapter_id: string
}

export interface UpdateAssessmentAnswersInput {
  id: string
  q1_energy_focus?: EnergyFocus
  q2_age_group?: AgeGroup
  q3_skill_level?: SkillLevel
  q4_time_commitment?: TimeCommitment
  q5_travel_willingness?: TravelWillingness
}

export interface CompleteAssessmentInput {
  id: string
  // Optional AI suggestions to accept
  accept_ai_suggestion_q1?: boolean
  accept_ai_suggestion_q2?: boolean
}

export interface AssignVerticalInput {
  assessment_id: string
  vertical_id: string
  assigned_by: string
  notes?: string
}

export interface AssignMentorInput {
  assessment_id: string
  mentor_id: string
  notes?: string
}

export interface UpdateRoadmapInput {
  assessment_id: string
  roadmap: RoadmapMilestone[]
}

// ============================================================================
// Query/Filter Types
// ============================================================================

export interface AssessmentFilters {
  member_id?: string
  chapter_id?: string
  status?: AssessmentStatus | AssessmentStatus[]
  category?: SkillWillCategory | SkillWillCategory[]
  has_mentor?: boolean
  has_vertical?: boolean
  is_expired?: boolean
}

export interface AssessmentStats {
  total: number
  by_status: Record<AssessmentStatus, number>
  by_category: Record<SkillWillCategory, number>
  pending_mentor: number
  pending_vertical: number
  average_skill_score: number
  average_will_score: number
}

// ============================================================================
// Constants
// ============================================================================

export const ASSESSMENT_STATUSES = ['pending', 'in_progress', 'completed', 'expired'] as const

export const SKILL_WILL_CATEGORIES = ['star', 'enthusiast', 'cynic', 'dead_wood'] as const

export const ENERGY_FOCUS_OPTIONS = [
  { value: 'teaching_mentoring', label: 'Teaching & Mentoring', description: 'Enjoy educating and guiding others' },
  { value: 'organizing_events', label: 'Organizing Events', description: 'Love planning and executing activities' },
  { value: 'corporate_partnerships', label: 'Corporate Partnerships', description: 'Strong at business relationships' },
  { value: 'fieldwork', label: 'Fieldwork', description: 'Prefer hands-on community work' },
  { value: 'creative_work', label: 'Creative Work', description: 'Excel at design and innovation' },
] as const

export const AGE_GROUP_OPTIONS = [
  { value: 'children_5_12', label: 'Children (5-12 years)', description: 'Thalir, Masoom programs' },
  { value: 'teenagers_15_22', label: 'Teenagers (15-22 years)', description: 'Yuva programs' },
  { value: 'adults_25_plus', label: 'Adults (25+ years)', description: 'Adult education, Road Safety' },
  { value: 'all_ages', label: 'All Ages', description: 'Comfortable with any age group' },
] as const

export const SKILL_LEVEL_OPTIONS = [
  { value: 'none', label: 'None', description: 'No prior experience', score: 0 },
  { value: 'beginner', label: 'Beginner', description: '0-2 sessions conducted', score: 0.25 },
  { value: 'intermediate', label: 'Intermediate', description: '3-10 sessions conducted', score: 0.6 },
  { value: 'expert', label: 'Expert', description: '10+ sessions conducted', score: 1 },
] as const

export const TIME_COMMITMENT_OPTIONS = [
  { value: 'under_2_hours', label: 'Under 2 hours/week', willScore: 0.25 },
  { value: 'hours_5_10', label: '5-10 hours/week', willScore: 0.5 },
  { value: 'hours_10_15', label: '10-15 hours/week', willScore: 0.75 },
  { value: 'hours_15_plus', label: '15+ hours/week', willScore: 1 },
] as const

export const TRAVEL_WILLINGNESS_OPTIONS = [
  { value: 'city_only', label: 'City Only', description: 'Prefer local activities' },
  { value: 'district', label: 'District', description: 'Can travel within district' },
  { value: 'neighboring', label: 'Neighboring Districts', description: 'Can travel to nearby districts' },
  { value: 'all_state', label: 'All State', description: 'Can travel anywhere in state' },
] as const

export const CATEGORY_INFO: Record<SkillWillCategory, {
  label: string
  description: string
  color: string
  actionPlan: string
}> = {
  star: {
    label: 'Star',
    description: 'High skill, high will - Ready to lead',
    color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    actionPlan: 'Assign leadership roles, mentor others, lead new initiatives',
  },
  enthusiast: {
    label: 'Enthusiast',
    description: 'Low skill, high will - Eager to learn',
    color: 'bg-green-500/10 text-green-700 dark:text-green-400',
    actionPlan: 'Pair with mentor, provide training, shadow experienced members',
  },
  cynic: {
    label: 'Cynic',
    description: 'High skill, low will - Needs motivation',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    actionPlan: 'Identify blockers, offer flexibility, recognize contributions',
  },
  dead_wood: {
    label: 'Dead Wood',
    description: 'Low skill, low will - Needs re-evaluation',
    color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
    actionPlan: 'Have honest conversation, explore interests, consider role change',
  },
}

/**
 * Calculate skill-will category from scores
 */
export function calculateCategory(skillScore: number, willScore: number): SkillWillCategory {
  const skillThreshold = 0.5
  const willThreshold = 0.5

  if (skillScore >= skillThreshold && willScore >= willThreshold) {
    return 'star'
  } else if (skillScore < skillThreshold && willScore >= willThreshold) {
    return 'enthusiast'
  } else if (skillScore >= skillThreshold && willScore < willThreshold) {
    return 'cynic'
  } else {
    return 'dead_wood'
  }
}

/**
 * Calculate skill score from assessment answers
 */
export function calculateSkillScore(skillLevel: SkillLevel | null): number {
  if (!skillLevel) return 0
  const option = SKILL_LEVEL_OPTIONS.find(o => o.value === skillLevel)
  return option?.score ?? 0
}

/**
 * Calculate will score from assessment answers
 */
export function calculateWillScore(timeCommitment: TimeCommitment | null): number {
  if (!timeCommitment) return 0
  const option = TIME_COMMITMENT_OPTIONS.find(o => o.value === timeCommitment)
  return option?.willScore ?? 0
}
