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

    // Alias chapter_type -> type so callers/types that read `.type` keep
    // working (live column is chapter_type). Fixed 2026-05-30 — Agent A.
    let query = supabase
      .schema('yi_connect').from('sub_chapters')
      .select(`
        *,
        type:chapter_type,
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

    // Alias chapter_type -> type (live column is chapter_type).
    const { data, error } = await supabase
      .schema('yi_connect').from('sub_chapters')
      .select(`
        *,
        type:chapter_type,
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
      .schema('yi_connect').from('sub_chapter_leads')
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
      .schema('yi_connect').from('sub_chapter_leads')
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
      .schema('yi_connect').from('sub_chapter_leads')
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

    // Live yi_connect.sub_chapter_members uses: status (not is_active),
    // joined_date (not joined_at), events_attended (not events_participated),
    // class_year (not year_of_study), roll_number (not student_id).
    // Alias them to the field names the rest of the app + types expect.
    // Fixed 2026-05-30 — Agent A (coordinator/sub-chapter drift sweep).
    let query = supabase
      .schema('yi_connect').from('sub_chapter_members')
      .select(
        'id, sub_chapter_id, full_name, email, phone, department, ' +
        'student_id:roll_number, year_of_study:class_year, ' +
        'events_participated:events_attended, volunteer_hours, ' +
        'status, joined_at:joined_date, left_at:left_date, ' +
        'created_at, updated_at'
      )
      .eq('sub_chapter_id', subChapterId)
      .order('joined_date', { ascending: false })

    if (options?.activeOnly) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching sub-chapter members:', error)
      return []
    }

    // Derive is_active from live status text so callers reading member.is_active
    // keep working (the column itself doesn't exist on the live table).
    return (data || []).map((m: any) => ({
      ...m,
      is_active: m.status === 'active',
    })) as SubChapterMember[]
  }
)

/**
 * Get member count for a sub-chapter
 */
export const getSubChapterMemberCount = cache(
  async (subChapterId: string): Promise<number> => {
    const supabase = await createClient()

    // Live sub_chapter_members uses status text, not an is_active boolean.
    const { count, error } = await supabase
      .schema('yi_connect').from('sub_chapter_members')
      .select('*', { count: 'exact', head: true })
      .eq('sub_chapter_id', subChapterId)
      .eq('status', 'active')

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
      .schema('yi_connect').from('sub_chapter_events')
      .select(`
        *,
        expected_participants:expected_attendance,
        actual_participants:actual_attendance,
        sub_chapter:sub_chapters(*)
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
      .schema('yi_connect').from('sub_chapter_events')
      .select(`
        *,
        expected_participants:expected_attendance,
        actual_participants:actual_attendance,
        sub_chapter:sub_chapters(*)
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
      .schema('yi_connect').from('sub_chapter_events')
      .select(`
        *,
        expected_participants:expected_attendance,
        actual_participants:actual_attendance,
        sub_chapter:sub_chapters(*)
      `)
      .eq('sub_chapter_id', subChapterId)
      .gte('event_date', today)
      .in('status', ['planned', 'confirmed'])
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

    let query = supabase.schema('yi_connect').from('sub_chapters').select('*')

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

    // Live yi_connect.sub_chapters uses member_count / events_count /
    // total_impact / chapter_type (not total_members / total_events /
    // total_students_reached / type). Fixed 2026-05-30 — Agent A.
    return {
      total_sub_chapters: subChapters.length,
      active_sub_chapters: subChapters.filter((s: any) => s.status === 'active').length,
      total_members: subChapters.reduce((sum, s: any) => sum + (s.member_count || 0), 0),
      total_events: subChapters.reduce((sum, s: any) => sum + (s.events_count || 0), 0),
      total_students_reached: subChapters.reduce(
        (sum, s: any) => sum + (s.total_impact || 0),
        0
      ),
      by_type: {
        yuva: subChapters.filter((s: any) => s.chapter_type === 'yuva').length,
        thalir: subChapters.filter((s: any) => s.chapter_type === 'thalir').length,
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

    // Get sub-chapter data.
    // Live yi_connect.sub_chapters columns are events_count / member_count /
    // total_impact (the *_this_year / total_* columns the types claim do not
    // exist). Fixed 2026-05-30 — Agent A (coordinator/sub-chapter drift sweep).
    const { data: subChapter } = await supabase
      .schema('yi_connect').from('sub_chapters')
      .select('events_count, member_count, total_impact')
      .eq('id', subChapterId)
      .single()

    // Get pending events count.
    // Live sub_chapter_events.status enum is planned/confirmed/completed/cancelled
    // (no draft/pending_approval/approved/scheduled). "Pending" == planned.
    const { count: pendingCount } = await supabase
      .schema('yi_connect').from('sub_chapter_events')
      .select('*', { count: 'exact', head: true })
      .eq('sub_chapter_id', subChapterId)
      .eq('status', 'planned')

    // Get upcoming events count (confirmed + future-dated).
    const { count: upcomingCount } = await supabase
      .schema('yi_connect').from('sub_chapter_events')
      .select('*', { count: 'exact', head: true })
      .eq('sub_chapter_id', subChapterId)
      .gte('event_date', today)
      .in('status', ['planned', 'confirmed'])

    return {
      total_events: subChapter?.events_count || 0,
      students_reached: subChapter?.total_impact || 0,
      total_members: subChapter?.member_count || 0,
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
      .schema('yi_connect').from('members')
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
