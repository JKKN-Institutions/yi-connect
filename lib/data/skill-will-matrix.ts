/**
 * Skill-Will Matrix Data Layer
 *
 * Calculation functions for the Skill-Will Matrix feature.
 * Analyzes members based on their capabilities (SKILL) and
 * motivation/engagement (WILL) to categorize them into quadrants.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { SkillWillCategory } from '@/types/member'

// ============================================================================
// Types
// ============================================================================

export interface MatrixMember {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  company: string | null
  designation: string | null
  skill_score: number
  will_score: number
  category: SkillWillCategory
  // Additional context
  years_of_experience: number | null
  top_skill: string | null
  engagement_score: number | null
  last_activity_date: string | null
}

export interface QuadrantSummary {
  category: SkillWillCategory
  count: number
  members: MatrixMember[]
  avg_skill: number
  avg_will: number
}

export interface MatrixData {
  members: MatrixMember[]
  quadrants: {
    star: QuadrantSummary
    enthusiast: QuadrantSummary
    cynic: QuadrantSummary
    dead_wood: QuadrantSummary
  }
  thresholds: {
    skill: number
    will: number
  }
  totals: {
    total_members: number
    avg_skill: number
    avg_will: number
  }
}

export interface MatrixFilters {
  vertical_ids?: string[]
  membership_status?: string[]
  min_tenure_months?: number
}

// ============================================================================
// Score Calculation Functions
// ============================================================================

/**
 * Calculate SKILL score (0-100) based on:
 * - Average proficiency level from member_skills
 * - Leadership assessment skills_score
 * - Years of experience
 * - Mentoring willingness (bonus)
 */
function calculateSkillScore(member: {
  skills?: Array<{ proficiency: string; is_willing_to_mentor?: boolean }>
  leadership_skills_score?: number | null
  leadership_experience_score?: number | null
  years_of_experience?: number | null
}): number {
  let score = 0
  let weights = 0

  // 1. Average proficiency from skills (weight: 35%)
  if (member.skills && member.skills.length > 0) {
    const proficiencyMap: Record<string, number> = {
      beginner: 25,
      intermediate: 50,
      advanced: 75,
      expert: 100,
    }
    const avgProficiency =
      member.skills.reduce((sum, s) => sum + (proficiencyMap[s.proficiency] || 0), 0) /
      member.skills.length
    score += avgProficiency * 0.35
    weights += 0.35

    // Bonus for mentoring willingness
    const mentorCount = member.skills.filter((s) => s.is_willing_to_mentor).length
    if (mentorCount > 0) {
      score += Math.min((mentorCount / member.skills.length) * 10, 10) // Up to 10 bonus points
    }
  }

  // 2. Leadership skills score (weight: 25%)
  if (member.leadership_skills_score != null) {
    score += member.leadership_skills_score * 0.25
    weights += 0.25
  }

  // 3. Leadership experience score (weight: 20%)
  if (member.leadership_experience_score != null) {
    score += member.leadership_experience_score * 0.2
    weights += 0.2
  }

  // 4. Years of experience (weight: 20%, capped at 30 years = 100)
  if (member.years_of_experience != null && member.years_of_experience > 0) {
    const expScore = Math.min((member.years_of_experience / 30) * 100, 100)
    score += expScore * 0.2
    weights += 0.2
  }

  // Normalize if we have partial data
  return weights > 0 ? Math.round(score / weights) : 0
}

/**
 * Calculate WILL score (0-100) based on:
 * - Engagement score (primary)
 * - Activity recency
 * - Contribution frequency
 * - Active membership status
 */
function calculateWillScore(member: {
  engagement_score?: number | null
  last_activity_date?: string | null
  events_attended?: number | null
  events_organized?: number | null
  volunteer_hours?: number | null
  membership_status?: string | null
  is_active?: boolean | null
}): number {
  let score = 0
  let weights = 0

  // 1. Engagement score (weight: 50%)
  if (member.engagement_score != null) {
    score += member.engagement_score * 0.5
    weights += 0.5
  }

  // 2. Activity recency (weight: 25%)
  if (member.last_activity_date) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(member.last_activity_date).getTime()) / (1000 * 60 * 60 * 24)
    )
    // Score decreases as days increase: 0 days = 100, 365+ days = 0
    const recencyScore = Math.max(100 - (daysSinceActivity / 365) * 100, 0)
    score += recencyScore * 0.25
    weights += 0.25
  }

  // 3. Contribution ratio (weight: 15%)
  if (member.events_attended && member.events_attended > 0) {
    const organized = member.events_organized || 0
    const hours = member.volunteer_hours || 0
    // Higher ratio of organizing/volunteering = higher will
    const contributionScore = Math.min(
      ((organized / member.events_attended) * 50 + (hours / 10) * 50),
      100
    )
    score += contributionScore * 0.15
    weights += 0.15
  }

  // 4. Membership status bonus (weight: 10%)
  if (member.membership_status === 'active' || member.is_active) {
    score += 100 * 0.1
    weights += 0.1
  }

  return weights > 0 ? Math.round(score / weights) : 0
}

