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
  const { data: member } = await supabase
    .from('members')
    .select('chapter_id')
    .eq('profile_id', user.id)
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
    .select('*, chapter:chapters(*)')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  // Use the secure database function to get roles
  const { data: userRoles } = await supabase.rpc('get_user_roles', {
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
  const user = await requireAuth()
  const supabase = await createServerSupabaseClient()

  // Use the secure database function to avoid permission errors with auth.users
  const { data: userRoles, error } = await supabase.rpc('get_user_roles', {
    p_user_id: user.id
  })

  if (error) {
    console.error('Error fetching user roles:', error)
    redirect('/unauthorized')
  }

  const userRoleNames = userRoles?.map((ur: { role_name: string }) => ur.role_name) || []
  const hasRequiredRole = allowedRoles.some((role: string) => userRoleNames.includes(role))

  if (!hasRequiredRole) {
    redirect('/unauthorized')
  }

  return { user, roles: userRoleNames }
}

/**
 * Check if user has specific permission
 *
 * Usage:
 * ```typescript
 * const canManageEvents = await hasPermission('manage_events')
 * ```
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  const supabase = await createServerSupabaseClient()

  // Use the secure database function to avoid permission errors
  const { data: userRoles } = await supabase.rpc('get_user_roles', {
    p_user_id: user.id
  })

  if (!userRoles) return false

  // For now, we don't have permissions column in the function result
  // This would need to be enhanced if permission-based checks are needed
  // For basic role checking, use requireRole() instead
  return false
}

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
