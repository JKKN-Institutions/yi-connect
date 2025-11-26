/**
 * Business Rules Enforcement
 *
 * Application-level enforcement of business rules from Part3.md:
 * - Rule 1: 7-day advance booking requirement
 * - Rule 2: Trainer max 6 sessions/month
 * - Rule 3: Materials approval 3 days before session
 * - Rule 4: Booking restrictions
 * - Rule 5: MoU requirements (handled in coordinator-auth.ts)
 * - Rule 6: Privacy rules (handled via RLS)
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BUSINESS_RULES } from '@/lib/permissions'

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

export interface TrainerWorkload {
  trainerId: string
  trainerName: string
  year: number
  month: number
  sessionCount: number
  maxSessions: number
  availableSlots: number
  availabilityStatus: 'available' | 'limited' | 'unavailable'
}

export interface MaterialsApprovalStatus {
  totalMaterials: number
  approvedCount: number
  pendingCount: number
  rejectedCount: number
  allApproved: boolean
  hasPending: boolean
}

export interface BookingRestrictions {
  minAdvanceDays: number
  maxAdvanceDays: number
  maxBookingsPerMonth: number
  maxConcurrentPending: number
  minSessionDuration: number
  maxSessionDuration: number
  allowedDays: string[]
  earliestStartTime: string
  latestEndTime: string
  requiresMou: boolean
  requiresApproval: boolean
}

// ============================================================================
// RULE 1: BOOKING ADVANCE TIME
// ============================================================================

/**
 * Validate booking advance time requirement
 *
 * Rule 1: Sessions must be requested at least 7 days in advance
 */
export function validateBookingAdvanceTime(sessionDate: Date): ValidationResult {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const session = new Date(sessionDate)
  session.setHours(0, 0, 0, 0)

  const diffTime = session.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  const minDays = BUSINESS_RULES.SESSION_BOOKING_ADVANCE_DAYS

  if (diffDays < minDays) {
    return {
      valid: false,
      errors: [
        `Sessions must be booked at least ${minDays} days in advance. ` +
          `The selected date is only ${diffDays} days away.`,
      ],
    }
  }

  const warnings: string[] = []
  if (diffDays > 90) {
    warnings.push('Booking more than 90 days in advance may be subject to change.')
  }

  return { valid: true, errors: [], warnings }
}

// ============================================================================
// RULE 2: TRAINER WORKLOAD
// ============================================================================

/**
 * Get trainer workload for a specific month
 */
export async function getTrainerWorkload(
  trainerId: string,
  year?: number,
  month?: number
): Promise<TrainerWorkload | null> {
  const supabase = await createServerSupabaseClient()

  const targetYear = year || new Date().getFullYear()
  const targetMonth = month || new Date().getMonth() + 1

  const { data, error } = await supabase.rpc('get_trainer_session_count', {
    p_trainer_id: trainerId,
    p_year: targetYear,
    p_month: targetMonth,
  })

  if (error) {
    console.error('Error getting trainer workload:', error)
    return null
  }

  const sessionCount = data || 0
  const maxSessions = BUSINESS_RULES.TRAINER_MAX_SESSIONS_PER_MONTH

  // Get trainer name
  const { data: member } = await supabase
    .from('members')
    .select('full_name')
    .eq('id', trainerId)
    .single()

  return {
    trainerId,
    trainerName: member?.full_name || 'Unknown',
    year: targetYear,
    month: targetMonth,
    sessionCount,
    maxSessions,
    availableSlots: Math.max(0, maxSessions - sessionCount),
    availabilityStatus:
      sessionCount >= maxSessions
        ? 'unavailable'
        : sessionCount >= BUSINESS_RULES.TRAINER_WARNING_THRESHOLD
          ? 'limited'
          : 'available',
  }
}

/**
 * Validate trainer can be assigned to a session
 *
 * Rule 2: Trainers cannot have more than 6 sessions per month
 */
export async function validateTrainerAssignment(
  trainerId: string,
  sessionDate: Date
): Promise<ValidationResult> {
  const supabase = await createServerSupabaseClient()

  const year = sessionDate.getFullYear()
  const month = sessionDate.getMonth() + 1

  const { data, error } = await supabase.rpc('validate_trainer_workload', {
    p_trainer_id: trainerId,
    p_session_date: sessionDate.toISOString().split('T')[0],
    p_max_sessions: BUSINESS_RULES.TRAINER_MAX_SESSIONS_PER_MONTH,
  })

  if (error) {
    console.error('Error validating trainer workload:', error)
    return { valid: false, errors: ['Failed to validate trainer availability'] }
  }

  const result = data?.[0]

  if (!result?.can_assign) {
    return {
      valid: false,
      errors: [result?.message || 'Trainer has reached maximum sessions for this month'],
    }
  }

  const warnings: string[] = []
  if (
    result.current_count >= BUSINESS_RULES.TRAINER_WARNING_THRESHOLD
  ) {
    warnings.push(
      `Trainer has ${result.current_count}/${result.max_allowed} sessions this month`
    )
  }

  return { valid: true, errors: [], warnings }
}

