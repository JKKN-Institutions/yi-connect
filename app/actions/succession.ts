'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  CreateSuccessionCycleSchema,
  UpdateSuccessionCycleSchema,
  CreateSuccessionPositionSchema,
  UpdateSuccessionPositionSchema,
  AdvanceSuccessionStatusSchema,
} from '@/lib/validations/succession'
import { z } from 'zod'

type ActionResult<T = any> = {
  success: boolean
  data?: T
  error?: string
}

// Mapping of cycle status to timeline step number
const STATUS_TO_STEP_MAP: Record<string, number> = {
  'nominations_open': 1,
  'nominations_closed': 1,
  'applications_open': 2,
  'applications_closed': 2,
  'evaluations': 3,
  'evaluations_closed': 3,
  'interviews': 4,
  'interviews_closed': 5,
  'selection': 6,
  'approval_pending': 6,
  'completed': 7,
  'archived': 7,
}

/**
 * Sync timeline step statuses based on cycle status
 * Called automatically when cycle status changes
 */
async function syncTimelineStepsWithCycleStatus(
  supabase: any,
  cycleId: string,
  cycleStatus: string
): Promise<void> {
  const currentStepNumber = STATUS_TO_STEP_MAP[cycleStatus]

  if (!currentStepNumber) return // Draft or active status, no step mapping

  // Get all timeline steps for this cycle
  const { data: steps } = await supabase
    .from('succession_timeline_steps')
    .select('id, step_number, status')
    .eq('cycle_id', cycleId)
    .order('step_number')

  if (!steps || steps.length === 0) return

  // Determine if current status is a "closed" status
  const isClosedStatus = cycleStatus.endsWith('_closed') ||
                          cycleStatus === 'completed' ||
                          cycleStatus === 'archived'

  // Update each step's status based on cycle status
  for (const step of steps) {
    let newStatus: string

    if (step.step_number < currentStepNumber) {
      // Previous steps should be completed
      newStatus = 'completed'
    } else if (step.step_number === currentStepNumber) {
      // Current step is active or completed based on cycle status
      newStatus = isClosedStatus ? 'completed' : 'active'
    } else {
      // Future steps are pending
      newStatus = 'pending'
    }

    // Only update if status changed
    if (step.status !== newStatus) {
      await supabase
        .from('succession_timeline_steps')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', step.id)
    }
  }
}

// ============================================================================
// SUCCESSION CYCLE ACTIONS
// ============================================================================

/**
 * Create a new succession cycle
 * Admin only action
 */
export async function createSuccessionCycle(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const rawData = Object.fromEntries(formData)
    const data: Record<string, any> = { ...rawData }

    // Parse JSON fields
    if (typeof data.phase_configs === 'string') {
      data.phase_configs = JSON.parse(data.phase_configs)
    }

    // Convert year to number (FormData always returns strings)
    if (typeof data.year === 'string') {
      data.year = parseInt(data.year, 10)
    }

    const validated = CreateSuccessionCycleSchema.parse(data)

    const { data: cycle, error } = await supabase
      .from('succession_cycles')
      .insert({
        ...validated,
        created_by_id: user.id,
        status: 'draft',
        version: 1,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/cycles')
    revalidatePath('/succession')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating succession cycle:', error)
    return { success: false, error: 'Failed to create succession cycle' }
  }
}

/**
 * Update an existing succession cycle
 * Admin only action
 */
export async function updateSuccessionCycle(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const rawData = Object.fromEntries(formData)
    const data: Record<string, any> = { ...rawData }

    // Parse JSON fields
    if (typeof data.phase_configs === 'string') {
      data.phase_configs = JSON.parse(data.phase_configs)
    }
    if (typeof data.selection_committee_ids === 'string') {
      data.selection_committee_ids = JSON.parse(data.selection_committee_ids)
    }

    // Convert year to number (FormData always returns strings)
    if (typeof data.year === 'string') {
      data.year = parseInt(data.year, 10)
    }

    const validated = UpdateSuccessionCycleSchema.parse({ ...data, id })

    // Remove id from the update payload (can't update primary key)
    const { id: _id, ...updateData } = validated

    // Clean up updateData - remove undefined values and empty strings for optional fields
    const cleanedData: Record<string, any> = {}
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined && value !== '') {
        cleanedData[key] = value
      } else if (value === '' && (key === 'start_date' || key === 'end_date' || key === 'description')) {
        // Set optional fields to null if empty string
        cleanedData[key] = null
      }
    }

    console.log('Updating succession cycle with data:', cleanedData)

    // Get current version for optimistic locking
    const { data: current, error: fetchError } = await supabase
      .from('succession_cycles')
      .select('version')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      console.error('Error fetching cycle:', fetchError)
      return { success: false, error: 'Cycle not found' }
    }

    const { data: cycle, error } = await supabase
      .from('succession_cycles')
      .update({
        ...cleanedData,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('version', current.version) // Optimistic locking
      .select()
      .single()

    if (error) {
      console.error('Supabase update error:', error)
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Cycle was updated by another user. Please refresh and try again.',
        }
      }
      throw error
    }

    if (!cycle) {
      return { success: false, error: 'Failed to update cycle - no data returned' }
    }

    // Sync timeline step statuses if cycle status was updated
    if (cleanedData.status) {
      await syncTimelineStepsWithCycleStatus(supabase, id, cleanedData.status)
    }

    revalidatePath('/succession/admin/cycles')
    revalidatePath(`/succession/admin/cycles/${id}`)
    revalidatePath('/succession')
    revalidatePath('/succession/admin/timeline')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.issues)
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating succession cycle:', error)
    // Return more specific error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Failed to update succession cycle'
    return { success: false, error: errorMessage }
  }
}

