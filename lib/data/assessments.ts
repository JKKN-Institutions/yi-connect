/**
 * Skill-Will Assessment Data Layer
 *
 * Cached data fetching functions for Skill-Will Assessment feature.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  SkillWillAssessment,
  SkillWillAssessmentFull,
  AssessmentFilters,
  AssessmentStats,
  SkillWillCategory,
  AssessmentStatus,
} from '@/types/assessment'

// ============================================================================
// Single Assessment Queries
// ============================================================================

/**
 * Get assessment by ID with full details
 */
export const getAssessmentById = cache(
  async (id: string): Promise<SkillWillAssessmentFull | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select(
        `
        *,
        member:members(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        recommended_vertical:verticals!skill_will_assessments_recommended_vertical_id_fkey(
          id,
          name,
          color
        ),
        assigned_vertical:verticals!skill_will_assessments_assigned_vertical_id_fkey(
          id,
          name,
          color
        ),
        mentor:members!skill_will_assessments_mentor_id_fkey(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        assigned_by_member:members!skill_will_assessments_assigned_by_fkey(
          id,
          profile:profiles(
            full_name
          )
        )
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch assessment: ${error.message}`)
    }

    return transformAssessment(data)
  }
)

/**
 * Get the latest assessment for a member
 */
export const getMemberAssessment = cache(
  async (memberId: string): Promise<SkillWillAssessmentFull | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select(
        `
        *,
        member:members(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        recommended_vertical:verticals!skill_will_assessments_recommended_vertical_id_fkey(
          id,
          name,
          color
        ),
        assigned_vertical:verticals!skill_will_assessments_assigned_vertical_id_fkey(
          id,
          name,
          color
        ),
        mentor:members!skill_will_assessments_mentor_id_fkey(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `
      )
      .eq('member_id', memberId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch member assessment: ${error.message}`)
    }

    if (!data) {
      return null
    }

    return transformAssessment(data)
  }
)

/**
 * Get in-progress assessment for a member (if any)
 */
export const getInProgressAssessment = cache(
  async (memberId: string): Promise<SkillWillAssessment | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select('*')
      .eq('member_id', memberId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch in-progress assessment: ${error.message}`)
    }

    return data as SkillWillAssessment | null
  }
)

// ============================================================================
// List Queries
// ============================================================================

/**
 * Get assessments with filters
 */