/**
 * Assign quadrant based on skill and will scores
 */
function assignCategory(
  skillScore: number,
  willScore: number,
  skillThreshold: number = 50,
  willThreshold: number = 50
): SkillWillCategory {
  if (skillScore >= skillThreshold && willScore >= willThreshold) return 'star'
  if (skillScore < skillThreshold && willScore >= willThreshold) return 'enthusiast'
  if (skillScore >= skillThreshold && willScore < willThreshold) return 'cynic'
  return 'dead_wood'
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Get Skill-Will Matrix data for a chapter
 */
export const getSkillWillMatrixData = cache(async (
  chapterId: string,
  filters?: MatrixFilters
): Promise<MatrixData> => {
  const supabase = await createServerSupabaseClient()

  // Fetch members with all related data for calculations
  let query = supabase
    .from('members')
    .select(`
      id,
      years_of_experience,
      membership_status,
      is_active,
      skill_will_category,
      profile:profiles!inner(
        email,
        full_name,
        avatar_url
      ),
      company,
      designation,
      skills:member_skills(
        proficiency,
        is_willing_to_mentor,
        skill:skills(name)
      ),
      engagement:engagement_metrics(
        engagement_score,
        total_events_attended,
        events_organized,
        volunteer_hours,
        last_activity_date
      ),
      leadership:leadership_assessments(
        skills_score,
        leadership_experience_score
      )
    `)
    .eq('chapter_id', chapterId)
    .eq('is_active', true)

  // Apply filters
  if (filters?.membership_status && filters.membership_status.length > 0) {
    query = query.in('membership_status', filters.membership_status)
  }

  const { data: members, error } = await query

  if (error) {
    console.error('Error fetching matrix data:', {
      code: error.code,
      message: error.message,
      chapterId,
    })
    return createEmptyMatrixData()
  }

  if (!members || members.length === 0) {
    return createEmptyMatrixData()
  }

  // Process members and calculate scores
  const processedMembers: MatrixMember[] = members.map((member) => {
    // Supabase returns arrays for joined data - get first element
    const profileData = member.profile as unknown
    const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as {
      email: string
      full_name: string
      avatar_url: string | null
    } | null

    const skillsData = member.skills as unknown
    const skills = ((Array.isArray(skillsData) ? skillsData : []) as Array<{
      proficiency: string
      is_willing_to_mentor: boolean
      skill: Array<{ name: string }> | { name: string }
    }>)

    type EngagementType = {
      engagement_score: number | null
      total_events_attended: number | null
      events_organized: number | null
      volunteer_hours: number | null
      last_activity_date: string | null
    }
    const engagementData = member.engagement as unknown
    const engagementRaw = (Array.isArray(engagementData) ? engagementData[0] : engagementData) as EngagementType | null
    const engagement: EngagementType = engagementRaw || {
      engagement_score: null,
      total_events_attended: null,
      events_organized: null,
      volunteer_hours: null,
      last_activity_date: null,
    }

    type LeadershipType = {
      skills_score: number | null
      leadership_experience_score: number | null
    }
    const leadershipData = member.leadership as unknown
    const leadershipRaw = (Array.isArray(leadershipData) ? leadershipData[0] : leadershipData) as LeadershipType | null
    const leadership: LeadershipType = leadershipRaw || {
      skills_score: null,
      leadership_experience_score: null,
    }

    const skillScore = calculateSkillScore({
      skills: skills.map((s) => ({
        proficiency: s.proficiency,
        is_willing_to_mentor: s.is_willing_to_mentor,
      })),
      leadership_skills_score: leadership.skills_score,
      leadership_experience_score: leadership.leadership_experience_score,
      years_of_experience: member.years_of_experience,
    })

    const willScore = calculateWillScore({
      engagement_score: engagement.engagement_score,
      last_activity_date: engagement.last_activity_date,
      events_attended: engagement.total_events_attended,
      events_organized: engagement.events_organized,
      volunteer_hours: engagement.volunteer_hours,
      membership_status: member.membership_status,
      is_active: member.is_active,
    })

    // Get top skill by proficiency
    const sortedSkills = skills.sort((a, b) => {
      const order = { expert: 4, advanced: 3, intermediate: 2, beginner: 1 }
      return (order[b.proficiency as keyof typeof order] || 0) -
             (order[a.proficiency as keyof typeof order] || 0)
    })
    const topSkillEntry = sortedSkills[0]
    // skill relation can be array or object depending on Supabase join
    const topSkillData = topSkillEntry?.skill
    const topSkill = topSkillData
      ? (Array.isArray(topSkillData) ? topSkillData[0]?.name : topSkillData.name) || null
      : null

    return {
      id: member.id,
      full_name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url || null,
      company: member.company,
      designation: member.designation,
      skill_score: skillScore,
      will_score: willScore,
      category: assignCategory(skillScore, willScore),
      years_of_experience: member.years_of_experience,
      top_skill: topSkill,
      engagement_score: engagement.engagement_score,
      last_activity_date: engagement.last_activity_date,
    }
  })

  // Calculate thresholds (median or fixed 50)
  const avgSkill = processedMembers.reduce((sum, m) => sum + m.skill_score, 0) / processedMembers.length
  const avgWill = processedMembers.reduce((sum, m) => sum + m.will_score, 0) / processedMembers.length

  // Group by quadrant
  const quadrants = {
    star: createQuadrantSummary('star', processedMembers),
    enthusiast: createQuadrantSummary('enthusiast', processedMembers),
    cynic: createQuadrantSummary('cynic', processedMembers),
    dead_wood: createQuadrantSummary('dead_wood', processedMembers),
  }

  return {
    members: processedMembers,
    quadrants,
    thresholds: {
      skill: 50, // Fixed threshold
      will: 50,
    },
    totals: {
      total_members: processedMembers.length,
      avg_skill: Math.round(avgSkill),
      avg_will: Math.round(avgWill),
    },
  }
})

/**
 * Update a member's skill_will_category in the database
 */
export async function updateMemberCategory(
  memberId: string,
  category: SkillWillCategory
): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('members')
    .update({ skill_will_category: category })
    .eq('id', memberId)

  if (error) {
    console.error('Error updating member category:', error)
    return false
  }

  return true
}