/**
 * Advance succession cycle to next status
 * Admin only action with state machine validation
 */
export async function advanceSuccessionStatus(
  cycleId: string,
  newStatus: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const validated = AdvanceSuccessionStatusSchema.parse({
      id: cycleId,
      new_status: newStatus,
    })

    // Get current cycle
    const { data: current } = await supabase
      .from('succession_cycles')
      .select('status, version')
      .eq('id', cycleId)
      .single()

    if (!current) {
      return { success: false, error: 'Cycle not found' }
    }

    // Basic state transition validation
    const validTransitions: Record<string, string[]> = {
      draft: ['active'],
      active: ['nominations_open'],
      nominations_open: ['nominations_closed'],
      nominations_closed: ['applications_open'],
      applications_open: ['applications_closed'],
      applications_closed: ['evaluations'],
      evaluations: ['evaluations_closed'],
      evaluations_closed: ['interviews'],
      interviews: ['interviews_closed'],
      interviews_closed: ['selection'],
      selection: ['approval_pending'],
      approval_pending: ['completed', 'selection'],
      completed: ['archived'],
    }

    const allowedTransitions = validTransitions[current.status] || []
    if (!allowedTransitions.includes(validated.new_status)) {
      return {
        success: false,
        error: `Cannot transition from ${current.status} to ${validated.new_status}`,
      }
    }

    const { data: cycle, error } = await supabase
      .from('succession_cycles')
      .update({
        status: validated.new_status,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
        ...(validated.new_status === 'completed' && {
          published_at: new Date().toISOString(),
          is_published: true,
        }),
      })
      .eq('id', cycleId)
      .eq('version', current.version)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Cycle was updated by another user. Please refresh and try again.',
        }
      }
      throw error
    }

    // Sync timeline step statuses with new cycle status
    await syncTimelineStepsWithCycleStatus(supabase, cycleId, validated.new_status)

    revalidatePath('/succession/admin/cycles')
    revalidatePath(`/succession/admin/cycles/${cycleId}`)
    revalidatePath('/succession')
    revalidatePath('/succession/admin/timeline')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error advancing succession status:', error)
    return { success: false, error: 'Failed to advance succession status' }
  }
}

/**
 * Delete a succession cycle
 * Only allowed for draft cycles with no positions
 */
export async function deleteSuccessionCycle(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check cycle status
    const { data: cycle } = await supabase
      .from('succession_cycles')
      .select('status')
      .eq('id', id)
      .single()

    if (!cycle) {
      return { success: false, error: 'Cycle not found' }
    }

    if (cycle.status !== 'draft') {
      return {
        success: false,
        error: 'Only draft cycles can be deleted',
      }
    }

    // Check for positions
    const { count } = await supabase
      .from('succession_positions')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', id)

    if (count && count > 0) {
      return {
        success: false,
        error: 'Cannot delete cycle with existing positions',
      }
    }

    const { error } = await supabase
      .from('succession_cycles')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/cycles')
    revalidatePath('/succession')
    return { success: true }
  } catch (error) {
    console.error('Error deleting succession cycle:', error)
    return { success: false, error: 'Failed to delete succession cycle' }
  }
}

// ============================================================================
// SUCCESSION POSITION ACTIONS
// ============================================================================

/**
 * Create a new succession position
 * Admin only action
 */
