/**
 * Chapter Type Definitions
 *
 * Types for Yi Chapter management
 */

import type { Database } from './database'

// Database types
export type Chapter = Database['public']['Tables']['chapters']['Row']
export type ChapterInsert = Database['public']['Tables']['chapters']['Insert']
export type ChapterUpdate = Database['public']['Tables']['chapters']['Update']

// Extended chapter with member count
export interface ChapterWithStats extends Chapter {
  active_members?: number
  total_members?: number
}

// Chapter list item for tables
export interface ChapterListItem {
  id: string
  name: string
  location: string
  region: string | null
  established_date: string | null
  member_count: number
  created_at: string
}

// Simplified type for dropdowns/selects
export interface ChapterOption {
  id: string
  name: string
  location: string
}

// Table filter and sort parameters
export interface ChapterFilters {
  search?: string
  region?: string[]
}

export interface ChapterSort {
  column: keyof ChapterListItem
  direction: 'asc' | 'desc'
}

// Paginated chapters response
export interface PaginatedChapters {
  data: ChapterListItem[]
  total: number
  page: number
  pageSize: number
}

// ============================================================================
// MULTI-CHAPTER SYSTEM TYPES
// ============================================================================

// Chapter status
export type ChapterStatus =
  | 'draft'
  | 'pending_chair'
  | 'active'
  | 'suspended'
  | 'archived'

// Extended chapter with multi-chapter fields
export interface ChapterExtended extends Chapter {
  status: ChapterStatus
  chair_id: string | null
  settings: Record<string, unknown> | null
  onboarding_completed_at: string | null
}

// Chapter with chair info
export interface ChapterWithChair extends ChapterExtended {
  chair?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
  }
}

// ============================================================================
// CHAPTER INVITATIONS
// ============================================================================

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface ChapterInvitation {
  id: string
  chapter_id: string
  email: string | null
  phone: string | null
  full_name: string
  invited_role: string
  token: string
  token_expires_at: string
  status: InvitationStatus
  personal_message: string | null
  accepted_at: string | null
  accepted_by: string | null
  invited_by: string
  created_at: string
  updated_at: string
}

export interface ChapterInvitationInsert {
  chapter_id: string
  email?: string | null
  phone?: string | null
  full_name: string
  invited_role?: string
  personal_message?: string | null
  invited_by: string
}

// Invitation with chapter and inviter details (for display)
export interface ChapterInvitationWithDetails extends ChapterInvitation {
  chapter: {
    id: string
    name: string
    location: string
  }
  inviter: {
    id: string
    full_name: string
    email: string
  }
}

// Invitation lookup result (from token)
export interface InvitationLookup {
  found: boolean
  id?: string
  status?: InvitationStatus
  full_name?: string
  email?: string | null
  phone?: string | null
  invited_role?: string
  personal_message?: string | null
  expires_at?: string
  chapter_name?: string
  chapter_location?: string
  inviter_name?: string
  is_expired?: boolean
  is_valid?: boolean
}

// ============================================================================
// FEATURE TOGGLES
// ============================================================================

export type FeatureNameType =
  | 'events'
  | 'communications'
  | 'stakeholder_crm'
  | 'session_bookings'
  | 'opportunities'
  | 'knowledge_base'
  | 'awards'
  | 'finance'
  | 'analytics'
  | 'member_intelligence'
  | 'succession_planning'
  | 'verticals'
  | 'sub_chapters'
  | 'industrial_visits'

export interface ChapterFeatureToggle {
  id: string
  chapter_id: string
  feature: FeatureNameType
  is_enabled: boolean
  enabled_at: string | null
  disabled_at: string | null
  changed_by: string | null
  settings: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ChapterFeatureToggleInsert {
  chapter_id: string
  feature: FeatureNameType
  is_enabled?: boolean
  settings?: Record<string, unknown>
  changed_by?: string
}

export interface ChapterFeatureToggleUpdate {
  is_enabled?: boolean
  settings?: Record<string, unknown>
  changed_by?: string
}

// Feature status for a chapter (simplified view)
export interface ChapterFeatureStatus {
  feature: FeatureNameType
  is_enabled: boolean
}

// ============================================================================
// CHAPTER CREATION / ONBOARDING
// ============================================================================

// Input for creating a new chapter with chair invitation
export interface CreateChapterInput {
  // Chapter details
  name: string
  location: string
  region: string
  established_date?: string
  // Chair invitation
  chair_email?: string
  chair_phone?: string
  chair_name: string
  personal_message?: string
  // Features to enable
  enabled_features: FeatureNameType[]
}

// Result of chapter creation
export interface CreateChapterResult {
  success: boolean
  chapter_id?: string
  invitation_id?: string
  invitation_token?: string
  error?: string
}

// Chapter onboarding progress
export interface ChapterOnboardingProgress {
  chapter_id: string
  chair_assigned: boolean
  features_configured: boolean
  first_member_added: boolean
  first_event_created: boolean
  onboarding_completed: boolean
}
