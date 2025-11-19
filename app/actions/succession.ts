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

    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.phase_configs === 'string') {
      data.phase_configs = JSON.parse(data.phase_configs)
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

    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.phase_configs === 'string') {
      data.phase_configs = JSON.parse(data.phase_configs)
    }
    if (typeof data.selection_committee_ids === 'string') {
      data.selection_committee_ids = JSON.parse(data.selection_committee_ids)
    }

    const validated = UpdateSuccessionCycleSchema.parse({ ...data, id })

    // Get current version for optimistic locking
    const { data: current } = await supabase
      .from('succession_cycles')
      .select('version')
      .eq('id', id)
      .single()

    if (!current) {
      return { success: false, error: 'Cycle not found' }
    }

    const { data: cycle, error } = await supabase
      .from('succession_cycles')
      .update({
        ...validated,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('version', current.version) // Optimistic locking
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

    revalidatePath('/succession/admin/cycles')
    revalidatePath(`/succession/admin/cycles/${id}`)
    revalidatePath('/succession')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating succession cycle:', error)
    return { success: false, error: 'Failed to update succession cycle' }
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

    revalidatePath('/succession/admin/cycles')
    revalidatePath(`/succession/admin/cycles/${cycleId}`)
    revalidatePath('/succession')
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
    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.eligibility_criteria === 'string') {
      data.eligibility_criteria = JSON.parse(data.eligibility_criteria)
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
    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.eligibility_criteria === 'string') {
      data.eligibility_criteria = JSON.parse(data.eligibility_criteria)
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