export async function createSuccessionPosition(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const rawData = Object.fromEntries(formData)
    const data: Record<string, any> = { ...rawData }

    // Parse JSON fields
    if (typeof data.eligibility_criteria === 'string') {
      data.eligibility_criteria = JSON.parse(data.eligibility_criteria)
    }

    // Convert number fields (FormData always returns strings)
    if (typeof data.hierarchy_level === 'string') {
      data.hierarchy_level = parseInt(data.hierarchy_level, 10)
    }
    if (typeof data.number_of_openings === 'string') {
      data.number_of_openings = parseInt(data.number_of_openings, 10)
    }

    const validated = CreateSuccessionPositionSchema.parse(data)

    const { data: position, error } = await supabase
      .from('succession_positions')
      .insert({
        ...validated,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    revalidatePath(`/succession/admin/cycles/${validated.cycle_id}`)
    revalidatePath('/succession')
    return { success: true, data: position }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating succession position:', error)
    return { success: false, error: 'Failed to create succession position' }
  }
}

/**
 * Update an existing succession position
 * Admin only action
 */
export async function updateSuccessionPosition(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const rawData = Object.fromEntries(formData)
    const data: Record<string, any> = { ...rawData }

    // Parse JSON fields
    if (typeof data.eligibility_criteria === 'string') {
      data.eligibility_criteria = JSON.parse(data.eligibility_criteria)
    }

    // Convert number fields (FormData always returns strings)
    if (typeof data.hierarchy_level === 'string') {
      data.hierarchy_level = parseInt(data.hierarchy_level, 10)
    }
    if (typeof data.number_of_openings === 'string') {
      data.number_of_openings = parseInt(data.number_of_openings, 10)
    }

    const validated = UpdateSuccessionPositionSchema.parse({ ...data, id })

    const { data: position, error } = await supabase
      .from('succession_positions')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    revalidatePath(`/succession/admin/positions/${id}`)
    revalidatePath('/succession')
    return { success: true, data: position }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating succession position:', error)
    return { success: false, error: 'Failed to update succession position' }
  }
}

/**
 * Toggle succession position active status
 * Admin only action
 */
export async function togglePositionStatus(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: position, error } = await supabase
      .from('succession_positions')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    revalidatePath('/succession')
    return { success: true, data: position }
  } catch (error) {
    console.error('Error toggling position status:', error)
    return { success: false, error: 'Failed to update position status' }
  }
}

/**
 * Delete a succession position
 * Only allowed if no nominations or applications exist
 */
export async function deleteSuccessionPosition(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check for nominations
    const { count: nominationCount } = await supabase
      .from('succession_nominations')
      .select('id', { count: 'exact', head: true })
      .eq('position_id', id)

    if (nominationCount && nominationCount > 0) {
      return {
        success: false,
        error: 'Cannot delete position with existing nominations',
      }
    }

    // Check for applications
    const { count: applicationCount } = await supabase
      .from('succession_applications')
      .select('id', { count: 'exact', head: true })
      .eq('position_id', id)

    if (applicationCount && applicationCount > 0) {
      return {
        success: false,
        error: 'Cannot delete position with existing applications',
      }
    }

    const { error } = await supabase
      .from('succession_positions')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    revalidatePath('/succession')
    return { success: true }
  } catch (error) {
    console.error('Error deleting succession position:', error)
    return { success: false, error: 'Failed to delete succession position' }
  }
}

// ============================================================================
// ELIGIBILITY ACTIONS
// ============================================================================

/**
 * Calculate eligibility for all members in a cycle
 * Admin only action - triggers bulk calculation
 */
export async function calculateCycleEligibility(
  cycleId: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await createClient()

    // Call the database function
    const { data, error } = await supabase.rpc('bulk_calculate_cycle_eligibility', {
      p_cycle_id: cycleId,
    })

    if (error) throw error

    revalidatePath(`/succession/admin/cycles/${cycleId}`)
    revalidatePath('/succession')
    return { success: true, data: { count: data || 0 } }
  } catch (error) {
    console.error('Error calculating cycle eligibility:', error)
    return { success: false, error: 'Failed to calculate eligibility' }
  }
}

// ============================================================================
// NOMINATION ACTIONS
// ============================================================================

/**
 * Submit a nomination for a position
 * Any member can nominate another member
 */
