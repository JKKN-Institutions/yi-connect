/**
 * Health Card Tracking Types
 *
 * Types for tracking health card submission metrics,
 * identifying pending submissions, and measuring chapter performance.
 */

import type { Event } from './event'
import type { HealthCardEntry } from './health-card'

// ============================================================================
// Pending Submission Types
// ============================================================================

/**
 * An event that should have a health card submission but doesn't yet
 */
export interface PendingSubmission {
  event_id: string
  event_name: string
  event_date: string
  vertical_id: string
  vertical_name: string
  hours_since_event: number
  is_overdue: boolean // > 48 hours
  urgency: 'critical' | 'urgent' | 'normal'
  event_category: string
  aaa_type: 'awareness' | 'action' | 'advocacy' | null
  estimated_participants: number
}

/**
 * Summary of pending submissions by vertical
 */
export interface PendingSubmissionSummary {
  total_pending: number
  overdue_count: number
  by_vertical: {
    vertical_id: string
    vertical_name: string
    pending_count: number
    overdue_count: number
    oldest_pending_hours: number
  }[]
}

// ============================================================================
// Submission Rate Types
// ============================================================================

/**
 * Submission rate metrics for a vertical
 */
export interface VerticalSubmissionRate {
  vertical_id: string
  vertical_name: string
  total_events: number
  submitted_count: number
  pending_count: number
  submission_rate: number // 0-100 percentage
  trend: 'improving' | 'declining' | 'stable'
  last_submission_date: string | null
}

/**
 * Overall chapter submission rate metrics
 */
export interface ChapterSubmissionRate {
  chapter_id: string
  chapter_name: string
  total_events: number
  total_submitted: number
  overall_rate: number // 0-100 percentage
  by_vertical: VerticalSubmissionRate[]
  by_month: MonthlySubmissionRate[]
}

/**
 * Monthly submission rate for trend tracking
 */
export interface MonthlySubmissionRate {
  month: string // YYYY-MM format
  events_count: number
  submitted_count: number
  rate: number
}

// ============================================================================
// Quality Score Types
// ============================================================================

/**
 * Quality metrics for a single health card submission
 */
export interface SubmissionQualityMetrics {
  entry_id: string
  completeness_score: number // 0-100
  timeliness_score: number // 0-100 (based on 48hr rule)
  impact_score: number // 0-100 (based on participant counts)
  documentation_score: number // 0-100 (photos, social media, description)
  overall_quality: number // weighted average
  missing_fields: string[]
  quality_grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

/**
 * Vertical-level quality aggregation
 */
export interface VerticalQualitySummary {
  vertical_id: string
  vertical_name: string
  avg_quality_score: number
  avg_completeness: number
  avg_timeliness: number
  total_submissions: number
  grade_distribution: {
    A: number
    B: number
    C: number
    D: number
    F: number
  }
}

/**
 * Chapter-level quality summary
 */
export interface ChapterQualitySummary {
  chapter_id: string
  avg_quality_score: number
  by_vertical: VerticalQualitySummary[]
  improvement_areas: string[]
  strengths: string[]
}

// ============================================================================
// Timeliness Types (48-Hour Rule)
// ============================================================================

/**
 * Timeliness metrics for submissions
 */
export interface TimelinessMetrics {
  on_time_count: number // within 48 hours
  late_count: number // after 48 hours
  on_time_rate: number // percentage
  avg_hours_to_submit: number
  fastest_submission_hours: number
  slowest_submission_hours: number
}

/**
 * Timeliness breakdown by vertical
 */
export interface VerticalTimelinessMetrics extends TimelinessMetrics {
  vertical_id: string
  vertical_name: string
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Comprehensive vertical tracking status
 */
export interface VerticalTrackingStatus {
  vertical_id: string
  vertical_name: string
  icon: string
  color: string

  // Counts
  total_events: number
  submitted_events: number
  pending_events: number
  overdue_events: number

  // Rates
  submission_rate: number
  quality_score: number
  timeliness_rate: number

  // Impact
  total_participants: number
  total_ec_members: number
  total_non_ec_members: number

