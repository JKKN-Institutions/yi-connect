/**
 * AAA Pathfinder Module Data Fetching
 *
 * Cached data fetching functions for AAA Framework
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import { getChapterHealthStats, getHealthCardSummaryByVertical } from '@/lib/data/health-card'
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
  if (filters.calendar_year) {
    query = query.eq('calendar_year', filters.calendar_year)
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
  calendarYear: number
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
    .eq('calendar_year', calendarYear)
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
  calendarYear: number
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
    .eq('calendar_year', calendarYear)

  // Get all commitment cards for this year
  const { data: commitments } = await supabase
    .from('commitment_cards')
    .select('member_id, signed_at')
    .eq('chapter_id', chapterId)
    .eq('pathfinder_year', calendarYear)

  // Get all mentor assignments for this year
  const { data: mentors } = await supabase
    .from('mentor_assignments')
    .select('ec_chair_id, mentor_name')
    .eq('chapter_id', chapterId)
    .eq('pathfinder_year', calendarYear)

  // Get health card summary by vertical for progress tracking
  const healthSummary = await getHealthCardSummaryByVertical(chapterId, calendarYear)
  const healthByVertical = new Map(healthSummary.map(h => [h.vertical_id, h]))

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

    // Calculate depth metrics (Feature 2: Progress Tracking)
    const depthMetrics = plan ? calculateDepthMetrics(plan) : {
      totalTargetAttendance: 0,
      depthMetricsFilled: 0,
      hasEngagementGoals: false,
      hasImpactMeasures: false,
    }

    // Progress Tracking (Feature 3)
    const healthData = healthByVertical.get(v.id)
    const plannedActivities = plan ? 5 : 0 // 3 awareness + 2 action (excluding advocacy for now)
    const completedActivities = awarenessCount + actionCount + (plan?.advocacy_status === 'completed' ? 1 : 0)
    const actualActivities = healthData?.total_activities || 0
    const targetAttendance = depthMetrics.totalTargetAttendance
    const actualAttendance = healthData?.total_participants || 0

    // Calculate progress percentages
    const activityProgress = plannedActivities > 0
      ? Math.min(100, Math.round((completedActivities / plannedActivities) * 100))
      : 0
    const attendanceProgress = targetAttendance > 0
      ? Math.min(100, Math.round((actualAttendance / targetAttendance) * 100))
      : 0

    // Stretch Goals calculations
    const hasStretchAwareness = plan?.has_stretch_awareness || false
    const hasStretchAction = plan?.has_stretch_action || false
    const hasStretchAdvocacy = plan?.has_stretch_advocacy || false
    const stretchAwarenessCompleted = hasStretchAwareness && plan?.awareness_4_status === 'completed'
    const stretchActionCompleted = hasStretchAction && plan?.action_3_status === 'completed'
    const stretchAdvocacyCompleted = hasStretchAdvocacy && plan?.advocacy_2_status === 'completed'
    const totalStretchActivities = (hasStretchAwareness ? 1 : 0) + (hasStretchAction ? 1 : 0) + (hasStretchAdvocacy ? 1 : 0)
    const completedStretchActivities = (stretchAwarenessCompleted ? 1 : 0) + (stretchActionCompleted ? 1 : 0) + (stretchAdvocacyCompleted ? 1 : 0)

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
      total_target_attendance: depthMetrics.totalTargetAttendance,
      depth_metrics_filled: depthMetrics.depthMetricsFilled,
      has_engagement_goals: depthMetrics.hasEngagementGoals,
      has_impact_measures: depthMetrics.hasImpactMeasures,
      // Progress Tracking (Feature 3)
      planned_activities: plannedActivities,
      completed_activities: completedActivities,
      actual_activities: actualActivities,
      activity_progress: activityProgress,
      target_attendance: targetAttendance,
      actual_attendance: actualAttendance,
      attendance_progress: attendanceProgress,
      has_commitment: !!commitment,
      commitment_signed: !!commitment?.signed_at,
      has_mentor: !!mentor,
      mentor_name: mentor?.mentor_name || null,
      // Stretch Goals
      has_stretch_awareness: hasStretchAwareness,
      has_stretch_action: hasStretchAction,
      has_stretch_advocacy: hasStretchAdvocacy,
      stretch_awareness_completed: stretchAwarenessCompleted,
      stretch_action_completed: stretchActionCompleted,
      stretch_advocacy_completed: stretchAdvocacyCompleted,
      total_stretch_activities: totalStretchActivities,
      completed_stretch_activities: completedStretchActivities,
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

  // Depth Metrics Summary (Feature 2: Progress Tracking)
  const totalTargetAttendance = verticalStatuses.reduce((sum, v) => sum + v.total_target_attendance, 0)
  const totalActivitiesWithDepth = verticalStatuses.reduce((sum, v) => sum + v.depth_metrics_filled, 0)
  const totalPossibleActivities = verticalStatuses.filter(v => v.has_plan).length * 5 // 5 activities per plan
  const avgDepthCoverage = totalPossibleActivities > 0
    ? Math.round((totalActivitiesWithDepth / totalPossibleActivities) * 100)
    : 0
  const verticalsWithEngagementGoals = verticalStatuses.filter(v => v.has_engagement_goals).length
  const verticalsWithImpactMeasures = verticalStatuses.filter(v => v.has_impact_measures).length

  // Progress Tracking Summary (Feature 3)
  const totalPlannedActivities = verticalStatuses.reduce((sum, v) => sum + v.planned_activities, 0)
  const totalCompletedActivities = verticalStatuses.reduce((sum, v) => sum + v.completed_activities, 0)
  const totalActualActivities = verticalStatuses.reduce((sum, v) => sum + v.actual_activities, 0)
  const overallActivityProgress = totalPlannedActivities > 0
    ? Math.round((totalCompletedActivities / totalPlannedActivities) * 100)
    : 0
  const totalTargetAttendanceGoal = verticalStatuses.reduce((sum, v) => sum + v.target_attendance, 0)
  const totalActualAttendance = verticalStatuses.reduce((sum, v) => sum + v.actual_attendance, 0)
  const overallAttendanceProgress = totalTargetAttendanceGoal > 0
    ? Math.round((totalActualAttendance / totalTargetAttendanceGoal) * 100)
    : 0
  const verticalsOnTrack = verticalStatuses.filter(v => v.activity_progress >= 50).length
  const verticalsBehind = verticalStatuses.filter(v => v.has_plan && v.activity_progress < 50).length

  // Health Card Stats (Activity Logging)
  const healthStats = await getChapterHealthStats(chapterId, calendarYear)

  // Stretch Goals Summary
  const verticalsWithStretchGoals = verticalStatuses.filter(v => v.total_stretch_activities > 0).length
  const dashboardTotalStretchActivities = verticalStatuses.reduce((sum, v) => sum + v.total_stretch_activities, 0)
  const dashboardCompletedStretchActivities = verticalStatuses.reduce((sum, v) => sum + v.completed_stretch_activities, 0)

  return {
    calendar_year: calendarYear,
    chapter_id: chapterId,
    chapter_name: chapter.name,
    total_verticals: verticals.length,
    verticals_with_plans: plans?.length || 0,
    plans_approved: plansApproved,
    commitments_signed: commitments?.filter((c) => c.signed_at).length || 0,
    mentors_assigned: mentors?.length || 0,
    avg_aaa_completion: Math.round(avgAAACompletion),
    avg_milestone_completion: Math.round(avgMilestoneCompletion),
    total_target_attendance: totalTargetAttendance,
    avg_depth_coverage: avgDepthCoverage,
    verticals_with_engagement_goals: verticalsWithEngagementGoals,
    verticals_with_impact_measures: verticalsWithImpactMeasures,
    // Progress Tracking Summary (Feature 3)
    total_planned_activities: totalPlannedActivities,
    total_completed_activities: totalCompletedActivities,
    total_actual_activities: totalActualActivities,
    overall_activity_progress: overallActivityProgress,
    total_target_attendance_goal: totalTargetAttendanceGoal,
    total_actual_attendance: totalActualAttendance,
    overall_attendance_progress: overallAttendanceProgress,
    verticals_on_track: verticalsOnTrack,
    verticals_behind: verticalsBehind,
    health_card_total_activities: healthStats?.total_activities || 0,
    health_card_total_participants: healthStats?.total_participants || 0,
    health_card_activities_this_month: healthStats?.activities_this_month || 0,
    // Stretch Goals Summary
    verticals_with_stretch_goals: verticalsWithStretchGoals,
    total_stretch_activities: dashboardTotalStretchActivities,
    completed_stretch_activities: dashboardCompletedStretchActivities,
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
 * Calculate depth metrics coverage for a plan (Feature 2: Progress Tracking)
 */
