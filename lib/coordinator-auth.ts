/**
 * External Coordinator Authentication Utilities
 *
 * Specialized authentication functions for external coordinators
 * (School, College, Industry) with institution-scoped access.
 *
 * These coordinators have limited access to the system, only seeing
 * data related to their specific institution.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ROLES,
  USER_TYPES,
  isExternalCoordinatorRole,
  getStakeholderTypeFromRole,
  type RoleName,
} from '@/lib/permissions'

// ============================================================================
// TYPES
// ============================================================================

export interface CoordinatorProfile {
  id: string
  user_id: string
  stakeholder_id: string
  stakeholder_type: 'school' | 'college' | 'industry'
  stakeholder_name: string
  role: 'primary' | 'secondary'
  status: 'pending' | 'active' | 'inactive'
  assigned_at: string
  assigned_by: string
}

export interface CoordinatorContext {
  user: User
  coordinator: CoordinatorProfile
  stakeholderType: 'school' | 'college' | 'industry'
  stakeholderId: string
  stakeholderName: string
  isPrimary: boolean
}

// ============================================================================
// COORDINATOR AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Get the current user's coordinator profile
 *
 * Returns null if user is not a coordinator or not authenticated.
 * Cached per-request using React cache().
 *
 * Usage:
 * ```typescript
 * const coordinator = await getCoordinatorProfile()
 * if (!coordinator) {
 *   // Not a coordinator
 * }
 * ```
 */
export const getCoordinatorProfile = cache(
  async (): Promise<CoordinatorProfile | null> => {
    const user = await getCurrentUser()
    if (!user) return null

    const supabase = await createServerSupabaseClient()

    const { data: coordinator } = await supabase
      .from('stakeholder_coordinators')
      .select(
        `
        id,
        user_id,
        stakeholder_id,
        stakeholder_type,
        role,
        status,
        assigned_at,
        assigned_by
      `
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!coordinator) return null

    // Get stakeholder name based on type
    let stakeholderName = 'Unknown'

    if (coordinator.stakeholder_type === 'industry') {
      const { data: industry } = await supabase
        .from('industries')
        .select('name')
        .eq('id', coordinator.stakeholder_id)
        .single()
      stakeholderName = industry?.name || 'Unknown Industry'
    } else {
      // School or College - from stakeholders table
      const { data: stakeholder } = await supabase
        .from('stakeholders')
        .select('name')
        .eq('id', coordinator.stakeholder_id)
        .single()
      stakeholderName = stakeholder?.name || 'Unknown Institution'
    }

    return {
      ...coordinator,
      stakeholder_name: stakeholderName,
    } as CoordinatorProfile
  }
)

/**
 * Require coordinator authentication
 *
 * Redirects to login if not authenticated, or to unauthorized if not a coordinator.
 *
 * Usage:
 * ```typescript
 * export default async function CoordinatorDashboard() {
 *   const { user, coordinator } = await requireCoordinator()
 *   // User is guaranteed to be a coordinator here
 * }
 * ```
 */
export async function requireCoordinator(): Promise<CoordinatorContext> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const coordinator = await getCoordinatorProfile()
  if (!coordinator) {
    redirect('/unauthorized')
  }

  return {
    user,
    coordinator,
    stakeholderType: coordinator.stakeholder_type,
    stakeholderId: coordinator.stakeholder_id,
    stakeholderName: coordinator.stakeholder_name,
    isPrimary: coordinator.role === 'primary',
  }
}

/**
 * Require specific coordinator type
 *
 * Usage:
 * ```typescript
 * const context = await requireCoordinatorType('school')
 * // Only school coordinators can access this
 * ```
 */
export async function requireCoordinatorType(
  allowedTypes: ('school' | 'college' | 'industry')[]
): Promise<CoordinatorContext> {
  const context = await requireCoordinator()

  if (!allowedTypes.includes(context.stakeholderType)) {
    redirect('/unauthorized')
  }

  return context
}

/**
 * Check if user is a coordinator for a specific stakeholder
 *
 * Usage:
 * ```typescript
 * const canAccess = await isCoordinatorFor('some-stakeholder-id')
 * ```
 */
