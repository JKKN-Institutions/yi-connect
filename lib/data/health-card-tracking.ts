/**
 * Health Card Tracking Data Layer
 *
 * Cached data fetching functions for health card submission tracking.
 * Identifies pending submissions, calculates submission rates, and
 * provides comprehensive tracking metrics.
 *
 * Uses React cache() for request-level deduplication.
 */

import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/data/auth'
import type {
  PendingSubmission,
  PendingSubmissionSummary,
  VerticalSubmissionRate,
  ChapterSubmissionRate,
  MonthlySubmissionRate,
  SubmissionQualityMetrics,
  VerticalQualitySummary,
  ChapterQualitySummary,
  TimelinessMetrics,
  VerticalTimelinessMetrics,
  VerticalTrackingStatus,
  HealthCardTrackingDashboard,
  EventWithSubmission,
  TrackingDashboardFilters,
  TrackingAlert,
} from '@/types/health-card-tracking'
import {
  VERTICAL_DISPLAY_MAP,
  QUALITY_WEIGHTS,
  QUALITY_THRESHOLDS,
  TIMELINESS_THRESHOLDS,
} from '@/types/health-card-tracking'
import type { HealthCardEntry } from '@/types/health-card'

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate hours between two dates
 */
function hoursBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60)
}

/**
 * Determine urgency based on hours since event
 */
function getUrgency(hoursSinceEvent: number): 'critical' | 'urgent' | 'normal' {
  if (hoursSinceEvent > 72) return 'critical'
  if (hoursSinceEvent > 48) return 'urgent'
  return 'normal'
}

/**
 * Calculate quality grade from score
 */
function getQualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= QUALITY_THRESHOLDS.A) return 'A'
  if (score >= QUALITY_THRESHOLDS.B) return 'B'
  if (score >= QUALITY_THRESHOLDS.C) return 'C'
  if (score >= QUALITY_THRESHOLDS.D) return 'D'
  return 'F'
}

/**
 * Get vertical status based on metrics
 */
function getVerticalStatus(
  submissionRate: number,
  overdueCount: number
): 'excellent' | 'good' | 'needs_attention' | 'critical' {
  if (overdueCount > 2) return 'critical'
  if (submissionRate >= 90) return 'excellent'
  if (submissionRate >= 70) return 'good'
  if (submissionRate >= 50) return 'needs_attention'
  return 'critical'
}

// ============================================================================
// PENDING SUBMISSION QUERIES
// ============================================================================

/**
 * Get events that need health card submissions (completed events without matching entries)
 */
export const getPendingSubmissions = cache(
  async (filters?: TrackingDashboardFilters): Promise<PendingSubmission[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get completed events from vertical_activities
    let eventsQuery = supabase
      .from('vertical_activities')
      .select(`
        id,
        title,
        activity_date,
        vertical_id,
        activity_type,
        beneficiaries_count,
        vertical:verticals(id, name, slug)
      `)
      .order('activity_date', { ascending: false })

    // Apply date filters
    if (filters?.date_from) {
      eventsQuery = eventsQuery.gte('activity_date', filters.date_from)
    }
    if (filters?.date_to) {
      eventsQuery = eventsQuery.lte('activity_date', filters.date_to)
    }
    if (filters?.vertical_id) {
      eventsQuery = eventsQuery.eq('vertical_id', filters.vertical_id)
    }

    const { data: activities, error: activitiesError } = await eventsQuery

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return []
    }

    // Get health card entries for the same period
    let entriesQuery = supabase
      .from('health_card_entries')
      .select('id, activity_date, activity_name, vertical_id')

    if (filters?.date_from) {
      entriesQuery = entriesQuery.gte('activity_date', filters.date_from)
    }
    if (filters?.date_to) {
      entriesQuery = entriesQuery.lte('activity_date', filters.date_to)
    }
    if (filters?.vertical_id) {
      entriesQuery = entriesQuery.eq('vertical_id', filters.vertical_id)
    }

    const { data: entries, error: entriesError } = await entriesQuery

    if (entriesError) {
      console.error('Error fetching health card entries:', entriesError)
      return []
    }

    // Create a set of submitted activities (by vertical_id + date for matching)
    const submittedSet = new Set(
      (entries || []).map((e) => `${e.vertical_id}-${e.activity_date}`)
    )

    const now = new Date()
    const pending: PendingSubmission[] = []

    for (const activity of activities || []) {
      const key = `${activity.vertical_id}-${activity.activity_date}`

      // Check if already submitted
      if (submittedSet.has(key)) continue

      const hoursSinceEvent = hoursBetween(activity.activity_date, now)
      const isOverdue = hoursSinceEvent > TIMELINESS_THRESHOLDS.on_time

      // Map activity_type to AAA type
      let aaaType: 'awareness' | 'action' | 'advocacy' | null = null
      const activityType = (activity.activity_type || '').toLowerCase()
      if (activityType.includes('awareness')) aaaType = 'awareness'
      else if (activityType.includes('action')) aaaType = 'action'
      else if (activityType.includes('advocacy')) aaaType = 'advocacy'

      pending.push({
        event_id: activity.id,
        event_name: activity.title,
        event_date: activity.activity_date,
        vertical_id: activity.vertical_id,
        vertical_name: (activity.vertical as any)?.name || 'Unknown',
        hours_since_event: Math.round(hoursSinceEvent),
        is_overdue: isOverdue,
        urgency: getUrgency(hoursSinceEvent),
        event_category: activity.activity_type || 'other',
        aaa_type: aaaType,
        estimated_participants: activity.beneficiaries_count || 0,
      })
    }

    // Filter by status if specified
    if (filters?.status === 'overdue') {
      return pending.filter((p) => p.is_overdue)
    }
    if (filters?.status === 'pending') {
      return pending.filter((p) => !p.is_overdue)
    }

    // Sort by urgency (critical first)
    return pending.sort((a, b) => {
      const urgencyOrder = { critical: 0, urgent: 1, normal: 2 }
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    })
  }
)