export async function submitNomination(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.supporting_evidence === 'string') {
      data.supporting_evidence = JSON.parse(data.supporting_evidence)
    }

    // Validate using Zod
    const { CreateNominationSchema } = await import('@/lib/validations/succession')
    const validated = CreateNominationSchema.parse({
      ...data,
      nominated_by_id: user.id,
    })

    const { data: nomination, error } = await supabase
      .from('succession_nominations')
      .insert({
        ...validated,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select(`
        *,
        nominee:members!succession_nominations_nominee_id_fkey (
          first_name,
          last_name,
          email
        ),
        position:succession_positions (
          title,
          cycle_id
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/nominations')
    revalidatePath('/succession/admin/nominations')
    return { success: true, data: nomination }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error submitting nomination:', error)
    return { success: false, error: 'Failed to submit nomination' }
  }
}

/**
 * Update a nomination (draft only)
 * Only the nominator can update their own nomination
 */
export async function updateNomination(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Check ownership
    const { data: existing } = await supabase
      .from('succession_nominations')
      .select('nominated_by_id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'Nomination not found' }
    }

    if (existing.nominated_by_id !== user.id) {
      return { success: false, error: 'You can only edit your own nominations' }
    }

    if (existing.status !== 'draft') {
      return { success: false, error: 'Only draft nominations can be edited' }
    }

    const data = Object.fromEntries(formData)

    if (typeof data.supporting_evidence === 'string') {
      data.supporting_evidence = JSON.parse(data.supporting_evidence)
    }

    const { UpdateNominationSchema } = await import('@/lib/validations/succession')
    const validated = UpdateNominationSchema.parse({ ...data, id })

    const { data: nomination, error } = await supabase
      .from('succession_nominations')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/nominations')
    revalidatePath(`/succession/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating nomination:', error)
    return { success: false, error: 'Failed to update nomination' }
  }
}

/**
 * Withdraw a nomination
 * Only the nominator can withdraw their own nomination
 */
export async function withdrawNomination(
  id: string,
  reason: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Check ownership
    const { data: existing } = await supabase
      .from('succession_nominations')
      .select('nominated_by_id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'Nomination not found' }
    }

    if (existing.nominated_by_id !== user.id) {
      return { success: false, error: 'You can only withdraw your own nominations' }
    }

    if (existing.status === 'withdrawn') {
      return { success: false, error: 'Nomination already withdrawn' }
    }

    const { data: nomination, error } = await supabase
      .from('succession_nominations')
      .update({
        status: 'withdrawn',
        withdrawn_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/nominations')
    revalidatePath(`/succession/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error) {
    console.error('Error withdrawing nomination:', error)
    return { success: false, error: 'Failed to withdraw nomination' }
  }
}

/**
 * Review a nomination (approve or reject)
 * Admin only action
 */
export async function reviewNomination(
  id: string,
  status: 'approved' | 'rejected',
  reviewNotes: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { ReviewNominationSchema } = await import('@/lib/validations/succession')
    const validated = ReviewNominationSchema.parse({
      id,
      status,
      review_notes: reviewNotes,
      reviewed_by_id: user.id,
    })

    const { data: nomination, error } = await supabase
      .from('succession_nominations')
      .update({
        status: validated.status,
        review_notes: validated.review_notes,
        reviewed_by_id: validated.reviewed_by_id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        nominee:members!succession_nominations_nominee_id_fkey (
          first_name,
          last_name,
          email
        ),
        position:succession_positions (
          title
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/nominations')
    revalidatePath(`/succession/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error reviewing nomination:', error)
    return { success: false, error: 'Failed to review nomination' }
  }
}

// ============================================================================
// APPLICATION SERVER ACTIONS
// ============================================================================

/**
 * Submit a self-application for a position
 */
export async function submitApplication(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    // Parse supporting_documents if it's a string
    if (typeof data.supporting_documents === 'string') {
      data.supporting_documents = JSON.parse(data.supporting_documents)
    }

    const { CreateApplicationSchema } = await import('@/lib/validations/succession')
    const validated = CreateApplicationSchema.parse({
      ...data,
      member_id: user.id,
    })

    const { data: application, error } = await supabase
      .from('succession_applications')
      .insert({
        ...validated,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select(`
        *,
        applicant:members!succession_applications_member_id_fkey (
          first_name,
          last_name,
          email
        ),
        position:succession_positions (
          title,
          cycle_id
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/applications')
    revalidatePath('/succession/admin/applications')
    return { success: true, data: application }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error submitting application:', error)
    return { success: false, error: 'Failed to submit application' }
  }
}

/**
 * Update a draft application
 */
export async function updateApplication(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    // Parse supporting_documents if it's a string
    if (typeof data.supporting_documents === 'string') {
      data.supporting_documents = JSON.parse(data.supporting_documents)
    }

    const { UpdateApplicationSchema } = await import('@/lib/validations/succession')
    const validated = UpdateApplicationSchema.parse(data)

    const { data: application, error } = await supabase
      .from('succession_applications')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('member_id', user.id)
      .eq('status', 'draft')
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/applications')
    revalidatePath(`/succession/applications/${id}`)
    return { success: true, data: application }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating application:', error)
    return { success: false, error: 'Failed to update application' }
  }
}

/**
 * Withdraw an application
 */
export async function withdrawApplication(
  id: string,
  reason: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: application, error } = await supabase
      .from('succession_applications')
      .update({
        status: 'withdrawn',
        review_notes: reason,
        withdrawn_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('member_id', user.id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/applications')
    revalidatePath(`/succession/applications/${id}`)
    return { success: true, data: application }
  } catch (error: any) {
    console.error('Error withdrawing application:', error)
    return { success: false, error: 'Failed to withdraw application' }
  }
}

/**
 * Review an application (admin action)
 */
export async function reviewApplication(
  id: string,
  status: 'approved' | 'rejected',
  reviewNotes: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: application, error } = await supabase
      .from('succession_applications')
      .update({
        status,
        review_notes: reviewNotes,
        reviewed_by_id: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        applicant:members!succession_applications_member_id_fkey (
          first_name,
          last_name,
          email
        ),
        position:succession_positions (
          title
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/applications')
    revalidatePath(`/succession/applications/${id}`)
    return { success: true, data: application }
  } catch (error: any) {
    console.error('Error reviewing application:', error)
    return { success: false, error: 'Failed to review application' }
  }
}

// ============================================================================
// EVALUATION CRITERIA SERVER ACTIONS
// ============================================================================

/**
 * Create evaluation criteria for a position
 */
export async function createEvaluationCriteria(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { CreateEvaluationCriteriaSchema } = await import('@/lib/validations/succession')
    const validated = CreateEvaluationCriteriaSchema.parse(data)

    const { data: criteria, error } = await supabase
      .from('succession_evaluation_criteria')
      .insert(validated)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    revalidatePath(`/succession/admin/positions/${validated.position_id}`)
    return { success: true, data: criteria }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating evaluation criteria:', error)
    return { success: false, error: 'Failed to create evaluation criteria' }
  }
}

/**
 * Update evaluation criteria
 */
export async function updateEvaluationCriteria(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { CreateEvaluationCriteriaSchema } = await import('@/lib/validations/succession')
    const validated = CreateEvaluationCriteriaSchema.partial().parse(data)

    const { data: criteria, error } = await supabase
      .from('succession_evaluation_criteria')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    return { success: true, data: criteria }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating evaluation criteria:', error)
    return { success: false, error: 'Failed to update evaluation criteria' }
  }
}

/**
 * Delete evaluation criteria
 */
export async function deleteEvaluationCriteria(
  id: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabase
      .from('succession_evaluation_criteria')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/positions')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting evaluation criteria:', error)
    return { success: false, error: 'Failed to delete evaluation criteria' }
  }
}

// ============================================================================
// EVALUATOR SERVER ACTIONS
// ============================================================================

/**
 * Assign an evaluator to a cycle
 */
export async function assignEvaluator(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { data: evaluator, error } = await supabase
      .from('succession_evaluators')
      .insert({
        cycle_id: data.cycle_id,
        member_id: data.member_id,
        assigned_by_id: user.id,
      })
      .select(`
        *,
        evaluator:members!succession_evaluators_member_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/evaluators')
    return { success: true, data: evaluator }
  } catch (error: any) {
    console.error('Error assigning evaluator:', error)
    return { success: false, error: 'Failed to assign evaluator' }
  }
}

/**
 * Remove an evaluator
 */
export async function removeEvaluator(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabase
      .from('succession_evaluators')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/evaluators')
    return { success: true }
  } catch (error: any) {
    console.error('Error removing evaluator:', error)
    return { success: false, error: 'Failed to remove evaluator' }
  }
}

// ============================================================================
// EVALUATION SCORES SERVER ACTIONS
// ============================================================================

/**
 * Submit evaluation scores for a nomination
 */
export async function submitEvaluationScores(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    // Parse scores if it's a string
    if (typeof data.scores === 'string') {
      data.scores = JSON.parse(data.scores)
    }

    const { SubmitEvaluationScoresSchema } = await import('@/lib/validations/succession')
    const validated = SubmitEvaluationScoresSchema.parse(data)

    // Get nomination to find cycle_id
    const { data: nomination } = await supabase
      .from('succession_nominations')
      .select('cycle_id')
      .eq('id', validated.nomination_id)
      .single()

    if (!nomination) {
      return { success: false, error: 'Nomination not found' }
    }

    // First verify user is an evaluator
    const { data: evaluator } = await supabase
      .from('succession_evaluators')
      .select('id')
      .eq('cycle_id', nomination.cycle_id)
      .eq('member_id', user.id)
      .single()

    if (!evaluator) {
      return { success: false, error: 'You are not an evaluator for this cycle' }
    }

    // Insert scores
    const scoresToInsert = validated.scores.map((score: any) => ({
      cycle_id: nomination.cycle_id,
      nomination_id: validated.nomination_id,
      evaluator_id: evaluator.id,
      criterion_id: score.criterion_id,
      score: score.score,
      comments: score.comments,
      submitted_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('succession_evaluation_scores')
      .insert(scoresToInsert)

    if (error) throw error

    // Update evaluator stats
    await supabase.rpc('increment_evaluator_scored_nominations', {
      p_evaluator_id: evaluator.id,
    })

    revalidatePath('/succession/evaluations')
    revalidatePath(`/succession/nominations/${validated.nomination_id}`)
    return { success: true }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error submitting evaluation scores:', error)
    return { success: false, error: 'Failed to submit evaluation scores' }
  }
}

// ============================================================================
// TIMELINE STEPS SERVER ACTIONS
// ============================================================================

/**
 * Create a timeline step for a cycle
 * Admin only action
 */
export async function createTimelineStep(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const rawData = Object.fromEntries(formData)
    const data: Record<string, any> = { ...rawData }

    // Convert number fields (FormData always returns strings)
    if (typeof data.step_number === 'string') {
      data.step_number = parseInt(data.step_number, 10)
    }

    const { CreateTimelineStepSchema } = await import('@/lib/validations/succession')
    const validated = CreateTimelineStepSchema.parse(data)

    const { data: timelineStep, error } = await supabase
      .from('succession_timeline_steps')
      .insert(validated)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/timeline')
    revalidatePath(`/succession/admin/cycles/${validated.cycle_id}`)
    return { success: true, data: timelineStep }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating timeline step:', error)
    return { success: false, error: 'Failed to create timeline step' }
  }
}

/**
 * Update a timeline step
 * Admin only action
 */
export async function updateTimelineStep(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const rawData = Object.fromEntries(formData)
    const data: Record<string, any> = { ...rawData }

    // Convert number fields (FormData always returns strings)
    if (typeof data.step_number === 'string') {
      data.step_number = parseInt(data.step_number, 10)
    }

    const { UpdateTimelineStepSchema } = await import('@/lib/validations/succession')
    const validated = UpdateTimelineStepSchema.parse({ ...data, id })

    const { data: timelineStep, error } = await supabase
      .from('succession_timeline_steps')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/timeline')
    return { success: true, data: timelineStep }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating timeline step:', error)
    return { success: false, error: 'Failed to update timeline step' }
  }
}

/**
 * Update timeline step status
 * Admin only action
 */
export async function updateTimelineStepStatus(
  id: string,
  status: 'pending' | 'active' | 'completed' | 'overdue'
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: timelineStep, error } = await supabase
      .from('succession_timeline_steps')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/timeline')
    return { success: true, data: timelineStep }
  } catch (error: any) {
    console.error('Error updating timeline step status:', error)
    return { success: false, error: 'Failed to update timeline step status' }
  }
}

/**
 * Delete a timeline step
 * Admin only action
 */
export async function deleteTimelineStep(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabase
      .from('succession_timeline_steps')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/timeline')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting timeline step:', error)
    return { success: false, error: 'Failed to delete timeline step' }
  }
}

