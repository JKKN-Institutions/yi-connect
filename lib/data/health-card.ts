/**
 * Health Card Data Layer
 *
 * Cached data fetching functions for health card entries.
 * Uses React cache() for request-level deduplication.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  HealthCardEntry,
  HealthCardEntryWithDetails,
  VerticalHealthSummary,
  HealthCardFilters,
  YiRegion,
} from '@/types/health-card'

// ============================================================================
// HEALTH CARD ENTRY QUERIES
// ============================================================================

/**
 * Get health card entries for a chapter with optional filters
 */
export const getHealthCardEntries = cache(
  async (
    chapterId: string,
    filters?: HealthCardFilters,
    pagination?: { limit?: number; offset?: number }
  ): Promise<{ entries: HealthCardEntryWithDetails[]; total: number }> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return { entries: [], total: 0 }
    }

    let query = supabase
      .from('health_card_entries')
      .select(
        `
        *,
        chapter:chapters(id, name, short_name),
        vertical:verticals(id, name, slug, color, icon),
        member:members(id, avatar_url, profile:profiles(full_name))
      `,
        { count: 'exact' }
      )
      .eq('chapter_id', chapterId)
      .order('activity_date', { ascending: false })

    // Apply filters
    if (filters?.vertical_id) {
      query = query.eq('vertical_id', filters.vertical_id)
    }
    if (filters?.region) {
      query = query.eq('region', filters.region)
    }
    if (filters?.calendar_year) {
      query = query.eq('calendar_year', filters.calendar_year)
    }
    if (filters?.date_from) {
      query = query.gte('activity_date', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('activity_date', filters.date_to)
    }
    if (filters?.submitter_role) {
      query = query.eq('submitter_role', filters.submitter_role)
    }

    // Apply pagination
    const limit = pagination?.limit || 20
    const offset = pagination?.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Get health card entries error:', error)
      return { entries: [], total: 0 }
    }

    // Transform data to match interface
    const entries = (data || []).map((entry: any) => ({
      ...entry,
      member: entry.member
        ? {
            id: entry.member.id,
            full_name: entry.member.profile?.full_name || 'Unknown',
            avatar_url: entry.member.avatar_url,
          }
        : null,
    }))

    return { entries, total: count || 0 }
  }
)

/**
 * Get a single health card entry by ID
 */
export const getHealthCardEntryById = cache(
  async (entryId: string): Promise<HealthCardEntryWithDetails | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) return null

    const { data, error } = await supabase
      .from('health_card_entries')
      .select(
        `
        *,
        chapter:chapters(id, name, short_name),
        vertical:verticals(id, name, slug, color, icon),
        member:members(id, avatar_url, profile:profiles(full_name))
      `
      )
      .eq('id', entryId)
      .single()

    if (error) {
      console.error('Get health card entry error:', error)
      return null
    }

    // Transform member data
    const entry = {
      ...data,
      member: data.member
        ? {
            id: data.member.id,
            full_name: data.member.profile?.full_name || 'Unknown',
            avatar_url: data.member.avatar_url,
          }
        : null,
    }

    return entry as HealthCardEntryWithDetails
  }
)

/**
 * Get health card summary by vertical for dashboard
 */
export const getHealthCardSummaryByVertical = cache(
  async (chapterId: string, calendarYear: number): Promise<VerticalHealthSummary[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) return []

    // Get all entries for the chapter/year
    const { data: entries, error } = await supabase
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
      .eq('calendar_year', calendarYear)

    if (error || !entries || entries.length === 0) {
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
  }
)

/**
 * Get total chapter health stats
 */
export const getChapterHealthStats = cache(
  async (
    chapterId: string,
    calendarYear: number
  ): Promise<{
    total_activities: number
    total_ec_participants: number
    total_non_ec_participants: number
    total_participants: number
    activities_this_week: number
    activities_this_month: number
  } | null> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) return null

    const { data: entries, error } = await supabase
      .from('health_card_entries')
      .select('ec_members_count, non_ec_members_count, activity_date')
      .eq('chapter_id', chapterId)
      .eq('calendar_year', calendarYear)

    if (error || !entries || entries.length === 0) {
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
  }
)

/**
 * Get all verticals (simple version for forms)
 */
export const getVerticalsForForm = cache(async (): Promise<{ id: string; name: string; slug: string; color: string | null; icon: string | null }[]> => {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('verticals')
    .select('id, name, slug, color, icon')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('Get verticals error:', error)
    return []
  }

  return data || []
})

/**
 * Get current calendar year
 */
export function getCurrentCalendarYear(): number {
  return new Date().getFullYear()
}

/**
 * Get chapter info by ID
 */
export const getChapterById = cache(async (chapterId: string): Promise<{ id: string; name: string; short_name: string | null } | null> => {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('chapters')
    .select('id, name, short_name')
    .eq('id', chapterId)
    .single()

  if (error) {
    console.error('Get chapter error:', error)
    return null
  }

  return data
})

/**
 * Get all chapters (for super admin)
 */
export const getAllChapters = cache(async (): Promise<{ id: string; name: string; short_name: string | null }[]> => {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('chapters')
    .select('id, name, short_name')
    .order('name', { ascending: true })

  if (error) {
    console.error('Get chapters error:', error)
    return []
  }

  return data || []
})