/**
 * Get summary of pending submissions by vertical
 */
export const getPendingSubmissionSummary = cache(
  async (filters?: TrackingDashboardFilters): Promise<PendingSubmissionSummary> => {
    const pending = await getPendingSubmissions(filters)

    const byVerticalMap = new Map<
      string,
      { vertical_id: string; vertical_name: string; pending_count: number; overdue_count: number; oldest_pending_hours: number }
    >()

    for (const p of pending) {
      const existing = byVerticalMap.get(p.vertical_id)
      if (existing) {
        existing.pending_count++
        if (p.is_overdue) existing.overdue_count++
        existing.oldest_pending_hours = Math.max(existing.oldest_pending_hours, p.hours_since_event)
      } else {
        byVerticalMap.set(p.vertical_id, {
          vertical_id: p.vertical_id,
          vertical_name: p.vertical_name,
          pending_count: 1,
          overdue_count: p.is_overdue ? 1 : 0,
          oldest_pending_hours: p.hours_since_event,
        })
      }
    }

    return {
      total_pending: pending.length,
      overdue_count: pending.filter((p) => p.is_overdue).length,
      by_vertical: Array.from(byVerticalMap.values()),
    }
  }
)

// ============================================================================
// SUBMISSION RATE QUERIES
// ============================================================================

/**
 * Get submission rates by vertical
 */
export const getVerticalSubmissionRates = cache(
  async (filters?: TrackingDashboardFilters): Promise<VerticalSubmissionRate[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get all verticals
    const { data: verticals } = await supabase
      .from('verticals')
      .select('id, name, slug')
      .eq('is_active', true)

    if (!verticals) return []

    const rates: VerticalSubmissionRate[] = []

    for (const vertical of verticals) {
      // Count activities for this vertical
      let activitiesQuery = supabase
        .from('vertical_activities')
        .select('id, activity_date', { count: 'exact' })
        .eq('vertical_id', vertical.id)

      if (filters?.date_from) {
        activitiesQuery = activitiesQuery.gte('activity_date', filters.date_from)
      }
      if (filters?.date_to) {
        activitiesQuery = activitiesQuery.lte('activity_date', filters.date_to)
      }

      const { count: totalEvents } = await activitiesQuery

      // Count health card entries for this vertical
      let entriesQuery = supabase
        .from('health_card_entries')
        .select('id, activity_date, created_at', { count: 'exact' })
        .eq('vertical_id', vertical.id)

      if (filters?.date_from) {
        entriesQuery = entriesQuery.gte('activity_date', filters.date_from)
      }
      if (filters?.date_to) {
        entriesQuery = entriesQuery.lte('activity_date', filters.date_to)
      }

      const { data: entries, count: submittedCount } = await entriesQuery

      const total = totalEvents || 0
      const submitted = submittedCount || 0
      const pending = Math.max(0, total - submitted)
      const rate = total > 0 ? (submitted / total) * 100 : 0

      // Get last submission date
      const lastSubmission = entries && entries.length > 0
        ? entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
        : null

      rates.push({
        vertical_id: vertical.id,
        vertical_name: vertical.name,
        total_events: total,
        submitted_count: submitted,
        pending_count: pending,
        submission_rate: Math.round(rate * 10) / 10,
        trend: 'stable', // TODO: Calculate trend from historical data
        last_submission_date: lastSubmission,
      })
    }

    return rates.sort((a, b) => b.submission_rate - a.submission_rate)
  }
)

