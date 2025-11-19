'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  CreateAwardCategorySchema,
  UpdateAwardCategorySchema,
  CreateAwardCycleSchema,
  UpdateAwardCycleSchema,
  CreateNominationSchema,
  UpdateNominationSchema,
  CreateJuryScoreSchema,
  UpdateJuryScoreSchema,
} from '@/lib/validations/award'
import { z } from 'zod'

type ActionResult<T = any> = {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// CATEGORY ACTIONS
// ============================================================================

export async function createAwardCategory(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.criteria === 'string') {
      data.criteria = JSON.parse(data.criteria)
    }
    if (typeof data.scoring_weights === 'string') {
      data.scoring_weights = JSON.parse(data.scoring_weights)
    }

    const validated = CreateAwardCategorySchema.parse(data)

    const { data: category, error } = await supabase
      .from('award_categories')
      .insert(validated)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    revalidatePath('/awards')
    return { success: true, data: category }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to create category' }
  }
}

export async function updateAwardCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)

    if (typeof data.criteria === 'string') {
      data.criteria = JSON.parse(data.criteria)
    }
    if (typeof data.scoring_weights === 'string') {
      data.scoring_weights = JSON.parse(data.scoring_weights)
    }

    const validated = UpdateAwardCategorySchema.parse({ ...data, id })

    const { data: category, error } = await supabase
      .from('award_categories')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    revalidatePath(`/awards/admin/categories/${id}`)
    revalidatePath('/awards')
    return { success: true, data: category }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update category' }
  }
}

export async function deleteAwardCategory(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check if category has cycles
    const { count } = await supabase
      .from('award_cycles')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if (count && count > 0) {
      return {
        success: false,
        error: 'Cannot delete category with existing cycles',
      }
    }

    const { error } = await supabase
      .from('award_categories')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    revalidatePath('/awards')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete category' }
  }
}

export async function toggleCategoryStatus(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('award_categories')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    revalidatePath('/awards')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to update category status' }
  }
}

// ============================================================================
// CYCLE ACTIONS
// ============================================================================

export async function createAwardCycle(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)
    const validated = CreateAwardCycleSchema.parse(data)

    const { data: cycle, error } = await supabase
      .from('award_cycles')
      .insert(validated)
      .select(`
        *,
        category:award_categories (*)
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath('/awards')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to create cycle' }
  }
}

export async function updateAwardCycle(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)
    const validated = UpdateAwardCycleSchema.parse({ ...data, id })

    const { data: cycle, error } = await supabase
      .from('award_cycles')
      .update(validated)
      .eq('id', id)
      .select(`
        *,
        category:award_categories (*)
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath(`/awards/admin/cycles/${id}`)
    revalidatePath('/awards')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update cycle' }
  }
}