function calculateDepthMetrics(plan: AAAPlan): {
  totalTargetAttendance: number
  depthMetricsFilled: number
  hasEngagementGoals: boolean
  hasImpactMeasures: boolean
} {
  // Sum up target attendance across all activities
  const totalTargetAttendance =
    (plan.awareness_1_target_attendance || 0) +
    (plan.awareness_2_target_attendance || 0) +
    (plan.awareness_3_target_attendance || 0) +
    (plan.action_1_target_attendance || 0) +
    (plan.action_2_target_attendance || 0)

  // Count activities with depth metrics filled (target_attendance set)
  const activities = [
    plan.awareness_1_target_attendance,
    plan.awareness_2_target_attendance,
    plan.awareness_3_target_attendance,
    plan.action_1_target_attendance,
    plan.action_2_target_attendance,
  ]
  const depthMetricsFilled = activities.filter(a => a !== null && a !== undefined && a > 0).length

  // Check for engagement goals
  const engagementGoals = [
    plan.awareness_1_engagement_goal,
    plan.awareness_2_engagement_goal,
    plan.awareness_3_engagement_goal,
    plan.action_1_engagement_goal,
    plan.action_2_engagement_goal,
  ]
  const hasEngagementGoals = engagementGoals.some(g => g && g.trim().length > 0)

  // Check for impact measures
  const impactMeasures = [
    plan.awareness_1_impact_measures,
    plan.awareness_2_impact_measures,
    plan.awareness_3_impact_measures,
    plan.action_1_impact_measures,
    plan.action_2_impact_measures,
  ]
  const hasImpactMeasures = impactMeasures.some(m => m && m.trim().length > 0)

  return {
    totalTargetAttendance,
    depthMetricsFilled,
    hasEngagementGoals,
    hasImpactMeasures,
  }
}

/**
 * Get current calendar year
 */
export function getCurrentCalendarYear(): number {
  return new Date().getFullYear()
}
