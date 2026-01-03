/**
 * AAA Pathfinder Module Server Actions
 *
 * Server Actions for AAA Framework: Awareness → Action → Advocacy
 * Handles AAA plans, commitment cards, and mentor assignments.
 */

'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import {
  createAAAPlanSchema,
  updateAAAPlanSchema,
  lockFirstEventSchema,
  approveAAAPlanSchema,
  signCommitmentCardSchema,
  updateCommitmentCardSchema,
  assignMentorSchema,
  updateMentorAssignmentSchema,
  type CreateAAAPlanInput,
  type UpdateAAAPlanInput,
  type SignCommitmentCardInput,
  type AssignMentorInput,
} from '@/lib/validations/aaa'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Sanitize form data - convert empty strings to null
 */
function sanitizeData<T extends Record<string, unknown>>(data: T): T {
  const sanitized = { ...data }
  for (const key in sanitized) {
    if (sanitized[key] === '') {
      sanitized[key] = null as T[Extract<keyof T, string>]
    }
  }
  return sanitized
}

// ============================================================================
// AAA PLAN ACTIONS
// ============================================================================

/**
 * Create a new AAA Plan for a vertical
 */
export async function createAAAPlan(
  input: CreateAAAPlanInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = createAAAPlanSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if plan already exists for this vertical + year
    const { data: existing } = await supabase
      .from('aaa_plans')
      .select('id')
      .eq('vertical_id', sanitized.vertical_id)
      .eq('calendar_year', sanitized.calendar_year)
      .single()

    if (existing) {
      return { success: false, error: 'AAA Plan already exists for this vertical and year' }
    }

    // Get member ID for created_by
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return { success: false, error: 'Member not found' }
    }

    const { data, error } = await supabase
      .from('aaa_plans')
      .insert({
        ...sanitized,
        created_by: member.id,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create AAA Plan error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('aaa-plans', 'max')
    revalidatePath('/pathfinder')
    revalidatePath(`/verticals/${sanitized.vertical_id}`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create AAA Plan error:', error)
    return { success: false, error: 'Failed to create AAA plan' }
  }
}

/**
 * Update an existing AAA Plan
 */
export async function updateAAAPlan(
  input: UpdateAAAPlanInput
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = updateAAAPlanSchema.parse(input)
    const { id, ...updateData } = validated
    const sanitized = sanitizeData(updateData)

    const supabase = await createClient()

    // Check if plan exists
    const { data: existing } = await supabase
      .from('aaa_plans')
      .select('id, vertical_id, first_event_locked')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'AAA Plan not found' }
    }

    // If trying to change first_event_date but it's locked, prevent
    if (existing.first_event_locked && sanitized.first_event_date !== undefined) {
      return { success: false, error: 'First event date is locked and cannot be changed' }
    }

    const { error } = await supabase
      .from('aaa_plans')
      .update(sanitized)
      .eq('id', id)

    if (error) {
      console.error('Update AAA Plan error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('aaa-plans', 'max')
    revalidatePath('/pathfinder')
    revalidatePath(`/verticals/${existing.vertical_id}`)

    return { success: true }
  } catch (error) {
    console.error('Update AAA Plan error:', error)
    return { success: false, error: 'Failed to update AAA plan' }
  }
}

/**
 * Lock the first event date (cannot be changed after)
 */
