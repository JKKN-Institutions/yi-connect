/**
 * Vertical Performance Tracker Module Server Actions
 *
 * Server Actions for vertical performance tracking module mutations.
 * Handles verticals, plans, KPIs, activities, reviews, members, and achievements.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import {
  createVerticalSchema,
  updateVerticalSchema,
  deleteVerticalSchema,
  assignVerticalChairSchema,
  updateVerticalChairSchema,
  createVerticalPlanSchema,
  updateVerticalPlanSchema,
  approveVerticalPlanSchema,
  createKPISchema,
  updateKPISchema,
  recordKPIActualSchema,
  updateKPIActualSchema,
  addVerticalMemberSchema,
  updateVerticalMemberSchema,
  removeVerticalMemberSchema,
  createActivitySchema,
  updateActivitySchema,
  createPerformanceReviewSchema,
  updatePerformanceReviewSchema,
  publishPerformanceReviewSchema,
  createAchievementSchema,
  updateAchievementSchema,
  type CreateVerticalInput,
  type UpdateVerticalInput,
  type AssignVerticalChairInput,
  type UpdateVerticalChairInput,
  type CreateVerticalPlanInput,
  type UpdateVerticalPlanInput,
  type CreateKPIInput,
  type UpdateKPIInput,
  type RecordKPIActualInput,
  type UpdateKPIActualInput,
  type AddVerticalMemberInput,
  type UpdateVerticalMemberInput,
  type CreateActivityInput,
  type UpdateActivityInput,
  type CreatePerformanceReviewInput,
  type UpdatePerformanceReviewInput,
  type CreateAchievementInput,
  type UpdateAchievementInput,
} from '@/lib/validations/vertical'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Sanitize form data before sending to database
 * Converts empty strings to null for optional fields
 */
function sanitizeData<T extends Record<string, any>>(data: T): T {
  const sanitized = { ...data }
  for (const key in sanitized) {
    if (sanitized[key] === '') {
      sanitized[key] = null as any
    }
  }
  return sanitized
}

// ============================================================================
// VERTICAL ACTIONS
// ============================================================================

/**
 * Create a new vertical
 */
export async function createVertical(input: CreateVerticalInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createVerticalSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if slug is unique for this chapter
    const { data: existing } = await supabase
      .from('verticals')
      .select('id')
      .eq('chapter_id', sanitized.chapter_id)
      .eq('slug', sanitized.slug)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'A vertical with this slug already exists' }
    }

    // Create vertical
    const { data, error } = await supabase
      .from('verticals')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create vertical error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create vertical' }
  }
}

/**
 * Update a vertical
 */
export async function updateVertical(id: string, input: UpdateVerticalInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateVerticalSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // If slug is being updated, check uniqueness
    if (sanitized.slug) {
      const { data: existing } = await supabase
        .from('verticals')
        .select('id, chapter_id')
        .eq('id', id)
        .single()

      if (existing) {
        const { data: duplicate } = await supabase
          .from('verticals')
          .select('id')
          .eq('chapter_id', existing.chapter_id)
          .eq('slug', sanitized.slug)
          .neq('id', id)
          .maybeSingle()

        if (duplicate) {
          return { success: false, error: 'A vertical with this slug already exists' }
        }
      }
    }

    // Update vertical
    const { error } = await supabase
      .from('verticals')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    revalidatePath(`/verticals/${id}`)
    return { success: true }
  } catch (error) {
    console.error('Update vertical error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update vertical' }
  }
}

/**
 * Delete a vertical
 */
export async function deleteVertical(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Check if vertical has any plans
    const { data: plans } = await supabase
      .from('vertical_plans')
      .select('id')
      .eq('vertical_id', id)
      .limit(1)

    if (plans && plans.length > 0) {
      return { success: false, error: 'Cannot delete vertical with existing plans. Archive it instead.' }
    }

    // Delete vertical (cascade will handle chairs, members, etc.)
    const { error } = await supabase.from('verticals').delete().eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Delete vertical error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete vertical' }
  }
}

// ============================================================================
// VERTICAL CHAIR ACTIONS
// ============================================================================

/**
 * Assign a chair to a vertical
 */
export async function assignVerticalChair(input: AssignVerticalChairInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = assignVerticalChairSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Mark existing active chairs as inactive
    await supabase
      .from('vertical_chairs')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('vertical_id', sanitized.vertical_id)
      .eq('is_active', true)

    // Create new chair assignment
    const { data, error } = await supabase
      .from('vertical_chairs')
      .insert({ ...sanitized, is_active: true })
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    revalidatePath(`/verticals/${sanitized.vertical_id}`)
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Assign vertical chair error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to assign chair' }
  }
}

/**
 * Update a vertical chair
 */
export async function updateVerticalChair(id: string, input: UpdateVerticalChairInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateVerticalChairSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update chair
    const { error } = await supabase
      .from('vertical_chairs')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update vertical chair error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update chair' }
  }
}

// ============================================================================
// VERTICAL PLAN ACTIONS
// ============================================================================

