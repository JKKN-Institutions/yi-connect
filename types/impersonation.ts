/**
 * User Impersonation System Types
 *
 * Type definitions for the impersonation feature that allows
 * National/Super Admins to temporarily assume any user's identity.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Timeout duration options for impersonation sessions
 */
export type ImpersonationTimeout = 15 | 30 | 60 | 240

export const TIMEOUT_OPTIONS: { value: ImpersonationTimeout; label: string }[] = [
  { value: 15, label: '15 minutes (Quick check)' },
  { value: 30, label: '30 minutes (Default)' },
  { value: 60, label: '1 hour (Extended testing)' },
  { value: 240, label: '4 hours (Deep debugging)' },
]

/**
 * Reasons for ending an impersonation session
 */
export type ImpersonationEndReason = 'manual' | 'timeout' | 'new_session' | 'logout'

/**
 * Impersonation session record from database
 */
export interface ImpersonationSession {
  id: string
  admin_id: string
  target_user_id: string
  reason: string | null
  timeout_minutes: number
  started_at: string
  ended_at: string | null
  end_reason: ImpersonationEndReason | null
  pages_visited: number
  actions_taken: number
  created_at: string
}

/**
 * Active impersonation session with enriched user info
 */
export interface ActiveImpersonationSession {
  session_id: string
  target_user_id: string
  target_user_name: string
  target_user_email: string
  target_user_role: string
  started_at: string
  timeout_minutes: number
  remaining_minutes: number
}

/**
 * Action log entry during impersonation
 */
export interface ImpersonationActionLog {
  id: string
  session_id: string
  action_type: 'create' | 'update' | 'delete' | 'other'
  table_name: string
  record_id: string | null
  payload_summary: Record<string, unknown> | null
  executed_at: string
}

/**
 * Recent impersonation entry for quick access
 */
export interface RecentImpersonation {
  target_user_id: string
  target_user_name: string
  target_user_email: string
  target_user_role: string
  target_chapter_name: string
  last_impersonated_at: string
  impersonation_count: number
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to start impersonation
 */
export interface StartImpersonationRequest {
  target_user_id: string
  reason?: string
  timeout_minutes?: ImpersonationTimeout
}

/**
 * Response from starting impersonation
 */
export interface StartImpersonationResponse {
  success: boolean
  session_id?: string
  error?: string
}

/**
 * Response from ending impersonation
 */
export interface EndImpersonationResponse {
  success: boolean
  error?: string
}

// ============================================================================
// User Selection Types
// ============================================================================

/**
 * User available for impersonation (filtered by permissions)
 */
export interface ImpersonatableUser {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role_name: string
  hierarchy_level: number
  chapter_id: string | null
  chapter_name: string | null
  last_active_at: string | null
}

/**
 * Role option for role-based user selection
 */
export interface RoleOption {
  role_name: string
  hierarchy_level: number
  user_count: number
}

/**
 * Filters for user selection
 */
export interface ImpersonationUserFilters {
  role_name?: string
  chapter_id?: string
  search?: string
}

// ============================================================================
// Audit Types
// ============================================================================

/**
 * Impersonation session with full details for audit view
 */
export interface ImpersonationAuditSession extends ImpersonationSession {
  admin_name: string
  admin_email: string
  target_user_name: string
  target_user_email: string
  target_user_role: string
  duration_minutes: number | null
  action_count: number
}

/**
 * Audit log filters
 */
export interface ImpersonationAuditFilters {
  admin_id?: string
  target_user_id?: string
  start_date?: string
  end_date?: string
  has_actions?: boolean
}

/**
 * Analytics summary for impersonation usage
 */
export interface ImpersonationAnalytics {
  total_sessions: number
  total_actions: number
  avg_duration_minutes: number
  most_impersonated_users: {
    user_id: string
    user_name: string
    count: number
  }[]
  sessions_by_admin: {
    admin_id: string
    admin_name: string
    count: number
  }[]
  sessions_by_day: {
    date: string
    count: number
  }[]
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Impersonation context state
 */
export interface ImpersonationState {
  isImpersonating: boolean
  session: ActiveImpersonationSession | null
  adminUserId: string | null
}

/**
 * Impersonation context actions
 */
export interface ImpersonationActions {
  startImpersonation: (
    targetUserId: string,
    reason?: string,
    timeoutMinutes?: ImpersonationTimeout
  ) => Promise<boolean>
  endImpersonation: () => Promise<boolean>
  refreshSession: () => Promise<void>
}

/**
 * Full impersonation context value
 */
export interface ImpersonationContextValue extends ImpersonationState, ImpersonationActions {}

// ============================================================================
// Cookie Types
// ============================================================================

/**
 * Data stored in the impersonation cookie
 */
export interface ImpersonationCookieData {
  session_id: string
  admin_id: string
  target_user_id: string
  expires_at: string
}

export const IMPERSONATION_COOKIE_NAME = 'yi-impersonation-session'
export const IMPERSONATION_COOKIE_MAX_AGE = 60 * 60 * 4 // 4 hours max
