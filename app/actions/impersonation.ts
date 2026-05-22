/**
 * Impersonation Server Actions
 *
 * Server actions for the user impersonation system.
 * Only National Admin (level 6) and Super Admin (level 7) can use these.
 *
 * ## Action Logging Integration Guide
 *
 * Other server actions should integrate impersonation logging to track
 * all changes made during impersonation sessions for audit purposes.
 *
 * ### Server Action Integration (Recommended)
 *
 * Add logging at the end of your mutation actions:
 *
 * ```typescript
 * import { logImpersonationAction } from '@/app/actions/impersonation'
 *
 * export async function createEvent(data: CreateEventData) {
 *   // Perform the mutation
 *   const supabase = await createServerSupabaseClient()
 *   const { data: event, error } = await supabase
 *     .from('events')
 *     .insert(data)
 *     .select()
 *     .single()
 *
 *   if (error) throw error
 *
 *   // Log the action (safe to call - no-op if not impersonating)
 *   await logImpersonationAction({
 *     action_type: 'create',
 *     affected_resource_type: 'events',
 *     affected_resource_id: event.id,
 *     action_details: {
 *       title: data.title,
 *       start_date: data.start_date,
 *     }
 *   })
 *
 *   return event
 * }
 * ```
 *
 * ### Client Component Integration
 *
 * Use the `useImpersonationLogging` hook for client-side logging:
 *
 * ```tsx
 * import { useImpersonationLogging } from '@/hooks/use-impersonation-logging'
 *
 * function EventForm() {
 *   const { logAction, isImpersonating } = useImpersonationLogging()
 *
 *   const handleSubmit = async (data) => {
 *     const result = await createEvent(data)
 *     // Hook auto-captures route context
 *     logAction('create', { title: data.title }, 'events', result.id)
 *   }
 * }
 * ```
 *
 * ### Best Practices
 *
 * 1. Log AFTER successful mutations, not before
 * 2. Include enough detail to understand what changed
 * 3. Don't include sensitive data (passwords, tokens)
 * 4. Use descriptive action_type: 'create', 'update', 'delete', 'view', 'export'
 * 5. Always include affected_resource_type for filtering
 */

'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserHierarchyLevel } from '@/lib/auth'
import {
  type ImpersonationTimeout,
  type StartImpersonationResponse,
  type EndImpersonationResponse,
  type ImpersonationCookieData,
  IMPERSONATION_COOKIE_NAME,
} from '@/types/impersonation'

// Minimum hierarchy level to impersonate (National Admin)
const MIN_IMPERSONATION_LEVEL = 6

export interface ActionResponse {
  success: boolean
  message?: string
  errors?: Record<string, string[]>
}

/**
 * Check if current user can impersonate
 */
async function requireImpersonationPermission() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized: Please log in')
  }

  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < MIN_IMPERSONATION_LEVEL) {
    throw new Error('Unauthorized: National Admin or Super Admin access required')
  }

  return { user, hierarchyLevel }
}

/**
 * Start impersonating a user
 *
 * Creates an impersonation session and sets the impersonation cookie.
 */
