'use server'

/**
 * CMP Targets Server Actions
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createCMPTargetSchema,
  updateCMPTargetSchema,
} from '@/lib/validations/cmp-targets'
import type { CreateCMPTargetInput, UpdateCMPTargetInput } from '@/types/cmp-targets'

// ============================================================================
// CREATE
// ============================================================================

export async function createCMPTargetAction(input: CreateCMPTargetInput) {
  const supabase = await createClient()

  // Validate input
  const validated = createCMPTargetSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid input',
    }
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Set default fiscal year if not provided
  const fiscalYear = validated.data.fiscal_year || new Date().getFullYear()

  // Insert target
  const { data, error } = await supabase
    .from('cmp_targets')
    .insert({
      ...validated.data,
      fiscal_year: fiscalYear,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating CMP target:', error)
    if (error.code === '23505') {
      return {
        success: false,
        error: 'A target already exists for this vertical and fiscal year',
      }
    }
    return { success: false, error: 'Failed to create CMP target' }
  }

  revalidatePath('/pathfinder/cmp-targets', 'page')
  revalidatePath('/pathfinder/dashboard', 'page')
  revalidateTag('cmp-targets', 'max')

  return { success: true, data }
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateCMPTargetAction(input: UpdateCMPTargetInput) {
  const supabase = await createClient()

  // Validate input
  const validated = updateCMPTargetSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || 'Invalid input',
    }
  }

  const { id, ...updateData } = validated.data

  // Update target
  const { data, error } = await supabase
    .from('cmp_targets')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating CMP target:', error)
    return { success: false, error: 'Failed to update CMP target' }
  }

  revalidatePath('/pathfinder/cmp-targets', 'page')
  revalidatePath('/pathfinder/dashboard', 'page')
  revalidateTag('cmp-targets', 'max')

  return { success: true, data }
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteCMPTargetAction(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('cmp_targets').delete().eq('id', id)

  if (error) {
    console.error('Error deleting CMP target:', error)
    return { success: false, error: 'Failed to delete CMP target' }
  }

  revalidatePath('/pathfinder/cmp-targets', 'page')
  revalidatePath('/pathfinder/dashboard', 'page')
  revalidateTag('cmp-targets', 'max')

  return { success: true }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export async function createDefaultTargetsAction(
  fiscalYear: number,
  chapterId?: string
) {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get all verticals
  const { data: verticals, error: verticalError } = await supabase
    .from('verticals')
    .select('id, name')
    .eq('is_active', true)

  if (verticalError || !verticals) {
    return { success: false, error: 'Failed to fetch verticals' }
  }

  // Default targets based on vertical type
  const defaultTargets = verticals.map((v) => ({
    vertical_id: v.id,
    fiscal_year: fiscalYear,
    min_activities: 4, // 1 per quarter
    min_participants: 50,
    min_ec_participation: 10,
    chapter_id: chapterId || null,
    is_national_target: !chapterId,
    created_by: user.id,
  }))

  // Insert all targets
  const { data, error } = await supabase
    .from('cmp_targets')
    .insert(defaultTargets)
    .select()

  if (error) {
    console.error('Error creating default targets:', error)
    if (error.code === '23505') {
      return {
        success: false,
        error: 'Targets already exist for some verticals',
      }
    }
    return { success: false, error: 'Failed to create default targets' }
  }

  revalidatePath('/pathfinder/cmp-targets', 'page')
  revalidatePath('/pathfinder/dashboard', 'page')
  revalidateTag('cmp-targets', 'max')

  return { success: true, data, count: data.length }
}
