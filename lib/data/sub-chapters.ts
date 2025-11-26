/**
 * Sub-Chapter Data Layer
 *
 * Cached data fetching functions for Yuva and Thalir sub-chapters.
 */

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type {
  SubChapter,
  SubChapterFull,
  SubChapterLead,
  SubChapterMember,
  SubChapterEvent,
  SubChapterEventFull,
  SubChapterFilters,
  SubChapterEventFilters,
  SubChapterStats,
  SubChapterDashboardStats,
} from '@/types/sub-chapter'

// ============================================================================
// Sub-Chapter Queries
// ============================================================================

/**
 * Get all sub-chapters with optional filtering
 */
export const getSubChapters = cache(
  async (filters?: SubChapterFilters): Promise<SubChapterFull[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('sub_chapters')
      .select(`
        *,
        yi_mentor:members!sub_chapters_yi_mentor_id_fkey(
          id,
          profile:profiles(full_name, email, phone, avatar_url)
        ),
        vertical:verticals(id, name, color),
        leads:sub_chapter_leads(*)
      `)
      .order('created_at', { ascending: false })

    if (filters?.chapter_id) {
      query = query.eq('chapter_id', filters.chapter_id)
    }
    if (filters?.type) {
      query = query.eq('type', filters.type)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.stakeholder_type) {
      query = query.eq('stakeholder_type', filters.stakeholder_type)
    }
    if (filters?.stakeholder_id) {
      query = query.eq('stakeholder_id', filters.stakeholder_id)
    }
    if (filters?.yi_mentor_id) {
      query = query.eq('yi_mentor_id', filters.yi_mentor_id)
    }
    if (filters?.vertical_id) {
      query = query.eq('vertical_id', filters.vertical_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sub-chapters:', error)
      return []
    }

    return (data || []) as SubChapterFull[]
  }
)

/**
 * Get a single sub-chapter by ID
 */
export const getSubChapterById = cache(
  async (id: string): Promise<SubChapterFull | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_chapters')
      .select(`
        *,
        yi_mentor:members!sub_chapters_yi_mentor_id_fkey(
          id,
          profile:profiles(full_name, email, phone, avatar_url)
        ),
        vertical:verticals(id, name, color),
        leads:sub_chapter_leads(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching sub-chapter:', error)
      return null
    }

    return data as SubChapterFull
  }
)

/**
 * Get sub-chapters by stakeholder (school/college)
 */
export const getSubChaptersByStakeholder = cache(
  async (
    stakeholderType: 'school' | 'college',
    stakeholderId: string
  ): Promise<SubChapterFull[]> => {
    return getSubChapters({
      stakeholder_type: stakeholderType,
      stakeholder_id: stakeholderId,
    })
  }
)

/**
 * Get sub-chapters assigned to a Yi mentor
 */
export const getSubChaptersByMentor = cache(
  async (mentorId: string): Promise<SubChapterFull[]> => {
    return getSubChapters({ yi_mentor_id: mentorId })
  }
)

// ============================================================================
// Sub-Chapter Lead Queries
// ============================================================================

/**
 * Get all leads for a sub-chapter
 */
export const getSubChapterLeads = cache(
  async (subChapterId: string): Promise<SubChapterLead[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_chapter_leads')
      .select('*')
      .eq('sub_chapter_id', subChapterId)
      .order('is_primary_lead', { ascending: false })
      .order('role')

    if (error) {
      console.error('Error fetching sub-chapter leads:', error)
      return []
    }

    return data || []
  }
)

/**
 * Get a lead by ID
 */
export const getSubChapterLeadById = cache(
  async (id: string): Promise<SubChapterLead | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_chapter_leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching sub-chapter lead:', error)
      return null
    }

    return data
  }
)

/**
 * Get a lead by email (for authentication)
 */
export const getSubChapterLeadByEmail = cache(
  async (email: string): Promise<(SubChapterLead & { sub_chapter: SubChapter }) | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_chapter_leads')
      .select(`
        *,
        sub_chapter:sub_chapters(*)
      `)
      .eq('email', email)
      .eq('status', 'active')
      .single()

    if (error) {
      console.error('Error fetching lead by email:', error)
      return null
    }

    return data as (SubChapterLead & { sub_chapter: SubChapter })
  }
)

// ============================================================================
// Sub-Chapter Member Queries
// ============================================================================

/**
 * Get all members of a sub-chapter
 */
export const getSubChapterMembers = cache(
  async (
    subChapterId: string,
    options?: { activeOnly?: boolean }
  ): Promise<SubChapterMember[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('sub_chapter_members')
      .select('*')
      .eq('sub_chapter_id', subChapterId)
      .order('joined_at', { ascending: false })

    if (options?.activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sub-chapter members:', error)
      return []
    }

    return data || []
  }
)

/**
 * Get member count for a sub-chapter
 */
export const getSubChapterMemberCount = cache(
  async (subChapterId: string): Promise<number> => {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('sub_chapter_members')
      .select('*', { count: 'exact', head: true })
      .eq('sub_chapter_id', subChapterId)
      .eq('is_active', true)

    if (error) {
      console.error('Error counting sub-chapter members:', error)
      return 0
    }

    return count || 0
  }
)

// ============================================================================
// Sub-Chapter Event Queries
// ============================================================================

/**
 * Get events for a sub-chapter with optional filtering
 */
export const getSubChapterEvents = cache(
  async (filters?: SubChapterEventFilters): Promise<SubChapterEventFull[]> => {
    const supabase = await createClient()

    let query = supabase
      .from('sub_chapter_events')
      .select(`
        *,
        sub_chapter:sub_chapters(*),
        requested_speaker:members!sub_chapter_events_requested_speaker_id_fkey(
          id,
          profile:profiles(full_name, email, phone, avatar_url)
        ),
        approved_by_member:members!sub_chapter_events_approved_by_fkey(
          id,
          profile:profiles(full_name)
        )
      `)
      .order('event_date', { ascending: true })

    if (filters?.sub_chapter_id) {
      query = query.eq('sub_chapter_id', filters.sub_chapter_id)
    }
    if (filters?.event_type) {
      query = query.eq('event_type', filters.event_type)
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }
    if (filters?.date_from) {
      query = query.gte('event_date', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('event_date', filters.date_to)
    }
    if (filters?.requested_speaker_id) {
      query = query.eq('requested_speaker_id', filters.requested_speaker_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sub-chapter events:', error)
      return []
    }

    return (data || []) as SubChapterEventFull[]
  }
)

/**
 * Get a single event by ID
 */
export const getSubChapterEventById = cache(
  async (id: string): Promise<SubChapterEventFull | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sub_chapter_events')
      .select(`
        *,
        sub_chapter:sub_chapters(*),
        requested_speaker:members!sub_chapter_events_requested_speaker_id_fkey(
          id,
          profile:profiles(full_name, email, phone, avatar_url)
        ),
        approved_by_member:members!sub_chapter_events_approved_by_fkey(
          id,
          profile:profiles(full_name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching sub-chapter event:', error)
      return null
    }

    return data as SubChapterEventFull
  }
)

/**
 * Get pending speaker requests for a Yi member
 */
export const getPendingSpeakerRequests = cache(
  async (speakerId: string): Promise<SubChapterEventFull[]> => {
    return getSubChapterEvents({
      requested_speaker_id: speakerId,
      status: ['pending_approval', 'approved'],
    })
  }
)

/**
 * Get upcoming events for a sub-chapter
 */
export const getUpcomingSubChapterEvents = cache(
  async (subChapterId: string, limit: number = 5): Promise<SubChapterEventFull[]> => {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('sub_chapter_events')
      .select(`
        *,
        sub_chapter:sub_chapters(*),
        requested_speaker:members!sub_chapter_events_requested_speaker_id_fkey(
          id,
          profile:profiles(full_name, email, phone, avatar_url)
        )
      `)
      .eq('sub_chapter_id', subChapterId)
      .gte('event_date', today)
      .in('status', ['approved', 'scheduled', 'in_progress'])
      .order('event_date', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching upcoming events:', error)
      return []
    }

    return (data || []) as SubChapterEventFull[]
  }
)

// ============================================================================
// Statistics Queries
// ============================================================================

/**
 * Get overall sub-chapter statistics
 */
export const getSubChapterStats = cache(
  async (chapterId?: string): Promise<SubChapterStats> => {
    const supabase = await createClient()

    let query = supabase.from('sub_chapters').select('*')

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sub-chapter stats:', error)
      return {
        total_sub_chapters: 0,
        active_sub_chapters: 0,
        total_members: 0,
        total_events: 0,
        total_students_reached: 0,
        by_type: { yuva: 0, thalir: 0 },
      }
    }

    const subChapters = data || []

    return {
      total_sub_chapters: subChapters.length,
      active_sub_chapters: subChapters.filter((s) => s.status === 'active').length,
      total_members: subChapters.reduce((sum, s) => sum + (s.total_members || 0), 0),
      total_events: subChapters.reduce((sum, s) => sum + (s.total_events || 0), 0),
      total_students_reached: subChapters.reduce(
        (sum, s) => sum + (s.total_students_reached || 0),
        0
      ),
      by_type: {
        yuva: subChapters.filter((s) => s.type === 'yuva').length,
        thalir: subChapters.filter((s) => s.type === 'thalir').length,
      },
    }
  }
)

/**
 * Get dashboard stats for a sub-chapter lead
 */
export const getSubChapterDashboardStats = cache(
  async (subChapterId: string): Promise<SubChapterDashboardStats> => {
    const supabase = await createClient()
    const today = new Date().toISOString().split('T')[0]

    // Get sub-chapter data
    const { data: subChapter } = await supabase
      .from('sub_chapters')
      .select('total_events, total_members, students_reached_this_year')
      .eq('id', subChapterId)
      .single()

    // Get pending events count
    const { count: pendingCount } = await supabase
      .from('sub_chapter_events')
      .select('*', { count: 'exact', head: true })
      .eq('sub_chapter_id', subChapterId)
      .in('status', ['pending_approval', 'draft'])

    // Get upcoming events count
    const { count: upcomingCount } = await supabase
      .from('sub_chapter_events')
      .select('*', { count: 'exact', head: true })
      .eq('sub_chapter_id', subChapterId)
      .gte('event_date', today)
      .in('status', ['approved', 'scheduled'])

    return {
      total_events: subChapter?.total_events || 0,
      students_reached: subChapter?.students_reached_this_year || 0,
      total_members: subChapter?.total_members || 0,
      pending_events: pendingCount || 0,
      upcoming_events: upcomingCount || 0,
    }
  }
)

// ============================================================================
// Yi Member Queries (for speaker selection)
// ============================================================================

/**
 * Get Yi members available as speakers
 */
export const getAvailableSpeakers = cache(
  async (options?: { verticalId?: string }): Promise<
    Array<{
      id: string
      full_name: string
      email: string
      phone: string | null
      avatar_url: string | null
      designation: string | null
      company: string | null
      expertise_areas: string[] | null
    }>
  > => {
    const supabase = await createClient()

    let query = supabase
      .from('members')
      .select(`
        id,
        profile:profiles(full_name, email, phone, avatar_url),
        designation,
        company,
        expertise_areas
      `)
      .eq('status', 'active')

    if (options?.verticalId) {
      query = query.eq('primary_vertical_id', options.verticalId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching available speakers:', error)
      return []
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      full_name: m.profile?.full_name || '',
      email: m.profile?.email || '',
      phone: m.profile?.phone || null,
      avatar_url: m.profile?.avatar_url || null,
      designation: m.designation,
      company: m.company,
      expertise_areas: m.expertise_areas,
    }))
  }
)