export async function advanceCycleStatus(
  id: string,
  newStatus: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('award_cycles')
      .update({
        status: newStatus,
        ...(newStatus === 'completed' && {
          winners_announced_at: new Date().toISOString(),
        }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath('/awards')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to update cycle status' }
  }
}

// ============================================================================
// NOMINATION ACTIONS
// ============================================================================

export async function submitNomination(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)

    // Parse array fields
    if (typeof data.supporting_evidence === 'string') {
      data.supporting_evidence = JSON.parse(data.supporting_evidence)
    }

    const validated = CreateNominationSchema.parse(data)

    const { data: nomination, error } = await supabase
      .from('nominations')
      .insert({
        ...validated,
        submitted_at:
          validated.status === 'submitted'
            ? new Date().toISOString()
            : null,
      })
      .select(`
        *,
        cycle:award_cycles (
          cycle_name,
          category:award_categories (name)
        ),
        nominee:members!nominations_nominee_id_fkey (
          first_name,
          last_name
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/nominations')
    revalidatePath('/awards/nominate')
    return { success: true, data: nomination }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to submit nomination' }
  }
}

export async function updateNomination(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)

    if (typeof data.supporting_evidence === 'string') {
      data.supporting_evidence = JSON.parse(data.supporting_evidence)
    }

    const validated = UpdateNominationSchema.parse({ ...data, id })

    const { data: nomination, error } = await supabase
      .from('nominations')
      .update({
        ...validated,
        ...(validated.status === 'submitted' && {
          submitted_at: new Date().toISOString(),
        }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/nominations')
    revalidatePath(`/awards/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update nomination' }
  }
}

export async function withdrawNomination(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('nominations')
      .update({ status: 'withdrawn' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/nominations')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to withdraw nomination' }
  }
}

export async function reviewNomination(
  id: string,
  status: 'approved' | 'rejected',
  reviewNotes: string,
  reviewedById: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: nomination, error } = await supabase
      .from('nominations')
      .update({
        status,
        review_notes: reviewNotes,
        reviewed_by_id: reviewedById,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/review')
    revalidatePath(`/awards/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error) {
    return { success: false, error: 'Failed to review nomination' }
  }
}

// ============================================================================
// JURY SCORING ACTIONS
// ============================================================================

export async function assignJuryMember(
  cycleId: string,
  memberId: string,
  assignedById: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check if already assigned
    const { data: existing } = await supabase
      .from('jury_members')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('member_id', memberId)
      .single()

    if (existing) {
      return { success: false, error: 'Member already assigned as jury' }
    }

    // Count nominations for this cycle
    const { count } = await supabase
      .from('nominations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId)
      .eq('status', 'approved')

    const { data, error } = await supabase
      .from('jury_members')
      .insert({
        cycle_id: cycleId,
        member_id: memberId,
        assigned_by_id: assignedById,
        total_nominations: count || 0,
      })
      .select(`
        *,
        member:members (
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath(`/awards/admin/cycles/${cycleId}`)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to assign jury member' }
  }
}

export async function submitJuryScores(
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)
    const validated = CreateJuryScoreSchema.parse(data)

    // Check if already scored
    const { data: existing } = await supabase
      .from('jury_scores')
      .select('id')
      .eq('nomination_id', validated.nomination_id)
      .eq('jury_member_id', validated.jury_member_id)
      .single()

    if (existing) {
      return {
        success: false,
        error: 'You have already scored this nomination',
      }
    }

    const { data: score, error } = await supabase
      .from('jury_scores')
      .insert(validated)
      .select()
      .single()

    if (error) throw error

    // Update jury member progress
    await supabase
      .from('jury_members')
      .update({ scored_nominations: supabase.rpc('increment', { x: 1 }) })
      .eq('id', validated.jury_member_id)

    revalidatePath('/awards/jury')
    revalidatePath(`/awards/jury/${validated.nomination_id}`)
    return { success: true, data: score }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to submit scores' }
  }
}

export async function updateJuryScores(
  scoreId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const data = Object.fromEntries(formData)
    const validated = UpdateJuryScoreSchema.parse({ ...data, id: scoreId })

    const { data: score, error } = await supabase
      .from('jury_scores')
      .update(validated)
      .eq('id', scoreId)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/jury')
    return { success: true, data: score }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update scores' }
  }
}

// ============================================================================
// WINNER ACTIONS
// ============================================================================

export async function declareWinners(
  cycleId: string,
  winners: Array<{ nomination_id: string; rank: number; final_score: number }>,
  announcedById: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Insert all winners
    const winnersData = winners.map((w) => ({
      cycle_id: cycleId,
      nomination_id: w.nomination_id,
      rank: w.rank,
      final_score: w.final_score,
      announced_by_id: announcedById,
      announced_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('award_winners')
      .insert(winnersData)
      .select(`
        *,
        nomination:nominations (
          nominee:members!nominations_nominee_id_fkey (
            first_name,
            last_name,
            email
          )
        )
      `)

    if (error) throw error

    // Update cycle status
    await supabase
      .from('award_cycles')
      .update({
        status: 'completed',
        winners_announced_at: new Date().toISOString(),
      })
      .eq('id', cycleId)

    revalidatePath('/awards/admin/review')
    revalidatePath('/awards/leaderboard')
    revalidatePath('/awards')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to declare winners' }
  }
}

export async function generateCertificate(
  winnerId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('award_winners')
      .update({
        certificate_generated: true,
        certificate_generated_at: new Date().toISOString(),
        certificate_url: `/certificates/${winnerId}.pdf`,
      })
      .eq('id', winnerId)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/leaderboard')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to generate certificate' }
  }
}
