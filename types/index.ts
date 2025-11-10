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
