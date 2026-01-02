/**
 * AAA Pathfinder Module Data Fetching
 *
 * Cached data fetching functions for AAA Framework
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  AAAPlan,
  AAAPlanWithDetails,
  CommitmentCard,
  CommitmentCardWithMember,
  MentorAssignment,
  MentorAssignmentWithDetails,
  VerticalAAAStatus,
  PathfinderDashboard,
  AAAPlanFilters,
} from '@/types/aaa'

// ============================================================================
// AAA PLAN DATA
// ============================================================================

/**
 * Get all AAA plans for a chapter/year
 */
export async function getAAAPlans(
  filters: AAAPlanFilters = {}
): Promise<AAAPlanWithDetails[]> {
  const supabase = await createClient()

  let query = supabase
    .from('aaa_plans')
    .select(`
      *,
      vertical:verticals(id, name, slug, color, icon),
      created_by_member:members!aaa_plans_created_by_fkey(id, full_name, avatar_url),
      approved_by_member:members!aaa_plans_approved_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (filters.chapter_id) {
    query = query.eq('chapter_id', filters.chapter_id)
  }
  if (filters.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id)
  }
  if (filters.fiscal_year) {
    query = query.eq('fiscal_year', filters.fiscal_year)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.has_first_event !== undefined) {
    if (filters.has_first_event) {
      query = query.not('first_event_date', 'is', null)
    } else {
      query = query.is('first_event_date', null)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Get AAA plans error:', error)
    return []
  }

  // Calculate completion percentages
  return (data || []).map((plan) => ({
    ...plan,
    aaa_completion: calculateAAACompletion(plan),
    milestone_completion: calculateMilestoneCompletion(plan),
  }))
}

/**
 * Get single AAA plan by ID
 */
export async function getAAAPlanById(id: string): Promise<AAAPlanWithDetails | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('aaa_plans')
    .select(`
      *,
      vertical:verticals(id, name, slug, color, icon),
      created_by_member:members!aaa_plans_created_by_fkey(id, full_name, avatar_url),
      approved_by_member:members!aaa_plans_approved_by_fkey(id, full_name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Get AAA plan error:', error)
    return null
  }

  return {
    ...data,
    aaa_completion: calculateAAACompletion(data),
    milestone_completion: calculateMilestoneCompletion(data),
  }
}

/**
 * Get AAA plan for a specific vertical and year
 */
export async function getAAAPlanByVertical(
  verticalId: string,
  fiscalYear: number
): Promise<AAAPlanWithDetails | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('aaa_plans')
    .select(`
      *,
      vertical:verticals(id, name, slug, color, icon),
      created_by_member:members!aaa_plans_created_by_fkey(id, full_name, avatar_url),
      approved_by_member:members!aaa_plans_approved_by_fkey(id, full_name)
    `)
    .eq('vertical_id', verticalId)
    .eq('fiscal_year', fiscalYear)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Get AAA plan by vertical error:', error)
    return null
  }

  if (!data) return null

  return {
    ...data,
    aaa_completion: calculateAAACompletion(data),
    milestone_completion: calculateMilestoneCompletion(data),
  }
}

// ============================================================================
// COMMITMENT CARD DATA
// ============================================================================

/**
 * Get all commitment cards for a chapter/year
 */
export async function getCommitmentCards(
  chapterId: string,
  pathfinderYear: number
): Promise<CommitmentCardWithMember[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commitment_cards')
    .select(`
      *,
      member:members(id, full_name, email, avatar_url, designation, company),
      aaa_plan:aaa_plans(id, vertical:verticals(name))
    `)
    .eq('chapter_id', chapterId)
    .eq('pathfinder_year', pathfinderYear)
    .order('signed_at', { ascending: false })

  if (error) {
    console.error('Get commitment cards error:', error)
    return []
  }

  return data || []
}

/**
 * Get commitment card for a specific member
 */
export async function getCommitmentCardByMember(
  memberId: string,
  pathfinderYear: number
): Promise<CommitmentCard | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commitment_cards')
    .select('*')
    .eq('member_id', memberId)
    .eq('pathfinder_year', pathfinderYear)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Get commitment card error:', error)
    return null
  }

  return data
}

// ============================================================================
// MENTOR ASSIGNMENT DATA
// ============================================================================

/**
 * Get all mentor assignments for a chapter/year
 */
export async function getMentorAssignments(
  chapterId: string,
  pathfinderYear: number
): Promise<MentorAssignmentWithDetails[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('mentor_assignments')
    .select(`
      *,
      ec_chair:members!mentor_assignments_ec_chair_id_fkey(id, full_name, email, avatar_url),
      mentor:members!mentor_assignments_mentor_id_fkey(id, full_name, email, avatar_url, designation, company),
      vertical:verticals(id, name, slug)
    `)
    .eq('chapter_id', chapterId)
    .eq('pathfinder_year', pathfinderYear)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('Get mentor assignments error:', error)
    return []
  }

  return data || []
}

// ============================================================================
// PATHFINDER DASHBOARD
// ============================================================================

/**
 * Get Pathfinder dashboard data for Chair view
 */