export async function isCoordinatorFor(stakeholderId: string): Promise<boolean> {
  const coordinator = await getCoordinatorProfile()
  if (!coordinator) return false
  return coordinator.stakeholder_id === stakeholderId
}

/**
 * Get coordinator's stakeholder ID
 *
 * Returns the stakeholder_id for the current coordinator.
 * Cached per-request.
 */
export const getCoordinatorStakeholderId = cache(
  async (): Promise<string | null> => {
    const coordinator = await getCoordinatorProfile()
    return coordinator?.stakeholder_id || null
  }
)

// ============================================================================
// COORDINATOR ACCESS CONTROL
// ============================================================================

/**
 * Check if coordinator can access a booking
 *
 * Coordinators can only access bookings for their institution.
 */
export async function canAccessBooking(bookingId: string): Promise<boolean> {
  const coordinator = await getCoordinatorProfile()
  if (!coordinator) return false

  const supabase = await createServerSupabaseClient()

  const { data: booking } = await supabase
    .from('session_bookings')
    .select('stakeholder_id')
    .eq('id', bookingId)
    .single()

  return booking?.stakeholder_id === coordinator.stakeholder_id
}

/**
 * Check if coordinator can manage an opportunity
 *
 * Only industry coordinators can manage opportunities,
 * and only for their own industry.
 */
export async function canManageOpportunity(
  opportunityId: string
): Promise<boolean> {
  const coordinator = await getCoordinatorProfile()
  if (!coordinator) return false
  if (coordinator.stakeholder_type !== 'industry') return false

  const supabase = await createServerSupabaseClient()

  const { data: opportunity } = await supabase
    .from('industry_opportunities')
    .select('industry_id')
    .eq('id', opportunityId)
    .single()

  return opportunity?.industry_id === coordinator.stakeholder_id
}

/**
 * Validate coordinator has active MoU for opportunity creation
 *
 * Industry coordinators can only create opportunities if their
 * industry has an active MoU (Rule 5).
 */
export async function validateMoUForOpportunity(): Promise<{
  valid: boolean
  error?: string
}> {
  const coordinator = await getCoordinatorProfile()

  if (!coordinator) {
    return { valid: false, error: 'Not authenticated as coordinator' }
  }

  if (coordinator.stakeholder_type !== 'industry') {
    return { valid: false, error: 'Only industry coordinators can create opportunities' }
  }

  const supabase = await createServerSupabaseClient()

  // Use the database function to check MoU status
  const { data: hasActiveMoU, error } = await supabase.rpc('has_active_mou', {
    p_industry_id: coordinator.stakeholder_id,
  })

  if (error) {
    console.error('Error checking MoU status:', error)
    return { valid: false, error: 'Failed to verify MoU status' }
  }

  if (!hasActiveMoU) {
    return {
      valid: false,
      error: 'Your industry does not have an active MoU. Please contact the chapter to renew your MoU before posting opportunities.',
    }
  }

  return { valid: true }
}

// ============================================================================
// COORDINATOR SESSION BOOKING VALIDATION
// ============================================================================

/**
 * Validate booking request timing (Rule 1)
 *
 * Coordinators must request sessions at least 7 days in advance.
 */
export function validateBookingAdvanceTime(sessionDate: Date): {
  valid: boolean
  error?: string
  daysUntilSession: number
} {
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const daysUntilSession = Math.floor(
    (sessionDate.getTime() - now.getTime()) / msPerDay
  )

  const minimumDays = 7 // Rule 1

  if (daysUntilSession < minimumDays) {
    return {
      valid: false,
      error: `Sessions must be requested at least ${minimumDays} days in advance. The selected date is only ${daysUntilSession} days away.`,
      daysUntilSession,
    }
  }

  return { valid: true, daysUntilSession }
}

/**
 * Get available session slots for a stakeholder
 *
 * Based on stakeholder type and existing bookings.
 */
