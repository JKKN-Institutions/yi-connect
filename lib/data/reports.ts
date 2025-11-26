/**
 * Report Data Layer
 *
 * Server-side functions for fetching report data.
 * Uses React cache() for request-level memoization.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type {
  ReportConfiguration,
  GeneratedReport,
  TrainerPerformanceData,
  TrainerPerformanceReportParams,
  StakeholderEngagementData,
  StakeholderEngagementReportParams,
  VerticalImpactData,
  VerticalImpactReportParams,
  MemberActivityData,
  MemberActivityReportParams,
  ReportDashboardSummary,
  ReportType,
  DateRangeType,
} from '@/types/reports'

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

export function getDateRange(type: DateRangeType, customStart?: string, customEnd?: string): {
  from: Date
  to: Date
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (type) {
    case 'last_7_days':
      return {
        from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: today,
      }
    case 'last_30_days':
      return {
        from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: today,
      }
    case 'last_90_days':
      return {
        from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
        to: today,
      }
    case 'last_year':
      return {
        from: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000),
        to: today,
      }
    case 'this_month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: today,
      }
    case 'this_quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return {
        from: quarterStart,
        to: today,
      }
    case 'this_year':
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: today,
      }
    case 'custom':
      return {
        from: customStart ? new Date(customStart) : today,
        to: customEnd ? new Date(customEnd) : today,
      }
    default:
      return {
        from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: today,
      }
  }
}

// ============================================================================
// REPORT CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Get all report configurations for a chapter
 */
export const getReportConfigurations = cache(
  async (chapterId?: string): Promise<ReportConfiguration[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('report_configurations')
      .select('*')
      .order('created_at', { ascending: false })

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching report configurations:', error)
      return []
    }

    return data as ReportConfiguration[]
  }
)

/**
 * Get a single report configuration
 */
export const getReportConfiguration = cache(
  async (configId: string): Promise<ReportConfiguration | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('report_configurations')
      .select('*')
      .eq('id', configId)
      .single()

    if (error) {
      console.error('Error fetching report configuration:', error)
      return null
    }

    return data as ReportConfiguration
  }
)

// ============================================================================
// GENERATED REPORTS FUNCTIONS
// ============================================================================

/**
 * Get generated reports with pagination
 */
export const getGeneratedReports = cache(
  async (options: {
    chapterId?: string
    reportType?: ReportType
    limit?: number
    offset?: number
  }): Promise<{ reports: GeneratedReport[]; total: number }> => {
    const supabase = await createServerSupabaseClient()
    const { chapterId, reportType, limit = 20, offset = 0 } = options

    let query = supabase
      .from('generated_reports')
      .select('*', { count: 'exact' })
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    if (reportType) {
      query = query.eq('report_type', reportType)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching generated reports:', error)
      return { reports: [], total: 0 }
    }

    return {
      reports: data as GeneratedReport[],
      total: count || 0,
    }
  }
)

/**
 * Get a single generated report
 */
export const getGeneratedReport = cache(
  async (reportId: string): Promise<GeneratedReport | null> => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error) {
      console.error('Error fetching generated report:', error)
      return null
    }

    return data as GeneratedReport
  }
)

// ============================================================================
// TRAINER PERFORMANCE REPORT DATA
// ============================================================================

/**
 * Get trainer performance report data
 */
export const getTrainerPerformanceData = cache(
  async (params: TrainerPerformanceReportParams): Promise<TrainerPerformanceData[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('trainer_performance_data')
      .select('*')
      .order('total_sessions', { ascending: false })

    if (params.chapter_id) {
      query = query.eq('chapter_id', params.chapter_id)
    }

    if (params.vertical_id) {
      query = query.eq('assigned_vertical_id', params.vertical_id)
    }

    if (params.categories && params.categories.length > 0) {
      query = query.in('skill_will_category', params.categories)
    }

    if (params.min_sessions) {
      query = query.gte('total_sessions', params.min_sessions)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching trainer performance data:', error)
      return []
    }

    return data as TrainerPerformanceData[]
  }
)

/**
 * Get trainer performance summary stats
 */