/**
 * Create a vertical plan with KPIs
 */
export async function createVerticalPlan(input: CreateVerticalPlanInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createVerticalPlanSchema.parse(input)
    const { kpis, ...planData } = validated

    const supabase = await createClient()

    // Check if plan already exists for this vertical and fiscal year
    const { data: existing } = await supabase
      .from('vertical_plans')
      .select('id')
      .eq('vertical_id', planData.vertical_id)
      .eq('fiscal_year', planData.fiscal_year)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'A plan already exists for this fiscal year' }
    }

    // Create plan
    const { data: plan, error: planError } = await supabase
      .from('vertical_plans')
      .insert({
        ...sanitizeData(planData),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (planError) throw planError

    // Create KPIs if provided
    if (kpis && kpis.length > 0) {
      const kpisToInsert = kpis.map((kpi) => ({
        ...sanitizeData(kpi),
        plan_id: plan.id,
      }))

      const { error: kpisError } = await supabase.from('vertical_kpis').insert(kpisToInsert)

      if (kpisError) throw kpisError
    }

    revalidatePath('/verticals')
    revalidatePath(`/verticals/${planData.vertical_id}`)
    return { success: true, data: { id: plan.id } }
  } catch (error) {
    console.error('Create vertical plan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create plan' }
  }
}

/**
 * Update a vertical plan
 */
export async function updateVerticalPlan(id: string, input: UpdateVerticalPlanInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateVerticalPlanSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update plan
    const { error } = await supabase
      .from('vertical_plans')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update vertical plan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update plan' }
  }
}

/**
 * Approve a vertical plan
 */
export async function approveVerticalPlan(planId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Update plan status to approved
    const { error } = await supabase
      .from('vertical_plans')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Approve vertical plan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to approve plan' }
  }
}

/**
 * Activate a vertical plan (set as active)
 */
export async function activateVerticalPlan(planId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('vertical_plans')
      .select('vertical_id, fiscal_year, status')
      .eq('id', planId)
      .single()

    if (planError) throw planError
    if (!plan) {
      return { success: false, error: 'Plan not found' }
    }

    // Only approved plans can be activated
    if (plan.status !== 'approved') {
      return { success: false, error: 'Only approved plans can be activated' }
    }

    // Deactivate any existing active plan for this vertical and fiscal year
    await supabase
      .from('vertical_plans')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('vertical_id', plan.vertical_id)
      .eq('fiscal_year', plan.fiscal_year)
      .eq('status', 'active')

    // Activate this plan
    const { error } = await supabase
      .from('vertical_plans')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', planId)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Activate vertical plan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to activate plan' }
  }
}

// ============================================================================
// KPI ACTIONS
// ============================================================================

/**
 * Create a KPI for a plan
 */
export async function createKPI(input: CreateKPIInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createKPISchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Create KPI
    const { data, error } = await supabase
      .from('vertical_kpis')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create KPI error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create KPI' }
  }
}

/**
 * Update a KPI
 */
export async function updateKPI(id: string, input: UpdateKPIInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateKPISchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update KPI
    const { error } = await supabase
      .from('vertical_kpis')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update KPI error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update KPI' }
  }
}

/**
 * Delete a KPI
 */
export async function deleteKPI(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Delete KPI (cascade will handle actuals)
    const { error } = await supabase.from('vertical_kpis').delete().eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Delete KPI error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete KPI' }
  }
}

/**
 * Record KPI actual value
 */
export async function recordKPIActual(input: RecordKPIActualInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = recordKPIActualSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if actual already exists for this KPI and quarter
    const { data: existing } = await supabase
      .from('vertical_kpi_actuals')
      .select('id')
      .eq('kpi_id', sanitized.kpi_id)
      .eq('quarter', sanitized.quarter)
      .maybeSingle()

    if (existing) {
      // Update existing actual
      const { error } = await supabase
        .from('vertical_kpi_actuals')
        .update({
          actual_value: sanitized.actual_value,
          recorded_date: sanitized.recorded_date || new Date().toISOString().split('T')[0],
          notes: sanitized.notes,
          recorded_by: sanitized.recorded_by,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) throw error

      revalidatePath('/verticals')
      return { success: true, data: { id: existing.id } }
    } else {
      // Create new actual
      const { data, error } = await supabase
        .from('vertical_kpi_actuals')
        .insert({
          ...sanitized,
          recorded_date: sanitized.recorded_date || new Date().toISOString().split('T')[0],
        })
        .select('id')
        .single()

      if (error) throw error

      revalidatePath('/verticals')
      return { success: true, data: { id: data.id } }
    }
  } catch (error) {
    console.error('Record KPI actual error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to record KPI actual' }
  }
}

/**
 * Update KPI actual value
 */
export async function updateKPIActual(id: string, input: UpdateKPIActualInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateKPIActualSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update actual
    const { error } = await supabase
      .from('vertical_kpi_actuals')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update KPI actual error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update KPI actual' }
  }
}

