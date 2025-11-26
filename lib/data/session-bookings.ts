/**
 * Session Booking Data Layer
 *
 * Cached data fetching functions for session bookings.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  SessionBooking,
  SessionBookingFull,
  SessionBookingFilters,
  SessionType,
  SessionTypeWithVertical,
  StakeholderCoordinator,
  CoordinatorFilters,
  BookingStats,
  CoordinatorDashboardStats,
  BookingStatus,
} from '@/types/session-booking'

// ============================================================================
// Session Type Queries
// ============================================================================

/**
 * Get all active session types
 */
export const getSessionTypes = cache(
  async (): Promise<SessionTypeWithVertical[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('session_types')
      .select(`
        *,
        vertical:verticals(
          id,
          name,
          color
        )
      `)
      .eq('is_active', true)
      .order('display_name')

    if (error) {
      throw new Error(`Failed to fetch session types: ${error.message}`)
    }

    return (data || []) as SessionTypeWithVertical[]
  }
)

/**
 * Get session type by ID
 */
export const getSessionTypeById = cache(
  async (id: string): Promise<SessionTypeWithVertical | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('session_types')
      .select(`
        *,
        vertical:verticals(
          id,
          name,
          color
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch session type: ${error.message}`)
    }

    return data as SessionTypeWithVertical
  }
)

// ============================================================================
// Session Booking Queries
// ============================================================================

/**
 * Get booking by ID with full details
 */
export const getBookingById = cache(
  async (id: string): Promise<SessionBookingFull | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('session_bookings')
      .select(`
        *,
        coordinator:stakeholder_coordinators(
          id,
          full_name,
          email,
          phone,
          designation,
          stakeholder_type,
          stakeholder_id
        ),
        session_type:session_types(
          id,
          name,
          display_name,
          description,
          typical_duration_minutes
        ),
        assigned_trainer:trainer_profiles(
          id,
          member_id,
          member:members(
            id,
            profile:profiles(
              full_name,
              email,
              phone,
              avatar_url
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch booking: ${error.message}`)
    }

    return data as SessionBookingFull
  }
)

/**
 * Get bookings with filters
 */
export const getBookings = cache(
  async (filters: SessionBookingFilters = {}): Promise<SessionBookingFull[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('session_bookings')
      .select(`
        *,
        coordinator:stakeholder_coordinators(
          id,
          full_name,
          email,
          stakeholder_type
        ),
        session_type:session_types(
          id,
          name,
          display_name
        ),
        assigned_trainer:trainer_profiles(
          id,
          member_id,
          member:members(
            id,
            profile:profiles(
              full_name,
              avatar_url
            )
          )
        )
      `)

    if (filters.coordinator_id) {
      query = query.eq('coordinator_id', filters.coordinator_id)
    }

    if (filters.stakeholder_id) {
      query = query.eq('stakeholder_id', filters.stakeholder_id)
    }

    if (filters.stakeholder_type) {
      query = query.eq('stakeholder_type', filters.stakeholder_type)
    }

    if (filters.session_type_id) {
      query = query.eq('session_type_id', filters.session_type_id)
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters.date_from) {
      query = query.gte('preferred_date', filters.date_from)
    }

    if (filters.date_to) {
      query = query.lte('preferred_date', filters.date_to)
    }

    if (filters.assigned_trainer_id) {
      query = query.eq('assigned_trainer_id', filters.assigned_trainer_id)
    }

    if (filters.has_trainer !== undefined) {
      if (filters.has_trainer) {
        query = query.not('assigned_trainer_id', 'is', null)
      } else {
        query = query.is('assigned_trainer_id', null)
      }
    }

    query = query.order('preferred_date', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch bookings: ${error.message}`)
    }

    return (data || []) as SessionBookingFull[]
  }
)

/**
 * Get bookings for a coordinator
 */
export const getCoordinatorBookings = cache(
  async (
    coordinatorId: string,
    options?: { limit?: number; status?: BookingStatus | BookingStatus[] }
  ): Promise<SessionBookingFull[]> => {
    const filters: SessionBookingFilters = { coordinator_id: coordinatorId }
    if (options?.status) {
      filters.status = options.status
    }
    const bookings = await getBookings(filters)
    if (options?.limit) {
      return bookings.slice(0, options.limit)
    }
    return bookings
  }
)

/**
 * Get upcoming bookings for a date
 */
export const getBookingsForDate = cache(
  async (date: string): Promise<SessionBookingFull[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('session_bookings')
      .select(`
        *,
        coordinator:stakeholder_coordinators(
          id,
          full_name,
          stakeholder_type
        ),
        session_type:session_types(
          id,
          display_name
        ),
        assigned_trainer:trainer_profiles(
          id,
          member:members(
            id,
            profile:profiles(
              full_name,
              phone
            )
          )
        )
      `)
      .or(`preferred_date.eq.${date},confirmed_date.eq.${date}`)
      .not('status', 'in', '("cancelled","completed")')
      .order('confirmed_time_start', { ascending: true, nullsFirst: false })

    if (error) {
      throw new Error(`Failed to fetch bookings for date: ${error.message}`)
    }

    return (data || []) as SessionBookingFull[]
  }
)

/**
 * Get pending bookings needing trainer assignment
 */
export const getPendingTrainerAssignments = cache(
  async (): Promise<SessionBookingFull[]> => {
    return getBookings({
      status: ['pending', 'pending_trainer'],
      has_trainer: false,
    })
  }
)

// ============================================================================
// Coordinator Queries
// ============================================================================

/**
 * Get coordinator by ID
 */
export const getCoordinatorById = cache(
  async (id: string): Promise<StakeholderCoordinator | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('stakeholder_coordinators')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch coordinator: ${error.message}`)
    }

    return data as StakeholderCoordinator
  }
)