/**
 * Get chapter-level submission rates
 */
export const getChapterSubmissionRate = cache(
  async (filters?: TrackingDashboardFilters): Promise<ChapterSubmissionRate> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const verticalRates = await getVerticalSubmissionRates(filters)

    // Calculate totals
    const totalEvents = verticalRates.reduce((sum, v) => sum + v.total_events, 0)
    const totalSubmitted = verticalRates.reduce((sum, v) => sum + v.submitted_count, 0)
    const overallRate = totalEvents > 0 ? (totalSubmitted / totalEvents) * 100 : 0

    // Get monthly breakdown
    const monthlyRates = await getMonthlySubmissionRates(filters)

    // Get chapter info from user
    const { data: member } = await supabase
      .from('members')
      .select('chapter:chapters(id, name)')
      .eq('user_id', user.id)
      .single()

    const chapterData = member?.chapter as { id: string; name: string }[] | { id: string; name: string } | null
    const chapter = Array.isArray(chapterData) ? chapterData[0] : chapterData

    return {
      chapter_id: chapter?.id || '',
      chapter_name: chapter?.name || 'Unknown Chapter',
      total_events: totalEvents,
      total_submitted: totalSubmitted,
      overall_rate: Math.round(overallRate * 10) / 10,
      by_vertical: verticalRates,
      by_month: monthlyRates,
    }
  }
)

/**
 * Get monthly submission rates for trend analysis
 */
export const getMonthlySubmissionRates = cache(
  async (filters?: TrackingDashboardFilters): Promise<MonthlySubmissionRate[]> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Default to last 12 months if no date range specified
    const endDate = filters?.date_to ? new Date(filters.date_to) : new Date()
    const startDate = filters?.date_from
      ? new Date(filters.date_from)
      : new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)

    const rates: MonthlySubmissionRate[] = []

    // Iterate through each month
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (current <= endDate) {
      const monthStart = current.toISOString().slice(0, 10)
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0).toISOString().slice(0, 10)

      // Count activities for this month
      const { count: eventCount } = await supabase
        .from('vertical_activities')
        .select('id', { count: 'exact' })
        .gte('activity_date', monthStart)
        .lte('activity_date', monthEnd)

      // Count submissions for this month
      const { count: submittedCount } = await supabase
        .from('health_card_entries')
        .select('id', { count: 'exact' })
        .gte('activity_date', monthStart)
        .lte('activity_date', monthEnd)

      const events = eventCount || 0
      const submitted = submittedCount || 0
      const rate = events > 0 ? (submitted / events) * 100 : 0

      rates.push({
        month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        events_count: events,
        submitted_count: submitted,
        rate: Math.round(rate * 10) / 10,
      })

      current.setMonth(current.getMonth() + 1)
    }

    return rates
  }
)

// ============================================================================
// QUALITY SCORE QUERIES
// ============================================================================

/**
 * Calculate quality metrics for a single health card entry
 */
