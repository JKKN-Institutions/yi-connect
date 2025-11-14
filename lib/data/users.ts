/**
 * User Management Data Layer
 *
 * Cached data fetching functions for admin user management.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  UserListItem,
  UserFull,
  UserQueryParams,
  PaginatedUsers,
  UserStats,
  UserRoleChangeInfo,
  RoleInfo,
  AvailableRole
} from '@/types/user'

// ============================================================================
// User Queries
// ============================================================================

/**
 * Get paginated user list with filters and sorting
 */
export const getUsers = cache(
  async (params: UserQueryParams = {}): Promise<PaginatedUsers> => {
    const supabase = await createServerSupabaseClient()
    const { page = 1, pageSize = 20, filters = {}, sort } = params

    // Base query with profile and chapter info
    let query = supabase
      .from('profiles')
      .select(
        `
        id,
        email,
        full_name,
        avatar_url,
        phone,
        chapter_id,
        created_at,
        updated_at,
        approved_at,
        approved_by,
        chapter:chapters(
          id,
          name,
          location
        )
      `,
        { count: 'exact' }
      )

    // Apply filters
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
      )
    }

    if (filters.chapter_id) {
      query = query.eq('chapter_id', filters.chapter_id)
    }

    // Apply sorting
    if (sort) {
      const { field, direction } = sort
      if (field === 'chapter') {
        // Can't sort by nested field directly, would need a separate query or view
        query = query.order('created_at', { ascending: direction === 'asc' })
      } else {
        query = query.order(field, { ascending: direction === 'asc' })
      }
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    // Fetch roles for all users
    const userIds = (data || []).map((u: any) => u.id)
    const rolesMap = new Map<string, RoleInfo[]>()

    if (userIds.length > 0) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select(
          `
          id,
          user_id,
          role_id,
          created_at,
          roles!inner(
            id,
            name,
            hierarchy_level,
            permissions
          )
        `
        )
        .in('user_id', userIds)

      // Group roles by user_id
      userRoles?.forEach((ur: any) => {
        const roleInfo: RoleInfo = {
          id: ur.id,
          role_id: ur.role_id,
          role_name: ur.roles.name,
          hierarchy_level: ur.roles.hierarchy_level,
          permissions: ur.roles.permissions || [],
          assigned_at: ur.created_at,
          assigned_by: null // Would need to query user_role_changes for this
        }

        if (!rolesMap.has(ur.user_id)) {
          rolesMap.set(ur.user_id, [])
        }
        rolesMap.get(ur.user_id)!.push(roleInfo)
      })
    }

    // Check if users have member records
    const { data: memberRecords } = await supabase
      .from('members')
      .select('id')
      .in('id', userIds)

    const memberIds = new Set(memberRecords?.map((m) => m.id) || [])

    // Check if users are active (via approved_emails)
    const { data: approvedEmails } = await supabase
      .from('approved_emails')
      .select('email, is_active')
      .in(
        'email',
        (data || []).map((u: any) => u.email)
      )

    const activeEmailsMap = new Map(
      approvedEmails?.map((ae) => [ae.email, ae.is_active]) || []
    )

    // Transform data to UserListItem format
    const users: UserListItem[] = (data || []).map((user: any) => {
      const roles = rolesMap.get(user.id) || []
      const highestRole = roles.length > 0
        ? roles.reduce((max, role) =>
            role.hierarchy_level > max.hierarchy_level ? role : max
          )
        : null

      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        chapter_id: user.chapter_id,
        chapter: user.chapter,
        created_at: user.created_at,
        updated_at: user.updated_at,
        approved_at: user.approved_at,
        approved_by: user.approved_by,
        roles,
        role_names: roles.map((r) => r.role_name),
        highest_role: highestRole?.role_name || null,
        hierarchy_level: highestRole?.hierarchy_level || 0,
        is_active: activeEmailsMap.get(user.email) ?? true,
        has_member_record: memberIds.has(user.id),
        last_login: null // Would need to query auth.sessions
      }
    })

    // Apply role filter (post-fetch since it's a computed field)
    let filteredUsers = users
    if (filters.role_id) {
      filteredUsers = users.filter((u) =>
        u.roles.some((r) => r.role_id === filters.role_id)
      )
    }
    if (filters.role_name) {
      filteredUsers = users.filter((u) =>
        u.roles.some((r) =>
          r.role_name.toLowerCase().includes(filters.role_name!.toLowerCase())
        )
      )
    }
    if (filters.hierarchy_level !== undefined) {
      filteredUsers = users.filter(
        (u) => u.hierarchy_level === filters.hierarchy_level
      )
    }
    if (filters.is_active !== undefined) {
      filteredUsers = users.filter((u) => u.is_active === filters.is_active)
    }
    if (filters.has_member_record !== undefined) {
      filteredUsers = users.filter(
        (u) => u.has_member_record === filters.has_member_record
      )
    }

    const finalTotal = filteredUsers.length

    return {
      data: filteredUsers,
      total: finalTotal,
      page,
      pageSize,
      totalPages: Math.ceil(finalTotal / pageSize)
    }
  }
)

