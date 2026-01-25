/**
 * Planned Activities Server Actions
 *
 * Server Actions for managing planned activities before they become health card entries.
 * Allows EC members to plan activities upfront and track data collection.
 */

'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  PlannedActivity,
  PlannedActivityWithDetails,
  CreatePlannedActivityInput,
  UpdatePlannedActivityInput,
  PlannedActivityPrefillData,
  PlannedActivityFilters,
  PlannedActivityStatus,
} from '@/types/planned-activity'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// CREATE PLANNED ACTIVITY
// ============================================================================

/**
 * Create a new planned activity
 */
export async function createPlannedActivity(
  input: CreatePlannedActivityInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Get member info for chapter_id and created_by
    const { data: member } = await supabase
      .from('members')
      .select('id, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return { success: false, error: 'Member not found' }
    }

    const { data, error } = await supabase
      .from('planned_activities')
      .insert({
        activity_name: input.activity_name,
        activity_description: input.activity_description || null,
        planned_date: input.planned_date,
        vertical_id: input.vertical_id,
        expected_ec_count: input.expected_ec_count,
        expected_non_ec_count: input.expected_non_ec_count,
        preparation_notes: input.preparation_notes || null,
        chapter_id: member.chapter_id,
        created_by: member.id,
        status: 'planned',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create planned activity error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('planned-activities', 'default')
    revalidatePath('/pathfinder/planned-activities')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create planned activity error:', error)
    return { success: false, error: 'Failed to create planned activity' }
  }
}

// ============================================================================
// GET PLANNED ACTIVITIES
// ============================================================================

/**
 * Get planned activities for the current user's chapter
 */
export async function getPlannedActivities(
  filters?: PlannedActivityFilters
): Promise<PlannedActivityWithDetails[]> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return []
    }

    const supabase = await createClient()

    // Get member's chapter
    const { data: member } = await supabase
      .from('members')
      .select('id, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return []
    }

    let query = supabase
      .from('planned_activities')
      .select(`
        *,
        vertical:verticals(id, name, slug, color, icon),
        chapter:chapters(id, name),
        member:members!created_by(id, full_name, avatar_url)
      `)
      .eq('chapter_id', member.chapter_id)
      .order('planned_date', { ascending: true })

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.vertical_id) {
      query = query.eq('vertical_id', filters.vertical_id)
    }

    if (filters?.date_from) {
      query = query.gte('planned_date', filters.date_from)
    }

    if (filters?.date_to) {
      query = query.lte('planned_date', filters.date_to)
    }

    if (filters?.created_by) {
      query = query.eq('created_by', filters.created_by)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get planned activities error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Get planned activities error:', error)
    return []
  }
}

/**
 * Get a single planned activity by ID
 */
