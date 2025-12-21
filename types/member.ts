/**
 * Member Type Definitions
 *
 * Type definitions for Member Intelligence Hub module.
 */

import type { Tables, Enums } from './database'

// ============================================================================
// Base Types from Database
// ============================================================================

export type Member = Tables<'members'>
export type Skill = Tables<'skills'>
export type MemberSkill = Tables<'member_skills'>
export type Certification = Tables<'certifications'>
export type MemberCertification = Tables<'member_certifications'>
export type Availability = Tables<'availability'>
export type EngagementMetric = Tables<'engagement_metrics'>
export type LeadershipAssessment = Tables<'leadership_assessments'>

// ============================================================================
// Enums
// ============================================================================

export type ProficiencyLevel = Enums<'proficiency_level'>
export type AvailabilityStatus = Enums<'availability_status'>
export type SkillCategory = Enums<'skill_category'>

// ============================================================================
// Extended Types (with relationships)
// ============================================================================

export interface MemberWithProfile extends Member {
  profile?: {
    email: string
    full_name: string
    avatar_url: string | null
    phone: string | null
  }
  chapter?: {
    id: string
    name: string
    location: string
  }
}

export interface MemberWithSkills extends MemberWithProfile {
  skills: Array<{
    id: string
    skill: Skill
    proficiency: ProficiencyLevel
    years_of_experience: number | null
    is_willing_to_mentor: boolean
    notes: string | null
  }>
}

export interface MemberWithCertifications extends MemberWithProfile {
  certifications: Array<{
    id: string
    certification: Certification
    certificate_number: string | null
    issued_date: string
    expiry_date: string | null
    document_url: string | null
    notes: string | null
    is_expiring_soon: boolean
  }>
}

export interface MemberWithEngagement extends MemberWithProfile {
  engagement: EngagementMetric
  leadership: LeadershipAssessment
}

export interface MemberFull extends MemberWithProfile {
  skills: Array<{
    id: string
    skill: Skill
    proficiency: ProficiencyLevel
    years_of_experience: number | null
    is_willing_to_mentor: boolean
  }>
  certifications: Array<{
    id: string
    certification: Certification
    certificate_number: string | null
    issued_date: string
    expiry_date: string | null
    is_expiring_soon: boolean
  }>
  engagement: EngagementMetric
  leadership: LeadershipAssessment
}

// ============================================================================
// UI/Display Types
// ============================================================================

export interface MemberListItem {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  company: string | null
  designation: string | null
  membership_status: string
  member_since: string
  engagement_score: number
  readiness_score: number
  skills_count: number
  top_skills: Array<{
    name: string
    proficiency: ProficiencyLevel
  }>
  roles: Array<{
    role_name: string
    hierarchy_level: number
  }>
  // New fields for vertical and category filtering
  skill_will_category: SkillWillCategory | null
  is_trainer: boolean
  verticals: Array<{
    id: string
    name: string
    color: string | null
  }>
}

// Skill-Will Category type
export type SkillWillCategory = 'star' | 'enthusiast' | 'cynic' | 'dead_wood'

// Member category tab filter type
export type MemberCategoryTab = 'all' | 'trainers' | 'star' | 'enthusiast' | 'cynic' | 'dead_wood'

export interface SkillWithMembers extends Skill {
  member_count: number
  proficiency_distribution: {
    beginner: number
    intermediate: number
    advanced: number
    expert: number
  }
  mentors_available: number
}

