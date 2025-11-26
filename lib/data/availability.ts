/**
 * Availability Data Layer
 *
 * Cached data fetching functions for member availability.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  Availability,
  AvailabilityWithMember,
  AvailabilityFilters,
  MemberAvailabilityPreferences,
} from '@/types/availability'

// ============================================================================
// Single Availability Queries
// ============================================================================

/**
 * Get availability for a specific date and member
 */
export const getMemberAvailabilityForDate = cache(
  async (memberId: string, date: string): Promise<Availability | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('member_id', memberId)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch availability: ${error.message}`)
    }

    return data as Availability | null
  }
)

/**
 * Get availability preferences for a member
 */
export const getMemberAvailabilityPreferences = cache(
  async (memberId: string): Promise<MemberAvailabilityPreferences | null> => {
    const supabase = await createServerSupabaseClient()

    // Get the most recent availability record to get preferences
    const { data, error } = await supabase
      .from('availability')
      .select(
        'member_id, time_commitment_hours, preferred_days, notice_period, geographic_flexibility, preferred_contact_method'
      )
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch availability preferences: ${error.message}`)
    }

    if (!data) {
      return null
    }

    return {
      member_id: data.member_id,
      time_commitment_hours: data.time_commitment_hours,
      preferred_days: data.preferred_days,
      notice_period: data.notice_period,
      geographic_flexibility: data.geographic_flexibility,
      preferred_contact_method: data.preferred_contact_method,
    }
  }
)

// ============================================================================
// List Queries
// ============================================================================

/**
 * Get member availability for a date range
 */
export const getMemberAvailability = cache(
  async (
    memberId: string,
    startDate: string,
    endDate: string
  ): Promise<Availability[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('member_id', memberId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch member availability: ${error.message}`)
    }

    return (data || []) as Availability[]
  }
)

/**
 * Get all availability with filters
 */
export const getAvailability = cache(
  async (filters: AvailabilityFilters = {}): Promise<AvailabilityWithMember[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('availability')
      .select(
        `
        *,
        member:members(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `
      )

    if (filters.member_id) {
      query = query.eq('member_id', filters.member_id)
    }

    if (filters.start_date) {
      query = query.gte('date', filters.start_date)
    }

    if (filters.end_date) {
      query = query.lte('date', filters.end_date)
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters.is_assigned !== undefined) {
      query = query.eq('is_assigned', filters.is_assigned)
    }

    query = query.order('date', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch availability: ${error.message}`)
    }

    return (data || []) as AvailabilityWithMember[]
  }
)

/**
 * Get available members for a specific date
 */
export const getAvailableMembersForDate = cache(
  async (
    date: string,
    chapterId?: string
  ): Promise<
    Array<{
      member_id: string
      full_name: string
      email: string
      avatar_url: string | null
      time_slots: any[] | null
    }>
  > => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('availability')
      .select(
        `
        member_id,
        time_slots,
        member:members!inner(
          id,
          chapter_id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `
      )
      .eq('date', date)
      .eq('status', 'available')
      .eq('is_assigned', false)

    if (chapterId) {
      query = query.eq('member.chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch available members: ${error.message}`)
    }

    return (data || []).map((item: any) => ({
      member_id: item.member_id,
      full_name: item.member?.profile?.full_name || '',
      email: item.member?.profile?.email || '',
      avatar_url: item.member?.profile?.avatar_url || null,
      time_slots: item.time_slots,
    }))
  }
)

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get availability summary for a member
 */
export const getMemberAvailabilitySummary = cache(
  async (
    memberId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total_days: number
    available_days: number
    busy_days: number
    unavailable_days: number
    assigned_days: number
  }> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('availability')
      .select('status, is_assigned')
      .eq('member_id', memberId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) {
      throw new Error(`Failed to fetch availability summary: ${error.message}`)
    }

    const records = data || []

    return {
      total_days: records.length,
      available_days: records.filter((r: any) => r.status === 'available').length,
      busy_days: records.filter((r: any) => r.status === 'busy').length,
      unavailable_days: records.filter((r: any) => r.status === 'unavailable').length,
      assigned_days: records.filter((r: any) => r.is_assigned).length,
    }
  }
)

/**
 * Get chapter availability overview
 */
export const getChapterAvailabilityOverview = cache(
  async (
    chapterId: string,
    date: string
  ): Promise<{
    total_members: number
    available_count: number
    busy_count: number
    unavailable_count: number
    not_set_count: number
  }> => {
    const supabase = await createServerSupabaseClient()

    // Get total active members in chapter
    const { count: totalMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)
      .eq('membership_status', 'active')

    // Get availability for the date
    const { data: availabilities } = await supabase
      .from('availability')
      .select(
        `
        status,
        member:members!inner(
          chapter_id
        )
      `
      )
      .eq('date', date)
      .eq('member.chapter_id', chapterId)

    const records = availabilities || []
    const membersWithAvailability = records.length

    return {
      total_members: totalMembers || 0,
      available_count: records.filter((r: any) => r.status === 'available').length,
      busy_count: records.filter((r: any) => r.status === 'busy').length,
      unavailable_count: records.filter((r: any) => r.status === 'unavailable').length,
      not_set_count: (totalMembers || 0) - membersWithAvailability,
    }
  }
)
