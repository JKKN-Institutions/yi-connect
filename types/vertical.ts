/**
 * Module 9: Vertical Performance Tracker
 * TypeScript Type Definitions
 *
 * This file contains all type definitions for the vertical performance tracking module.
 * It includes database types, extended types with relations, dashboard types, filter types,
 * and constants/enums used throughout the module.
 */

import type { Tables, Inserts, Updates, Enums } from './database'

// ============================================================================
// DATABASE ROW TYPES (Direct from generated types)
// ============================================================================

export type Vertical = Tables<'verticals'>
export type VerticalChair = Tables<'vertical_chairs'>
export type VerticalPlan = Tables<'vertical_plans'>
export type VerticalKPI = Tables<'vertical_kpis'>
export type VerticalKPIActual = Tables<'vertical_kpi_actuals'>
export type VerticalMember = Tables<'vertical_members'>
export type VerticalActivity = Tables<'vertical_activities'>
export type VerticalPerformanceReview = Tables<'vertical_performance_reviews'>
export type VerticalAchievement = Tables<'vertical_achievements'>

// Insert types for creating new records
export type VerticalInsert = Inserts<'verticals'>
export type VerticalChairInsert = Inserts<'vertical_chairs'>
export type VerticalPlanInsert = Inserts<'vertical_plans'>
export type VerticalKPIInsert = Inserts<'vertical_kpis'>
export type VerticalKPIActualInsert = Inserts<'vertical_kpi_actuals'>
export type VerticalMemberInsert = Inserts<'vertical_members'>
export type VerticalActivityInsert = Inserts<'vertical_activities'>
export type VerticalPerformanceReviewInsert = Inserts<'vertical_performance_reviews'>
export type VerticalAchievementInsert = Inserts<'vertical_achievements'>

// Update types for partial updates
export type VerticalUpdate = Updates<'verticals'>
export type VerticalChairUpdate = Updates<'vertical_chairs'>
export type VerticalPlanUpdate = Updates<'vertical_plans'>
export type VerticalKPIUpdate = Updates<'vertical_kpis'>
export type VerticalKPIActualUpdate = Updates<'vertical_kpi_actuals'>
export type VerticalMemberUpdate = Updates<'vertical_members'>
export type VerticalActivityUpdate = Updates<'vertical_activities'>
export type VerticalPerformanceReviewUpdate = Updates<'vertical_performance_reviews'>
export type VerticalAchievementUpdate = Updates<'vertical_achievements'>

// Enum types
export type VerticalStatus = Enums<'vertical_status'>
export type PlanStatus = Enums<'plan_status'>
export type MetricType = Enums<'metric_type'>
export type ActivityType = Enums<'activity_type'>
export type AchievementCategory = Enums<'achievement_category'>
export type ReviewStatus = Enums<'review_status'>

// ============================================================================
// EXTENDED TYPES WITH RELATIONS
// ============================================================================

/**
 * Vertical with current chair information
 */
export interface VerticalWithChair extends Vertical {
  current_chair?: {
    id: string
    member_id: string
    role: string
    start_date: string
    member?: {
      id: string
      avatar_url: string | null
      profile?: {
        full_name: string
        email: string
      }
    }
  } | null
  member_count?: number
  active_plan_count?: number
}

/**
 * Vertical Plan with all associated KPIs and progress
 */
export interface VerticalPlanWithKPIs extends VerticalPlan {
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
    icon: string | null
  }
  kpis?: VerticalKPIWithActuals[]
  created_by_member?: {
    id: string
    full_name: string
    email: string
  }
  approved_by_member?: {
    id: string
    full_name: string
    email: string
  } | null
  kpi_progress?: {
    total_kpis: number
    completed_kpis: number
    in_progress_kpis: number
    overall_completion: number
    weighted_achievement: number
  }
}

/**
 * KPI with actual values for all quarters
 */
export interface VerticalKPIWithActuals extends VerticalKPI {
  actuals?: {
    q1?: VerticalKPIActual
    q2?: VerticalKPIActual
    q3?: VerticalKPIActual
    q4?: VerticalKPIActual
  }
  current_achievement?: number
  completion_percentage?: number
  status?: 'not_started' | 'in_progress' | 'completed' | 'at_risk'
}