// ============================================================================
// CANDIDATE APPROACH SERVER ACTIONS
// ============================================================================

/**
 * Record a candidate approach
 * Admin only action
 */
export async function createApproach(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { CreateApproachSchema } = await import('@/lib/validations/succession')
    const validated = CreateApproachSchema.parse({
      ...data,
      approached_by: user.id,
    })

    const { data: approach, error } = await supabase
      .from('succession_approaches')
      .insert({
        ...validated,
        approached_at: new Date().toISOString(),
      })
      .select(`
        *,
        cycle:succession_cycles (id, cycle_name, year),
        position:succession_positions (id, title, hierarchy_level),
        nominee:members!succession_approaches_nominee_id_fkey (id, first_name, last_name, email, phone, avatar_url),
        approached_by_member:members!succession_approaches_approached_by_fkey (id, first_name, last_name)
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/approaches')
    revalidatePath(`/succession/admin/cycles/${validated.cycle_id}`)
    return { success: true, data: approach }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating approach:', error)
    return { success: false, error: 'Failed to create approach record' }
  }
}

/**
 * Update an approach record
 * Admin only action
 */
export async function updateApproach(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { UpdateApproachSchema } = await import('@/lib/validations/succession')
    const validated = UpdateApproachSchema.parse({ ...data, id })

    const { data: approach, error } = await supabase
      .from('succession_approaches')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        cycle:succession_cycles (id, cycle_name, year),
        position:succession_positions (id, title, hierarchy_level),
        nominee:members!succession_approaches_nominee_id_fkey (id, first_name, last_name, email, phone, avatar_url),
        approached_by_member:members!succession_approaches_approached_by_fkey (id, first_name, last_name)
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/approaches')
    revalidatePath(`/succession/admin/approaches/${id}`)
    return { success: true, data: approach }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating approach:', error)
    return { success: false, error: 'Failed to update approach record' }
  }
}

/**
 * Update approach response status
 * Can be updated by the nominee or admin
 */
export async function updateApproachResponse(
  id: string,
  responseStatus: 'pending' | 'accepted' | 'declined' | 'conditional',
  conditionsText?: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: approach, error } = await supabase
      .from('succession_approaches')
      .update({
        response_status: responseStatus,
        response_date: new Date().toISOString(),
        conditions_text: conditionsText || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        nominee:members!succession_approaches_nominee_id_fkey (id, first_name, last_name)
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/approaches')
    revalidatePath(`/succession/admin/approaches/${id}`)
    return { success: true, data: approach }
  } catch (error: any) {
    console.error('Error updating approach response:', error)
    return { success: false, error: 'Failed to update approach response' }
  }
}

/**
 * Delete an approach record
 * Admin only action
 */
export async function deleteApproach(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { error } = await supabase
      .from('succession_approaches')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/approaches')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting approach:', error)
    return { success: false, error: 'Failed to delete approach record' }
  }
}

// ============================================================================
// STEERING COMMITTEE MEETING SERVER ACTIONS
// ============================================================================

/**
 * Create a steering committee meeting
 * Admin only action
 */
export async function createMeeting(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { CreateMeetingSchema } = await import('@/lib/validations/succession')
    const validated = CreateMeetingSchema.parse({
      ...data,
      created_by: user.id,
    })

    const { data: meeting, error } = await supabase
      .from('succession_meetings')
      .insert(validated)
      .select(`
        *,
        cycle:succession_cycles (id, cycle_name, year),
        created_by_member:members!succession_meetings_created_by_fkey (id, first_name, last_name)
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/meetings')
    revalidatePath(`/succession/admin/cycles/${validated.cycle_id}`)
    return { success: true, data: meeting }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating meeting:', error)
    return { success: false, error: 'Failed to create meeting' }
  }
}