  // Status
  status: 'excellent' | 'good' | 'needs_attention' | 'critical'
  last_activity_date: string | null
  last_submission_date: string | null
}

/**
 * Main tracking dashboard data structure
 */
export interface HealthCardTrackingDashboard {
  chapter_id: string
  chapter_name: string
  generated_at: string
  period: {
    start: string
    end: string
    label: string
  }

  // Summary Stats
  summary: {
    total_events: number
    total_submissions: number
    overall_submission_rate: number
    overall_quality_score: number
    overall_timeliness_rate: number
    pending_count: number
    overdue_count: number
  }

  // Breakdown by vertical
  verticals: VerticalTrackingStatus[]

  // Pending submissions requiring attention
  pending_submissions: PendingSubmission[]

  // Timeliness metrics
  timeliness: TimelinessMetrics

  // Quality summary
  quality: ChapterQualitySummary

  // Monthly trend
  monthly_trend: MonthlySubmissionRate[]

  // Comparison metrics (vs other chapters or previous period)
  comparison?: {
    rank_in_region?: number
    total_chapters_in_region?: number
    vs_previous_period?: {
      submission_rate_change: number
      quality_score_change: number
    }
  }
}

// ============================================================================
// Event-Submission Linking Types
// ============================================================================

/**
 * Linked event with its corresponding health card submission
 */
export interface EventWithSubmission {
  event: Event
  submission: HealthCardEntry | null
  submission_status: 'submitted' | 'pending' | 'overdue' | 'not_required'
  hours_since_event: number
  quality_score: number | null
}

/**
 * Filter options for tracking dashboard
 */
export interface TrackingDashboardFilters {
  vertical_id?: string
  period?: 'week' | 'month' | 'quarter' | 'year' | 'all'
  status?: 'all' | 'pending' | 'overdue' | 'submitted'
  quality_grade?: 'A' | 'B' | 'C' | 'D' | 'F' | 'all'
  date_from?: string
  date_to?: string
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Tracking alert for actionable items
 */
export interface TrackingAlert {
  id: string
  type: 'overdue_submission' | 'approaching_deadline' | 'low_quality' | 'missing_data'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  related_event_id?: string
  related_entry_id?: string
  vertical_id?: string
  created_at: string
  action_url?: string
}

// ============================================================================
// Vertical Mapping (for display)
// ============================================================================

export const VERTICAL_DISPLAY_MAP: Record<string, { name: string; icon: string; color: string }> = {
  accessibility: { name: 'Accessibility', icon: '♿', color: 'blue' },
  climate_change: { name: 'Climate Change', icon: '🌱', color: 'green' },
  entrepreneurship: { name: 'Entrepreneurship', icon: '💼', color: 'orange' },
  health: { name: 'Health', icon: '🏥', color: 'red' },
  innovation: { name: 'Innovation', icon: '💡', color: 'yellow' },
  learning: { name: 'Learning', icon: '📚', color: 'purple' },
  masoom: { name: 'MASOOM', icon: '👶', color: 'pink' },
  membership_engagement: { name: 'Membership Engagement', icon: '🤝', color: 'cyan' },
  road_safety: { name: 'Road Safety', icon: '🚗', color: 'amber' },
  rural_initiative: { name: 'Rural Initiative', icon: '🌾', color: 'lime' },
  sig: { name: 'SIG', icon: '🎯', color: 'indigo' },
  sports: { name: 'Sports', icon: '🏆', color: 'emerald' },
  thalir: { name: 'Thalir', icon: '🌿', color: 'teal' },
  together_tribe: { name: 'Together Tribe', icon: '👥', color: 'violet' },
  yuva: { name: 'YUVA Acquisitions', icon: '🎓', color: 'rose' },
}

// ============================================================================
// Quality Scoring Constants
// ============================================================================

export const QUALITY_WEIGHTS = {
  completeness: 0.25,
  timeliness: 0.30,
  impact: 0.25,
  documentation: 0.20,
} as const

export const QUALITY_THRESHOLDS = {
  A: 90,
  B: 75,
  C: 60,
  D: 40,
  F: 0,
} as const

export const TIMELINESS_THRESHOLDS = {
  on_time: 48, // hours
  late_warning: 72, // hours
} as const
