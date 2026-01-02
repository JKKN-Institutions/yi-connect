/**
 * Health Card Activity Reporting Server Actions
 *
 * Server Actions for submitting and managing health card entries.
 * Tracks activities per vertical with EC/Non-EC participation counts.
 */

'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import {
  createHealthCardSchema,
  updateHealthCardSchema,
  type CreateHealthCardInput,
  type UpdateHealthCardInput,
} from '@/lib/validations/health-card'

type ActionResponse<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Sanitize form data - convert empty strings to null
 */
function sanitizeData<T extends Record<string, unknown>>(data: T): T {
  const sanitized = { ...data }
  for (const key in sanitized) {
    if (sanitized[key] === '') {
      sanitized[key] = null as T[Extract<keyof T, string>]
    }
  }
  return sanitized
}

/**
 * Get current fiscal year (April-March)
 */
function getCurrentFiscalYear(): number {
  const now = new Date()
  const month = now.getMonth() // 0-indexed (0 = Jan, 3 = Apr)
  const year = now.getFullYear()
  // If month is Jan-Mar (0-2), fiscal year is previous year
  // If month is Apr-Dec (3-11), fiscal year is current year
  return month < 3 ? year - 1 : year
}

// ============================================================================
// HEALTH CARD ENTRY ACTIONS
// ============================================================================

/**
 * Submit a new health card entry
 */
export async function createHealthCardEntry(
  input: CreateHealthCardInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = createHealthCardSchema.parse(input)
    const sanitized = sanitizeData(validated)

    const supabase = await createClient()

    // Get member ID for tracking who submitted
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const { data, error } = await supabase
      .from('health_card_entries')
      .insert({
        ...sanitized,
        member_id: member?.id || null,
        fiscal_year: getCurrentFiscalYear(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Create health card entry error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('health-cards', 'max')
    revalidatePath('/pathfinder/health-card')
    revalidatePath('/pathfinder')

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Create health card entry error:', error)
    return { success: false, error: 'Failed to submit health card entry' }
  }
}

/**
 * Update an existing health card entry
 */
export async function updateHealthCardEntry(
  input: UpdateHealthCardInput
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const validated = updateHealthCardSchema.parse(input)
    const { id, ...updateData } = validated
    const sanitized = sanitizeData(updateData)

    const supabase = await createClient()

    // Check if entry exists
    const { data: existing } = await supabase
      .from('health_card_entries')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) {
      return { success: false, error: 'Health card entry not found' }
    }

    const { error } = await supabase
      .from('health_card_entries')
      .update(sanitized)
      .eq('id', id)

    if (error) {
      console.error('Update health card entry error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('health-cards', 'max')
    revalidatePath('/pathfinder/health-card')
    revalidatePath('/pathfinder')

    return { success: true }
  } catch (error) {
    console.error('Update health card entry error:', error)
    return { success: false, error: 'Failed to update health card entry' }
  }
}

/**
 * Delete a health card entry (Chair only)
 */
export async function deleteHealthCardEntry(entryId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createClient()

    // Check if user is a chair (hierarchy_level >= 4)
    const { data: member } = await supabase
      .from('members')
      .select('id, hierarchy_level')
      .eq('user_id', user.id)
      .single()

    if (!member || member.hierarchy_level < 4) {
      return { success: false, error: 'Only Chair or above can delete entries' }
    }

    const { error } = await supabase
      .from('health_card_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      console.error('Delete health card entry error:', error)
      return { success: false, error: error.message }
    }

    revalidateTag('health-cards', 'max')
    revalidatePath('/pathfinder/health-card')
    revalidatePath('/pathfinder')

    return { success: true }
  } catch (error) {
    console.error('Delete health card entry error:', error)
    return { success: false, error: 'Failed to delete health card entry' }
  }
}

// ============================================================================
// HEALTH CARD QUERY ACTIONS
// ============================================================================

/**
 * Get health card entries for a chapter
 */
export async function getHealthCardEntries(
  chapterId: string,
  options?: {
    verticalId?: string
    fiscalYear?: number
    limit?: number
    offset?: number
  }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { entries: [], total: 0 }
    }

    const supabase = await createClient()

    let query = supabase
      .from('health_card_entries')
      .select(
        `
        *,
        chapter:chapters(id, name, short_name),
        vertical:verticals(id, name, slug, color, icon)
      `,
        { count: 'exact' }
      )
      .eq('chapter_id', chapterId)
      .order('activity_date', { ascending: false })

    if (options?.verticalId) {
      query = query.eq('vertical_id', options.verticalId)
    }

    if (options?.fiscalYear) {
      query = query.eq('fiscal_year', options.fiscalYear)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Get health card entries error:', error)
      return { entries: [], total: 0 }
    }

    return { entries: data || [], total: count || 0 }
  } catch (error) {
    console.error('Get health card entries error:', error)
    return { entries: [], total: 0 }
  }
}

