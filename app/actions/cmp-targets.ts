'use server'

// ================================================
// CMP Targets Server Actions
// ================================================
// Server actions for managing CMP (Common Minimum Program) targets
// Includes proper role-based authorization
// ================================================

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createCMPTarget,
  updateCMPTarget,
  deleteCMPTarget,
  createDefaultCMPTargets,
  copyCMPTargetsToYear,
} from '@/lib/data/cmp-targets'
import {
  createCMPTargetSchema,
  updateCMPTargetSchema,
  type CreateCMPTargetSchemaInput,
  type UpdateCMPTargetSchemaInput,
} from '@/lib/validations/cmp-targets'
import { getCurrentCalendarYear } from '@/types/cmp-targets'

// ================================================
// ACTION RESULT TYPE
// ================================================

interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ================================================
// HELPER: Revalidate CMP paths
// ================================================

function revalidateCMPPaths() {
  revalidatePath('/pathfinder/cmp-targets', 'page')
  revalidatePath('/pathfinder/dashboard', 'page')
  revalidatePath('/pathfinder', 'page')
}

// ================================================
// CREATE CMP TARGET
// ================================================

/**
 * Create a new CMP target
 * Requires: Super Admin, National Admin, Chair, or Co-Chair role
 */
export async function createCMPTargetAction(
  input: CreateCMPTargetSchemaInput
): Promise<ActionResult> {
  try {
    // Check permissions - only admins and chairs can create targets
    const { user } = await requireRole([
      'Super Admin',
      'National Admin',
      'Chair',
      'Co-Chair',
    ])

    // Validate input
    const validated = createCMPTargetSchema.safeParse(input)
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || 'Invalid input',
      }
    }

    // Set default calendar year if not provided
    const calendarYear = validated.data.calendar_year || getCurrentCalendarYear()

    // Create the target
    const target = await createCMPTarget({
      vertical_id: validated.data.vertical_id,
      calendar_year: calendarYear,
      min_activities: validated.data.min_activities,
      min_participants: validated.data.min_participants,
      min_ec_participation: validated.data.min_ec_participation,
      min_awareness_activities: validated.data.min_awareness_activities ?? null,
      min_action_activities: validated.data.min_action_activities ?? null,
      min_advocacy_activities: validated.data.min_advocacy_activities ?? null,
      chapter_id: validated.data.chapter_id ?? null,
      is_national_target: validated.data.is_national_target,
      description: validated.data.description ?? null,
      created_by: user.id,
    })

    revalidateCMPPaths()

    return { success: true, data: target }
  } catch (error) {
    console.error('Create CMP target error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create CMP target',
    }
  }
}

// ================================================
// UPDATE CMP TARGET
// ================================================

/**
 * Update an existing CMP target
 * Requires: Super Admin, National Admin, Chair, or Co-Chair role
 */
export async function updateCMPTargetAction(
  input: UpdateCMPTargetSchemaInput
): Promise<ActionResult> {
  try {
    // Check permissions
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    // Validate input
    const validated = updateCMPTargetSchema.safeParse(input)
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || 'Invalid input',
      }
    }

    const { id, ...updateData } = validated.data

    // Update the target
    const target = await updateCMPTarget(id, updateData)

    revalidateCMPPaths()

    return { success: true, data: target }
  } catch (error) {
    console.error('Update CMP target error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update CMP target',
    }
  }
}

// ================================================
// DELETE CMP TARGET
// ================================================

/**
 * Delete a CMP target
 * Requires: Super Admin or National Admin role (higher level for deletion)
 */
export async function deleteCMPTargetAction(
  id: string
): Promise<ActionResult> {
  try {
    // Only admins can delete targets
    await requireRole(['Super Admin', 'National Admin'])

    // Validate ID
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid target ID' }
    }

    await deleteCMPTarget(id)

    revalidateCMPPaths()

    return { success: true }
  } catch (error) {
    console.error('Delete CMP target error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete CMP target',
    }
  }
}

// ================================================
// CREATE DEFAULT TARGETS
// ================================================

/**
 * Create default CMP targets for all verticals for a calendar year
 * Requires: Super Admin, National Admin, Chair, or Co-Chair role
 */
export async function createDefaultTargetsAction(
  calendarYear: number,
  chapterId?: string
): Promise<ActionResult<{ count: number }>> {
  try {
    // Check permissions
    const { user } = await requireRole([
      'Super Admin',
      'National Admin',
      'Chair',
      'Co-Chair',
    ])

    // Validate input
    if (!calendarYear || calendarYear < 2020 || calendarYear > 2100) {
      return { success: false, error: 'Invalid calendar year' }
    }

    const result = await createDefaultCMPTargets(calendarYear, chapterId, user.id)

    if (result.count === 0) {
      return {
        success: false,
        error: 'No targets were created. Targets may already exist for this year.',
      }
    }

    revalidateCMPPaths()

    return { success: true, data: result }
  } catch (error) {
    console.error('Create default targets error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create default targets',
    }
  }
}

// ================================================
// COPY TARGETS TO NEW YEAR
// ================================================

