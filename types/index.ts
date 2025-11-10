/**
 * Shared TypeScript Types
 *
 * Common types used across the Yi Connect application.
 */

import type { Database } from './database'

// Database Table Types (will be generated from Supabase)
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Common Types
export interface PageProps<T = Record<string, string>> {
  params: Promise<T>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export interface LayoutProps {
  children: React.ReactNode
  params: Promise<Record<string, string>>
}

// Form State (for Server Actions)
export interface FormState {
  success?: boolean
  message?: string
  errors?: Record<string, string[] | undefined>
  data?: any
  redirectTo?: string
}

// Pagination
export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Filters
export interface BaseFilters extends PaginationParams {
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// User & Profile
export interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  phone?: string
  chapter_id?: string
  created_at: string
  updated_at: string
}

export interface UserWithRoles extends UserProfile {
  roles: string[]
  permissions: string[]
}

// Chapter
export interface Chapter {
  id: string
  name: string
  location: string
  region?: string
  established_date?: string
  member_count: number
  created_at: string
  updated_at: string
}

// Analytics
export interface ChapterHealthMetrics {
  engagement_index: number
  impact_index: number
  financial_efficiency: number
  leadership_pipeline_strength: number
  communication_reach: number
}

export interface MetricCard {
  title: string
  value: string | number
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ComponentType
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Search
export interface SearchResult {
  id: string
  type: 'member' | 'event' | 'stakeholder' | 'document'
  title: string
  description?: string
  url: string
  metadata?: Record<string, any>
}

// Notifications
export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  action_url?: string
  created_at: string
}

// Audit Log
export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// Member Extended Types
export type MembershipType = 'individual' | 'couple'

export type WillingnessLevel = 1 | 2 | 3 | 4 | 5

export interface WillingnessLevelInfo {
  level: WillingnessLevel
  label: string
  emoji: string
  description: string
}

export const WILLINGNESS_LEVELS: Record<WillingnessLevel, WillingnessLevelInfo> = {
  5: { level: 5, label: 'Activist', emoji: '🔥', description: 'Highly engaged, leads initiatives' },
  4: { level: 4, label: 'Regular', emoji: '⭐', description: 'Consistently active participant' },
  3: { level: 3, label: 'Selective', emoji: '✅', description: 'Participates in specific areas' },
  2: { level: 2, label: 'Occasional', emoji: '🕐', description: 'Occasional involvement' },
  1: { level: 1, label: 'Passive', emoji: '👀', description: 'Minimal participation' }
}

export const YI_VERTICALS = [
  'masoom',
  'road_safety',
  'yuva',
  'thalir',
  'climate',
  'rural_development',
  'health',
  'sports',
  'innovation',
  'arts'
] as const

export type YiVertical = typeof YI_VERTICALS[number]

export const COMMON_LANGUAGES = [
  'tamil',
  'english',
  'hindi',
  'malayalam',
  'telugu',
  'kannada'
] as const

export type CommonLanguage = typeof COMMON_LANGUAGES[number]

// Availability Profile Types
export type TimeCommitment = 2 | 5 | 10 | 15 | 20

export type PreferredDays = 'weekdays' | 'weekends' | 'flexible'

export type NoticePeriod = '2_hours' | '1_day' | '3_days' | '1_week' | '2_weeks' | '1_month'

export type GeographicFlexibility = 'erode_only' | 'district' | 'state' | 'zone' | 'pan_india'

export type ContactMethod = 'whatsapp' | 'email' | 'phone' | 'notification'

export interface AvailabilityProfile {
  time_commitment_hours?: TimeCommitment
  preferred_days?: PreferredDays
  notice_period?: NoticePeriod
  geographic_flexibility?: GeographicFlexibility
  preferred_contact_method?: ContactMethod
}

// Member Networks Types
export type NetworkType =
  | 'schools'
  | 'colleges'
  | 'industries'
  | 'government'
  | 'ngos'
  | 'venues'
  | 'speakers'
  | 'corporate_partners'

export type RelationshipStrength = 'weak' | 'moderate' | 'strong'

export interface MemberNetwork {
  id: string
  member_id: string
  network_type: NetworkType
  organization_name: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  relationship_strength: RelationshipStrength
  notes?: string
  verified: boolean
  created_at: string
  updated_at: string
}