/**
 * Activity with event and creator details
 */
export interface VerticalActivityWithDetails extends VerticalActivity {
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
  }
  event?: {
    id: string
    title: string
    start_date: string
    status: string
  } | null
  created_by_member?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
  }
}

/**
 * Performance Review with all related information
 */
export interface VerticalPerformanceReviewWithDetails extends VerticalPerformanceReview {
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
  }
  chair?: {
    id: string
    role: string
    member?: {
      id: string
      full_name: string
      email: string
      avatar_url: string | null
    }
  }
  reviewed_by_member?: {
    id: string
    full_name: string
    email: string
  }
}

/**
 * Vertical Member with member details and contribution stats
 */
export interface VerticalMemberWithDetails extends VerticalMember {
  member?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
    phone: string | null
  }
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
  }
  activity_count?: number
  total_volunteer_hours?: number
}

/**
 * Achievement with vertical and creator details
 */
export interface VerticalAchievementWithDetails extends VerticalAchievement {
  vertical?: {
    id: string
    name: string
    slug: string
    color: string | null
    icon: string | null
  }
  created_by_member?: {
    id: string
    full_name: string
    email: string
  }
}

// ============================================================================
// DASHBOARD AND ANALYTICS TYPES
// ============================================================================

/**
 * Dashboard summary for a single vertical
 */
export interface VerticalDashboardSummary {
  vertical: Vertical
  current_chair?: {
    id: string
    member_id: string
    role: string
    start_date: string
    member?: {
      id: string
      avatar_url: string | null
      profile?: {
        full_name: string
        email: string
      }
    }
  } | null
  current_plan?: VerticalPlanWithKPIs | null
  kpi_summary: {
    total_kpis: number
    completed: number
    in_progress: number
    not_started: number
    at_risk: number
    overall_completion_percentage: number
    weighted_achievement_percentage: number
  }
  impact_metrics: {
    total_activities: number
    total_events: number
    total_beneficiaries: number
    total_volunteer_hours: number
    total_cost: number
    avg_beneficiaries_per_activity: number
    cost_per_beneficiary: number
  }
  budget_summary: {
    allocated: number
    spent: number
    committed: number
    available: number
    utilization_percentage: number
  }
  recent_activities: VerticalActivityWithDetails[]
  recent_achievements: VerticalAchievementWithDetails[]
  member_count: number
  active_member_count: number
}

/**
 * Ranking information for vertical leaderboard
 */
export interface VerticalRanking {
  vertical_id: string
  vertical_name: string
  rank: number
  total_score: number
  kpi_achievement: number
  budget_utilization: number
  impact_score: number
  change_from_last_quarter?: number // +1 = moved up, -1 = moved down, 0 = same
  color?: string | null
  icon?: string | null
}

/**
 * KPI Alert information
 */
export interface KPIAlert {
  kpi_id: string
  kpi_name: string
  target: number
  actual: number
  completion: number
  alert_type: 'success' | 'warning' | 'danger' | 'info'
  message: string
  vertical_id?: string
  vertical_name?: string
}

/**
 * Comparative analytics across verticals
 */
export interface VerticalComparison {
  fiscal_year: number
  quarter?: number
  verticals: {
    vertical_id: string
    vertical_name: string
    color: string | null
    kpi_achievement_rate: number
    budget_utilization_rate: number
    total_beneficiaries: number
    total_volunteer_hours: number
    event_completion_rate: number
    overall_score: number
  }[]
}

/**
 * Quarterly trend data for a vertical
 */
export interface VerticalQuarterlyTrend {
  vertical_id: string
  vertical_name: string
  fiscal_year: number
  quarters: {
    quarter: number
    kpi_achievement: number
    budget_utilization: number
    activities_count: number
    beneficiaries_count: number
    volunteer_hours: number
    cost_incurred: number
  }[]
}

/**
 * Impact metrics aggregated by time period
 */