export const getTrainerPerformanceSummary = cache(
  async (chapterId?: string): Promise<{
    totalTrainers: number
    totalSessions: number
    totalStudentsImpacted: number
    avgFeedbackScore: number
    topPerformers: TrainerPerformanceData[]
  }> => {
    const data = await getTrainerPerformanceData({
      chapter_id: chapterId,
      date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      date_to: new Date().toISOString(),
    })

    const totalSessions = data.reduce((sum, t) => sum + t.total_sessions, 0)
    const totalStudents = data.reduce((sum, t) => sum + t.total_students_impacted, 0)
    const avgFeedback =
      data.length > 0
        ? data.reduce((sum, t) => sum + (t.avg_feedback_score || 0), 0) / data.length
        : 0

    // Top 5 performers by sessions
    const topPerformers = [...data]
      .sort((a, b) => b.total_sessions - a.total_sessions)
      .slice(0, 5)

    return {
      totalTrainers: data.length,
      totalSessions,
      totalStudentsImpacted: totalStudents,
      avgFeedbackScore: Math.round(avgFeedback * 100) / 100,
      topPerformers,
    }
  }
)

// ============================================================================
// STAKEHOLDER ENGAGEMENT REPORT DATA
// ============================================================================

/**
 * Get stakeholder engagement report data
 */
export const getStakeholderEngagementData = cache(
  async (params: StakeholderEngagementReportParams): Promise<StakeholderEngagementData[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('stakeholder_engagement_data')
      .select('*')
      .order('total_sessions', { ascending: false })

    if (params.chapter_id) {
      query = query.eq('chapter_id', params.chapter_id)
    }

    if (params.stakeholder_types && params.stakeholder_types.length > 0) {
      query = query.in('stakeholder_type', params.stakeholder_types)
    }

    if (params.engagement_status && params.engagement_status.length > 0) {
      query = query.in('engagement_status', params.engagement_status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stakeholder engagement data:', error)
      return []
    }

    return data as StakeholderEngagementData[]
  }
)

/**
 * Get stakeholder engagement summary
 */
export const getStakeholderEngagementSummary = cache(
  async (chapterId?: string): Promise<{
    totalStakeholders: number
    activeStakeholders: number
    atRiskStakeholders: number
    totalSessionsThisYear: number
    totalStudentsReached: number
    byType: Record<string, number>
    byStatus: Record<string, number>
  }> => {
    const data = await getStakeholderEngagementData({
      chapter_id: chapterId,
      date_from: new Date(new Date().getFullYear(), 0, 1).toISOString(),
      date_to: new Date().toISOString(),
    })

    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}

    data.forEach((s) => {
      byType[s.stakeholder_type] = (byType[s.stakeholder_type] || 0) + 1
      byStatus[s.engagement_status] = (byStatus[s.engagement_status] || 0) + 1
    })

    return {
      totalStakeholders: data.length,
      activeStakeholders: data.filter((s) => s.engagement_status === 'active').length,
      atRiskStakeholders: data.filter((s) => s.engagement_status === 'at_risk').length,
      totalSessionsThisYear: data.reduce((sum, s) => sum + s.sessions_this_year, 0),
      totalStudentsReached: data.reduce((sum, s) => sum + s.total_students_reached, 0),
      byType,
      byStatus,
    }
  }
)

// ============================================================================
// VERTICAL IMPACT REPORT DATA
// ============================================================================

/**
 * Get vertical impact report data
 */
export const getVerticalImpactData = cache(
  async (params: VerticalImpactReportParams): Promise<VerticalImpactData[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('vertical_impact_data')
      .select('*')
      .order('performance_score', { ascending: false })

    if (params.chapter_id) {
      query = query.eq('chapter_id', params.chapter_id)
    }

    if (params.vertical_ids && params.vertical_ids.length > 0) {
      query = query.in('vertical_id', params.vertical_ids)
    }

    if (params.min_performance_score) {
      query = query.gte('performance_score', params.min_performance_score)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching vertical impact data:', error)
      return []
    }

    return data as VerticalImpactData[]
  }
)

/**
 * Get vertical impact summary
 */
