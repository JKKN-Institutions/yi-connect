/**
 * User Management Type Definitions
 *
 * Types for admin user management module
 */

import type { Database } from './database'

// ============================================================================
// Database Types
// ============================================================================

export type UserProfile = Database['public']['Tables']['profiles']['Row']
export type UserProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type UserProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type UserRole = Database['public']['Tables']['user_roles']['Row']
export type UserRoleInsert = Database['public']['Tables']['user_roles']['Insert']

export type Role = Database['public']['Tables']['roles']['Row']

// UserRoleChange type - manually defined until database types are regenerated
export interface UserRoleChange {
  id: string
  user_id: string
  role_id: string
  action: 'assigned' | 'removed'
  changed_by: string | null
  notes: string | null
  created_at: string
}

// ============================================================================
// Extended User Types
// ============================================================================

/**
 * Role information with metadata
 */
export interface RoleInfo {
  id: string
  role_id: string
  role_name: string
  hierarchy_level: number
  permissions: string[]
  assigned_at: string
  assigned_by: string | null
}

/**
 * User with basic profile information
 */
export interface UserListItem {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  phone: string | null
  chapter_id: string | null
  chapter?: {
    id: string
    name: string
    location: string
  } | null
  created_at: string
  updated_at: string
  approved_at: string | null
  approved_by: string | null
  // Computed fields
  roles: RoleInfo[]
  role_names: string[]
  highest_role: string | null
  hierarchy_level: number
  is_active: boolean
  has_member_record: boolean
  last_login: string | null
}

/**
 * Full user details with all relationships
 */
export interface UserFull extends UserListItem {
  member?: {
    id: string
    membership_number: string | null
    membership_status: string
    member_since: string
    company: string | null
    designation: string | null
  } | null
  approved_email?: {
    id: string
    is_active: boolean
    notes: string | null
  } | null
  role_changes: UserRoleChangeInfo[]
}

/**
 * User role change with metadata
 */
export interface UserRoleChangeInfo {
  id: string
  user_id: string
  role_id: string
  role_name: string
  action: 'assigned' | 'removed'
  changed_by: string | null
  changed_by_name: string | null
  notes: string | null
  created_at: string
}

// ============================================================================
// Query Parameters
// ============================================================================

/**
 * Filters for user list queries
 */
export interface UserFilters {
  search?: string
  role_id?: string
  role_name?: string
  chapter_id?: string
  hierarchy_level?: number
  is_active?: boolean
  has_member_record?: boolean
  approved_date_from?: string
  approved_date_to?: string
}

/**
 * User query parameters with pagination and filtering
 */
export interface UserQueryParams {
  page?: number
  pageSize?: number
  filters?: UserFilters
  sort?: {
    field: keyof UserListItem | 'role' | 'chapter'
    direction: 'asc' | 'desc'
  }
}

/**
 * Paginated user response
 */
export interface PaginatedUsers {
  data: UserListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// Form Data Types
// ============================================================================

/**
 * Update user profile form data
 */
export interface UpdateUserProfileData {
  id: string
  full_name: string
  phone?: string | null
  chapter_id?: string | null
  avatar_url?: string | null
}

/**
 * Assign role form data
 */
export interface AssignRoleData {
  user_id: string
  role_id: string
  notes?: string
}

/**
 * Remove role form data
 */
export interface RemoveRoleData {
  user_role_id: string // ID from user_roles table
  notes?: string
}

/**
 * Bulk assign role form data
 */
export interface BulkAssignRoleData {
  user_ids: string[]
  role_id: string
  notes?: string
}

/**
 * Change user status form data
 */
export interface ChangeUserStatusData {
  user_id: string
  is_active: boolean
  notes?: string
}

// ============================================================================
// Analytics & Statistics
// ============================================================================

/**
 * User statistics for dashboard
 */
export interface UserStats {
  total_users: number
  active_users: number
  inactive_users: number
  users_by_role: Record<string, number>
  users_by_chapter: Record<string, number>
  users_by_hierarchy_level: Record<number, number>
  new_users_this_month: number
  new_users_this_week: number
}

/**
 * User activity summary
 */
export interface UserActivitySummary {
  user_id: string
  last_login: string | null
  login_count: number
  role_changes_count: number
  recent_role_changes: UserRoleChangeInfo[]
}

// ============================================================================
// Role Management Types
// ============================================================================

/**
 * Available role for assignment
 */
export interface AvailableRole extends Role {
  can_assign: boolean // Based on current user's hierarchy level
  assigned_to_user: boolean // Whether this role is already assigned to the target user
  member_count: number // How many users have this role
}

/**
 * Role assignment history
 */
export interface RoleAssignmentHistory {
  role_name: string
  total_assignments: number
  total_removals: number
  current_members: number
  recent_changes: UserRoleChangeInfo[]
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  success_count: number
  failure_count: number
  failures: Array<{
    user_id: string
    user_name: string
    error: string
  }>
}

// ============================================================================
// Export & Import Types
// ============================================================================

/**
 * User export data (for CSV/XLSX)
 */
export interface UserExportData {
  email: string
  full_name: string
  phone: string | null
  chapter_name: string | null
  roles: string
  hierarchy_level: number
  is_active: string
  has_member: string
  created_at: string
  last_login: string | null
}

/**
 * Export configuration
 */
export interface UserExportConfig {
  format: 'csv' | 'xlsx' | 'json'
  fields?: Array<keyof UserExportData>
  filters?: UserFilters
  include_inactive?: boolean
}