export const getAssessments = cache(
  async (filters: AssessmentFilters = {}): Promise<SkillWillAssessmentFull[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('skill_will_assessments')
      .select(
        `
        *,
        member:members(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        recommended_vertical:verticals!skill_will_assessments_recommended_vertical_id_fkey(
          id,
          name,
          color
        ),
        assigned_vertical:verticals!skill_will_assessments_assigned_vertical_id_fkey(
          id,
          name,
          color
        ),
        mentor:members!skill_will_assessments_mentor_id_fkey(
          id,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        )
      `
      )

    // Apply filters
    if (filters.member_id) {
      query = query.eq('member_id', filters.member_id)
    }

    if (filters.chapter_id) {
      query = query.eq('chapter_id', filters.chapter_id)
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status)
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters.category) {
      if (Array.isArray(filters.category)) {
        query = query.in('category', filters.category)
      } else {
        query = query.eq('category', filters.category)
      }
    }

    if (filters.has_mentor !== undefined) {
      if (filters.has_mentor) {
        query = query.not('mentor_id', 'is', null)
      } else {
        query = query.is('mentor_id', null)
      }
    }

    if (filters.has_vertical !== undefined) {
      if (filters.has_vertical) {
        query = query.not('assigned_vertical_id', 'is', null)
      } else {
        query = query.is('assigned_vertical_id', null)
      }
    }

    if (filters.is_expired) {
      query = query.eq('status', 'expired')
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch assessments: ${error.message}`)
    }

    return (data || []).map(transformAssessment)
  }
)

/**
 * Get assessments for a chapter grouped by category
 */
export const getChapterAssessmentsByCategory = cache(
  async (chapterId: string): Promise<Record<SkillWillCategory, SkillWillAssessmentFull[]>> => {
    const assessments = await getAssessments({
      chapter_id: chapterId,
      status: 'completed',
    })

    const grouped: Record<SkillWillCategory, SkillWillAssessmentFull[]> = {
      star: [],
      enthusiast: [],
      cynic: [],
      dead_wood: [],
    }

    assessments.forEach((assessment) => {
      if (assessment.category) {
        grouped[assessment.category].push(assessment)
      }
    })

    return grouped
  }
)

/**
 * Get members pending assessment
 */
export const getMembersPendingAssessment = cache(
  async (chapterId: string): Promise<Array<{
    member_id: string
    full_name: string
    email: string
    avatar_url: string | null
    company: string | null
    designation: string | null
  }>> => {
    const supabase = await createServerSupabaseClient()

    // Get members without any completed assessment
    const { data, error } = await supabase
      .from('members')
      .select(
        `
        id,
        company,
        designation,
        profile:profiles(
          full_name,
          email,
          avatar_url
        )
      `
      )
      .eq('chapter_id', chapterId)
      .eq('membership_status', 'active')

    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`)
    }

    // Get members with completed assessments
    const { data: assessedMembers } = await supabase
      .from('skill_will_assessments')
      .select('member_id')
      .eq('chapter_id', chapterId)
      .eq('status', 'completed')

    const assessedMemberIds = new Set((assessedMembers || []).map((a: any) => a.member_id))

    // Filter out members with completed assessments
    return (data || [])
      .filter((m: any) => !assessedMemberIds.has(m.id))
      .map((m: any) => ({
        member_id: m.id,
        full_name: m.profile?.full_name || '',
        email: m.profile?.email || '',
        avatar_url: m.profile?.avatar_url || null,
        company: m.company,
        designation: m.designation,
      }))
  }
)

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get assessment statistics for a chapter
 */
export const getAssessmentStats = cache(
  async (chapterId: string): Promise<AssessmentStats> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select('status, category, skill_score, will_score, mentor_id, assigned_vertical_id')
      .eq('chapter_id', chapterId)

    if (error) {
      throw new Error(`Failed to fetch assessment stats: ${error.message}`)
    }

    const assessments = data || []

    const stats: AssessmentStats = {
      total: assessments.length,
      by_status: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        expired: 0,
      },
      by_category: {
        star: 0,
        enthusiast: 0,
        cynic: 0,
        dead_wood: 0,
      },
      pending_mentor: 0,
      pending_vertical: 0,
      average_skill_score: 0,
      average_will_score: 0,
    }

    let skillScoreSum = 0
    let willScoreSum = 0
    let scoreCount = 0

    assessments.forEach((a: any) => {
      // Count by status
      if (a.status) {
        stats.by_status[a.status as AssessmentStatus]++
      }

      // Count by category (only completed assessments)
      if (a.status === 'completed' && a.category) {
        stats.by_category[a.category as SkillWillCategory]++
      }

      // Count pending mentor/vertical assignments
      if (a.status === 'completed') {
        if (!a.mentor_id) stats.pending_mentor++
        if (!a.assigned_vertical_id) stats.pending_vertical++
      }

      // Sum scores for average
      if (a.skill_score !== null && a.will_score !== null) {
        skillScoreSum += Number(a.skill_score)
        willScoreSum += Number(a.will_score)
        scoreCount++
      }
    })

    // Calculate averages
    if (scoreCount > 0) {
      stats.average_skill_score = skillScoreSum / scoreCount
      stats.average_will_score = willScoreSum / scoreCount
    }

    return stats
  }
)

// ============================================================================
// Mentor Queries
// ============================================================================

/**
 * Get available mentors (Stars) for a chapter
 */