/**
 * Update a steering committee meeting
 * Admin only action
 */
export async function updateMeeting(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { UpdateMeetingSchema } = await import('@/lib/validations/succession')
    const validated = UpdateMeetingSchema.parse({ ...data, id })

    const { data: meeting, error } = await supabase
      .from('succession_meetings')
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        cycle:succession_cycles (id, cycle_name, year),
        created_by_member:members!succession_meetings_created_by_fkey (id, first_name, last_name)
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/meetings')
    revalidatePath(`/succession/admin/meetings/${id}`)
    return { success: true, data: meeting }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating meeting:', error)
    return { success: false, error: 'Failed to update meeting' }
  }
}

/**
 * Update meeting status
 * Admin only action
 */
export async function updateMeetingStatus(
  id: string,
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const { data: meeting, error } = await supabase
      .from('succession_meetings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/meetings')
    revalidatePath(`/succession/admin/meetings/${id}`)
    return { success: true, data: meeting }
  } catch (error: any) {
    console.error('Error updating meeting status:', error)
    return { success: false, error: 'Failed to update meeting status' }
  }
}

/**
 * Delete a meeting
 * Admin only action - only allowed for scheduled meetings with no votes
 */
export async function deleteMeeting(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Check meeting status
    const { data: meeting } = await supabase
      .from('succession_meetings')
      .select('status')
      .eq('id', id)
      .single()

    if (!meeting) {
      return { success: false, error: 'Meeting not found' }
    }

    if (meeting.status !== 'scheduled') {
      return {
        success: false,
        error: 'Only scheduled meetings can be deleted',
      }
    }

    // Check for votes
    const { count } = await supabase
      .from('succession_votes')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_id', id)

    if (count && count > 0) {
      return {
        success: false,
        error: 'Cannot delete meeting with existing votes',
      }
    }

    const { error } = await supabase
      .from('succession_meetings')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/meetings')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting meeting:', error)
    return { success: false, error: 'Failed to delete meeting' }
  }
}

