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
  ImpersonationAnalytics,
} from '@/types/impersonation'

/**
 * Get the active impersonation session for the current admin
 *
 * Cached per-request using React cache().
 */
export const getActiveImpersonationSession = cache(
  async (): Promise<ActiveImpersonationSession | null> => {
    try {
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
    } catch (err) {
      console.error('Unexpected error in getActiveImpersonationSession:', err)
      return null
    }
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
 * Get users with the same role for role cycling in impersonation banner
 *
 * Returns users ordered by name for easy navigation.
 * Note: Not wrapped in cache() due to dynamic parameters.
 */
export async function getUsersForRoleCycling(
  roleName: string,
  currentUserId: string
): Promise<{ users: { id: string; name: string }[]; currentIndex: number }> {
  const user = await getCurrentUser()
  if (!user) return { users: [], currentIndex: 0 }

  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < 6) return { users: [], currentIndex: 0 }

  const supabase = await createServerSupabaseClient()

  // Get all users with this role who have lower hierarchy level than admin
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      user_roles!inner (
        role:roles!inner (
          name,
          hierarchy_level
        )
      )
    `)
    .neq('id', user.id) // Exclude admin
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching role cycle users:', error)
    return { users: [], currentIndex: 0 }
  }

  // Filter users by role and hierarchy level
  const users: { id: string; name: string }[] = []

  for (const profile of data || []) {
    const userRoles = profile.user_roles as unknown as Array<{ role: { name: string; hierarchy_level: number } }>
    if (!userRoles || userRoles.length === 0) continue

    // Check if user has the target role
    const hasTargetRole = userRoles.some((r) => r.role.name === roleName)
    if (!hasTargetRole) continue

    // Get highest role to check hierarchy
    const highestRole = userRoles.reduce((max, r) =>
      r.role.hierarchy_level > max.role.hierarchy_level ? r : max
    )

    // Only include users with lower hierarchy level
    if (highestRole.role.hierarchy_level >= hierarchyLevel) continue

    users.push({
      id: profile.id,
      name: profile.full_name || 'Unknown',
    })
  }

  // Find current index
  const currentIndex = users.findIndex((u) => u.id === currentUserId)

  return { users, currentIndex: currentIndex >= 0 ? currentIndex : 0 }
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

/**
 * Get impersonation analytics data
 *
 * Aggregates session data for analytics dashboard.
 * Note: Not wrapped in cache() due to time-sensitive calculations.
 */
export async function getImpersonationAnalytics(): Promise<ImpersonationAnalytics | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const hierarchyLevel = await getUserHierarchyLevel()
  if (hierarchyLevel < 6) return null

  const supabase = await createServerSupabaseClient()

  // Calculate date boundaries
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  // Fetch all sessions
  const { data: allSessions, error: sessionsError } = await supabase
    .from('impersonation_sessions')
    .select(`
      id,
      admin_id,
      target_user_id,
      started_at,
      ended_at,
      actions_taken,
      admin:profiles!impersonation_sessions_admin_id_fkey (
        full_name,
        email
      ),
      target:profiles!impersonation_sessions_target_user_id_fkey (
        full_name,
        email
      )
    `)
    .order('started_at', { ascending: false })

  if (sessionsError) {
    console.error('Error fetching sessions for analytics:', sessionsError)
    return null
  }

  const sessions = allSessions || []

  // Calculate summary stats
  const totalSessions = sessions.length
  const sessionsThisWeek = sessions.filter(
    (s) => new Date(s.started_at) >= startOfWeek
  ).length
  const sessionsThisMonth = sessions.filter(
    (s) => new Date(s.started_at) >= startOfMonth
  ).length
  const totalActions = sessions.reduce((sum, s) => sum + (s.actions_taken || 0), 0)

  // Calculate average duration (only for ended sessions)
  const completedSessions = sessions.filter((s) => s.ended_at)
  const avgDuration =
    completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => {
          const start = new Date(s.started_at).getTime()
          const end = new Date(s.ended_at!).getTime()
          return sum + (end - start) / 60000
        }, 0) / completedSessions.length
      : 0

  // Unique users impersonated
  const uniqueTargetIds = new Set(sessions.map((s) => s.target_user_id))
  const uniqueAdminIds = new Set(sessions.map((s) => s.admin_id))

  // Most impersonated users (top 10)
  const userCounts = new Map<string, { count: number; user: { full_name: string; email: string } | null }>()
  for (const session of sessions) {
    const existing = userCounts.get(session.target_user_id)
    if (existing) {
      existing.count++
    } else {
      userCounts.set(session.target_user_id, {
        count: 1,
        user: session.target as unknown as { full_name: string; email: string } | null,
      })
    }
  }

  // Get roles for most impersonated users
  const topUserIds = [...userCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([id]) => id)

  // Fetch roles for top users
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role:roles (name)
    `)
    .in('user_id', topUserIds)

  const userRoleMap = new Map<string, string>()
  for (const ur of userRoles || []) {
    const roleData = ur.role as unknown as { name: string } | { name: string }[] | null
    let roleName = 'Member'
    if (Array.isArray(roleData)) {
      roleName = roleData[0]?.name || 'Member'
    } else if (roleData) {
      roleName = roleData.name || 'Member'
    }
    userRoleMap.set(ur.user_id, roleName)
  }

  const mostImpersonatedUsers = [...userCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([userId, data]) => ({
      user_id: userId,
      user_name: data.user?.full_name || 'Unknown',
      user_email: data.user?.email || '',
      user_role: userRoleMap.get(userId) || 'Member',
      count: data.count,
    }))

  // Most active admins (top 10)
  const adminStats = new Map<
    string,
    { sessionCount: number; totalActions: number; admin: { full_name: string; email: string } | null }
  >()
  for (const session of sessions) {
    const existing = adminStats.get(session.admin_id)
    if (existing) {
      existing.sessionCount++
      existing.totalActions += session.actions_taken || 0
    } else {
      adminStats.set(session.admin_id, {
        sessionCount: 1,
        totalActions: session.actions_taken || 0,
        admin: session.admin as unknown as { full_name: string; email: string } | null,
      })
    }
  }

  const mostActiveAdmins = [...adminStats.entries()]
    .sort((a, b) => b[1].sessionCount - a[1].sessionCount)
    .slice(0, 10)
    .map(([adminId, data]) => ({
      admin_id: adminId,
      admin_name: data.admin?.full_name || 'Unknown',
      admin_email: data.admin?.email || '',
      session_count: data.sessionCount,
      total_actions: data.totalActions,
    }))

  // Sessions by day (last 30 days)
  const recentSessions = sessions.filter(
    (s) => new Date(s.started_at) >= thirtyDaysAgo
  )

  const dailyMap = new Map<string, { count: number; actions: number }>()

  // Initialize all 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    dailyMap.set(dateStr, { count: 0, actions: 0 })
  }

  // Fill in actual data
  for (const session of recentSessions) {
    const dateStr = session.started_at.split('T')[0]
    const existing = dailyMap.get(dateStr)
    if (existing) {
      existing.count++
      existing.actions += session.actions_taken || 0
    }
  }

  const sessionsByDay = [...dailyMap.entries()]
    .map(([date, data]) => ({
      date,
      count: data.count,
      actions: data.actions,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Sessions by role
  const roleCountMap = new Map<string, number>()
  for (const user of mostImpersonatedUsers) {
    const existing = roleCountMap.get(user.user_role) || 0
    roleCountMap.set(user.user_role, existing + user.count)
  }

  // For sessions not in top 10 users, we need to aggregate by role
  // Get all session target roles
  const allTargetIds = [...uniqueTargetIds]
  const { data: allUserRoles } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role:roles (name)
    `)
    .in('user_id', allTargetIds)

  const allUserRoleMap = new Map<string, string>()
  for (const ur of allUserRoles || []) {
    const roleData = ur.role as unknown as { name: string } | { name: string }[] | null
    let roleName = 'Member'
    if (Array.isArray(roleData)) {
      roleName = roleData[0]?.name || 'Member'
    } else if (roleData) {
      roleName = roleData.name || 'Member'
    }
    allUserRoleMap.set(ur.user_id, roleName)
  }

  // Recalculate by role with all users
  const fullRoleCountMap = new Map<string, number>()
  for (const session of sessions) {
    const role = allUserRoleMap.get(session.target_user_id) || 'Member'
    const existing = fullRoleCountMap.get(role) || 0
    fullRoleCountMap.set(role, existing + 1)
  }

  const sessionsByRole = [...fullRoleCountMap.entries()]
    .map(([role_name, count]) => ({
      role_name,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    total_sessions: totalSessions,
    sessions_this_week: sessionsThisWeek,
    sessions_this_month: sessionsThisMonth,
    total_actions: totalActions,
    avg_duration_minutes: Math.round(avgDuration * 10) / 10,
    unique_users_impersonated: uniqueTargetIds.size,
    active_admins_count: uniqueAdminIds.size,
    most_impersonated_users: mostImpersonatedUsers,
    most_active_admins: mostActiveAdmins,
    sessions_by_day: sessionsByDay,
    sessions_by_role: sessionsByRole,
  }
}
