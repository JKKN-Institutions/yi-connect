'use server'

/**
 * Stretch Goals Server Actions
 */

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import {
  createStretchGoal,
  updateStretchGoal,
  deleteStretchGoal,
  createDefaultStretchGoals,
} from '@/lib/data/stretch-goals'
import {
  createStretchGoalSchema,
  updateStretchGoalSchema,
  type CreateStretchGoalSchemaInput,
  type UpdateStretchGoalSchemaInput,
} from '@/lib/validations/stretch-goals'
import { getCurrentFiscalYear } from '@/types/cmp-targets'

// ============================================================================
// CREATE
// ============================================================================

export async function createStretchGoalAction(
  input: CreateStretchGoalSchemaInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    // Validate input
    const validated = createStretchGoalSchema.parse(input)

    // Create the stretch goal
    await createStretchGoal({
      cmp_target_id: validated.cmp_target_id ?? null,
      vertical_id: validated.vertical_id,
      chapter_id: validated.chapter_id ?? null,
      fiscal_year: validated.fiscal_year ?? getCurrentFiscalYear(),
      stretch_activities: validated.stretch_activities,
      stretch_participants: validated.stretch_participants,
      stretch_ec_participation: validated.stretch_ec_participation,
      stretch_awareness: validated.stretch_awareness ?? null,
      stretch_action: validated.stretch_action ?? null,
      stretch_advocacy: validated.stretch_advocacy ?? null,
      name: validated.name ?? 'Stretch Goal',
      description: validated.description ?? null,
      reward_description: validated.reward_description ?? null,
      created_by: null, // Will be set by RLS
    })

    revalidatePath('/pathfinder/stretch-goals')
    return { success: true }
  } catch (error) {
    console.error('Create stretch goal error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create stretch goal',
    }
  }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateStretchGoalAction(
  input: UpdateStretchGoalSchemaInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    // Validate input
    const validated = updateStretchGoalSchema.parse(input)

    // Update the stretch goal
    await updateStretchGoal(validated.id, {
      stretch_activities: validated.stretch_activities,
      stretch_participants: validated.stretch_participants,
      stretch_ec_participation: validated.stretch_ec_participation,
      stretch_awareness: validated.stretch_awareness,
      stretch_action: validated.stretch_action,
      stretch_advocacy: validated.stretch_advocacy,
      name: validated.name,
      description: validated.description,
      reward_description: validated.reward_description,
      is_achieved: validated.is_achieved,
    })

    revalidatePath('/pathfinder/stretch-goals')
    return { success: true }
  } catch (error) {
    console.error('Update stretch goal error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update stretch goal',
    }
  }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteStretchGoalAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    await requireRole(['Super Admin', 'National Admin', 'Chair'])

    await deleteStretchGoal(id)

    revalidatePath('/pathfinder/stretch-goals')
    return { success: true }
  } catch (error) {
    console.error('Delete stretch goal error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete stretch goal',
    }
  }
}

// ============================================================================
// BULK CREATE
// ============================================================================

export async function createDefaultStretchGoalsAction(
  fiscalYear: number,
  chapterId?: string,
  multiplier?: number
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Check permissions
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    const result = await createDefaultStretchGoals(
      fiscalYear,
      chapterId,
      multiplier
    )

    if (result.count === 0) {
      return {
        success: false,
        error: 'No CMP targets found to create stretch goals from. Please set CMP targets first.',
      }
    }

    revalidatePath('/pathfinder/stretch-goals')
    return { success: true, count: result.count }
  } catch (error) {
    console.error('Create default stretch goals error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create stretch goals',
    }
  }
}

// ============================================================================
// MARK ACHIEVED
// ============================================================================

export async function markStretchGoalAchievedAction(
  id: string,
  achieved: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    await requireRole(['Super Admin', 'National Admin', 'Chair', 'Co-Chair'])

    await updateStretchGoal(id, {
      is_achieved: achieved,
      achieved_at: achieved ? new Date().toISOString() : null,
    })

    revalidatePath('/pathfinder/stretch-goals')
    return { success: true }
  } catch (error) {
    console.error('Mark stretch goal achieved error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update stretch goal',
    }
  }
}
