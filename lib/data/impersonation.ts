/**
 * Impersonation Data Layer
 *
 * Cached data fetching functions for the impersonation system.
 * Uses React cache() for request-level deduplication.
 *
 * Note: We don't use Next.js 16's 'use cache' directive here because
 * impersonation data depends on cookies for auth. React's cache()
 * provides request-level deduplication.
 */

import 'server-only'

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserHierarchyLevel } from '@/lib/auth'
import type {
  ActiveImpersonationSession,
  RecentImpersonation,
  ImpersonatableUser,
  RoleOption,
  ImpersonationAuditSession,
  ImpersonationAuditFilters,
  ImpersonationActionLog,
} from '@/types/impersonation'

/**
 * Get the active impersonation session for the current admin
 *
 * Cached per-request using React cache().
 */
export const getActiveImpersonationSession = cache(
  async (): Promise<ActiveImpersonationSession | null> => {
    const user = await getCurrentUser()
    if (!user) return null

    const hierarchyLevel = await getUserHierarchyLevel()
    if (hierarchyLevel < 6) return null

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.rpc('get_active_impersonation', {
      p_admin_id: user.id,
    })

    if (error) {
      console.error('Error fetching active impersonation:', error)
      return null
    }

    if (!data || data.length === 0) return null

    return data[0] as ActiveImpersonationSession
  }
)

/**
 * Get recent impersonations for quick access dropdown
 *
 * Cached per-request using React cache().
 */
export const getRecentImpersonations = cache(
  async (limit: number = 10): Promise<RecentImpersonation[]> => {
    const user = await getCurrentUser()
    if (!user) return []

    const hierarchyLevel = await getUserHierarchyLevel()
    if (hierarchyLevel < 6) return []

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.rpc('get_recent_impersonations', {
      p_admin_id: user.id,
      p_limit: limit,
    })

    if (error) {
      console.error('Error fetching recent impersonations:', error)
      return []
    }

    return (data || []) as RecentImpersonation[]
  }
)

/**
 * Get users available for impersonation
 *
 * Returns users with hierarchy level lower than the current admin.
 * Cached per-request using React cache().
 */
export async function getImpersonatableUsers(
  filters?: {
    role_name?: string
    chapter_id?: string
    search?: string
  },
  page: number = 1,
  pageSize: number = 20
): Promise<{ users: ImpersonatableUser[]; total: number }> {
  const user = await getCurrentUser()
  if (!user) return { users: [], total: 0 }

  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < 6) return { users: [], total: 0 }

  const supabase = await createServerSupabaseClient()

  // Build query for users with roles below current hierarchy level
  let query = supabase
    .from('profiles')
    .select(
      `
      id,
      full_name,
      email,
      avatar_url,
      members!inner (
        chapter_id,
        chapter:chapters (
          id,
          name
        )
      ),
      user_roles!inner (
        role:roles (
          name,
          hierarchy_level
        )
      )
    `,
      { count: 'exact' }
    )
    .neq('id', user.id) // Exclude self

  // Apply search filter
  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
  }

  // Apply chapter filter
  if (filters?.chapter_id) {
    query = query.eq('members.chapter_id', filters.chapter_id)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching impersonatable users:', error)
    return { users: [], total: 0 }
  }

  // Transform and filter by hierarchy level
  const users: ImpersonatableUser[] = []

  for (const profile of data || []) {
    // Get highest role for user
    const userRoles = profile.user_roles as unknown as Array<{ role: { name: string; hierarchy_level: number } }>
    if (!userRoles || userRoles.length === 0) continue

    const highestRole = userRoles.reduce((max, r) =>
      r.role.hierarchy_level > max.role.hierarchy_level ? r : max
    )

    // Filter by role if specified
    if (filters?.role_name && highestRole.role.name !== filters.role_name) continue

    // Only include users with lower hierarchy level
    if (highestRole.role.hierarchy_level >= hierarchyLevel) continue

    const member = profile.members as unknown as { chapter_id: string; chapter: { id: string; name: string } | null }

    users.push({
      id: profile.id,
      full_name: profile.full_name || 'Unknown',
      email: profile.email || '',
      avatar_url: profile.avatar_url,
      role_name: highestRole.role.name,
      hierarchy_level: highestRole.role.hierarchy_level,
      chapter_id: member?.chapter_id || null,
      chapter_name: member?.chapter?.name || null,
      last_active_at: null, // Would need separate query
    })
  }

  return { users, total: count || 0 }
}

/**
 * Get role options with user counts for role-based selection
 *
 * Cached per-request using React cache().
 */