/**
 * Copy CMP targets from one calendar year to another
 * Requires: Super Admin, National Admin, Chair, or Co-Chair role
 */
export async function copyTargetsToYearAction(
  sourceYear: number,
  targetYear: number,
  chapterId?: string
): Promise<ActionResult<{ count: number }>> {
  try {
    // Check permissions
    const { user } = await requireRole([
      'Super Admin',
      'National Admin',
      'Chair',
      'Co-Chair',
    ])

    // Validate input
    if (!sourceYear || sourceYear < 2020 || sourceYear > 2100) {
      return { success: false, error: 'Invalid source year' }
    }
    if (!targetYear || targetYear < 2020 || targetYear > 2100) {
      return { success: false, error: 'Invalid target year' }
    }
    if (sourceYear === targetYear) {
      return { success: false, error: 'Source and target years must be different' }
    }

    const result = await copyCMPTargetsToYear(
      sourceYear,
      targetYear,
      chapterId,
      user.id
    )

    if (result.count === 0) {
      return {
        success: false,
        error: 'No targets were copied. Source year may have no targets.',
      }
    }

    revalidateCMPPaths()

    return { success: true, data: result }
  } catch (error) {
    console.error('Copy targets to year error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to copy targets',
    }
  }
}

// ================================================
// RECORD CMP PROGRESS (via Health Card Entry)
// ================================================

/**
 * Record actual progress against a CMP target
 * This creates a health card entry that contributes to the target
 * Requires: Any authenticated member with appropriate chapter access
 */
export async function recordCMPProgressAction(
  targetId: string,
  data: {
    activity_count: number
    participant_count: number
    ec_members_count: number
    non_ec_members_count: number
    aaa_type: 'awareness' | 'action' | 'advocacy'
    activity_date: string
    description?: string
    event_id?: string
  }
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get the target to know vertical_id and chapter_id
    const { data: target, error: targetError } = await supabase
      .from('cmp_targets')
      .select('vertical_id, calendar_year, chapter_id, is_national_target')
      .eq('id', targetId)
      .single()

    if (targetError || !target) {
      return { success: false, error: 'Target not found' }
    }

    // Get user's chapter
    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('id', user.id)
      .single()

    const chapterId = member?.chapter_id || target.chapter_id

    if (!chapterId) {
      return { success: false, error: 'No chapter associated with this progress entry' }
    }

    // Create health card entry
    const { data: entry, error: insertError } = await supabase
      .from('health_card_entries')
      .insert({
        vertical_id: target.vertical_id,
        chapter_id: chapterId,
        calendar_year: target.calendar_year,
        activity_count: data.activity_count,
        ec_members_count: data.ec_members_count,
        non_ec_members_count: data.non_ec_members_count,
        aaa_type: data.aaa_type,
        activity_date: data.activity_date,
        description: data.description || null,
        event_id: data.event_id || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error recording progress:', insertError)
      return { success: false, error: 'Failed to record progress' }
    }

    revalidateCMPPaths()

    return { success: true, data: entry }
  } catch (error) {
    console.error('Record CMP progress error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record progress',
    }
  }
}

// ================================================
// BATCH UPDATE TARGETS
// ================================================

/**
 * Update multiple CMP targets at once
 * Useful for bulk adjustments
 * Requires: Super Admin or National Admin role
 */
export async function batchUpdateTargetsAction(
  updates: { id: string; min_activities?: number; min_participants?: number; min_ec_participation?: number }[]
): Promise<ActionResult<{ updated: number }>> {
  try {
    // Only admins can batch update
    await requireRole(['Super Admin', 'National Admin'])

    if (!updates || updates.length === 0) {
      return { success: false, error: 'No updates provided' }
    }

    const supabase = await createServerSupabaseClient()
    let updatedCount = 0

    // Update each target
    for (const update of updates) {
      const { id, ...data } = update

      // Only include non-undefined fields
      const updateData: Record<string, number> = {}
      if (data.min_activities !== undefined) updateData.min_activities = data.min_activities
      if (data.min_participants !== undefined) updateData.min_participants = data.min_participants
      if (data.min_ec_participation !== undefined) updateData.min_ec_participation = data.min_ec_participation

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('cmp_targets')
          .update(updateData)
          .eq('id', id)

        if (!error) {
          updatedCount++
        }
      }
    }

    revalidateCMPPaths()

    return { success: true, data: { updated: updatedCount } }
  } catch (error) {
    console.error('Batch update targets error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to batch update targets',
    }
  }
}

// ================================================
// TOGGLE NATIONAL TARGET
// ================================================

/**
 * Toggle whether a target is a national target or chapter-specific
 * Requires: Super Admin or National Admin role
 */
export async function toggleNationalTargetAction(
  id: string,
  isNational: boolean
): Promise<ActionResult> {
  try {
    // Only admins can change national target status
    await requireRole(['Super Admin', 'National Admin'])

    const target = await updateCMPTarget(id, {
      is_national_target: isNational,
      // Clear chapter_id if making it national
      chapter_id: isNational ? null : undefined,
    })

    revalidateCMPPaths()

    return { success: true, data: target }
  } catch (error) {
    console.error('Toggle national target error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update target',
    }
  }
}