// ============================================================================
// VOTING SERVER ACTIONS
// ============================================================================

/**
 * Submit a vote for a nominee
 * Steering committee member action
 */
export async function submitVote(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    const data = Object.fromEntries(formData)

    const { CreateVoteSchema } = await import('@/lib/validations/succession')
    const validated = CreateVoteSchema.parse({
      ...data,
      voter_member_id: user.id,
    })

    const { data: vote, error } = await supabase
      .from('succession_votes')
      .insert(validated)
      .select(`
        *,
        meeting:succession_meetings (id, meeting_date, meeting_type),
        position:succession_positions (id, title, hierarchy_level),
        nominee:members!succession_votes_nominee_id_fkey (id, first_name, last_name, avatar_url),
        voter:members!succession_votes_voter_member_id_fkey (id, first_name, last_name)
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'You have already voted for this nominee in this meeting',
        }
      }
      throw error
    }

    revalidatePath('/succession/admin/meetings')
    revalidatePath(`/succession/admin/meetings/${validated.meeting_id}`)
    return { success: true, data: vote }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error submitting vote:', error)
    return { success: false, error: 'Failed to submit vote' }
  }
}

/**
 * Update a vote
 * Can only update your own vote
 */
export async function updateVote(
  id: string,
  vote: 'yes' | 'no' | 'abstain',
  comments?: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Check ownership
    const { data: existing } = await supabase
      .from('succession_votes')
      .select('voter_member_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'Vote not found' }
    }

    if (existing.voter_member_id !== user.id) {
      return { success: false, error: 'You can only update your own votes' }
    }

    const { data: updatedVote, error } = await supabase
      .from('succession_votes')
      .update({
        vote,
        comments: comments || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        meeting:succession_meetings (id, meeting_date, meeting_type),
        position:succession_positions (id, title, hierarchy_level),
        nominee:members!succession_votes_nominee_id_fkey (id, first_name, last_name, avatar_url)
      `)
      .single()

    if (error) throw error

    revalidatePath('/succession/admin/meetings')
    return { success: true, data: updatedVote }
  } catch (error: any) {
    console.error('Error updating vote:', error)
    return { success: false, error: 'Failed to update vote' }
  }
}

/**
 * Delete a vote
 * Can only delete your own vote before meeting is completed
 */
export async function deleteVote(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Check ownership and meeting status
    const { data: vote } = await supabase
      .from('succession_votes')
      .select(`
        voter_member_id,
        meeting:succession_meetings (status)
      `)
      .eq('id', id)
      .single()

    if (!vote) {
      return { success: false, error: 'Vote not found' }
    }

    if (vote.voter_member_id !== user.id) {
      return { success: false, error: 'You can only delete your own votes' }
    }

    if ((vote.meeting as any).status === 'completed') {
      return {
        success: false,
        error: 'Cannot delete votes from completed meetings',
      }
    }

    const { error } = await supabase
      .from('succession_votes')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/succession/admin/meetings')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting vote:', error)
    return { success: false, error: 'Failed to delete vote' }
  }
}

