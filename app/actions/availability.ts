'use server'

/**
 * Availability Server Actions
 *
 * Server actions for managing member availability.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  AvailabilityStatus,
  TimeSlot,
  TimeCommitmentHours,
  PreferredDays,
  NoticePeriod,
  GeographicFlexibility,
  PreferredContactMethod,
} from '@/types/availability'

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ============================================================================
// Set Availability Actions
// ============================================================================

/**
 * Set availability for a single date
 */
export async function setAvailability(input: {
  member_id: string
  date: string
  status: AvailabilityStatus
  time_slots?: TimeSlot[]
  notes?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createServerSupabaseClient()

    // Upsert availability record
    const { data, error } = await supabase
      .from('availability')
      .upsert(
        {
          member_id: input.member_id,
          date: input.date,
          status: input.status,
          time_slots: input.time_slots || null,
          notes: input.notes || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'member_id,date',
        }
      )
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to set availability: ${error.message}`)
    }

    revalidatePath('/members')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Set availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set availability',
    }
  }
}

/**
 * Set availability for multiple dates at once
 */
export async function bulkSetAvailability(input: {
  member_id: string
  dates: string[]
  status: AvailabilityStatus
  time_slots?: TimeSlot[]
}): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await createServerSupabaseClient()

    const records = input.dates.map((date) => ({
      member_id: input.member_id,
      date,
      status: input.status,
      time_slots: input.time_slots || null,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('availability').upsert(records, {
      onConflict: 'member_id,date',
    })

    if (error) {
      throw new Error(`Failed to bulk set availability: ${error.message}`)
    }

    revalidatePath('/members')

    return { success: true, data: { count: input.dates.length } }
  } catch (error) {
    console.error('Bulk set availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set availability',
    }
  }
}

/**
 * Clear availability for a date (delete the record)
 */
export async function clearAvailability(
  memberId: string,
  date: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('availability')
      .delete()
      .eq('member_id', memberId)
      .eq('date', date)

    if (error) {
      throw new Error(`Failed to clear availability: ${error.message}`)
    }

    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Clear availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear availability',
    }
  }
}

// ============================================================================
// Preferences Actions
// ============================================================================

/**
 * Update member availability preferences
 */
export async function updateAvailabilityPreferences(input: {
  member_id: string
  time_commitment_hours?: TimeCommitmentHours
  preferred_days?: PreferredDays
  notice_period?: NoticePeriod
  geographic_flexibility?: GeographicFlexibility
  preferred_contact_method?: PreferredContactMethod
}): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Update all existing availability records with new preferences
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (input.time_commitment_hours !== undefined) {
      updateData.time_commitment_hours = input.time_commitment_hours
    }
    if (input.preferred_days !== undefined) {
      updateData.preferred_days = input.preferred_days
    }
    if (input.notice_period !== undefined) {
      updateData.notice_period = input.notice_period
    }
    if (input.geographic_flexibility !== undefined) {
      updateData.geographic_flexibility = input.geographic_flexibility
    }
    if (input.preferred_contact_method !== undefined) {
      updateData.preferred_contact_method = input.preferred_contact_method
    }

    // Get existing records to update
    const { data: existingRecords } = await supabase
      .from('availability')
      .select('id')
      .eq('member_id', input.member_id)

    if (existingRecords && existingRecords.length > 0) {
      // Update existing records
      const { error } = await supabase
        .from('availability')
        .update(updateData)
        .eq('member_id', input.member_id)

      if (error) {
        throw new Error(`Failed to update preferences: ${error.message}`)
      }
    } else {
      // Create a new record with just preferences (for today)
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('availability').insert({
        member_id: input.member_id,
        date: today,
        status: 'available',
        ...updateData,
      })

      if (error) {
        throw new Error(`Failed to create preferences: ${error.message}`)
      }
    }

    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Update preferences error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update preferences',
    }
  }
}

// ============================================================================
// Assignment Actions
// ============================================================================

/**
 * Mark availability as assigned to a session
 */
export async function assignAvailabilityToSession(
  availabilityId: string,
  sessionId: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('availability')
      .update({
        is_assigned: true,
        assigned_session_id: sessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', availabilityId)

    if (error) {
      throw new Error(`Failed to assign availability: ${error.message}`)
    }

    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Assign availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign availability',
    }
  }
}

/**
 * Unassign availability from a session
 */
export async function unassignAvailability(availabilityId: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase
      .from('availability')
      .update({
        is_assigned: false,
        assigned_session_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', availabilityId)

    if (error) {
      throw new Error(`Failed to unassign availability: ${error.message}`)
    }

    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Unassign availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unassign availability',
    }
  }
}

/**
 * Block availability with a reason
 */
export async function blockAvailability(
  memberId: string,
  date: string,
  reason: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.from('availability').upsert(
      {
        member_id: memberId,
        date,
        status: 'unavailable',
        blocked_reason: reason,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'member_id,date',
      }
    )

    if (error) {
      throw new Error(`Failed to block availability: ${error.message}`)
    }

    revalidatePath('/members')

    return { success: true }
  } catch (error) {
    console.error('Block availability error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to block availability',
    }
  }
}
