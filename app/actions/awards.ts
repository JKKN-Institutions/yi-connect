// ============================================================================
// Module 6: Take Pride Award Automation - Server Actions
// Description: Server Actions for all award mutations with validation
// ============================================================================

'use server'

import { updateTag, revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  CreateAwardCategorySchema,
  UpdateAwardCategorySchema,
  CreateAwardCycleSchema,
  UpdateAwardCycleSchema,
  CreateNominationSchema,
  UpdateNominationSchema,
  AssignJuryMemberSchema,
  CreateJuryScoreSchema,
  UpdateJuryScoreSchema,
  CreateAwardWinnerSchema,
  AnnounceWinnersSchema,
} from '@/lib/validations/award'

// ============================================================================
// SHARED TYPES
// ============================================================================

type FormState = {
  success?: boolean
  message?: string
  errors?: {
    [key: string]: string[]
  }
}

// ============================================================================
// AWARD CATEGORY ACTIONS
// ============================================================================

export async function createAwardCategory(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = CreateAwardCategorySchema.safeParse({
    chapter_id: formData.get('chapter_id'),
    name: formData.get('name'),
    description: formData.get('description'),
    frequency: formData.get('frequency'),
    icon: formData.get('icon'),
    color: formData.get('color'),
    sort_order: formData.get('sort_order') ? Number(formData.get('sort_order')) : undefined,
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_categories')
    .insert([validation.data])
    .select()
    .single()

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  // Instant cache invalidation
  updateTag('award-categories')

  redirect(`/awards/admin/categories`)
}

export async function updateAwardCategory(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = UpdateAwardCategorySchema.safeParse({
    id,
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active') === 'true',
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('award_categories')
    .update(validation.data)
    .eq('id', id)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('award-categories')
  updateTag(`award-category-${id}`)

  return { success: true, message: 'Category updated successfully' }
}

export async function deleteAwardCategory(id: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  // Check if category has cycles
  const { count } = await supabase
    .from('award_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return { message: 'Cannot delete category with existing award cycles' }
  }

  const { error } = await supabase
    .from('award_categories')
    .delete()
    .eq('id', id)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('award-categories')
  revalidatePath('/awards/admin/categories')

  return { success: true, message: 'Category deleted successfully' }
}

// ============================================================================
// AWARD CYCLE ACTIONS
// ============================================================================

export async function createAwardCycle(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = CreateAwardCycleSchema.safeParse({
    category_id: formData.get('category_id'),
    cycle_name: formData.get('cycle_name'),
    year: Number(formData.get('year')),
    period_identifier: formData.get('period_identifier'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    nomination_deadline: formData.get('nomination_deadline'),
    jury_deadline: formData.get('jury_deadline'),
    description: formData.get('description'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_cycles')
    .insert([validation.data])
    .select()
    .single()

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('award-cycles')

  redirect(`/awards/admin/cycles/${data.id}`)
}

export async function updateAwardCycle(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = UpdateAwardCycleSchema.safeParse({
    id,
    cycle_name: formData.get('cycle_name'),
    description: formData.get('description'),
    status: formData.get('status'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('award_cycles')
    .update(validation.data)
    .eq('id', id)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('award-cycles')
  updateTag(`award-cycle-${id}`)

  return { success: true, message: 'Cycle updated successfully' }
}

export async function openCycle(cycleId: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('award_cycles')
    .update({ status: 'open' })
    .eq('id', cycleId)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('award-cycles')
  updateTag(`award-cycle-${cycleId}`)
  updateTag('active-cycles')

  return { success: true, message: 'Cycle opened for nominations' }
}

export async function closeCycle(cycleId: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('award_cycles')
    .update({ status: 'nominations_closed' })
    .eq('id', cycleId)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('award-cycles')
  updateTag(`award-cycle-${cycleId}`)
  updateTag('active-cycles')

  return { success: true, message: 'Cycle closed for nominations' }
}

// ============================================================================
// NOMINATION ACTIONS
// ============================================================================

export async function createNomination(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = CreateNominationSchema.safeParse({
    cycle_id: formData.get('cycle_id'),
    nominee_id: formData.get('nominee_id'),
    nominator_id: formData.get('nominator_id'),
    justification: formData.get('justification'),
    status: formData.get('status') || 'draft',
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  // Check eligibility
  const { data: eligibility } = await supabase
    .rpc('check_nomination_eligibility', {
      p_member_id: validation.data.nominee_id,
      p_cycle_id: validation.data.cycle_id,
    })

  if (eligibility && eligibility.length > 0 && !eligibility[0].is_eligible) {
    return { message: eligibility[0].reason }
  }

  const { data, error } = await supabase
    .from('nominations')
    .insert([validation.data])
    .select()
    .single()

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('nominations')
  updateTag(`my-nominations-${validation.data.nominator_id}`)

  if (validation.data.status === 'submitted') {
    updateTag(`eligibility-${validation.data.nominee_id}-${validation.data.cycle_id}`)
    return { success: true, message: 'Nomination submitted successfully' }
  }

  redirect(`/awards/nominations/${data.id}/edit`)
}

export async function updateNomination(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = UpdateNominationSchema.safeParse({
    id,
    justification: formData.get('justification'),
    status: formData.get('status'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check the form.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('nominations')
    .update(validation.data)
    .eq('id', id)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('nominations')
  updateTag(`nomination-${id}`)

  return { success: true, message: 'Nomination updated successfully' }
}

export async function submitNomination(nominationId: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('nominations')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', nominationId)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('nominations')
  updateTag(`nomination-${nominationId}`)

  redirect('/awards/nominations')
}

export async function deleteNomination(nominationId: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('nominations')
    .delete()
    .eq('id', nominationId)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('nominations')
  revalidatePath('/awards/nominations')

  return { success: true, message: 'Nomination deleted successfully' }
}

// ============================================================================
// JURY MEMBER ACTIONS
// ============================================================================

export async function assignJuryMember(data: {
  cycle_id: string
  member_id: string
  assigned_by?: string
}): Promise<FormState> {
  const validation = AssignJuryMemberSchema.safeParse(data)

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid data',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('jury_members')
    .insert([validation.data])

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('jury-members')
  updateTag(`jury-cycle-${validation.data.cycle_id}`)

  return { success: true, message: 'Jury member assigned successfully' }
}

export async function removeJuryMember(juryMemberId: string): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  // Check if jury member has submitted any scores
  const { count } = await supabase
    .from('jury_scores')
    .select('id', { count: 'exact', head: true })
    .eq('jury_member_id', juryMemberId)

  if (count && count > 0) {
    return { message: 'Cannot remove jury member who has submitted scores' }
  }

  const { error } = await supabase
    .from('jury_members')
    .delete()
    .eq('id', juryMemberId)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('jury-members')

  return { success: true, message: 'Jury member removed successfully' }
}

// ============================================================================
// JURY SCORE ACTIONS
// ============================================================================

export async function submitJuryScore(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = CreateJuryScoreSchema.safeParse({
    nomination_id: formData.get('nomination_id'),
    jury_member_id: formData.get('jury_member_id'),
    impact_score: Number(formData.get('impact_score')),
    innovation_score: Number(formData.get('innovation_score')),
    participation_score: Number(formData.get('participation_score')),
    consistency_score: Number(formData.get('consistency_score')),
    leadership_score: Number(formData.get('leadership_score')),
    comments: formData.get('comments'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check all scores.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('jury_scores')
    .insert([validation.data])

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('jury-scores')
  updateTag(`scores-nomination-${validation.data.nomination_id}`)
  updateTag(`score-calc-${validation.data.nomination_id}`)
  updateTag('nominations')

  return { success: true, message: 'Score submitted successfully' }
}

export async function updateJuryScore(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validation = UpdateJuryScoreSchema.safeParse({
    id,
    impact_score: Number(formData.get('impact_score')),
    innovation_score: Number(formData.get('innovation_score')),
    participation_score: Number(formData.get('participation_score')),
    consistency_score: Number(formData.get('consistency_score')),
    leadership_score: Number(formData.get('leadership_score')),
    comments: formData.get('comments'),
  })

  if (!validation.success) {
    return {
      errors: validation.error.flatten().fieldErrors,
      message: 'Invalid fields. Please check all scores.',
    }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('jury_scores')
    .update(validation.data)
    .eq('id', id)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  updateTag('jury-scores')

  return { success: true, message: 'Score updated successfully' }
}

// ============================================================================
// AWARD WINNER ACTIONS
// ============================================================================

export async function selectWinners(cycleId: string, winners: Array<{
  nomination_id: string
  rank: number
  final_score: number
}>): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  // Validate all winners
  for (const winner of winners) {
    const validation = CreateAwardWinnerSchema.safeParse({
      cycle_id: cycleId,
      ...winner,
    })

    if (!validation.success) {
      return { message: `Invalid winner data for rank ${winner.rank}` }
    }
  }

  // Insert winners
  const { error } = await supabase
    .from('award_winners')
    .insert(winners.map(w => ({ cycle_id: cycleId, ...w })))

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  // Update nominations status
  await supabase
    .from('nominations')
    .update({ status: 'winner' })
    .in('id', winners.map(w => w.nomination_id))

  updateTag('award-winners')
  updateTag(`winners-cycle-${cycleId}`)
  updateTag('nominations')

  return { success: true, message: 'Winners selected successfully' }
}

export async function announceWinners(
  cycleId: string,
  announcedBy: string
): Promise<FormState> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('award_winners')
    .update({
      announced_at: new Date().toISOString(),
      announced_by: announcedBy,
      announcement_sent: true,
    })
    .eq('cycle_id', cycleId)

  if (error) {
    return { message: `Database error: ${error.message}` }
  }

  // Update cycle status
  await supabase
    .from('award_cycles')
    .update({ status: 'completed', winners_announced_at: new Date().toISOString() })
    .eq('id', cycleId)

  updateTag('award-winners')
  updateTag(`winners-cycle-${cycleId}`)
  updateTag('award-cycles')
  updateTag(`award-cycle-${cycleId}`)
  updateTag('leaderboard')

  return { success: true, message: 'Winners announced successfully' }
}