/**
 * Get coordinator by email
 */
export const getCoordinatorByEmail = cache(
  async (email: string): Promise<StakeholderCoordinator | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('stakeholder_coordinators')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch coordinator: ${error.message}`)
    }

    return data as StakeholderCoordinator
  }
)

/**
 * Get coordinators with filters
 */
export const getCoordinators = cache(
  async (filters: CoordinatorFilters = {}): Promise<StakeholderCoordinator[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('stakeholder_coordinators')
      .select('*')

    if (filters.stakeholder_type) {
      query = query.eq('stakeholder_type', filters.stakeholder_type)
    }

    if (filters.stakeholder_id) {
      query = query.eq('stakeholder_id', filters.stakeholder_id)
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    query = query.order('full_name')

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch coordinators: ${error.message}`)
    }

    return (data || []) as StakeholderCoordinator[]
  }
)

/**
 * Get coordinators for a stakeholder
 */
export const getStakeholderCoordinators = cache(
  async (stakeholderType: string, stakeholderId: string): Promise<StakeholderCoordinator[]> => {
    return getCoordinators({
      stakeholder_type: stakeholderType,
      stakeholder_id: stakeholderId,
    })
  }
)

// ============================================================================
// Trainer Availability Queries
// ============================================================================

/**
 * Get available trainers for a date and session type
 */
export const getAvailableTrainersForSession = cache(
  async (
    date: string,
    sessionTypeId: string
  ): Promise<Array<{
    trainer_id: string
    member_id: string
    full_name: string
    email: string
    avatar_url: string | null
    total_sessions: number
    average_rating: number | null
    sessions_this_month: number
    is_available: boolean
  }>> => {
    const supabase = await createServerSupabaseClient()

    // Get session type to know required certifications
    const sessionType = await getSessionTypeById(sessionTypeId)

    // Get eligible trainers
    const { data: trainers, error } = await supabase
      .from('trainer_profiles')
      .select(`
        id,
        member_id,
        total_sessions,
        average_rating,
        sessions_this_month,
        eligible_session_types,
        member:members(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `)
      .eq('is_trainer_eligible', true)
      .contains('eligible_session_types', [sessionType?.name || ''])

    if (error) {
      throw new Error(`Failed to fetch trainers: ${error.message}`)
    }

    // Check availability for each trainer
    const { data: availability } = await supabase
      .from('availability')
      .select('member_id, status')
      .eq('date', date)
      .eq('status', 'available')

    const availableMemberIds = new Set((availability || []).map((a: any) => a.member_id))

    // Check existing bookings for the date
    const { data: existingBookings } = await supabase
      .from('session_bookings')
      .select('assigned_trainer_id')
      .eq('confirmed_date', date)
      .not('status', 'in', '("cancelled","completed")')

    const busyTrainerIds = new Set(
      (existingBookings || [])
        .filter((b: any) => b.assigned_trainer_id)
        .map((b: any) => b.assigned_trainer_id)
    )

    return (trainers || []).map((t: any) => ({
      trainer_id: t.id,
      member_id: t.member_id,
      full_name: t.member?.profile?.full_name || '',
      email: t.member?.profile?.email || '',
      avatar_url: t.member?.profile?.avatar_url || null,
      total_sessions: t.total_sessions || 0,
      average_rating: t.average_rating,
      sessions_this_month: t.sessions_this_month || 0,
      is_available: availableMemberIds.has(t.member_id) && !busyTrainerIds.has(t.id),
    }))
  }
)

/**
 * Get trainer availability summary for a date range
 */