export async function startImpersonation(
  targetUserId: string,
  reason?: string,
  timeoutMinutes: ImpersonationTimeout = 30
): Promise<StartImpersonationResponse> {
  try {
    // Verify admin permissions
    const { user } = await requireImpersonationPermission()

    // Validate target user exists
    const supabase = await createServerSupabaseClient()

    // Check if we can impersonate this user using DB function
    const { data: canImpersonate, error: checkError } = await supabase.rpc(
      'can_impersonate_user',
      {
        impersonator_id: user.id,
        target_id: targetUserId,
      }
    )

    if (checkError) {
      console.error('Error checking impersonation permission:', checkError)
      return { success: false, error: 'Failed to verify impersonation permissions' }
    }

    if (!canImpersonate) {
      return {
        success: false,
        error: 'Cannot impersonate this user. You can only impersonate users with a lower hierarchy level.',
      }
    }

    // Start impersonation session via DB function
    const { data: sessionId, error: startError } = await supabase.rpc(
      'start_impersonation',
      {
        p_admin_id: user.id,
        p_target_user_id: targetUserId,
        p_reason: reason || null,
        p_timeout_minutes: timeoutMinutes,
      }
    )

    if (startError) {
      console.error('Error starting impersonation:', startError)
      return { success: false, error: startError.message }
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString()

    // Set impersonation cookie
    const cookieData: ImpersonationCookieData = {
      session_id: sessionId,
      admin_id: user.id,
      target_user_id: targetUserId,
      expires_at: expiresAt,
    }

    const cookieStore = await cookies()
    cookieStore.set(IMPERSONATION_COOKIE_NAME, JSON.stringify(cookieData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: timeoutMinutes * 60,
    })

    // Invalidate relevant caches
    updateTag('impersonation')

    return { success: true, session_id: sessionId }
  } catch (error) {
    console.error('Start impersonation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * End the current impersonation session
 */
export async function endImpersonation(): Promise<EndImpersonationResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get impersonation cookie
    const cookieStore = await cookies()
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME)

    if (!impersonationCookie?.value) {
      return { success: false, error: 'No active impersonation session' }
    }

    let cookieData: ImpersonationCookieData
    try {
      cookieData = JSON.parse(impersonationCookie.value)
    } catch {
      // Invalid cookie, just delete it
      cookieStore.delete(IMPERSONATION_COOKIE_NAME)
      return { success: true }
    }

    // Verify this session belongs to current admin
    if (cookieData.admin_id !== user.id) {
      cookieStore.delete(IMPERSONATION_COOKIE_NAME)
      return { success: false, error: 'Session mismatch' }
    }

    // End session in database
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.rpc('end_impersonation', {
      p_session_id: cookieData.session_id,
      p_admin_id: user.id,
      p_reason: 'manual',
    })

    if (error) {
      console.error('Error ending impersonation:', error)
    }

    // Delete impersonation cookie
    cookieStore.delete(IMPERSONATION_COOKIE_NAME)

    // Invalidate relevant caches
    updateTag('impersonation')

    return { success: true }
  } catch (error) {
    console.error('End impersonation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Get the current impersonation session from cookie
 *
 * Returns null if not impersonating or session is invalid/expired.
 */
export async function getImpersonationSession(): Promise<ImpersonationCookieData | null> {
  try {
    const cookieStore = await cookies()
    const impersonationCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME)

    if (!impersonationCookie?.value) {
      return null
    }

    const cookieData: ImpersonationCookieData = JSON.parse(impersonationCookie.value)

    // Check if expired
    if (new Date(cookieData.expires_at) < new Date()) {
      // Cookie expired, clean up
      cookieStore.delete(IMPERSONATION_COOKIE_NAME)
      return null
    }

    return cookieData
  } catch {
    return null
  }
}

/**
 * Get the effective user ID (impersonated user if impersonating, otherwise actual user)
 *
 * This should be used in data fetching layers to apply proper RLS context.
 */
export async function getEffectiveUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const session = await getImpersonationSession()
  if (session && session.admin_id === user.id) {
    return session.target_user_id
  }

  return user.id
}

/**
 * Check if currently impersonating
 */
export async function isImpersonating(): Promise<boolean> {
  const session = await getImpersonationSession()
  return session !== null
}

/**
 * Action types for impersonation logging
 */
export type ImpersonationActionType = 'create' | 'update' | 'delete' | 'view' | 'export' | 'other'

/**
 * Parameters for logging an impersonation action
 */
export interface LogActionParams {
  /** Type of action performed */
  action_type: ImpersonationActionType
  /** Additional details about the action (e.g., { eventName: '...', oldStatus: '...', newStatus: '...' }) */
  action_details?: Record<string, unknown>
  /** Resource type affected (e.g., 'members', 'events', 'finances') */
  affected_resource_type: string
  /** ID of the affected record (optional for list views or exports) */
  affected_resource_id?: string
}

/**
 * Log an action during impersonation
 *
 * Called by other server actions when mutations occur during impersonation.
 * This function is safe to call even when not impersonating - it will simply return early.
 *
 * @example
 * ```typescript
 * // In your server action after a successful mutation:
 * import { logImpersonationAction } from '@/app/actions/impersonation'
 *
 * export async function createEvent(data: CreateEventData) {
 *   // ... perform the create ...
 *   const newEvent = await supabase.from('events').insert(data).select().single()
 *
 *   // Log the action (safe to call, no-op if not impersonating)
 *   await logImpersonationAction({
 *     action_type: 'create',
 *     affected_resource_type: 'events',
 *     affected_resource_id: newEvent.id,
 *     action_details: { title: data.title, date: data.start_date }
 *   })
 *
 *   return newEvent
 * }
 * ```
 */
export async function logImpersonationAction(
  params: LogActionParams
): Promise<void>
/**
 * @deprecated Use object parameter format instead
 */
export async function logImpersonationAction(
  actionType: ImpersonationActionType,
  tableName: string,
  recordId?: string,
  payloadSummary?: Record<string, unknown>
): Promise<void>
export async function logImpersonationAction(
  paramsOrActionType: LogActionParams | ImpersonationActionType,
  tableName?: string,
  recordId?: string,
  payloadSummary?: Record<string, unknown>
): Promise<void> {
  try {
    const session = await getImpersonationSession()
    if (!session) return

    // Handle both old and new call signatures
    let actionType: ImpersonationActionType
    let resourceType: string
    let resourceId: string | undefined
    let details: Record<string, unknown> | undefined

    if (typeof paramsOrActionType === 'object') {
      // New object-based signature
      actionType = paramsOrActionType.action_type
      resourceType = paramsOrActionType.affected_resource_type
      resourceId = paramsOrActionType.affected_resource_id
      details = paramsOrActionType.action_details
    } else {
      // Legacy positional signature
      actionType = paramsOrActionType
      resourceType = tableName!
      resourceId = recordId
      details = payloadSummary
    }

    // Map 'view' and 'export' to 'other' for DB compatibility
    const dbActionType = ['view', 'export'].includes(actionType) ? 'other' : actionType

    const supabase = await createServerSupabaseClient()
    await supabase.rpc('log_impersonation_action', {
      p_session_id: session.session_id,
      p_action_type: dbActionType,
      p_table_name: resourceType,
      p_record_id: resourceId || null,
      p_payload_summary: details ? { ...details, original_action_type: actionType } : null,
    })
  } catch (error) {
    // Don't fail the main action if logging fails
    console.error('Failed to log impersonation action:', error)
  }
}

/**
 * Check if there's an active impersonation and return session details
 *
 * Useful for components that want to conditionally show impersonation info
 * without making repeated cookie checks.
 */
export async function getActiveImpersonationDetails(): Promise<{
  isActive: boolean
  sessionId: string | null
  adminId: string | null
  targetUserId: string | null
  expiresAt: Date | null
}> {
  const session = await getImpersonationSession()

  if (!session) {
    return {
      isActive: false,
      sessionId: null,
      adminId: null,
      targetUserId: null,
      expiresAt: null,
    }
  }

  return {
    isActive: true,
    sessionId: session.session_id,
    adminId: session.admin_id,
    targetUserId: session.target_user_id,
    expiresAt: new Date(session.expires_at),
  }
}

/**
 * Extend the current impersonation session
 *
 * Adds more time to the session timeout.
 */
export async function extendImpersonationSession(
  additionalMinutes: ImpersonationTimeout
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, message: 'Not authenticated' }
    }

    const session = await getImpersonationSession()
    if (!session || session.admin_id !== user.id) {
      return { success: false, message: 'No active impersonation session' }
    }

    // Calculate new expiry
    const currentExpiry = new Date(session.expires_at)
    const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000)

    // Update cookie with new expiry
    const cookieData: ImpersonationCookieData = {
      ...session,
      expires_at: newExpiry.toISOString(),
    }

    const cookieStore = await cookies()
    const remainingSeconds = Math.floor((newExpiry.getTime() - Date.now()) / 1000)

    cookieStore.set(IMPERSONATION_COOKIE_NAME, JSON.stringify(cookieData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: remainingSeconds,
    })

    // Update session in database
    const supabase = await createServerSupabaseClient()
    await supabase
      .from('impersonation_sessions')
      .update({
        timeout_minutes: Math.floor((newExpiry.getTime() - new Date(session.expires_at).getTime() + session.session_id ? additionalMinutes : 0) / 60000) + additionalMinutes,
      })
      .eq('id', session.session_id)

    return { success: true, message: `Session extended by ${additionalMinutes} minutes` }
  } catch (error) {
    console.error('Extend impersonation error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