export function calculateEntryQuality(
  entry: HealthCardEntry,
  eventDate?: string
): SubmissionQualityMetrics {
  const missingFields: string[] = []

  // Completeness score (25%)
  let completenessScore = 100
  const requiredFields = [
    'activity_name',
    'activity_date',
    'ec_members_count',
    'non_ec_members_count',
    'vertical_id',
  ]

  for (const field of requiredFields) {
    const value = (entry as any)[field]
    if (value === null || value === undefined || value === '') {
      completenessScore -= 20
      missingFields.push(field)
    }
  }

  // Timeliness score (30%)
  let timelinessScore = 100
  if (eventDate && entry.created_at) {
    const hoursToSubmit = hoursBetween(eventDate, entry.created_at)
    if (hoursToSubmit > TIMELINESS_THRESHOLDS.late_warning) {
      timelinessScore = 40
    } else if (hoursToSubmit > TIMELINESS_THRESHOLDS.on_time) {
      timelinessScore = 70
    }
  }

  // Impact score (25%) - based on participant counts
  let impactScore = 100
  const totalParticipants = (entry.ec_members_count || 0) + (entry.non_ec_members_count || 0)
  if (totalParticipants === 0) {
    impactScore = 30
    missingFields.push('participant_count')
  } else if (totalParticipants < 5) {
    impactScore = 60
  } else if (totalParticipants < 20) {
    impactScore = 80
  }

  // Documentation score (20%) - based on vertical_specific_data
  let documentationScore = 100
  const specificData = entry.vertical_specific_data || {}
  const hasDescription = specificData.description || specificData.brief_description
  const hasPhotos = specificData.pictures || specificData.photos
  const hasSocialMedia = specificData.social_media_link

  if (!hasDescription) {
    documentationScore -= 40
    missingFields.push('description')
  }
  if (!hasPhotos) {
    documentationScore -= 30
    missingFields.push('photos')
  }
  if (!hasSocialMedia) {
    documentationScore -= 10
  }

  // Calculate overall quality
  const overall =
    completenessScore * QUALITY_WEIGHTS.completeness +
    timelinessScore * QUALITY_WEIGHTS.timeliness +
    impactScore * QUALITY_WEIGHTS.impact +
    documentationScore * QUALITY_WEIGHTS.documentation

  return {
    entry_id: entry.id,
    completeness_score: Math.round(completenessScore),
    timeliness_score: Math.round(timelinessScore),
    impact_score: Math.round(impactScore),
    documentation_score: Math.round(documentationScore),
    overall_quality: Math.round(overall),
    missing_fields: missingFields,
    quality_grade: getQualityGrade(overall),
  }
}

/**
 * Get quality summary for a vertical
 */
export const getVerticalQualitySummary = cache(
  async (verticalId: string, filters?: TrackingDashboardFilters): Promise<VerticalQualitySummary> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get vertical info
    const { data: vertical } = await supabase
      .from('verticals')
      .select('id, name')
      .eq('id', verticalId)
      .single()

    // Get health card entries
    let query = supabase
      .from('health_card_entries')
      .select('*')
      .eq('vertical_id', verticalId)

    if (filters?.date_from) {
      query = query.gte('activity_date', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('activity_date', filters.date_to)
    }

    const { data: entries } = await query

    if (!entries || entries.length === 0) {
      return {
        vertical_id: verticalId,
        vertical_name: vertical?.name || 'Unknown',
        avg_quality_score: 0,
        avg_completeness: 0,
        avg_timeliness: 0,
        total_submissions: 0,
        grade_distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
      }
    }

    // Calculate quality for each entry
    const qualities = entries.map((entry) =>
      calculateEntryQuality(entry, entry.activity_date)
    )

    // Calculate averages
    const avgQuality = qualities.reduce((sum, q) => sum + q.overall_quality, 0) / qualities.length
    const avgCompleteness = qualities.reduce((sum, q) => sum + q.completeness_score, 0) / qualities.length
    const avgTimeliness = qualities.reduce((sum, q) => sum + q.timeliness_score, 0) / qualities.length

    // Calculate grade distribution
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    for (const q of qualities) {
      gradeDistribution[q.quality_grade]++
    }

    return {
      vertical_id: verticalId,
      vertical_name: vertical?.name || 'Unknown',
      avg_quality_score: Math.round(avgQuality),
      avg_completeness: Math.round(avgCompleteness),
      avg_timeliness: Math.round(avgTimeliness),
      total_submissions: entries.length,
      grade_distribution: gradeDistribution,
    }
  }
)

/**
 * Get chapter-level quality summary
 */
export const getChapterQualitySummary = cache(
  async (filters?: TrackingDashboardFilters): Promise<ChapterQualitySummary> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get all verticals
    const { data: verticals } = await supabase
      .from('verticals')
      .select('id')
      .eq('is_active', true)

    if (!verticals) {
      return {
        chapter_id: '',
        avg_quality_score: 0,
        by_vertical: [],
        improvement_areas: [],
        strengths: [],
      }
    }

    // Get quality summary for each vertical
    const verticalSummaries = await Promise.all(
      verticals.map((v) => getVerticalQualitySummary(v.id, filters))
    )

    // Calculate overall average
    const withSubmissions = verticalSummaries.filter((v) => v.total_submissions > 0)
    const avgQuality = withSubmissions.length > 0
      ? withSubmissions.reduce((sum, v) => sum + v.avg_quality_score, 0) / withSubmissions.length
      : 0

    // Identify improvement areas and strengths
    const improvementAreas: string[] = []
    const strengths: string[] = []

    for (const summary of withSubmissions) {
      if (summary.avg_completeness < 70) {
        improvementAreas.push(`${summary.vertical_name}: Improve form completeness`)
      }
      if (summary.avg_timeliness < 70) {
        improvementAreas.push(`${summary.vertical_name}: Submit within 48 hours`)
      }
      if (summary.avg_quality_score >= 85) {
        strengths.push(`${summary.vertical_name}: High quality submissions`)
      }
    }

    // Get chapter info
    const { data: member } = await supabase
      .from('members')
      .select('chapter:chapters(id)')
      .eq('user_id', user.id)
      .single()

    return {
      chapter_id: (member?.chapter as any)?.id || '',
      avg_quality_score: Math.round(avgQuality),
      by_vertical: verticalSummaries,
      improvement_areas: improvementAreas.slice(0, 5),
      strengths: strengths.slice(0, 5),
    }
  }
)