export const getRoleOptionsForImpersonation = cache(
  async (): Promise<RoleOption[]> => {
    const user = await getCurrentUser()
    if (!user) return []

    const hierarchyLevel = await getUserHierarchyLevel()
    if (hierarchyLevel < 6) return []

    const supabase = await createServerSupabaseClient()

    // Get roles with counts, excluding roles at or above current level
    const { data, error } = await supabase
      .from('roles')
      .select('name, hierarchy_level')
      .lt('hierarchy_level', hierarchyLevel)
      .order('hierarchy_level', { ascending: false })

    if (error) {
      console.error('Error fetching role options:', error)
      return []
    }

    // Get user counts per role
    const roleOptions: RoleOption[] = []

    for (const role of data || []) {
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', role.name) // This needs role_id, not name

      roleOptions.push({
        role_name: role.name,
        hierarchy_level: role.hierarchy_level,
        user_count: count || 0,
      })
    }

    return roleOptions
  }
)

/**
 * Get impersonation sessions for audit viewer
 *
 * Note: Not wrapped in cache() due to dynamic filter parameters
 */
export async function getImpersonationAuditSessions(
  filters?: ImpersonationAuditFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<{ sessions: ImpersonationAuditSession[]; total: number }> {
  const user = await getCurrentUser()
  if (!user) return { sessions: [], total: 0 }

  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < 6) return { sessions: [], total: 0 }

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('impersonation_sessions')
    .select(
      `
      *,
      admin:profiles!impersonation_sessions_admin_id_fkey (
        full_name,
        email
      ),
      target:profiles!impersonation_sessions_target_user_id_fkey (
        full_name,
        email
      )
    `,
      { count: 'exact' }
    )
    .order('started_at', { ascending: false })

  // Apply filters
  if (filters?.admin_id) {
    query = query.eq('admin_id', filters.admin_id)
  }

  if (filters?.target_user_id) {
    query = query.eq('target_user_id', filters.target_user_id)
  }

  if (filters?.start_date) {
    query = query.gte('started_at', filters.start_date)
  }

  if (filters?.end_date) {
    query = query.lte('started_at', filters.end_date)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching audit sessions:', error)
    return { sessions: [], total: 0 }
  }

  // Transform data
  const sessions: ImpersonationAuditSession[] = (data || []).map((session) => {
    const admin = session.admin as { full_name: string; email: string } | null
    const target = session.target as { full_name: string; email: string } | null

    // Calculate duration if session ended
    let durationMinutes: number | null = null
    if (session.ended_at) {
      const start = new Date(session.started_at).getTime()
      const end = new Date(session.ended_at).getTime()
      durationMinutes = Math.round((end - start) / 60000)
    }

    return {
      ...session,
      admin_name: admin?.full_name || 'Unknown',
      admin_email: admin?.email || '',
      target_user_name: target?.full_name || 'Unknown',
      target_user_email: target?.email || '',
      target_user_role: '', // Would need additional query
      duration_minutes: durationMinutes,
      action_count: session.actions_taken,
    }
  })

  return { sessions, total: count || 0 }
}

/**
 * Get action log for a specific impersonation session
 *
 * Note: Not wrapped in cache() due to dynamic sessionId parameter
 */
export async function getImpersonationActionLog(
  sessionId: string
): Promise<ImpersonationActionLog[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < 6) return []

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('impersonation_action_log')
    .select('*')
    .eq('session_id', sessionId)
    .order('executed_at', { ascending: true })

  if (error) {
    console.error('Error fetching action log:', error)
    return []
  }

  return (data || []) as ImpersonationActionLog[]
}

/**
 * Get user details for impersonation target display
 *
 * Note: Not wrapped in cache() due to dynamic userId parameter
 */
export async function getImpersonationTargetDetails(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      full_name,
      email,
      avatar_url,
      user_roles (
        role:roles (
          name,
          hierarchy_level
        )
      ),
      members (
        chapter:chapters (
          name
        )
      )
    `
    )
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return null
  }

  const roles = profile.user_roles as unknown as Array<{ role: { name: string; hierarchy_level: number } }>
  const highestRole = roles?.reduce((max, r) =>
    r.role.hierarchy_level > max.role.hierarchy_level ? r : max
  , roles[0])

  const member = profile.members as unknown as { chapter: { name: string } | null } | null

  return {
    id: profile.id,
    name: profile.full_name || 'Unknown',
    email: profile.email || '',
    avatar_url: profile.avatar_url,
    role: highestRole?.role.name || 'Member',
    chapter: member?.chapter?.name || null,
  }
}
