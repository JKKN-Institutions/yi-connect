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