/**
 * Get single user with full details
 */
export const getUserById = cache(async (id: string): Promise<UserFull | null> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      *,
      chapter:chapters(
        id,
        name,
        location
      ),
      approved_email:approved_emails!profiles_approved_email_id_fkey(
        id,
        is_active,
        notes
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch user: ${error.message}`)
  }

  // Fetch user roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(
      `
      id,
      role_id,
      created_at,
      roles!inner(
        id,
        name,
        hierarchy_level,
        permissions
      )
    `
    )
    .eq('user_id', id)

  const roles: RoleInfo[] =
    userRoles?.map((ur: any) => ({
      id: ur.id,
      role_id: ur.role_id,
      role_name: ur.roles.name,
      hierarchy_level: ur.roles.hierarchy_level,
      permissions: ur.roles.permissions || [],
      assigned_at: ur.created_at,
      assigned_by: null
    })) || []

  // Fetch member record if exists
  const { data: member } = await supabase
    .from('members')
    .select(
      `
      id,
      membership_number,
      membership_status,
      member_since,
      company,
      designation
    `
    )
    .eq('id', id)
    .single()

  // Fetch role change history
  const { data: roleChanges } = await supabase
    .from('user_role_changes')
    .select(
      `
      id,
      user_id,
      role_id,
      action,
      notes,
      created_at,
      changed_by,
      role:roles!user_role_changes_role_id_fkey(name),
      changed_by_profile:profiles!user_role_changes_changed_by_fkey(full_name)
    `
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const role_changes: UserRoleChangeInfo[] =
    roleChanges?.map((rc: any) => ({
      id: rc.id,
      user_id: rc.user_id,
      role_id: rc.role_id,
      role_name: rc.role?.name || 'Unknown',
      action: rc.action,
      changed_by: rc.changed_by,
      changed_by_name: rc.changed_by_profile?.full_name || null,
      notes: rc.notes,
      created_at: rc.created_at
    })) || []

  // Check if user is active
  const { data: approvedEmail } = await supabase
    .from('approved_emails')
    .select('is_active')
    .eq('email', data.email)
    .single()

  const highestRole = roles.length > 0
    ? roles.reduce((max, role) =>
        role.hierarchy_level > max.hierarchy_level ? role : max
      )
    : null

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    phone: data.phone,
    chapter_id: data.chapter_id,
    chapter: data.chapter,
    created_at: data.created_at,
    updated_at: data.updated_at,
    approved_at: data.approved_at,
    approved_by: data.approved_by,
    roles,
    role_names: roles.map((r) => r.role_name),
    highest_role: highestRole?.role_name || null,
    hierarchy_level: highestRole?.hierarchy_level || 0,
    is_active: approvedEmail?.is_active ?? true,
    has_member_record: !!member,
    last_login: null,
    member: member || null,
    approved_email: data.approved_email || null,
    role_changes
  }
})

/**
 * Get all roles for user assignment
 */
export const getAvailableRoles = cache(
  async (currentUserId: string, targetUserId?: string): Promise<AvailableRole[]> => {
    const supabase = await createServerSupabaseClient()

    // Get current user's hierarchy level
    const { data: currentUserLevel } = await supabase.rpc(
      'get_user_hierarchy_level',
      {
        user_id: currentUserId
      }
    )

    // Get all roles
    const { data: roles } = await supabase
      .from('roles')
      .select('*, user_roles(user_id)')
      .order('hierarchy_level', { ascending: false })

    if (!roles) return []

    // Get target user's current roles
    let targetUserRoleIds = new Set<string>()
    if (targetUserId) {
      const { data: targetRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', targetUserId)

      targetUserRoleIds = new Set(targetRoles?.map((r) => r.role_id) || [])
    }

    return roles.map((role) => ({
      ...role,
      can_assign:
        currentUserLevel >= 7 || // Super Admin can assign any role
        (currentUserLevel >= 6 && role.hierarchy_level <= 5), // National Admin can assign up to level 5
      assigned_to_user: targetUserRoleIds.has(role.id),
      member_count: role.user_roles?.length || 0
    }))
  }
)

/**
 * Get user statistics
 */
export const getUserStats = cache(async (): Promise<UserStats> => {
  const supabase = await createServerSupabaseClient()

  // Total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Active/Inactive users
  const { data: approvedEmails } = await supabase
    .from('approved_emails')
    .select('is_active')

  const activeCount =
    approvedEmails?.filter((ae) => ae.is_active).length || totalUsers || 0
  const inactiveCount =
    approvedEmails?.filter((ae) => !ae.is_active).length || 0

  // Users by role
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles!inner(name)')

  const usersByRole: Record<string, number> = {}
  userRoles?.forEach((ur: any) => {
    const roleName = ur.roles.name
    usersByRole[roleName] = (usersByRole[roleName] || 0) + 1
  })

  // Users by chapter
  const { data: profiles } = await supabase
    .from('profiles')
    .select('chapter_id, chapters(name)')

  const usersByChapter: Record<string, number> = {}
  profiles?.forEach((p: any) => {
    const chapterName = p.chapters?.name || 'No Chapter'
    usersByChapter[chapterName] = (usersByChapter[chapterName] || 0) + 1
  })

  // Users by hierarchy level
  const { data: hierarchyData } = await supabase
    .from('user_roles')
    .select('user_id, roles!inner(hierarchy_level)')

  const usersByLevel: Record<number, Set<string>> = {}
  hierarchyData?.forEach((ud: any) => {
    const level = ud.roles.hierarchy_level
    if (!usersByLevel[level]) {
      usersByLevel[level] = new Set()
    }
    usersByLevel[level].add(ud.user_id)
  })

  const usersByHierarchyLevel: Record<number, number> = {}
  Object.entries(usersByLevel).forEach(([level, users]) => {
    usersByHierarchyLevel[Number(level)] = users.size
  })

  // New users this month/week
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstDayOfWeek = new Date(now)
  firstDayOfWeek.setDate(now.getDate() - now.getDay())

  const { count: newThisMonth } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', firstDayOfMonth.toISOString())

  const { count: newThisWeek } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', firstDayOfWeek.toISOString())

  return {
    total_users: totalUsers || 0,
    active_users: activeCount,
    inactive_users: inactiveCount,
    users_by_role: usersByRole,
    users_by_chapter: usersByChapter,
    users_by_hierarchy_level: usersByHierarchyLevel,
    new_users_this_month: newThisMonth || 0,
    new_users_this_week: newThisWeek || 0
  }
})

/**
 * Get user role change history
 */
export const getUserRoleChanges = cache(
  async (userId: string): Promise<UserRoleChangeInfo[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('user_role_changes')
      .select(
        `
        id,
        user_id,
        role_id,
        action,
        notes,
        created_at,
        changed_by,
        role:roles!user_role_changes_role_id_fkey(name),
        changed_by_profile:profiles!user_role_changes_changed_by_fkey(full_name)
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch role changes: ${error.message}`)
    }

    return (
      data?.map((rc: any) => ({
        id: rc.id,
        user_id: rc.user_id,
        role_id: rc.role_id,
        role_name: rc.role?.name || 'Unknown',
        action: rc.action,
        changed_by: rc.changed_by,
        changed_by_name: rc.changed_by_profile?.full_name || null,
        notes: rc.notes,
        created_at: rc.created_at
      })) || []
    )
  }
)
