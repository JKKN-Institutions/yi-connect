'use server'

/**
 * Session Booking Server Actions
 *
 * Server actions for managing session bookings in the coordinator portal.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CreateBookingInput,
  AssignTrainerInput,
  CompleteSessionInput,
  RescheduleBookingInput,
  CancelBookingInput,
  BookingStatus,
  StatusHistoryItem,
} from '@/types/session-booking'

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ============================================================================
// Booking Actions
// ============================================================================

/**
 * Create a new session booking
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createServerSupabaseClient()

    const statusHistory: StatusHistoryItem[] = [
      {
        status: 'pending',
        changed_at: new Date().toISOString(),
        notes: 'Booking created',
      },
    ]

    const { data, error } = await supabase
      .from('session_bookings')
      .insert({
        coordinator_id: input.coordinator_id,
        stakeholder_type: input.stakeholder_type,
        stakeholder_id: input.stakeholder_id,
        session_type_id: input.session_type_id,
        preferred_date: input.preferred_date,
        preferred_time_slot: input.preferred_time_slot || null,
        alternate_date: input.alternate_date || null,
        alternate_time_slot: input.alternate_time_slot || null,
        expected_participants: input.expected_participants,
        participant_details: input.participant_details || null,
        topics_requested: input.topics_requested || null,
        custom_requirements: input.custom_requirements || null,
        status: 'pending',
        status_history: statusHistory,
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create booking: ${error.message}`)
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create booking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create booking',
    }
  }
}

/**
 * Assign a trainer to a booking
 */
export async function assignTrainer(
  input: AssignTrainerInput
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Get current booking
    const { data: booking } = await supabase
      .from('session_bookings')
      .select('status_history')
      .eq('id', input.booking_id)
      .single()

    const statusHistory: StatusHistoryItem[] = [
      ...((booking?.status_history as StatusHistoryItem[]) || []),
      {
        status: 'trainer_assigned',
        changed_at: new Date().toISOString(),
        changed_by: user.id,
        notes: input.notes || 'Trainer assigned',
      },
    ]

    const { error } = await supabase
      .from('session_bookings')
      .update({
        assigned_trainer_id: input.trainer_id,
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
        confirmed_date: input.confirmed_date,
        confirmed_time_start: input.confirmed_time_start,
        confirmed_time_end: input.confirmed_time_end,
        venue: input.venue || null,
        status: 'trainer_assigned',
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.booking_id)

    if (error) {
      throw new Error(`Failed to assign trainer: ${error.message}`)
    }

    // Update trainer profile sessions count (non-critical, ignore errors)
    const { error: rpcError } = await supabase.rpc('increment_trainer_session_count', {
      trainer_id: input.trainer_id,
    })
    if (rpcError) {
      console.warn('Non-critical: Failed to update trainer session count:', rpcError.message)
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')
    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Assign trainer error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign trainer',
    }
  }
}

/**
 * Confirm a booking
 */