export interface ImpactMetricsTrend {
  period: string // e.g., '2024-Q1', '2024-Q2'
  fiscal_year: number
  quarter: number
  total_beneficiaries: number
  total_volunteer_hours: number
  total_activities: number
  total_events: number
  total_cost: number
  cost_per_beneficiary: number
  hours_per_beneficiary: number
}

// ============================================================================
// FILTER AND SORT TYPES
// ============================================================================

/**
 * Filters for vertical listing
 */
export interface VerticalFilters {
  chapter_id?: string
  is_active?: boolean
  search?: string // Search in name, description
  has_current_chair?: boolean
  has_active_plan?: boolean
}

/**
 * Sort options for verticals
 */
export interface VerticalSortOptions {
  field: 'name' | 'created_at' | 'display_order' | 'member_count'
  direction: 'asc' | 'desc'
}

/**
 * Filters for KPI listing
 */
export interface KPIFilters {
  plan_id?: string
  vertical_id?: string
  fiscal_year?: number
  metric_type?: MetricType
  is_active?: boolean
  status?: 'not_started' | 'in_progress' | 'completed' | 'at_risk'
}

/**
 * Sort options for KPIs
 */
export interface KPISortOptions {
  field: 'kpi_name' | 'weight' | 'completion_percentage' | 'display_order'
  direction: 'asc' | 'desc'
}

/**
 * Filters for activity listing
 */
export interface ActivityFilters {
  vertical_id?: string
  fiscal_year?: number
  quarter?: number
  activity_type?: ActivityType
  date_from?: string
  date_to?: string
  has_event?: boolean
  created_by?: string
  min_beneficiaries?: number
}

/**
 * Sort options for activities
 */
export interface ActivitySortOptions {
  field: 'activity_date' | 'beneficiaries_count' | 'volunteer_hours' | 'cost_incurred' | 'created_at'
  direction: 'asc' | 'desc'
}

/**
 * Filters for performance reviews
 */
export interface ReviewFilters {
  vertical_id?: string
  fiscal_year?: number
  quarter?: number
  status?: ReviewStatus
  reviewed_by?: string
  min_rating?: number
}

/**
 * Sort options for reviews
 */
export interface ReviewSortOptions {
  field: 'reviewed_at' | 'overall_rating' | 'kpi_achievement_rate' | 'fiscal_year'
  direction: 'asc' | 'desc'
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export type PaginatedVerticals = PaginatedResponse<VerticalWithChair>
export type PaginatedPlans = PaginatedResponse<VerticalPlanWithKPIs>
export type PaginatedKPIs = PaginatedResponse<VerticalKPIWithActuals>
export type PaginatedActivities = PaginatedResponse<VerticalActivityWithDetails>
export type PaginatedReviews = PaginatedResponse<VerticalPerformanceReviewWithDetails>
export type PaginatedMembers = PaginatedResponse<VerticalMemberWithDetails>
export type PaginatedAchievements = PaginatedResponse<VerticalAchievementWithDetails>

// ============================================================================
// FORM DATA TYPES
// ============================================================================

/**
 * Form data for creating/updating a vertical
 */
export interface VerticalFormData {
  name: string
  slug: string
  description?: string | null
  color?: string | null
  icon?: string | null
  is_active?: boolean
  display_order?: number
}

/**
 * Form data for creating/updating a vertical plan
 */
export interface VerticalPlanFormData {
  vertical_id: string
  fiscal_year: number
  plan_title: string
  plan_description?: string | null
  vision_statement?: string | null
  objectives?: string[] | null
  budget_allocated: number
  kpis?: {
    kpi_name: string
    metric_type: MetricType
    target_q1: number
    target_q2: number
    target_q3: number
    target_q4: number
    weight: number
    display_order?: number
  }[]
}

/**
 * Form data for recording KPI actuals
 */
export interface KPIActualFormData {
  kpi_id: string
  quarter: number
  actual_value: number
  recorded_date?: string
  notes?: string | null
}

/**
 * Form data for creating an activity
 */
export interface VerticalActivityFormData {
  vertical_id: string
  event_id?: string | null
  activity_date: string
  activity_title: string
  activity_type: ActivityType
  description?: string | null
  beneficiaries_count: number
  volunteer_hours: number
  cost_incurred: number
  impact_notes?: string | null
  photo_urls?: string[] | null
}

/**
 * Form data for creating a performance review
 */
export interface PerformanceReviewFormData {
  vertical_id: string
  chair_id: string
  fiscal_year: number
  quarter: number
  overall_rating: number
  kpi_achievement_rate?: number
  budget_utilization_rate?: number
  event_completion_rate?: number
  strengths?: string | null
  areas_for_improvement?: string | null
  recommendations?: string | null
}

/**
 * Form data for assigning a chair
 */
export interface VerticalChairFormData {
  vertical_id: string
  member_id: string
  role?: string
  start_date: string
  end_date?: string | null
  responsibilities?: string | null
}

/**
 * Form data for adding a member to vertical
 */
export interface VerticalMemberFormData {
  vertical_id: string
  member_id: string
  role?: string | null
  joined_at?: string
  contribution_notes?: string | null
}

// ============================================================================
// CONSTANTS AND ENUMS
// ============================================================================

/**
 * Vertical status options
 */
export const VERTICAL_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

/**
 * Plan status options
 */
export const PLAN_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const

/**
 * Metric type options
 */
export const METRIC_TYPES = {
  COUNT: 'count',
  PERCENTAGE: 'percentage',
  AMOUNT: 'amount',
  HOURS: 'hours',
  SCORE: 'score',
} as const

/**
 * Metric type labels for UI
 */
export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  count: 'Count',
  percentage: 'Percentage',
  amount: 'Amount (₹)',
  hours: 'Hours',
  score: 'Score',
}