export const getVerticalImpactSummary = cache(
  async (chapterId?: string): Promise<{
    totalVerticals: number
    totalActiveTrainers: number
    totalSessionsThisMonth: number
    totalStudentsImpacted: number
    avgPerformanceScore: number
    topPerformer: VerticalImpactData | null
  }> => {
    const data = await getVerticalImpactData({
      chapter_id: chapterId,
      date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      date_to: new Date().toISOString(),
    })

    const avgScore =
      data.length > 0
        ? data.reduce((sum, v) => sum + v.performance_score, 0) / data.length
        : 0

    return {
      totalVerticals: data.length,
      totalActiveTrainers: data.reduce((sum, v) => sum + v.active_trainers, 0),
      totalSessionsThisMonth: data.reduce((sum, v) => sum + v.sessions_this_month, 0),
      totalStudentsImpacted: data.reduce((sum, v) => sum + v.total_students_impacted, 0),
      avgPerformanceScore: Math.round(avgScore * 100) / 100,
      topPerformer: data.length > 0 ? data[0] : null,
    }
  }
)

// ============================================================================
// MEMBER ACTIVITY REPORT DATA
// ============================================================================

/**
 * Get member activity report data
 */
export const getMemberActivityData = cache(
  async (params: MemberActivityReportParams): Promise<MemberActivityData[]> => {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('member_activity_data')
      .select('*')
      .order('engagement_score', { ascending: false })

    if (params.chapter_id) {
      query = query.eq('chapter_id', params.chapter_id)
    }

    if (params.vertical_id) {
      query = query.eq('assigned_vertical_id', params.vertical_id)
    }

    if (params.categories && params.categories.length > 0) {
      query = query.in('skill_will_category', params.categories)
    }

    if (params.min_engagement_score) {
      query = query.gte('engagement_score', params.min_engagement_score)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching member activity data:', error)
      return []
    }

    return data as MemberActivityData[]
  }
)

/**
 * Get member activity summary
 */
export const getMemberActivitySummary = cache(
  async (chapterId?: string): Promise<{
    totalActiveMembers: number
    totalTrainingSessions: number
    totalEventsAttended: number
    totalAwardsGiven: number
    avgEngagementScore: number
    byCategory: Record<string, number>
    topEngaged: MemberActivityData[]
  }> => {
    const data = await getMemberActivityData({
      chapter_id: chapterId,
      date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      date_to: new Date().toISOString(),
    })

    const byCategory: Record<string, number> = {}
    data.forEach((m) => {
      const cat = m.skill_will_category || 'unassessed'
      byCategory[cat] = (byCategory[cat] || 0) + 1
    })

    const avgScore =
      data.length > 0
        ? data.reduce((sum, m) => sum + m.engagement_score, 0) / data.length
        : 0

    return {
      totalActiveMembers: data.length,
      totalTrainingSessions: data.reduce((sum, m) => sum + m.sessions_conducted, 0),
      totalEventsAttended: data.reduce((sum, m) => sum + m.events_attended, 0),
      totalAwardsGiven: data.reduce((sum, m) => sum + m.awards_received, 0),
      avgEngagementScore: Math.round(avgScore * 100) / 100,
      byCategory,
      topEngaged: data.slice(0, 10),
    }
  }
)

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

/**
 * Get report dashboard summary
 */
export const getReportDashboardSummary = cache(
  async (chapterId?: string): Promise<ReportDashboardSummary> => {
    const supabase = await createServerSupabaseClient()

    // Get configurations
    const configs = await getReportConfigurations(chapterId)

    // Count active schedules
    const activeSchedules = configs.filter(
      (c) => c.is_active && c.schedule !== 'on_demand'
    ).length

    // Get reports generated this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const { count: reportsThisMonth } = await supabase
      .from('generated_reports')
      .select('*', { count: 'exact', head: true })
      .gte('generated_at', startOfMonth.toISOString())
      .eq('generation_status', 'completed')

    // Get pending reports
    const { count: pendingReports } = await supabase
      .from('generated_reports')
      .select('*', { count: 'exact', head: true })
      .in('generation_status', ['pending', 'generating'])

    // Get recent reports
    const { data: recentReports } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('generation_status', 'completed')
      .order('generated_at', { ascending: false })
      .limit(5)

    // Get upcoming schedules
    const upcomingSchedules = configs
      .filter((c) => c.is_active && c.next_run_at)
      .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())
      .slice(0, 5)
      .map((c) => ({
        configuration_id: c.id,
        name: c.name,
        report_type: c.report_type,
        next_run_at: c.next_run_at!,
      }))

    return {
      total_configurations: configs.length,
      active_schedules: activeSchedules,
      reports_generated_this_month: reportsThisMonth || 0,
      pending_generation: pendingReports || 0,
      recent_reports: (recentReports as GeneratedReport[]) || [],
      upcoming_schedules: upcomingSchedules,
    }
  }
)