export const getTrainerAvailabilitySummary = cache(
  async (
    startDate: string,
    endDate: string
  ): Promise<Record<string, { available: number; total: number }>> => {
    const supabase = await createServerSupabaseClient()

    // Get all eligible trainers count
    const { count: totalTrainers } = await supabase
      .from('trainer_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_trainer_eligible', true)

    // Get availability records
    const { data: availability } = await supabase
      .from('availability')
      .select('date, member_id, status')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'available')

    // Group by date
    const summary: Record<string, { available: number; total: number }> = {}
    const availabilityByDate = new Map<string, Set<string>>()

    ;(availability || []).forEach((a: any) => {
      if (!availabilityByDate.has(a.date)) {
        availabilityByDate.set(a.date, new Set())
      }
      availabilityByDate.get(a.date)!.add(a.member_id)
    })

    // Create date range
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      const availableSet = availabilityByDate.get(dateStr)
      summary[dateStr] = {
        available: availableSet?.size || 0,
        total: totalTrainers || 0,
      }
      current.setDate(current.getDate() + 1)
    }

    return summary
  }
)

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get booking statistics
 */
export const getBookingStats = cache(
  async (filters: { stakeholder_id?: string; coordinator_id?: string } = {}): Promise<BookingStats> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase.from('session_bookings').select('*')

    if (filters.stakeholder_id) {
      query = query.eq('stakeholder_id', filters.stakeholder_id)
    }

    if (filters.coordinator_id) {
      query = query.eq('coordinator_id', filters.coordinator_id)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch booking stats: ${error.message}`)
    }

    const bookings = data || []
    const now = new Date()
    const weekFromNow = new Date(now)
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const stats: BookingStats = {
      total: bookings.length,
      by_status: {
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        pending_trainer: 0,
        trainer_assigned: 0,
        materials_pending: 0,
        in_progress: 0,
        completed: 0,
        rescheduled: 0,
      },
      pending_trainer_assignment: 0,
      upcoming_this_week: 0,
      completed_this_month: 0,
      average_participants: 0,
      average_feedback_score: null,
    }

    let totalParticipants = 0
    let totalFeedback = 0
    let feedbackCount = 0

    bookings.forEach((b: any) => {
      // Count by status
      if (b.status) {
        stats.by_status[b.status as BookingStatus]++
      }

      // Pending trainer
      if (['pending', 'pending_trainer'].includes(b.status) && !b.assigned_trainer_id) {
        stats.pending_trainer_assignment++
      }

      // Upcoming this week
      const bookingDate = new Date(b.confirmed_date || b.preferred_date)
      if (bookingDate >= now && bookingDate <= weekFromNow && !['cancelled', 'completed'].includes(b.status)) {
        stats.upcoming_this_week++
      }

      // Completed this month
      if (b.status === 'completed' && b.completed_at) {
        const completedDate = new Date(b.completed_at)
        if (completedDate >= startOfMonth) {
          stats.completed_this_month++
        }
      }

      // Participants
      totalParticipants += b.attendance_count || b.expected_participants || 0

      // Feedback
      if (b.feedback_score) {
        totalFeedback += Number(b.feedback_score)
        feedbackCount++
      }
    })

    stats.average_participants = bookings.length > 0 ? Math.round(totalParticipants / bookings.length) : 0
    stats.average_feedback_score = feedbackCount > 0 ? totalFeedback / feedbackCount : null

    return stats
  }
)

/**
 * Get coordinator dashboard stats
 */
export const getCoordinatorDashboardStats = cache(
  async (coordinatorId: string): Promise<CoordinatorDashboardStats> => {
    const supabase = await createServerSupabaseClient()

    const { data: bookings, error } = await supabase
      .from('session_bookings')
      .select('status, attendance_count, expected_participants, feedback_score, preferred_date, confirmed_date')
      .eq('coordinator_id', coordinatorId)

    if (error) {
      throw new Error(`Failed to fetch coordinator stats: ${error.message}`)
    }

    const now = new Date()
    const allBookings = bookings || []

    let totalStudents = 0
    let totalFeedback = 0
    let feedbackCount = 0
    let upcomingCount = 0
    let pendingCount = 0

    let confirmedCount = 0
    let completedCount = 0

    allBookings.forEach((b: any) => {
      // Total students
      totalStudents += b.attendance_count || 0

      // Feedback
      if (b.feedback_score) {
        totalFeedback += Number(b.feedback_score)
        feedbackCount++
      }

      // Upcoming
      const bookingDate = new Date(b.confirmed_date || b.preferred_date)
      if (bookingDate >= now && !['cancelled', 'completed'].includes(b.status)) {
        upcomingCount++
      }

      // Pending
      if (['pending', 'pending_trainer'].includes(b.status)) {
        pendingCount++
      }

      // Confirmed
      if (['trainer_assigned', 'confirmed', 'materials_pending', 'in_progress'].includes(b.status)) {
        confirmedCount++
      }

      // Completed
      if (b.status === 'completed') {
        completedCount++
      }
    })

    return {
      total_bookings: allBookings.length,
      pending_bookings: pendingCount,
      confirmed_bookings: confirmedCount,
      completed_sessions: completedCount,
      total_students_impacted: totalStudents,
      average_rating: feedbackCount > 0 ? totalFeedback / feedbackCount : null,
    }
  }
)