// ============================================================================
// TIMELINESS QUERIES
// ============================================================================

/**
 * Get timeliness metrics
 */
export const getTimelinessMetrics = cache(
  async (filters?: TrackingDashboardFilters): Promise<TimelinessMetrics> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get health card entries with activity dates
    let query = supabase
      .from('health_card_entries')
      .select('id, activity_date, created_at')

    if (filters?.date_from) {
      query = query.gte('activity_date', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('activity_date', filters.date_to)
    }
    if (filters?.vertical_id) {
      query = query.eq('vertical_id', filters.vertical_id)
    }

    const { data: entries } = await query

    if (!entries || entries.length === 0) {
      return {
        on_time_count: 0,
        late_count: 0,
        on_time_rate: 0,
        avg_hours_to_submit: 0,
        fastest_submission_hours: 0,
        slowest_submission_hours: 0,
      }
    }

    let onTimeCount = 0
    let lateCount = 0
    const submissionHours: number[] = []

    for (const entry of entries) {
      const hours = hoursBetween(entry.activity_date, entry.created_at)
      submissionHours.push(hours)

      if (hours <= TIMELINESS_THRESHOLDS.on_time) {
        onTimeCount++
      } else {
        lateCount++
      }
    }

    const avgHours = submissionHours.reduce((sum, h) => sum + h, 0) / submissionHours.length

    return {
      on_time_count: onTimeCount,
      late_count: lateCount,
      on_time_rate: Math.round((onTimeCount / entries.length) * 100),
      avg_hours_to_submit: Math.round(avgHours),
      fastest_submission_hours: Math.round(Math.min(...submissionHours)),
      slowest_submission_hours: Math.round(Math.max(...submissionHours)),
    }
  }
)

// ============================================================================
// DASHBOARD QUERIES
// ============================================================================

/**
 * Get comprehensive tracking dashboard data
 */
