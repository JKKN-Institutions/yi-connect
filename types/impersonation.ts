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
  // Summary stats
  total_sessions: number
  sessions_this_week: number
  sessions_this_month: number
  total_actions: number
  avg_duration_minutes: number
  unique_users_impersonated: number
  active_admins_count: number

  // Top lists
  most_impersonated_users: {
    user_id: string
    user_name: string
    user_email: string
    user_role: string
    count: number
  }[]
  most_active_admins: {
    admin_id: string
    admin_name: string
    admin_email: string
    session_count: number
    total_actions: number
  }[]

  // Time series
  sessions_by_day: {
    date: string
    count: number
    actions: number
  }[]

  // Breakdown by role
  sessions_by_role: {
    role_name: string
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

// ============================================================================
// Export Types
// ============================================================================

/**
 * Supported export formats for audit logs
 */
export type AuditExportFormat = 'csv' | 'json'

/**
 * Query parameters for audit log export
 */
export interface AuditExportParams {
  /** Export format: 'csv' or 'json' */
  format: AuditExportFormat
  /** Start date filter (ISO string) */
  dateFrom?: string
  /** End date filter (ISO string) */
  dateTo?: string
  /** Filter by admin who performed impersonation */
  adminId?: string
  /** Filter by target user who was impersonated */
  targetUserId?: string
  /** Filter by session ID */
  sessionId?: string
  /** Include action details in export */
  includeActions?: boolean
}

/**
 * Flattened session entry for export
 */
export interface SessionExportEntry {
  session_id: string
  admin_id: string
  admin_name: string
  admin_email: string
  target_user_id: string
  target_user_name: string
  target_user_email: string
  target_user_role: string
  reason: string | null
  started_at: string
  ended_at: string | null
  end_reason: string | null
  duration_minutes: number | null
  pages_visited: number
  actions_taken: number
}

/**
 * Action log entry for export
 */
export interface ActionExportEntry {
  action_id: string
  session_id: string
  action_type: string
  resource_type: string
  resource_id: string | null
  action_details: string | null
  executed_at: string
  admin_name: string
  target_user_name: string
}

/**
 * Combined export response
 */
export interface AuditExportResponse {
  sessions: SessionExportEntry[]
  actions?: ActionExportEntry[]
  exportedAt: string
  filters: Partial<AuditExportParams>
}