export const getAvailableMentors = cache(
  async (chapterId: string): Promise<Array<{
    member_id: string
    full_name: string
    email: string
    avatar_url: string | null
    mentee_count: number
  }>> => {
    const supabase = await createServerSupabaseClient()

    // Get all Star-category members
    const { data: starMembers, error } = await supabase
      .from('skill_will_assessments')
      .select(
        `
        member_id,
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
      .eq('chapter_id', chapterId)
      .eq('status', 'completed')
      .eq('category', 'star')

    if (error) {
      throw new Error(`Failed to fetch available mentors: ${error.message}`)
    }

    // Get mentee counts
    const { data: menteeCounts } = await supabase
      .from('skill_will_assessments')
      .select('mentor_id')
      .eq('chapter_id', chapterId)
      .not('mentor_id', 'is', null)

    const menteeCountMap = new Map<string, number>()
    ;(menteeCounts || []).forEach((a: any) => {
      const count = menteeCountMap.get(a.mentor_id) || 0
      menteeCountMap.set(a.mentor_id, count + 1)
    })

    return (starMembers || []).map((s: any) => ({
      member_id: s.member_id,
      full_name: s.member?.profile?.full_name || '',
      email: s.member?.profile?.email || '',
      avatar_url: s.member?.profile?.avatar_url || null,
      mentee_count: menteeCountMap.get(s.member_id) || 0,
    }))
  }
)

/**
 * Get mentees for a mentor
 */
export const getMentees = cache(
  async (mentorMemberId: string): Promise<SkillWillAssessmentFull[]> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('skill_will_assessments')
      .select(
        `
        *,
        member:members(
          id,
          company,
          designation,
          profile:profiles(
            full_name,
            email,
            avatar_url
          )
        ),
        assigned_vertical:verticals!skill_will_assessments_assigned_vertical_id_fkey(
          id,
          name,
          color
        )
      `
      )
      .eq('mentor_id', mentorMemberId)
      .eq('status', 'completed')

    if (error) {
      throw new Error(`Failed to fetch mentees: ${error.message}`)
    }

    return (data || []).map(transformAssessment)
  }
)

// ============================================================================
// Helpers
// ============================================================================

/**
 * Transform database record to typed assessment
 */
function transformAssessment(data: any): SkillWillAssessmentFull {
  return {
    id: data.id,
    member_id: data.member_id,
    chapter_id: data.chapter_id,
    status: data.status,
    version: data.version,
    started_at: data.started_at,
    completed_at: data.completed_at,
    expires_at: data.expires_at,
    q1_energy_focus: data.q1_energy_focus,
    q1_ai_suggestion: data.q1_ai_suggestion,
    q1_ai_reason: data.q1_ai_reason,
    q2_age_group: data.q2_age_group,
    q2_ai_suggestion: data.q2_ai_suggestion,
    q2_ai_reason: data.q2_ai_reason,
    q3_skill_level: data.q3_skill_level,
    q4_time_commitment: data.q4_time_commitment,
    q5_travel_willingness: data.q5_travel_willingness,
    ai_suggestions: data.ai_suggestions || {},
    skill_score: data.skill_score ? Number(data.skill_score) : null,
    will_score: data.will_score ? Number(data.will_score) : null,
    category: data.category,
    recommended_vertical_id: data.recommended_vertical_id,
    recommended_match_pct: data.recommended_match_pct,
    alternative_verticals: data.alternative_verticals || [],
    assigned_vertical_id: data.assigned_vertical_id,
    assigned_by: data.assigned_by,
    assigned_at: data.assigned_at,
    assignment_notes: data.assignment_notes,
    mentor_id: data.mentor_id,
    mentor_assigned_at: data.mentor_assigned_at,
    mentor_notes: data.mentor_notes,
    roadmap: data.roadmap || [],
    created_at: data.created_at,
    updated_at: data.updated_at,
    // Relationships
    member: data.member,
    recommended_vertical: data.recommended_vertical,
    assigned_vertical: data.assigned_vertical,
    mentor: data.mentor,
    assigned_by_member: data.assigned_by_member,
  }
}