/**
 * Get available trainers for a session date
 *
 * Returns trainers sorted by availability
 */
export async function getAvailableTrainers(
  sessionDate: Date,
  verticalId?: string
): Promise<TrainerWorkload[]> {
  const supabase = await createServerSupabaseClient()

  const { data: trainers } = await supabase
    .from('trainer_availability_summary')
    .select('*')
    .order('available_slots', { ascending: false })

  if (!trainers) return []

  // Filter by vertical if specified
  if (verticalId) {
    const { data: verticalTrainers } = await supabase
      .from('skill_will_assessments')
      .select('member_id')
      .eq('assigned_vertical_id', verticalId)

    const verticalMemberIds = new Set(
      verticalTrainers?.map((t) => t.member_id) || []
    )

    return trainers
      .filter((t) => verticalMemberIds.has(t.trainer_id))
      .map((t) => ({
        trainerId: t.trainer_id,
        trainerName: t.trainer_name,
        year: t.current_year,
        month: t.current_month,
        sessionCount: t.sessions_this_month,
        maxSessions: t.max_sessions,
        availableSlots: t.available_slots,
        availabilityStatus: t.availability_status as TrainerWorkload['availabilityStatus'],
      }))
  }

  return trainers.map((t) => ({
    trainerId: t.trainer_id,
    trainerName: t.trainer_name,
    year: t.current_year,
    month: t.current_month,
    sessionCount: t.sessions_this_month,
    maxSessions: t.max_sessions,
    availableSlots: t.available_slots,
    availabilityStatus: t.availability_status as TrainerWorkload['availabilityStatus'],
  }))
}

// ============================================================================
// RULE 3: MATERIALS APPROVAL
// ============================================================================

/**
 * Validate materials upload deadline
 *
 * Rule 3: Materials must be uploaded at least 3 days before the session
 */
export async function validateMaterialsDeadline(
  bookingId: string
): Promise<ValidationResult & { deadline?: Date; daysRemaining?: number }> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('validate_materials_deadline', {
    p_booking_id: bookingId,
  })

  if (error) {
    console.error('Error validating materials deadline:', error)
    return { valid: false, errors: ['Failed to validate materials deadline'] }
  }

  const result = data?.[0]

  if (!result) {
    return { valid: false, errors: ['Booking not found'] }
  }

  const deadline = result.deadline_date ? new Date(result.deadline_date) : undefined
  const daysRemaining = result.days_until_session - BUSINESS_RULES.MATERIALS_APPROVAL_DAYS_BEFORE_SESSION

  if (!result.can_upload) {
    return {
      valid: false,
      errors: [result.message],
      deadline,
      daysRemaining: Math.max(0, daysRemaining),
    }
  }

  const warnings: string[] = []
  if (daysRemaining <= 1) {
    warnings.push('Materials deadline is approaching. Please upload soon.')
  }

  return {
    valid: true,
    errors: [],
    warnings,
    deadline,
    daysRemaining,
  }
}

/**
 * Get materials approval status for a booking
 */
export async function getMaterialsApprovalStatus(
  bookingId: string
): Promise<MaterialsApprovalStatus | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('check_materials_approval_status', {
    p_booking_id: bookingId,
  })

  if (error || !data?.[0]) {
    console.error('Error checking materials status:', error)
    return null
  }

  const result = data[0]

  return {
    totalMaterials: result.total_materials,
    approvedCount: result.approved_count,
    pendingCount: result.pending_count,
    rejectedCount: result.rejected_count,
    allApproved: result.all_approved,
    hasPending: result.has_pending,
  }
}

/**
 * Get materials pending approval (for Chair dashboard)
 */
export async function getPendingMaterials(): Promise<
  Array<{
    materialId: string
    bookingId: string
    title: string
    fileName: string
    materialType: string
    uploadedAt: string
    uploadedByName: string
    sessionDate: string
    daysUntilSession: number
    urgency: 'urgent' | 'warning' | 'normal'
  }>