export interface SkillGapAnalysis {
  skill_id: string
  skill_name: string
  skill_category: SkillCategory
  total_members_with_skill: number
  beginner_count: number
  intermediate_count: number
  advanced_count: number
  expert_count: number
  avg_proficiency: number
  mentors_available: number
  gap_severity: 'critical' | 'high' | 'medium' | 'low'
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface MemberFilters {
  search?: string
  membership_status?: string[]
  skills?: string[]
  min_engagement_score?: number
  max_engagement_score?: number
  min_readiness_score?: number
  max_readiness_score?: number
  availability_status?: AvailabilityStatus[]
  city?: string[]
  company?: string[]
  is_active?: boolean
  // New filters for category and vertical
  category_tab?: MemberCategoryTab
  skill_will_category?: SkillWillCategory[]
  vertical_ids?: string[]
  is_trainer?: boolean
}

export interface MemberSortOptions {
  field: 'full_name' | 'member_since' | 'engagement_score' | 'readiness_score' | 'company'
  direction: 'asc' | 'desc'
}

export interface MemberQueryParams {
  page?: number
  pageSize?: number
  filters?: MemberFilters
  sort?: MemberSortOptions
}

export interface PaginatedMembers {
  data: MemberListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateMemberInput {
  // Profile info (inherited from signup)
  id: string
  email: string
  full_name: string
  phone?: string

  // Member-specific info
  chapter_id?: string
  membership_number?: string
  member_since?: string
  membership_status?: 'active' | 'inactive' | 'suspended' | 'alumni'

  // Professional info
  company?: string
  designation?: string
  industry?: string
  years_of_experience?: number
  linkedin_url?: string

  // Personal info
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  address?: string
  city?: string
  state?: string
  country?: string
  pincode?: string

  // Emergency contact
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string

  // Preferences
  interests?: string[]
  preferred_event_types?: string[]
  communication_preferences?: {
    email: boolean
    sms: boolean
    whatsapp: boolean
  }

  notes?: string
}

export interface UpdateMemberInput extends Partial<CreateMemberInput> {
  id: string
}

export interface AddMemberSkillInput {
  member_id: string
  skill_id: string
  proficiency: ProficiencyLevel
  years_of_experience?: number
  is_willing_to_mentor?: boolean
  notes?: string
}

export interface UpdateMemberSkillInput {
  id: string
  proficiency?: ProficiencyLevel
  years_of_experience?: number
  is_willing_to_mentor?: boolean
  notes?: string
}

export interface AddMemberCertificationInput {
  member_id: string
  certification_id: string
  certificate_number?: string
  issued_date: string
  expiry_date?: string
  document_url?: string
  notes?: string
}

export interface UpdateMemberCertificationInput {
  id: string
  certificate_number?: string
  issued_date?: string
  expiry_date?: string
  document_url?: string
  notes?: string
}

export interface SetAvailabilityInput {
  member_id: string
  date: string
  status: AvailabilityStatus
  time_slots?: {
    morning?: 'available' | 'busy' | 'unavailable'
    afternoon?: 'available' | 'busy' | 'unavailable'
    evening?: 'available' | 'busy' | 'unavailable'
  }
  notes?: string
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface MemberAnalytics {
  total_members: number
  active_members: number
  new_members_this_month: number
  avg_engagement_score: number
  members_by_status: Record<string, number>
  members_by_city: Record<string, number>
  top_companies: Array<{ company: string; count: number }>
  skills_distribution: Record<SkillCategory, number>
  leadership_pipeline: {
    not_ready: number
    developing: number
    ready: number
    highly_ready: number
  }
}

export interface EngagementTrend {
  month: string
  avg_score: number
  active_members: number
  total_events: number
}

// ============================================================================
// Constants
// ============================================================================

export const MEMBERSHIP_STATUSES = ['active', 'inactive', 'suspended', 'alumni'] as const
export const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const
export const AVAILABILITY_STATUSES = ['available', 'busy', 'unavailable'] as const
export const SKILL_CATEGORIES = [
  'technical',
  'business',
  'creative',
  'leadership',
  'communication',
  'other',
] as const
export const READINESS_LEVELS = ['not_ready', 'developing', 'ready', 'highly_ready'] as const
export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const
export const SKILL_WILL_CATEGORIES = ['star', 'enthusiast', 'cynic', 'dead_wood'] as const
export const MEMBER_CATEGORY_TABS = [
  { value: 'all', label: 'All Members', description: 'View all chapter members' },
  { value: 'trainers', label: 'Trainers', description: 'Certified session trainers' },
  { value: 'star', label: 'Stars', description: 'High skill & high will members' },
  { value: 'enthusiast', label: 'Enthusiasts', description: 'High will, developing skills' },
  { value: 'cynic', label: 'Cynics', description: 'High skill, lower engagement' },
  { value: 'dead_wood', label: 'Needs Attention', description: 'Members needing development' },
] as const

// ============================================================================
// Helper Types
// ============================================================================

export interface TimeSlot {
  morning?: 'available' | 'busy' | 'unavailable'
  afternoon?: 'available' | 'busy' | 'unavailable'
  evening?: 'available' | 'busy' | 'unavailable'
}

export interface CommunicationPreferences {
  email: boolean
  sms: boolean
  whatsapp: boolean
}