export async function lockFirstEventDate(
  planId: string,
  firstEventDate: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = lockFirstEventSchema.parse({
      plan_id: planId,
      first_event_date: firstEventDate,
    })

    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('aaa_plans')
      .select('id, vertical_id, first_event_locked')
      .eq('id', validated.plan_id)
      .single()

    if (!existing) {
      return { success: false, error: 'AAA Plan not found' }
    }

    if (existing.first_event_locked) {
      return { success: false, error: 'First event date is already locked' }
    }

    const { error } = await supabase
      .from('aaa_plans')
      .update({
        first_event_date: validated.first_event_date,
        first_event_locked: true,
        first_event_locked_at: new Date().toISOString(),
      })
      .eq('id', validated.plan_id)

    if (error) {
      console.error('Lock first event error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('aaa-plans', 'max')
    revalidatePath('/pathfinder')

    return { success: true }
  } catch (error) {
    console.error('Lock first event error:', error)
    return { success: false, error: 'Failed to lock first event date' }
  }
}

/**
 * Approve an AAA Plan (Chair only)
 */
export async function approveAAAPlan(planId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = approveAAAPlanSchema.parse({ plan_id: planId })

    const supabase = await createClient()

    // Get member for approved_by
    const { data: member } = await supabase
      .from('members')
      .select('id, hierarchy_level')
      .eq('user_id', user.id)
      .single()

    if (!member || member.hierarchy_level < 4) {
      return { success: false, error: 'Only Chair or above can approve plans' }
    }

    const { error } = await supabase
      .from('aaa_plans')
      .update({
        status: 'approved',
        approved_by: member.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', validated.plan_id)

    if (error) {
      console.error('Approve AAA Plan error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('aaa-plans', 'max')
    revalidatePath('/pathfinder')

    return { success: true }
  } catch (error) {
    console.error('Approve AAA Plan error:', error)
    return { success: false, error: 'Failed to approve plan' }
  }
}

/**
 * Delete an AAA Plan
 */
export async function deleteAAAPlan(planId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('aaa_plans')
      .select('id, vertical_id, status')
      .eq('id', planId)
      .single()

    if (!existing) {
      return { success: false, error: 'AAA Plan not found' }
    }

    if (existing.status === 'approved' || existing.status === 'active') {
      return { success: false, error: 'Cannot delete approved or active plans' }
    }

    const { error } = await supabase
      .from('aaa_plans')
      .delete()
      .eq('id', planId)

    if (error) {
      console.error('Delete AAA Plan error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('aaa-plans', 'max')
    revalidatePath('/pathfinder')
    revalidatePath(`/verticals/${existing.vertical_id}`)

    return { success: true }
  } catch (error) {
    console.error('Delete AAA Plan error:', error)
    return { success: false, error: 'Failed to delete plan' }
  }
}

// ============================================================================
// COMMITMENT CARD ACTIONS
// ============================================================================

/**
 * Sign a commitment card
 */
export async function signCommitmentCard(
  input: SignCommitmentCardInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = signCommitmentCardSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if commitment already exists
    const { data: existing } = await supabase
      .from('commitment_cards')
      .select('id')
      .eq('member_id', sanitized.member_id)
      .eq('pathfinder_year', sanitized.pathfinder_year)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('commitment_cards')
        .update({
          ...sanitized,
          signed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Update commitment card error:', error)
        return { success: false, error: error.message }
      }

      revalidateTag('commitment-cards', 'max')
      revalidatePath('/pathfinder')

      return { success: true, data: { id: existing.id } }
    }

    // Create new
    const { data, error } = await supabase
      .from('commitment_cards')
      .insert({
        ...sanitized,
        signed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Sign commitment card error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('commitment-cards', 'max')
    revalidatePath('/pathfinder')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Sign commitment card error:', error)
    return { success: false, error: 'Failed to sign commitment card' }
  }
}

/**
 * Get commitment card for current user
 */
export async function getMyCommitmentCard(pathfinderYear: number) {
  try {
    const user = await getCurrentUser()
    if (!user) return null

    const supabase = await createClient()

    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) return null

    const { data } = await supabase
      .from('commitment_cards')
      .select('*')
      .eq('member_id', member.id)
      .eq('pathfinder_year', pathfinderYear)
      .single()

    return data
  } catch (error) {
    console.error('Get commitment card error:', error)
    return null
  }
}

// ============================================================================
// MENTOR ASSIGNMENT ACTIONS
// ============================================================================

/**
 * Assign a mentor to an EC Chair
 */
export async function assignMentor(
  input: AssignMentorInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = assignMentorSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('ec_chair_id', sanitized.ec_chair_id)
      .eq('pathfinder_year', sanitized.pathfinder_year)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('mentor_assignments')
        .update({
          mentor_id: sanitized.mentor_id,
          mentor_name: sanitized.mentor_name,
          mentor_title: sanitized.mentor_title,
          mentor_expertise: sanitized.mentor_expertise,
          notes: sanitized.notes,
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Update mentor assignment error:', error)
        return { success: false, error: error.message }
      }

      revalidateTag('mentor-assignments', 'max')
      revalidatePath('/pathfinder')

      return { success: true, data: { id: existing.id } }
    }

    // Create new
    const { data, error } = await supabase
      .from('mentor_assignments')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) {
      console.error('Assign mentor error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('mentor-assignments', 'max')
    revalidatePath('/pathfinder')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Assign mentor error:', error)
    return { success: false, error: 'Failed to assign mentor' }
  }
}

/**
 * Remove mentor assignment
 */
export async function removeMentorAssignment(assignmentId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('mentor_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      console.error('Remove mentor assignment error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('mentor-assignments', 'max')
    revalidatePath('/pathfinder')

    return { success: true }
  } catch (error) {
    console.error('Remove mentor assignment error:', error)
    return { success: false, error: 'Failed to remove mentor assignment' }
  }
}
