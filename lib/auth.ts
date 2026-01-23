/**
 * Authentication Utilities
 *
 * Helper functions for authentication and authorization in Yi Connect.
 * These functions are used in Server Components and Server Actions.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'

/**
 * Get the current authenticated user
 *
 * This function is cached per request to avoid multiple database calls.
 * Returns null if user is not authenticated.
 *
 * Usage:
 * ```typescript
 * const user = await getCurrentUser()
 * if (!user) {
 *   // Handle unauthenticated state
 * }
 * ```
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * Require authentication - redirect to login if not authenticated
 *
 * Use this in pages or layouts that require authentication.
 *
 * Usage:
 * ```typescript
 * export default async function ProtectedPage() {
 *   const user = await requireAuth()
 *   // User is guaranteed to be authenticated here
 * }
 * ```
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

/**
 * Get the current user's chapter ID
 *
 * Returns the chapter_id from the user's member record.
 * Cached per-request using React cache().
 * Returns null if user is not authenticated or has no chapter assigned.
 *
 * Usage:
 * ```typescript
 * const chapterId = await getCurrentChapterId()
 * if (!chapterId) {
 *   // Handle missing chapter
 * }
 * ```
 */
export const getCurrentChapterId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createServerSupabaseClient()

  // chapter_id is stored in the members table, not profiles
  // Note: member.id IS the profile/user id in the members table
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('id', user.id)
    .single()

  return member?.chapter_id || null
})

/**
 * Get user profile with role information
 *
 * Fetches the user's profile including their role and chapter information.
 * Cached per-request using React cache().
 */
export const getUserProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createServerSupabaseClient()

  // Fetch profile and chapter separately to avoid auth.users permission issues
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, chapter:chapters!profiles_chapter_id_fkey(*)')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Use the secure database function to get roles
  // Note: get_user_roles_detailed returns role_id, role_name, hierarchy_level, permissions
  const { data: userRoles } = await supabase.rpc('get_user_roles_detailed', {
    p_user_id: user.id
  })

  return {
    ...profile,
    roles: userRoles || []
  }
})

/**
 * Require specific role(s) - redirect to unauthorized if user doesn't have required role
 *
 * Usage:
 * ```typescript
 * export default async function AdminPage() {
 *   const { user, profile } = await requireRole(['Executive Member', 'National Admin'])
 *   // User has required role here
 * }
 * ```
 */
export async function requireRole(allowedRoles: string[]) {
  console.log('[requireRole] Starting role check for allowed roles:', allowedRoles)

  const user = await requireAuth()
  console.log('[requireRole] User authenticated:', user.id, user.email)

  const supabase = await createServerSupabaseClient()
  console.log('[requireRole] Supabase client created')

  // Use the secure database function to avoid permission errors with auth.users
  const { data: userRoles, error } = await supabase.rpc('get_user_roles_detailed', {
    p_user_id: user.id
  })

  console.log('[requireRole] RPC result - userRoles:', JSON.stringify(userRoles), 'error:', error?.message)

  if (error) {
    console.error('[requireRole] ERROR fetching user roles:', error.message, error.code, error.details)
    redirect('/unauthorized')
  }

  const userRoleNames = userRoles?.map((ur: { role_name: string }) => ur.role_name) || []
  console.log('[requireRole] User role names:', userRoleNames)

  const hasRequiredRole = allowedRoles.some((role: string) => userRoleNames.includes(role))
  console.log('[requireRole] hasRequiredRole:', hasRequiredRole)

  if (!hasRequiredRole) {
    console.log('[requireRole] DENYING ACCESS - no matching role found')
    redirect('/unauthorized')
  }

  console.log('[requireRole] ACCESS GRANTED')
  return { user, roles: userRoleNames }
}

/**
 * Check if user has specific permission
 *
 * Supports both role-based permissions and context-specific permissions
 * (vertical chair, sub-chapter lead).
 *
 * Usage:
 * ```typescript
 * // Basic permission check
 * const canManageEvents = await hasPermission('manage_events')
 *
 * // With context (for vertical-specific permissions)
 * const canAssignTrainers = await hasPermission('assign_trainers', {
 *   verticalId: 'some-vertical-id'
 * })
 *
 * // With sub-chapter context
 * const canManageChapter = await hasPermission('manage_chapter_members', {
 *   subChapterId: 'some-sub-chapter-id'
 * })
 * ```
 */
