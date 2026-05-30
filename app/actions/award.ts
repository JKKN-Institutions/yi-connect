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
      .schema('yi_connect').from('award_categories')
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
      .schema('yi_connect').from('award_categories')
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
      .schema('yi_connect').from('award_cycles')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if (count && count > 0) {
      return {
        success: false,
        error: 'Cannot delete category with existing cycles',
      }
    }

    const { error } = await supabase
      .schema('yi_connect').from('award_categories')
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
      .schema('yi_connect').from('award_categories')
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
      .schema('yi_connect').from('award_cycles')
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
      .schema('yi_connect').from('award_cycles')
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
      .schema('yi_connect').from('award_cycles')
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
      .schema('yi_connect').from('nominations')
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
        nominee:members!nominations_nominee_member_id_fkey (
          full_name
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
      .schema('yi_connect').from('nominations')
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
      .schema('yi_connect').from('nominations')
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
      .schema('yi_connect').from('nominations')
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

    // Step 1: Fetch the cycle to get its chapter_id
    const { data: cycle, error: cycleErr } = await supabase
      .schema('yi_connect').from('award_cycles')
      .select('id, chapter_id')
      .eq('id', cycleId)
      .single()

    if (cycleErr) throw cycleErr

    // Step 2: Resolve or create the default panel for this cycle
    const { data: existingPanel, error: panelFetchErr } = await supabase
      .schema('yi_connect').from('jury_panels')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('is_active', true)
      .maybeSingle()

    if (panelFetchErr) throw panelFetchErr

    let panelId: string

    if (existingPanel) {
      panelId = existingPanel.id
    } else {
      // Create the default panel using the cycle's chapter_id
      const { data: newPanel, error: panelInsertErr } = await supabase
        .schema('yi_connect').from('jury_panels')
        .insert({
          cycle_id: cycleId,
          chapter_id: cycle.chapter_id ?? null,
          panel_name: 'Default Panel',
          is_active: true,
          created_by: assignedById,
        })
        .select('id')
        .single()

      if (panelInsertErr) throw panelInsertErr
      panelId = newPanel.id
    }

    // Step 3: Guard duplicate — check if member is already on this panel
    const { data: existingMember } = await supabase
      .schema('yi_connect').from('jury_panel_members')
      .select('id')
      .eq('panel_id', panelId)
      .eq('juror_id', memberId)
      .maybeSingle()

    if (existingMember) {
      return { success: false, error: 'Member is already assigned to the jury panel for this cycle' }
    }

    // Step 4: Insert the panel member
    const { data: panelMember, error: insertErr } = await supabase
      .schema('yi_connect').from('jury_panel_members')
      .insert({
        panel_id: panelId,
        juror_id: memberId,
        role: 'juror',
        is_active: true,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    revalidatePath('/awards/admin/jury')
    return { success: true, data: panelMember }
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

    // jury_scores.jury_member_id renamed to juror_id in current schema
    const { data: existing } = await supabase
      .schema('yi_connect').from('jury_scores')
      .select('id')
      .eq('nomination_id', validated.nomination_id)
      .eq('juror_id', validated.jury_member_id)
      .single()

    if (existing) {
      return {
        success: false,
        error: 'You have already scored this nomination',
      }
    }

    const { data: score, error } = await supabase
      .schema('yi_connect').from('jury_scores')
      .insert(validated)
      .select()
      .single()

    if (error) throw error

    // Progress is derived on read via COUNT(*) FROM jury_scores WHERE juror_id = X — no write needed here.

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
      .schema('yi_connect').from('jury_scores')
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
  // announcedById retained for signature compatibility; nominations table has
  // no announced_by_id column, so it is intentionally unused.
  _announcedById: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Winner state lives on nominations (rank, final_score, awarded_at).
    // The previously-targeted award_winners table does not exist in yi_connect.
    const awardedAt = new Date().toISOString()
    const results: any[] = []

    for (const w of winners) {
      const { data, error } = await supabase
        .schema('yi_connect').from('nominations')
        .update({
          rank: w.rank,
          final_score: w.final_score,
          awarded_at: awardedAt,
          status: 'awarded',
        })
        .eq('id', w.nomination_id)
        .eq('cycle_id', cycleId)
        .select(`
          *,
          nominee:members!nominations_nominee_member_id_fkey (
            full_name,
            email
          )
        `)
        .single()

      if (error) throw error
      results.push(data)
    }

    // Update cycle status
    await supabase
      .schema('yi_connect').from('award_cycles')
      .update({
        status: 'completed',
        winners_announced_at: awardedAt,
      })
      .eq('id', cycleId)

    revalidatePath('/awards/admin/review')
    revalidatePath('/awards/leaderboard')
    revalidatePath('/awards')
    return { success: true, data: results }
  } catch (error) {
    return { success: false, error: 'Failed to declare winners' }
  }
}

export async function generateCertificate(
  // nominationId is the winning nomination row (since award_winners does not
  // exist, nominations is the source of truth for winner state).
  nominationId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Look up the nomination to derive recipient + award context for the cert.
    const { data: nom, error: nomErr } = await supabase
      .schema('yi_connect').from('nominations')
      .select(`
        id,
        cycle_id,
        title,
        citation,
        nominee:members!nominations_nominee_member_id_fkey (
          full_name
        )
      `)
      .eq('id', nominationId)
      .single()

    if (nomErr) throw nomErr

    const recipientName =
      (nom as any)?.nominee?.full_name ?? 'Recipient'

    const { data, error } = await supabase
      .schema('yi_connect').from('award_certificates')
      .insert({
        nomination_id: nominationId,
        cycle_id: (nom as any).cycle_id,
        recipient_name: recipientName,
        award_title: (nom as any).title ?? '',
        citation: (nom as any).citation ?? null,
        pdf_url: `/certificates/${nominationId}.pdf`,
        status: 'issued',
        issued_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/leaderboard')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to generate certificate' }
  }
}