export async function getAvailableSessionSlots(
  month: number,
  year: number
): Promise<{
  available: number
  used: number
  limit: number
}> {
  const coordinator = await getCoordinatorProfile()
  if (!coordinator) {
    return { available: 0, used: 0, limit: 0 }
  }

  const supabase = await createServerSupabaseClient()

  // Get booking count for the month
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const { count } = await supabase
    .from('session_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('stakeholder_id', coordinator.stakeholder_id)
    .gte('session_date', startDate.toISOString())
    .lte('session_date', endDate.toISOString())
    .not('status', 'in', '("cancelled","rejected")')

  const used = count || 0

  // Limits based on stakeholder type (can be configured)
  const limits: Record<string, number> = {
    school: 10,
    college: 15,
    industry: 8,
  }

  const limit = limits[coordinator.stakeholder_type] || 10
  const available = Math.max(0, limit - used)

  return { available, used, limit }
}

// ============================================================================
// USER TYPE DETECTION
// ============================================================================

/**
 * Determine the user type for the current user
 *
 * Returns the appropriate user type based on their roles and coordinator status.
 */
export async function getUserType(): Promise<{
  type: string
  isExternal: boolean
  stakeholderId?: string
  stakeholderType?: string
}> {
  const user = await getCurrentUser()
  if (!user) {
    return { type: 'guest', isExternal: true }
  }

  // Check if user is an external coordinator
  const coordinator = await getCoordinatorProfile()
  if (coordinator) {
    const typeMap: Record<string, string> = {
      school: USER_TYPES.SCHOOL_COORDINATOR,
      college: USER_TYPES.COLLEGE_COORDINATOR,
      industry: USER_TYPES.INDUSTRY_COORDINATOR,
    }

    return {
      type: typeMap[coordinator.stakeholder_type] || 'coordinator',
      isExternal: true,
      stakeholderId: coordinator.stakeholder_id,
      stakeholderType: coordinator.stakeholder_type,
    }
  }

  // Check user roles for internal users
  const supabase = await createServerSupabaseClient()
  const { data: userRoles } = await supabase.rpc('get_user_roles_detailed', {
    p_user_id: user.id,
  })

  if (!userRoles || userRoles.length === 0) {
    return { type: USER_TYPES.YI_MEMBER, isExternal: false }
  }

  const roleNames = userRoles.map(
    (ur: { role_name: string }) => ur.role_name
  )
  const maxLevel = Math.max(
    ...userRoles.map((ur: { hierarchy_level: number }) => ur.hierarchy_level)
  )

  // Check for admin/chair
  if (maxLevel >= 4) {
    return { type: USER_TYPES.ADMIN_CHAIR, isExternal: false }
  }

  // Check for vertical chair
  const { data: isVerticalChair } = await supabase.rpc('is_vertical_chair', {
    p_user_id: user.id,
  })

  if (isVerticalChair) {
    return { type: USER_TYPES.VERTICAL_CHAIR, isExternal: false }
  }

  // Default to Yi Member
  return { type: USER_TYPES.YI_MEMBER, isExternal: false }
}

// ============================================================================
// COORDINATOR DASHBOARD STATS
// ============================================================================

/**
 * Get dashboard statistics for a coordinator
 */
export async function getCoordinatorDashboardStats(): Promise<{
  pendingBookings: number
  upcomingSessions: number
  completedSessions: number
  totalStudents: number
} | null> {
  const coordinator = await getCoordinatorProfile()
  if (!coordinator) return null

  const supabase = await createServerSupabaseClient()
  const now = new Date().toISOString()

  // Parallel queries for efficiency
  const [
    { count: pendingBookings },
    { count: upcomingSessions },
    { count: completedSessions },
  ] = await Promise.all([
    supabase
      .from('session_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('stakeholder_id', coordinator.stakeholder_id)
      .in('status', ['pending', 'pending_chair_approval']),

    supabase
      .from('session_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('stakeholder_id', coordinator.stakeholder_id)
      .eq('status', 'confirmed')
      .gte('session_date', now),

    supabase
      .from('session_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('stakeholder_id', coordinator.stakeholder_id)
      .eq('status', 'completed'),
  ])

  // Get total students from stakeholder (for schools/colleges)
  let totalStudents = 0
  if (coordinator.stakeholder_type !== 'industry') {
    const { data: stakeholder } = await supabase
      .from('stakeholders')
      .select('student_count')
      .eq('id', coordinator.stakeholder_id)
      .single()
    totalStudents = stakeholder?.student_count || 0
  }

  return {
    pendingBookings: pendingBookings || 0,
    upcomingSessions: upcomingSessions || 0,
    completedSessions: completedSessions || 0,
    totalStudents,
  }
}