export async function hasPermission(
  permission: string,
  context?: {
    verticalId?: string
    subChapterId?: string
    stakeholderId?: string
  }
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  const supabase = await createServerSupabaseClient()

  // Get user roles with permissions
  const { data: userRoles, error } = await supabase.rpc('get_user_roles_detailed', {
    p_user_id: user.id
  })

  if (error || !userRoles || userRoles.length === 0) return false

  // Get highest hierarchy level
  const maxHierarchy = Math.max(
    ...userRoles.map((ur: { hierarchy_level: number }) => ur.hierarchy_level)
  )

  // Admin/Executive override - has all permissions
  if (maxHierarchy >= 5) return true

  // Check role-based permissions
  const allPermissions = userRoles.flatMap(
    (ur: { permissions: string[] | null }) => ur.permissions || []
  )
  if (allPermissions.includes(permission)) return true

  // Vertical-specific permissions for vertical chairs
  if (context?.verticalId) {
    const { data: isChair } = await supabase.rpc('is_vertical_chair', {
      p_user_id: user.id,
      p_vertical_id: context.verticalId
    })

    if (isChair) {
      // Vertical chairs have these permissions for their vertical
      const verticalChairPermissions = [
        'view_stakeholders',
        'manage_stakeholders',
        'assign_trainers',
        'approve_materials',
        'view_vertical_dashboard',
        'manage_vertical_activities',
        'view_trainer_reports'
      ]
      if (verticalChairPermissions.includes(permission)) return true
    }
  }

  // Sub-chapter lead permissions
  if (context?.subChapterId) {
    const { data: isLead } = await supabase.rpc('is_sub_chapter_lead', {
      p_user_id: user.id,
      p_sub_chapter_id: context.subChapterId
    })

    if (isLead) {
      const chapterLeadPermissions = [
        'manage_chapter_members',
        'create_chapter_events',
        'view_chapter_reports',
        'mark_attendance',
        'view_chapter_dashboard'
      ]
      if (chapterLeadPermissions.includes(permission)) return true
    }
  }

  // Check if user is any vertical chair (without specific vertical context)
  if (!context?.verticalId) {
    const { data: isAnyChair } = await supabase.rpc('is_vertical_chair', {
      p_user_id: user.id
    })

    if (isAnyChair) {
      // General vertical chair permissions
      const generalChairPermissions = [
        'view_vertical_dashboard',
        'view_trainer_reports'
      ]
      if (generalChairPermissions.includes(permission)) return true
    }
  }

  // Check if user is any sub-chapter lead
  if (!context?.subChapterId) {
    const { data: isAnyLead } = await supabase.rpc('is_sub_chapter_lead', {
      p_user_id: user.id
    })

    if (isAnyLead) {
      const generalLeadPermissions = ['view_chapter_dashboard']
      if (generalLeadPermissions.includes(permission)) return true
    }
  }

  return false
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  permissions: string[],
  context?: {
    verticalId?: string
    subChapterId?: string
    stakeholderId?: string
  }
): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(permission, context)) {
      return true
    }
  }
  return false
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  permissions: string[],
  context?: {
    verticalId?: string
    subChapterId?: string
    stakeholderId?: string
  }
): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermission(permission, context))) {
      return false
    }
  }
  return true
}

/**
 * Get user's hierarchy level (cached)
 */
export const getUserHierarchyLevel = cache(async (): Promise<number> => {
  const user = await getCurrentUser()
  if (!user) return 0

  const supabase = await createServerSupabaseClient()

  const { data: userRoles } = await supabase.rpc('get_user_roles_detailed', {
    p_user_id: user.id
  })

  if (!userRoles || userRoles.length === 0) return 0

  return Math.max(
    ...userRoles.map((ur: { hierarchy_level: number }) => ur.hierarchy_level)
  )
})

/**
 * Sign out the current user
 *
 * Usage:
 * ```typescript
 * 'use server'
 * export async function signOut() {
 *   await logout()
 * }
 * ```
 */
export async function logout() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Get the current user's member ID
 *
 * Returns the member ID (which equals the user ID in our schema).
 * Cached per-request using React cache().
 * Returns null if user is not authenticated.
 *
 * Usage:
 * ```typescript
 * const memberId = await getCurrentMemberId()
 * if (!memberId) {
 *   // Handle unauthenticated state
 * }
 * ```
 */
export const getCurrentMemberId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) return null
  return user.id
})

/**
 * Get the effective user ID (handles impersonation)
 *
 * Returns the impersonated user's ID if currently impersonating,
 * otherwise returns the actual authenticated user's ID.
 *
 * Use this in data fetching where you want to respect impersonation context.
 *
 * Usage:
 * ```typescript
 * const effectiveUserId = await getEffectiveUserId()
 * // Use this for data queries that should show impersonated user's data
 * ```
 */
export const getEffectiveUserId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  // Check for impersonation session
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const impersonationCookie = cookieStore.get('yi-impersonation-session')

    if (impersonationCookie?.value) {
      const sessionData = JSON.parse(impersonationCookie.value)

      // Verify the session belongs to current user and hasn't expired
      if (
        sessionData.admin_id === user.id &&
        new Date(sessionData.expires_at) > new Date()
      ) {
        return sessionData.target_user_id
      }
    }
  } catch {
    // If cookie parsing fails, return actual user
  }

  return user.id
})

/**
 * Check if the current session is impersonating
 *
 * Returns details about the impersonation if active.
 */
export async function getImpersonationInfo(): Promise<{
  isImpersonating: boolean
  adminId: string | null
  targetUserId: string | null
}> {
  const user = await getCurrentUser()
  if (!user) {
    return { isImpersonating: false, adminId: null, targetUserId: null }
  }

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const impersonationCookie = cookieStore.get('yi-impersonation-session')

    if (impersonationCookie?.value) {
      const sessionData = JSON.parse(impersonationCookie.value)

      if (
        sessionData.admin_id === user.id &&
        new Date(sessionData.expires_at) > new Date()
      ) {
        return {
          isImpersonating: true,
          adminId: sessionData.admin_id,
          targetUserId: sessionData.target_user_id,
        }
      }
    }
  } catch {
    // Cookie parsing failed
  }

  return { isImpersonating: false, adminId: null, targetUserId: null }
}