// ============================================================================
// VERTICAL MEMBER ACTIONS
// ============================================================================

/**
 * Add a member to a vertical
 */
export async function addVerticalMember(input: AddVerticalMemberInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = addVerticalMemberSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if member is already in this vertical
    const { data: existing } = await supabase
      .from('vertical_members')
      .select('id, is_active')
      .eq('vertical_id', sanitized.vertical_id)
      .eq('member_id', sanitized.member_id)
      .maybeSingle()

    if (existing) {
      if (existing.is_active) {
        return { success: false, error: 'Member is already in this vertical' }
      } else {
        // Reactivate the member
        const { error } = await supabase
          .from('vertical_members')
          .update({
            is_active: true,
            joined_at: sanitized.joined_at || new Date().toISOString(),
            left_at: null,
            role: sanitized.role,
            contribution_notes: sanitized.contribution_notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) throw error

        revalidatePath('/verticals')
        return { success: true, data: { id: existing.id } }
      }
    }

    // Add new member
    const { data, error } = await supabase
      .from('vertical_members')
      .insert({
        ...sanitized,
        joined_at: sanitized.joined_at || new Date().toISOString(),
        is_active: true,
      })
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Add vertical member error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add member' }
  }
}

/**
 * Update a vertical member
 */
export async function updateVerticalMember(id: string, input: UpdateVerticalMemberInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateVerticalMemberSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update member
    const { error } = await supabase
      .from('vertical_members')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update vertical member error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update member' }
  }
}

/**
 * Remove a member from a vertical
 */
export async function removeVerticalMember(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Mark as inactive instead of deleting
    const { error } = await supabase
      .from('vertical_members')
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Remove vertical member error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to remove member' }
  }
}

// ============================================================================
// ACTIVITY ACTIONS
// ============================================================================

/**
 * Create a vertical activity
 */
export async function createActivity(input: CreateActivityInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createActivitySchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Create activity
    const { data, error } = await supabase
      .from('vertical_activities')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create activity error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create activity' }
  }
}

/**
 * Update a vertical activity
 */
export async function updateActivity(id: string, input: UpdateActivityInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateActivitySchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update activity
    const { error } = await supabase
      .from('vertical_activities')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update activity error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update activity' }
  }
}

/**
 * Delete a vertical activity
 */
export async function deleteActivity(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Delete activity
    const { error } = await supabase.from('vertical_activities').delete().eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Delete activity error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete activity' }
  }
}

// ============================================================================
// PERFORMANCE REVIEW ACTIONS
// ============================================================================

/**
 * Create a performance review
 */
export async function createPerformanceReview(
  input: CreatePerformanceReviewInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createPerformanceReviewSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Check if review already exists for this vertical, fiscal year, and quarter
    const { data: existing } = await supabase
      .from('vertical_performance_reviews')
      .select('id')
      .eq('vertical_id', sanitized.vertical_id)
      .eq('fiscal_year', sanitized.fiscal_year)
      .eq('quarter', sanitized.quarter)
      .maybeSingle()

    if (existing) {
      return { success: false, error: 'A review already exists for this period' }
    }

    // Create review
    const reviewPeriod = `FY${sanitized.fiscal_year}-Q${sanitized.quarter}`
    const { data, error } = await supabase
      .from('vertical_performance_reviews')
      .insert({
        ...sanitized,
        review_period: reviewPeriod,
        reviewed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create performance review error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create review' }
  }
}

/**
 * Update a performance review
 */
export async function updatePerformanceReview(id: string, input: UpdatePerformanceReviewInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updatePerformanceReviewSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update review
    const { error } = await supabase
      .from('vertical_performance_reviews')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update performance review error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update review' }
  }
}

/**
 * Publish a performance review
 */
export async function publishPerformanceReview(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Update review status to published
    const { error } = await supabase
      .from('vertical_performance_reviews')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Publish performance review error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to publish review' }
  }
}

/**
 * Delete a performance review
 */
export async function deletePerformanceReview(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Delete review
    const { error } = await supabase.from('vertical_performance_reviews').delete().eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Delete performance review error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete review' }
  }
}

// ============================================================================
// ACHIEVEMENT ACTIONS
// ============================================================================

/**
 * Create an achievement
 */
export async function createAchievement(input: CreateAchievementInput): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = createAchievementSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Create achievement
    const { data, error } = await supabase
      .from('vertical_achievements')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create achievement error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create achievement' }
  }
}

/**
 * Update an achievement
 */
export async function updateAchievement(id: string, input: UpdateAchievementInput): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = updateAchievementSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Update achievement
    const { error } = await supabase
      .from('vertical_achievements')
      .update({ ...sanitized, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Update achievement error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update achievement' }
  }
}

/**
 * Delete an achievement
 */
export async function deleteAchievement(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Delete achievement
    const { error } = await supabase.from('vertical_achievements').delete().eq('id', id)

    if (error) throw error

    revalidatePath('/verticals')
    return { success: true }
  } catch (error) {
    console.error('Delete achievement error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete achievement' }
  }
}