/**
 * Activity type options
 */
export const ACTIVITY_TYPES = {
  EVENT: 'event',
  MEETING: 'meeting',
  CAMPAIGN: 'campaign',
  WORKSHOP: 'workshop',
  OUTREACH: 'outreach',
  OTHER: 'other',
} as const

/**
 * Activity type labels for UI
 */
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  event: 'Event',
  meeting: 'Meeting',
  campaign: 'Campaign',
  workshop: 'Workshop',
  outreach: 'Outreach',
  other: 'Other',
}

/**
 * Achievement category options
 */
export const ACHIEVEMENT_CATEGORIES = {
  AWARD: 'award',
  MILESTONE: 'milestone',
  RECOGNITION: 'recognition',
  IMPACT: 'impact',
  INNOVATION: 'innovation',
} as const

/**
 * Achievement category labels for UI
 */
export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  award: 'Award',
  milestone: 'Milestone',
  recognition: 'Recognition',
  impact: 'Impact',
  innovation: 'Innovation',
}

/**
 * Review status options
 */
export const REVIEW_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  PUBLISHED: 'published',
} as const

/**
 * Quarter options
 */
export const QUARTERS = [1, 2, 3, 4] as const
export type Quarter = typeof QUARTERS[number]

/**
 * Quarter labels
 */
export const QUARTER_LABELS: Record<Quarter, string> = {
  1: 'Q1 (Apr-Jun)',
  2: 'Q2 (Jul-Sep)',
  3: 'Q3 (Oct-Dec)',
  4: 'Q4 (Jan-Mar)',
}

/**
 * KPI status thresholds
 */
export const KPI_STATUS_THRESHOLDS = {
  NOT_STARTED: 0,
  AT_RISK: 50,
  IN_PROGRESS: 75,
  COMPLETED: 100,
} as const

/**
 * Default colors for verticals (Tailwind colors)
 */
export const DEFAULT_VERTICAL_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
] as const

/**
 * Default icons for verticals (Lucide icon names)
 */
export const DEFAULT_VERTICAL_ICONS = [
  'Users',
  'GraduationCap',
  'Heart',
  'Briefcase',
  'Lightbulb',
  'Globe',
  'Megaphone',
  'Award',
] as const

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Get the fiscal year from a date
 */
export type FiscalYear = number

/**
 * Review period format: "FY2024-Q1"
 */
export type ReviewPeriod = string

/**
 * Success/Error result type for server actions
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Chart data point
 */
export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  date: string
  value: number
  label?: string
}