export const getHealthCardTrackingDashboard = cache(
  async (filters?: TrackingDashboardFilters): Promise<HealthCardTrackingDashboard> => {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Get chapter info
    const { data: member } = await supabase
      .from('members')
      .select('chapter:chapters(id, name)')
      .eq('user_id', user.id)
      .single()

    const chapterData = member?.chapter as { id: string; name: string }[] | { id: string; name: string } | null
    const chapter = Array.isArray(chapterData) ? chapterData[0] : chapterData

    // Calculate date period
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date = new Date(filters?.date_to || now)
    let periodLabel: string

    switch (filters?.period) {
      case 'week':
        periodStart = new Date(periodEnd)
        periodStart.setDate(periodStart.getDate() - 7)
        periodLabel = 'Last 7 days'
        break
      case 'month':
        periodStart = new Date(periodEnd)
        periodStart.setMonth(periodStart.getMonth() - 1)
        periodLabel = 'Last 30 days'
        break
      case 'quarter':
        periodStart = new Date(periodEnd)
        periodStart.setMonth(periodStart.getMonth() - 3)
        periodLabel = 'Last quarter'
        break
      case 'year':
        periodStart = new Date(periodEnd)
        periodStart.setFullYear(periodStart.getFullYear() - 1)
        periodLabel = 'Last 12 months'
        break
      default:
        periodStart = new Date(filters?.date_from || new Date(now.getFullYear(), 0, 1))
        periodLabel = 'Year to date'
    }

    const dateFilters: TrackingDashboardFilters = {
      ...filters,
      date_from: periodStart.toISOString().slice(0, 10),
      date_to: periodEnd.toISOString().slice(0, 10),
    }

    // Fetch all data in parallel
    const [
      pendingSubmissions,
      chapterRate,
      qualitySummary,
      timelinessMetrics,
      monthlyTrend,
    ] = await Promise.all([
      getPendingSubmissions(dateFilters),
      getChapterSubmissionRate(dateFilters),
      getChapterQualitySummary(dateFilters),
      getTimelinessMetrics(dateFilters),
      getMonthlySubmissionRates(dateFilters),
    ])

    // Build vertical tracking statuses
    const verticals: VerticalTrackingStatus[] = chapterRate.by_vertical.map((v) => {
      const display = VERTICAL_DISPLAY_MAP[v.vertical_id] || {
        name: v.vertical_name,
        icon: '📋',
        color: 'gray',
      }

      const pendingForVertical = pendingSubmissions.filter(
        (p) => p.vertical_id === v.vertical_id
      )
      const overdueForVertical = pendingForVertical.filter((p) => p.is_overdue)

      const qualityForVertical = qualitySummary.by_vertical.find(
        (q) => q.vertical_id === v.vertical_id
      )

      return {
        vertical_id: v.vertical_id,
        vertical_name: v.vertical_name,
        icon: display.icon,
        color: display.color,
        total_events: v.total_events,
        submitted_events: v.submitted_count,
        pending_events: pendingForVertical.length,
        overdue_events: overdueForVertical.length,
        submission_rate: v.submission_rate,
        quality_score: qualityForVertical?.avg_quality_score || 0,
        timeliness_rate: qualityForVertical?.avg_timeliness || 0,
        total_participants: 0, // Would need to aggregate from entries
        total_ec_members: 0,
        total_non_ec_members: 0,
        status: getVerticalStatus(v.submission_rate, overdueForVertical.length),
        last_activity_date: null, // Would need to query
        last_submission_date: v.last_submission_date,
      }
    })

    // Build summary
    const summary = {
      total_events: chapterRate.total_events,
      total_submissions: chapterRate.total_submitted,
      overall_submission_rate: chapterRate.overall_rate,
      overall_quality_score: qualitySummary.avg_quality_score,
      overall_timeliness_rate: timelinessMetrics.on_time_rate,
      pending_count: pendingSubmissions.length,
      overdue_count: pendingSubmissions.filter((p) => p.is_overdue).length,
    }

    return {
      chapter_id: chapter?.id || '',
      chapter_name: chapter?.name || 'Unknown Chapter',
      generated_at: now.toISOString(),
      period: {
        start: periodStart.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10),
        label: periodLabel,
      },
      summary,
      verticals,
      pending_submissions: pendingSubmissions.slice(0, 10), // Top 10 most urgent
      timeliness: timelinessMetrics,
      quality: qualitySummary,
      monthly_trend: monthlyTrend,
    }
  }
)

// ============================================================================
// ALERT QUERIES
// ============================================================================

/**
 * Get tracking alerts for actionable items
 */
export const getTrackingAlerts = cache(
  async (filters?: TrackingDashboardFilters): Promise<TrackingAlert[]> => {
    const pendingSubmissions = await getPendingSubmissions(filters)
    const alerts: TrackingAlert[] = []

    // Generate alerts for overdue submissions
    for (const pending of pendingSubmissions.filter((p) => p.is_overdue)) {
      alerts.push({
        id: `overdue-${pending.event_id}`,
        type: 'overdue_submission',
        severity: pending.urgency === 'critical' ? 'critical' : 'warning',
        title: `Overdue: ${pending.event_name}`,
        description: `Health card submission for "${pending.event_name}" is ${pending.hours_since_event} hours overdue`,
        related_event_id: pending.event_id,
        vertical_id: pending.vertical_id,
        created_at: new Date().toISOString(),
        action_url: `/pathfinder/health-card/new?event=${pending.event_id}`,
      })
    }

    // Generate alerts for approaching deadlines (24-48 hours)
    for (const pending of pendingSubmissions.filter(
      (p) => !p.is_overdue && p.hours_since_event >= 24
    )) {
      alerts.push({
        id: `deadline-${pending.event_id}`,
        type: 'approaching_deadline',
        severity: 'warning',
        title: `Deadline approaching: ${pending.event_name}`,
        description: `Submit health card for "${pending.event_name}" within ${48 - pending.hours_since_event} hours`,
        related_event_id: pending.event_id,
        vertical_id: pending.vertical_id,
        created_at: new Date().toISOString(),
        action_url: `/pathfinder/health-card/new?event=${pending.event_id}`,
      })
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  }
)