> {
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('materials_pending_approval')
    .select('*')
    .order('session_date', { ascending: true })

  if (!data) return []

  return data.map((m) => ({
    materialId: m.material_id,
    bookingId: m.booking_id,
    title: m.title || m.file_name,
    fileName: m.file_name,
    materialType: m.material_type,
    uploadedAt: m.uploaded_at,
    uploadedByName: m.uploaded_by_name,
    sessionDate: m.session_date,
    daysUntilSession: m.days_until_session,
    urgency: m.urgency as 'urgent' | 'warning' | 'normal',
  }))
}

// ============================================================================
// RULE 4: BOOKING RESTRICTIONS
// ============================================================================

/**
 * Get booking restrictions for a stakeholder type
 */
export async function getBookingRestrictions(
  stakeholderType: 'school' | 'college' | 'industry'
): Promise<BookingRestrictions | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('get_booking_restrictions', {
    p_stakeholder_type: stakeholderType,
  })

  if (error || !data?.[0]) {
    console.error('Error getting booking restrictions:', error)
    return null
  }

  const r = data[0]

  return {
    minAdvanceDays: r.min_advance_days,
    maxAdvanceDays: r.max_advance_days,
    maxBookingsPerMonth: r.max_bookings_per_month,
    maxConcurrentPending: r.max_concurrent_pending,
    minSessionDuration: r.min_session_duration,
    maxSessionDuration: r.max_session_duration,
    allowedDays: r.allowed_days,
    earliestStartTime: r.earliest_start_time,
    latestEndTime: r.latest_end_time,
    requiresMou: r.requires_mou,
    requiresApproval: r.requires_approval,
  }
}

/**
 * Comprehensive booking validation
 *
 * Validates all booking rules at once
 */
export async function validateBookingRequest(
  stakeholderId: string,
  stakeholderType: 'school' | 'college' | 'industry',
  sessionDate: Date,
  startTime: string,
  endTime: string
): Promise<ValidationResult> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('validate_booking_request', {
    p_stakeholder_id: stakeholderId,
    p_stakeholder_type: stakeholderType,
    p_session_date: sessionDate.toISOString().split('T')[0],
    p_start_time: startTime,
    p_end_time: endTime,
  })

  if (error) {
    console.error('Error validating booking:', error)
    return { valid: false, errors: ['Failed to validate booking request'] }
  }

  const result = data?.[0]

  return {
    valid: result?.is_valid || false,
    errors: result?.errors || [],
  }
}

// ============================================================================
// SESSION READINESS CHECK
// ============================================================================

/**
 * Check if a session is ready to be conducted
 *
 * Validates:
 * - All materials are approved
 * - Trainer is assigned
 * - Booking is confirmed
 */
export async function checkSessionReadiness(
  bookingId: string
): Promise<{
  ready: boolean
  issues: string[]
  materialsStatus: MaterialsApprovalStatus | null
  hasTrainer: boolean
  bookingStatus: string | null
}> {
  const supabase = await createServerSupabaseClient()

  const issues: string[] = []

  // Get booking status
  const { data: booking } = await supabase
    .from('session_bookings')
    .select('status, session_date')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    return {
      ready: false,
      issues: ['Booking not found'],
      materialsStatus: null,
      hasTrainer: false,
      bookingStatus: null,
    }
  }

  // Check booking is confirmed
  if (booking.status !== 'confirmed') {
    issues.push(`Booking is not confirmed (current status: ${booking.status})`)
  }

  // Check materials
  const materialsStatus = await getMaterialsApprovalStatus(bookingId)
  if (materialsStatus) {
    if (materialsStatus.totalMaterials === 0) {
      issues.push('No materials have been uploaded for this session')
    } else if (!materialsStatus.allApproved) {
      issues.push(
        `Materials not fully approved: ${materialsStatus.pendingCount} pending, ${materialsStatus.rejectedCount} rejected`
      )
    }
  }

  // Check trainer assignment
  const { count: trainerCount } = await supabase
    .from('session_booking_trainers')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)

  const hasTrainer = (trainerCount || 0) > 0
  if (!hasTrainer) {
    issues.push('No trainer has been assigned to this session')
  }

  return {
    ready: issues.length === 0,
    issues,
    materialsStatus,
    hasTrainer,
    bookingStatus: booking.status,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format time for display
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

/**
 * Calculate session duration in minutes
 */
export function calculateSessionDuration(
  startTime: string,
  endTime: string
): number {
  const [startHours, startMins] = startTime.split(':').map(Number)
  const [endHours, endMins] = endTime.split(':').map(Number)

  const startMinutes = startHours * 60 + startMins
  const endMinutes = endHours * 60 + endMins

  return endMinutes - startMinutes
}

/**
 * Get day of week name from date
 */
export function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}