export async function getPathfinderDashboard(
  chapterId: string,
  fiscalYear: number
): Promise<PathfinderDashboard | null> {
  const supabase = await createClient()

  // Get chapter info
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name')
    .eq('id', chapterId)
    .single()

  if (!chapter) return null

  // Get all verticals for the chapter
  const { data: verticals } = await supabase
    .from('verticals')
    .select(`
      id, name, slug, color, icon,
      current_chair:vertical_chairs(
        id, member_id,
        member:members(id, full_name, avatar_url)
      )
    `)
    .eq('chapter_id', chapterId)
    .eq('is_active', true)
    .order('display_order')

  if (!verticals) return null

  // Get all AAA plans for this year
  const { data: plans } = await supabase
    .from('aaa_plans')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('fiscal_year', fiscalYear)

  // Get all commitment cards for this year
  const { data: commitments } = await supabase
    .from('commitment_cards')
    .select('member_id, signed_at')
    .eq('chapter_id', chapterId)
    .eq('pathfinder_year', fiscalYear)

  // Get all mentor assignments for this year
  const { data: mentors } = await supabase
    .from('mentor_assignments')
    .select('ec_chair_id, mentor_name')
    .eq('chapter_id', chapterId)
    .eq('pathfinder_year', fiscalYear)

  // Build vertical statuses
  const verticalStatuses: VerticalAAAStatus[] = verticals.map((v) => {
    const plan = plans?.find((p) => p.vertical_id === v.id)
    // Supabase returns nested relations as arrays
    const currentChairEntry = Array.isArray(v.current_chair) && v.current_chair.length > 0
      ? v.current_chair[0]
      : null
    // member is also returned as array from Supabase nested query
    const memberData = currentChairEntry?.member && Array.isArray(currentChairEntry.member) && currentChairEntry.member.length > 0
      ? currentChairEntry.member[0]
      : (currentChairEntry?.member && !Array.isArray(currentChairEntry.member) ? currentChairEntry.member : null)
    const chairMemberId = currentChairEntry?.member_id
    const commitment = commitments?.find((c) => c.member_id === chairMemberId)
    const mentor = mentors?.find((m) => m.ec_chair_id === chairMemberId)

    const awarenessCount = plan
      ? [plan.awareness_1_status, plan.awareness_2_status, plan.awareness_3_status]
          .filter((s) => s === 'completed').length
      : 0

    const actionCount = plan
      ? [plan.action_1_status, plan.action_2_status]
          .filter((s) => s === 'completed').length
      : 0

    return {
      vertical_id: v.id,
      vertical_name: v.name,
      vertical_slug: v.slug,
      vertical_color: v.color,
      vertical_icon: v.icon,
      ec_chair_id: chairMemberId || null,
      ec_chair_name: memberData?.full_name || null,
      ec_chair_avatar: memberData?.avatar_url || null,
      has_plan: !!plan,
      plan_id: plan?.id || null,
      plan_status: plan?.status || null,
      awareness_count: awarenessCount,
      action_count: actionCount,
      advocacy_done: plan?.advocacy_status === 'completed',
      aaa_completion: plan ? calculateAAACompletion(plan) : 0,
      first_event_date: plan?.first_event_date || null,
      first_event_locked: plan?.first_event_locked || false,
      milestone_completion: plan ? calculateMilestoneCompletion(plan) : 0,
      has_commitment: !!commitment,
      commitment_signed: !!commitment?.signed_at,
      has_mentor: !!mentor,
      mentor_name: mentor?.mentor_name || null,
    }
  })

  // Calculate summary stats
  const plansApproved = plans?.filter((p) => p.status === 'approved' || p.status === 'active').length || 0
  const avgAAACompletion = verticalStatuses.length > 0
    ? verticalStatuses.reduce((sum, v) => sum + v.aaa_completion, 0) / verticalStatuses.length
    : 0
  const avgMilestoneCompletion = verticalStatuses.length > 0
    ? verticalStatuses.reduce((sum, v) => sum + v.milestone_completion, 0) / verticalStatuses.length
    : 0

  return {
    fiscal_year: fiscalYear,
    chapter_id: chapterId,
    chapter_name: chapter.name,
    total_verticals: verticals.length,
    verticals_with_plans: plans?.length || 0,
    plans_approved: plansApproved,
    commitments_signed: commitments?.filter((c) => c.signed_at).length || 0,
    mentors_assigned: mentors?.length || 0,
    avg_aaa_completion: Math.round(avgAAACompletion),
    avg_milestone_completion: Math.round(avgMilestoneCompletion),
    verticals: verticalStatuses,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate AAA completion percentage (0-100)
 */
function calculateAAACompletion(plan: AAAPlan): number {
  const totalItems = 6 // 3 awareness + 2 action + 1 advocacy
  let completedItems = 0

  if (plan.awareness_1_status === 'completed') completedItems++
  if (plan.awareness_2_status === 'completed') completedItems++
  if (plan.awareness_3_status === 'completed') completedItems++
  if (plan.action_1_status === 'completed') completedItems++
  if (plan.action_2_status === 'completed') completedItems++
  if (plan.advocacy_status === 'completed') completedItems++

  return Math.round((completedItems / totalItems) * 100)
}

/**
 * Calculate milestone completion percentage (0-100)
 */
function calculateMilestoneCompletion(plan: AAAPlan): number {
  const totalMilestones = 3
  let completedMilestones = 0

  if (plan.milestone_jan_status === 'completed') completedMilestones++
  if (plan.milestone_feb_status === 'completed') completedMilestones++
  if (plan.milestone_mar_status === 'completed') completedMilestones++

  return Math.round((completedMilestones / totalMilestones) * 100)
}

/**
 * Get current fiscal year (Apr-Mar)
 * Yi uses the ENDING year for naming: April 2025 - March 2026 = FY2026
 */
export function getCurrentFiscalYear(): number {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()

  // Fiscal year runs April to March, named by ending year
  // Apr-Dec: ending year is next calendar year
  // Jan-Mar: ending year is current calendar year
  return month >= 4 ? year + 1 : year
}