// ============================================================================
// TIMELINE AUTOMATION SERVER ACTIONS
// ============================================================================

/**
 * Seed timeline steps for a succession cycle
 * Creates the standard 7-week workflow automatically
 * Admin only action
 */
export async function seedTimelineSteps(
  cycleId: string,
  startDate: Date
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Define the 7-week succession timeline
    const timelineSteps = [
      {
        step_number: 1,
        step_name: 'Nominations Open',
        description: 'Members can nominate candidates for leadership positions',
        duration_days: 7,
        auto_trigger_action: 'open_nominations',
      },
      {
        step_number: 2,
        step_name: 'Self Applications',
        description: 'Members can self-apply for eligible positions',
        duration_days: 7,
        auto_trigger_action: 'open_applications',
      },
      {
        step_number: 3,
        step_name: 'Evaluation & Scoring',
        description: 'Evaluators score nominees based on criteria',
        duration_days: 7,
        auto_trigger_action: 'start_evaluations',
      },
      {
        step_number: 4,
        step_name: 'Regional Chair Review',
        description: 'RC reviews top candidates and provides feedback',
        duration_days: 7,
        auto_trigger_action: 'notify_rc',
      },
      {
        step_number: 5,
        step_name: 'Steering Committee Meeting',
        description: 'Committee meets to vote on final candidates',
        duration_days: 7,
        auto_trigger_action: 'schedule_meeting',
      },
      {
        step_number: 6,
        step_name: 'Candidate Approach',
        description: 'Selected candidates are approached for acceptance',
        duration_days: 7,
        auto_trigger_action: 'approach_candidates',
      },
      {
        step_number: 7,
        step_name: 'Final Selection & Announcement',
        description: 'Final selections confirmed and announced',
        duration_days: 7,
        auto_trigger_action: 'announce_results',
      },
    ]

    // Calculate dates for each step
    let currentDate = new Date(startDate)
    const stepsToInsert = timelineSteps.map((step) => {
      const stepStartDate = new Date(currentDate)
      const stepEndDate = new Date(currentDate)
      stepEndDate.setDate(stepEndDate.getDate() + step.duration_days - 1)

      const stepData = {
        cycle_id: cycleId,
        step_number: step.step_number,
        step_name: step.step_name,
        description: step.description,
        start_date: stepStartDate.toISOString().split('T')[0],
        end_date: stepEndDate.toISOString().split('T')[0],
        status: 'pending' as const,
        auto_trigger_action: step.auto_trigger_action,
      }

      // Move to next week
      currentDate.setDate(currentDate.getDate() + step.duration_days)

      return stepData
    })

    const { data: insertedSteps, error } = await supabase
      .from('succession_timeline_steps')
      .insert(stepsToInsert)
      .select()

    if (error) throw error

    revalidatePath(`/succession/admin/cycles/${cycleId}`)
    revalidatePath('/succession/admin/timeline')
    return { success: true, data: { count: insertedSteps?.length || 0 } }
  } catch (error: any) {
    console.error('Error seeding timeline steps:', error)
    return { success: false, error: 'Failed to seed timeline steps' }
  }
}

/**
 * Auto-create succession cycle (typically triggered on Sept 1st)
 * Creates a new cycle and seeds timeline steps
 * Can be called via scheduled job or Edge Function
 */
export async function autoCreateSuccessionCycle(
  year: number
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check if cycle already exists for this year
    const { data: existingCycle } = await supabase
      .from('succession_cycles')
      .select('id')
      .eq('year', year)
      .single()

    if (existingCycle) {
      return {
        success: false,
        error: `Succession cycle for ${year} already exists`,
      }
    }

    // Create the new cycle
    const cycleName = `Leadership Succession ${year}`
    const startDate = new Date(year, 8, 1) // Sept 1 (month is 0-indexed)
    const endDate = new Date(year, 10, 15) // Nov 15 (7 weeks + buffer)

    const { data: cycle, error: cycleError } = await supabase
      .from('succession_cycles')
      .insert({
        year,
        cycle_name: cycleName,
        description: `Annual leadership succession cycle for ${year}`,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
        version: 1,
      })
      .select()
      .single()

    if (cycleError) throw cycleError

    // Seed timeline steps
    const timelineResult = await seedTimelineSteps(cycle.id, startDate)

    if (!timelineResult.success) {
      console.error('Failed to seed timeline steps:', timelineResult.error)
    }

    revalidatePath('/succession/admin/cycles')
    revalidatePath('/succession')
    return {
      success: true,
      data: {
        cycle,
        timelineStepsCreated: timelineResult.data?.count || 0,
      },
    }
  } catch (error: any) {
    console.error('Error auto-creating succession cycle:', error)
    return { success: false, error: 'Failed to auto-create succession cycle' }
  }
}