/**
 * Get health card summary by vertical
 */
export async function getHealthCardSummaryByVertical(
  chapterId: string,
  fiscalYear?: number
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return []
    }

    const supabase = await createClient()
    const year = fiscalYear || getCurrentFiscalYear()

    // Get all entries grouped by vertical
    const { data: entries } = await supabase
      .from('health_card_entries')
      .select(
        `
        vertical_id,
        ec_members_count,
        non_ec_members_count,
        activity_date
      `
      )
      .eq('chapter_id', chapterId)
      .eq('fiscal_year', year)

    if (!entries || entries.length === 0) {
      return []
    }

    // Get vertical details
    const verticalIds = [...new Set(entries.map((e) => e.vertical_id))]
    const { data: verticals } = await supabase
      .from('verticals')
      .select('id, name, slug, color, icon')
      .in('id', verticalIds)

    const verticalMap = new Map(verticals?.map((v) => [v.id, v]) || [])

    // Calculate current month and quarter
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentQuarter = Math.floor(currentMonth / 3) + 1

    // Aggregate by vertical
    const summaryMap = new Map<
      string,
      {
        total_activities: number
        activities_this_month: number
        activities_this_quarter: number
        total_ec: number
        total_non_ec: number
      }
    >()

    for (const entry of entries) {
      const vid = entry.vertical_id
      const existing = summaryMap.get(vid) || {
        total_activities: 0,
        activities_this_month: 0,
        activities_this_quarter: 0,
        total_ec: 0,
        total_non_ec: 0,
      }

      existing.total_activities++
      existing.total_ec += entry.ec_members_count
      existing.total_non_ec += entry.non_ec_members_count

      const activityDate = new Date(entry.activity_date)
      const activityMonth = activityDate.getMonth()
      const activityQuarter = Math.floor(activityMonth / 3) + 1

      if (activityMonth === currentMonth && activityDate.getFullYear() === now.getFullYear()) {
        existing.activities_this_month++
      }

      if (activityQuarter === currentQuarter && activityDate.getFullYear() === now.getFullYear()) {
        existing.activities_this_quarter++
      }

      summaryMap.set(vid, existing)
    }

    // Build result
    const result = Array.from(summaryMap.entries()).map(([vid, stats]) => {
      const vertical = verticalMap.get(vid)
      return {
        vertical_id: vid,
        vertical_name: vertical?.name || 'Unknown',
        vertical_slug: vertical?.slug || '',
        vertical_color: vertical?.color || null,
        vertical_icon: vertical?.icon || null,
        total_activities: stats.total_activities,
        activities_this_month: stats.activities_this_month,
        activities_this_quarter: stats.activities_this_quarter,
        total_ec_participants: stats.total_ec,
        total_non_ec_participants: stats.total_non_ec,
        total_participants: stats.total_ec + stats.total_non_ec,
        avg_participants_per_activity:
          stats.total_activities > 0
            ? Math.round((stats.total_ec + stats.total_non_ec) / stats.total_activities)
            : 0,
      }
    })

    return result.sort((a, b) => b.total_activities - a.total_activities)
  } catch (error) {
    console.error('Get health card summary error:', error)
    return []
  }
}

/**
 * Get total chapter health stats
 */
export async function getChapterHealthStats(chapterId: string, fiscalYear?: number) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return null
    }

    const supabase = await createClient()
    const year = fiscalYear || getCurrentFiscalYear()

    const { data: entries } = await supabase
      .from('health_card_entries')
      .select('ec_members_count, non_ec_members_count, activity_date')
      .eq('chapter_id', chapterId)
      .eq('fiscal_year', year)

    if (!entries || entries.length === 0) {
      return {
        total_activities: 0,
        total_ec_participants: 0,
        total_non_ec_participants: 0,
        total_participants: 0,
        activities_this_week: 0,
        activities_this_month: 0,
      }
    }

    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const currentMonth = now.getMonth()

    let totalEc = 0
    let totalNonEc = 0
    let thisWeek = 0
    let thisMonth = 0

    for (const entry of entries) {
      totalEc += entry.ec_members_count
      totalNonEc += entry.non_ec_members_count

      const activityDate = new Date(entry.activity_date)

      if (activityDate >= oneWeekAgo) {
        thisWeek++
      }

      if (activityDate.getMonth() === currentMonth && activityDate.getFullYear() === now.getFullYear()) {
        thisMonth++
      }
    }

    return {
      total_activities: entries.length,
      total_ec_participants: totalEc,
      total_non_ec_participants: totalNonEc,
      total_participants: totalEc + totalNonEc,
      activities_this_week: thisWeek,
      activities_this_month: thisMonth,
    }
  } catch (error) {
    console.error('Get chapter health stats error:', error)
    return null
  }
}