export async function getPlannedActivityById(
  id: string
): Promise<PlannedActivityWithDetails | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return null
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('planned_activities')
      .select(`
        *,
        vertical:verticals(id, name, slug, color, icon),
        chapter:chapters(id, name),
        member:members!created_by(id, full_name, avatar_url)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Get planned activity error:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Get planned activity error:', error)
    return null
  }
}

/**
 * Get user's own planned activities
 */
export async function getMyPlannedActivities(
  filters?: Omit<PlannedActivityFilters, 'created_by'>
): Promise<PlannedActivityWithDetails[]> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return []
    }

    const supabase = await createClient()

    // Get member ID
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return []
    }

    return getPlannedActivities({ ...filters, created_by: member.id })
  } catch (error) {
    console.error('Get my planned activities error:', error)
    return []
  }
}

// ============================================================================
// UPDATE PLANNED ACTIVITY
// ============================================================================

/**
 * Update a planned activity
 */
export async function updatePlannedActivity(
  id: string,
  input: UpdatePlannedActivityInput
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('planned_activities')
      .update({
        ...(input.activity_name && { activity_name: input.activity_name }),
        ...(input.activity_description !== undefined && {
          activity_description: input.activity_description || null,
        }),
        ...(input.planned_date && { planned_date: input.planned_date }),
        ...(input.vertical_id && { vertical_id: input.vertical_id }),
        ...(input.expected_ec_count !== undefined && {
          expected_ec_count: input.expected_ec_count,
        }),
        ...(input.expected_non_ec_count !== undefined && {
          expected_non_ec_count: input.expected_non_ec_count,
        }),
        ...(input.preparation_notes !== undefined && {
          preparation_notes: input.preparation_notes || null,
        }),
        ...(input.status && { status: input.status }),
      })
      .eq('id', id)

    if (error) {
      console.error('Update planned activity error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('planned-activities', 'default')
    revalidatePath('/pathfinder/planned-activities')

    return { success: true }
  } catch (error) {
    console.error('Update planned activity error:', error)
    return { success: false, error: 'Failed to update planned activity' }
  }
}

/**
 * Update planned activity status
 */
export async function updatePlannedActivityStatus(
  id: string,
  status: PlannedActivityStatus
): Promise<ActionResponse> {
  return updatePlannedActivity(id, { status })
}

// ============================================================================
// DELETE PLANNED ACTIVITY
// ============================================================================

/**
 * Delete a planned activity (only if not completed)
 */
export async function deletePlannedActivity(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Check if activity is completed (cannot delete completed activities)
    const { data: activity } = await supabase
      .from('planned_activities')
      .select('status')
      .eq('id', id)
      .single()

    if (activity?.status === 'completed') {
      return { success: false, error: 'Cannot delete a completed activity' }
    }

    const { error } = await supabase
      .from('planned_activities')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete planned activity error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('planned-activities', 'default')
    revalidatePath('/pathfinder/planned-activities')

    return { success: true }
  } catch (error) {
    console.error('Delete planned activity error:', error)
    return { success: false, error: 'Failed to delete planned activity' }
  }
}

// ============================================================================
// PREFILL DATA FOR HEALTH CARD
// ============================================================================

/**
 * Get prefill data for health card form from a planned activity
 */
export async function getPlannedActivityPrefillData(
  id: string
): Promise<PlannedActivityPrefillData | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return null
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('planned_activities')
      .select('id, activity_name, activity_description, planned_date, vertical_id, expected_ec_count, expected_non_ec_count')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Get prefill data error:', error)
      return null
    }

    return {
      planned_activity_id: data.id,
      activity_name: data.activity_name,
      activity_description: data.activity_description,
      activity_date: data.planned_date,
      vertical_id: data.vertical_id,
      expected_ec_count: data.expected_ec_count,
      expected_non_ec_count: data.expected_non_ec_count,
    }
  } catch (error) {
    console.error('Get prefill data error:', error)
    return null
  }
}

// ============================================================================
// COMPLETE PLANNED ACTIVITY
// ============================================================================

/**
 * Complete a planned activity and link it to a health card entry
 */
export async function completePlannedActivity(
  id: string,
  healthCardEntryId: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('planned_activities')
      .update({
        status: 'completed',
        health_card_entry_id: healthCardEntryId,
        converted_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Complete planned activity error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('planned-activities', 'default')
    revalidatePath('/pathfinder/planned-activities')

    return { success: true }
  } catch (error) {
    console.error('Complete planned activity error:', error)
    return { success: false, error: 'Failed to complete planned activity' }
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get planned activities statistics for the current chapter
 */
export async function getPlannedActivitiesStats(): Promise<{
  total: number
  planned: number
  in_progress: number
  completed: number
  cancelled: number
  upcoming_this_week: number
} | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return null
    }

    const supabase = await createClient()

    // Get member's chapter
    const { data: member } = await supabase
      .from('members')
      .select('chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return null
    }

    const { data, error } = await supabase
      .from('planned_activities')
      .select('status, planned_date')
      .eq('chapter_id', member.chapter_id)

    if (error) {
      console.error('Get stats error:', error)
      return null
    }

    const now = new Date()
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const stats = {
      total: data.length,
      planned: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      upcoming_this_week: 0,
    }

    for (const activity of data) {
      stats[activity.status as keyof typeof stats]++

      const activityDate = new Date(activity.planned_date)
      if (
        activity.status === 'planned' &&
        activityDate >= now &&
        activityDate <= oneWeekFromNow
      ) {
        stats.upcoming_this_week++
      }
    }

    return stats
  } catch (error) {
    console.error('Get stats error:', error)
    return null
  }
}