export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get current booking
    const { data: booking } = await supabase
      .from('session_bookings')
      .select('status_history')
      .eq('id', bookingId)
      .single()

    const statusHistory: StatusHistoryItem[] = [
      ...((booking?.status_history as StatusHistoryItem[]) || []),
      {
        status: 'confirmed',
        changed_at: new Date().toISOString(),
        changed_by: user?.id,
        notes: 'Booking confirmed',
      },
    ]

    const { error } = await supabase
      .from('session_bookings')
      .update({
        status: 'confirmed',
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (error) {
      throw new Error(`Failed to confirm booking: ${error.message}`)
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')

    return { success: true }
  } catch (error) {
    console.error('Confirm booking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm booking',
    }
  }
}

/**
 * Complete a session
 */
export async function completeSession(
  input: CompleteSessionInput
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get current booking
    const { data: booking } = await supabase
      .from('session_bookings')
      .select('status_history, assigned_trainer_id')
      .eq('id', input.booking_id)
      .single()

    const statusHistory: StatusHistoryItem[] = [
      ...((booking?.status_history as StatusHistoryItem[]) || []),
      {
        status: 'completed',
        changed_at: new Date().toISOString(),
        changed_by: user?.id,
        notes: 'Session completed',
      },
    ]

    const { error } = await supabase
      .from('session_bookings')
      .update({
        status: 'completed',
        status_history: statusHistory,
        attendance_count: input.attendance_count,
        feedback_score: input.feedback_score || null,
        session_notes: input.session_notes || null,
        materials_provided: input.materials_provided || null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.booking_id)

    if (error) {
      throw new Error(`Failed to complete session: ${error.message}`)
    }

    // Update trainer profile stats (non-critical)
    if (booking?.assigned_trainer_id) {
      // Get current stats
      const { data: trainerProfile } = await supabase
        .from('trainer_profiles')
        .select('total_sessions, total_students_impacted')
        .eq('id', booking.assigned_trainer_id)
        .single()

      if (trainerProfile) {
        const { error: updateError } = await supabase
          .from('trainer_profiles')
          .update({
            total_sessions: (trainerProfile.total_sessions || 0) + 1,
            total_students_impacted: (trainerProfile.total_students_impacted || 0) + input.attendance_count,
            last_session_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.assigned_trainer_id)

        if (updateError) {
          console.warn('Non-critical: Failed to update trainer stats:', updateError.message)
        }
      }
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')
    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Complete session error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete session',
    }
  }
}

/**
 * Reschedule a booking
 */
export async function rescheduleBooking(
  input: RescheduleBookingInput
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get current booking
    const { data: booking } = await supabase
      .from('session_bookings')
      .select('status_history, preferred_date')
      .eq('id', input.booking_id)
      .single()

    const statusHistory: StatusHistoryItem[] = [
      ...((booking?.status_history as StatusHistoryItem[]) || []),
      {
        status: 'rescheduled',
        changed_at: new Date().toISOString(),
        changed_by: user?.id,
        notes: input.reason || `Rescheduled from ${booking?.preferred_date} to ${input.new_date}`,
      },
    ]

    const { error } = await supabase
      .from('session_bookings')
      .update({
        preferred_date: input.new_date,
        preferred_time_slot: input.new_time_slot || null,
        confirmed_date: null,
        confirmed_time_start: null,
        confirmed_time_end: null,
        assigned_trainer_id: null, // Need to reassign trainer
        assigned_at: null,
        status: 'pending',
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.booking_id)

    if (error) {
      throw new Error(`Failed to reschedule booking: ${error.message}`)
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')

    return { success: true }
  } catch (error) {
    console.error('Reschedule booking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reschedule booking',
    }
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(
  input: CancelBookingInput
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get current booking
    const { data: booking } = await supabase
      .from('session_bookings')
      .select('status_history')
      .eq('id', input.booking_id)
      .single()

    const statusHistory: StatusHistoryItem[] = [
      ...((booking?.status_history as StatusHistoryItem[]) || []),
      {
        status: 'cancelled',
        changed_at: new Date().toISOString(),
        changed_by: user?.id,
        notes: input.reason,
      },
    ]

    const { error } = await supabase
      .from('session_bookings')
      .update({
        status: 'cancelled',
        status_history: statusHistory,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: input.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.booking_id)

    if (error) {
      throw new Error(`Failed to cancel booking: ${error.message}`)
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')

    return { success: true }
  } catch (error) {
    console.error('Cancel booking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel booking',
    }
  }
}

/**
 * Update booking status
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  notes?: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Get current booking
    const { data: booking } = await supabase
      .from('session_bookings')
      .select('status_history')
      .eq('id', bookingId)
      .single()

    const statusHistory: StatusHistoryItem[] = [
      ...((booking?.status_history as StatusHistoryItem[]) || []),
      {
        status,
        changed_at: new Date().toISOString(),
        changed_by: user?.id,
        notes,
      },
    ]

    const { error } = await supabase
      .from('session_bookings')
      .update({
        status,
        status_history: statusHistory,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (error) {
      throw new Error(`Failed to update booking status: ${error.message}`)
    }

    revalidatePath('/coordinator')
    revalidatePath('/stakeholders')

    return { success: true }
  } catch (error) {
    console.error('Update booking status error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update booking status',
    }
  }
}

// ============================================================================
// Coordinator Actions
// ============================================================================

/**
 * Create a coordinator account
 */
export async function createCoordinator(input: {
  stakeholder_type: string
  stakeholder_id: string
  email: string
  full_name: string
  designation?: string
  phone?: string
}): Promise<ActionResult<{ id: string; temporary_password: string }>> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword()

    // Hash password (in production, use bcrypt)
    const passwordHash = await hashPassword(temporaryPassword)

    const { data, error } = await supabase
      .from('stakeholder_coordinators')
      .insert({
        stakeholder_type: input.stakeholder_type,
        stakeholder_id: input.stakeholder_id,
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: input.full_name,
        designation: input.designation || null,
        phone: input.phone || null,
        status: 'pending_verification',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('A coordinator with this email already exists')
      }
      throw new Error(`Failed to create coordinator: ${error.message}`)
    }

    revalidatePath('/stakeholders')

    return {
      success: true,
      data: {
        id: data.id,
        temporary_password: temporaryPassword,
      },
    }
  } catch (error) {
    console.error('Create coordinator error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create coordinator',
    }
  }
}

/**
 * Verify a coordinator account
 */
export async function verifyCoordinator(coordinatorId: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    const { error } = await supabase
      .from('stakeholder_coordinators')
      .update({
        status: 'active',
        verified_at: new Date().toISOString(),
        verified_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coordinatorId)

    if (error) {
      throw new Error(`Failed to verify coordinator: ${error.message}`)
    }

    revalidatePath('/stakeholders')

    return { success: true }
  } catch (error) {
    console.error('Verify coordinator error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify coordinator',
    }
  }
}

/**
 * Deactivate a coordinator account
 */
export async function deactivateCoordinator(coordinatorId: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('stakeholder_coordinators')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', coordinatorId)

    if (error) {
      throw new Error(`Failed to deactivate coordinator: ${error.message}`)
    }

    revalidatePath('/stakeholders')

    return { success: true }
  } catch (error) {
    console.error('Deactivate coordinator error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate coordinator',
    }
  }
}

/**
 * Reset coordinator password
 */
export async function resetCoordinatorPassword(
  coordinatorId: string
): Promise<ActionResult<{ temporary_password: string }>> {
  try {
    const supabase = await createServerSupabaseClient()

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)

    const { error } = await supabase
      .from('stakeholder_coordinators')
      .update({
        password_hash: passwordHash,
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coordinatorId)

    if (error) {
      throw new Error(`Failed to reset password: ${error.message}`)
    }

    revalidatePath('/stakeholders')

    return {
      success: true,
      data: { temporary_password: temporaryPassword },
    }
  } catch (error) {
    console.error('Reset coordinator password error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password',
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const specialChars = '@#$%&*'
  let password = ''

  // Add 8 random alphanumeric characters
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // Add 1 special character
  password += specialChars.charAt(Math.floor(Math.random() * specialChars.length))

  // Add year
  password += new Date().getFullYear()

  return password
}

async function hashPassword(password: string): Promise<string> {
  // In production, use bcrypt
  // For now, using a simple hash (NOT secure for production)
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