/**
 * Batch update all members' categories for a chapter
 */
export async function recalculateChapterCategories(chapterId: string): Promise<number> {
  const matrixData = await getSkillWillMatrixData(chapterId)
  const supabase = await createServerSupabaseClient()

  let updatedCount = 0

  for (const member of matrixData.members) {
    const { error } = await supabase
      .from('members')
      .update({ skill_will_category: member.category })
      .eq('id', member.id)

    if (!error) {
      updatedCount++
    }
  }

  return updatedCount
}

// ============================================================================
// Helper Functions
// ============================================================================

function createQuadrantSummary(
  category: SkillWillCategory,
  members: MatrixMember[]
): QuadrantSummary {
  const quadrantMembers = members.filter((m) => m.category === category)
  const avgSkill =
    quadrantMembers.length > 0
      ? quadrantMembers.reduce((sum, m) => sum + m.skill_score, 0) / quadrantMembers.length
      : 0
  const avgWill =
    quadrantMembers.length > 0
      ? quadrantMembers.reduce((sum, m) => sum + m.will_score, 0) / quadrantMembers.length
      : 0

  return {
    category,
    count: quadrantMembers.length,
    members: quadrantMembers,
    avg_skill: Math.round(avgSkill),
    avg_will: Math.round(avgWill),
  }
}

function createEmptyMatrixData(): MatrixData {
  const emptyQuadrant = (category: SkillWillCategory): QuadrantSummary => ({
    category,
    count: 0,
    members: [],
    avg_skill: 0,
    avg_will: 0,
  })

  return {
    members: [],
    quadrants: {
      star: emptyQuadrant('star'),
      enthusiast: emptyQuadrant('enthusiast'),
      cynic: emptyQuadrant('cynic'),
      dead_wood: emptyQuadrant('dead_wood'),
    },
    thresholds: { skill: 50, will: 50 },
    totals: { total_members: 0, avg_skill: 0, avg_will: 0 },
  }
}

// ============================================================================
// Re-export config for server components
// ============================================================================

// Re-export from config file for convenience
export { QUADRANT_CONFIG } from './skill-will-matrix-config'
