/**
 * Report Types
 *
 * TypeScript types for the Yi Connect reporting system.
 * Includes types for 4 specialized reports:
 * 1. Trainer Performance Report
 * 2. Stakeholder Engagement Report
 * 3. Vertical Impact Report
 * 4. Member Activity Report
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ReportType =
  | 'trainer_performance'
  | 'stakeholder_engagement'
  | 'vertical_impact'
  | 'member_activity'
  | 'custom'

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json'

export type ReportSchedule =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'on_demand'

export type DateRangeType =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_year'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom'

export type GenerationStatus = 'pending' | 'generating' | 'completed' | 'failed'

export type EngagementStatus = 'active' | 'moderate' | 'dormant' | 'at_risk'

export type SkillWillCategory = 'star' | 'enthusiast' | 'cynic' | 'dead_wood'

// ============================================================================
// REPORT CONFIGURATION
// ============================================================================

export interface ReportConfiguration {
  id: string
  name: string
  description?: string
  report_type: ReportType
  chapter_id?: string
  vertical_id?: string
  config: ReportConfig
  date_range_type: DateRangeType
  custom_start_date?: string
  custom_end_date?: string
  schedule: ReportSchedule
  schedule_day_of_week?: number
  schedule_day_of_month?: number
  schedule_time?: string
  next_run_at?: string
  last_run_at?: string
  email_recipients: string[]
  auto_download: boolean
  is_active: boolean
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface ReportConfig {
  metrics: string[]
  filters?: Record<string, unknown>
  groupBy?: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
}

// ============================================================================
// GENERATED REPORTS
// ============================================================================

export interface GeneratedReport {
  id: string
  configuration_id?: string
  name: string
  report_type: ReportType
  format: ReportFormat
  chapter_id?: string
  parameters: Record<string, unknown>
  date_from?: string
  date_to?: string
  file_url?: string
  file_size_bytes?: number
  storage_path?: string
  generated_by?: string
  generated_at: string
  generation_time_ms?: number
  generation_status: GenerationStatus
  error_message?: string
  row_count?: number
  data_snapshot?: ReportSnapshot
  download_count: number
  last_downloaded_at?: string
  last_downloaded_by?: string
  expires_at: string
  is_archived: boolean
  created_at: string
}

export interface ReportSnapshot {
  summary: Record<string, number | string>
  highlights?: string[]
  charts?: ChartData[]
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  data: Array<{ label: string; value: number }>
}

// ============================================================================
// TRAINER PERFORMANCE REPORT
// ============================================================================

export interface TrainerPerformanceData {
  trainer_id: string
  trainer_name: string
  chapter_id: string
  skill_will_category?: SkillWillCategory
  assigned_vertical?: string

  // Session metrics
  total_sessions: number
  sessions_this_month: number
  sessions_this_quarter: number

  // Impact metrics
  total_students_impacted: number
  unique_stakeholders: number

  // Quality metrics
  avg_feedback_score: number
  session_completion_rate: number

  // Materials
  materials_uploaded: number
  materials_approved: number

  // Workload
  current_month_sessions: number
  available_slots: number
}

export interface TrainerPerformanceReportParams {
  chapter_id?: string
  vertical_id?: string
  date_from: string
  date_to: string
  min_sessions?: number
  categories?: SkillWillCategory[]
}

// ============================================================================
// STAKEHOLDER ENGAGEMENT REPORT
// ============================================================================

export interface StakeholderEngagementData {
  stakeholder_id: string
  stakeholder_name: string
  stakeholder_type: 'school' | 'college' | 'industry' | 'ngo' | 'government'
  chapter_id: string
  city?: string
  district?: string

  // MoU Status
  mou_status?: string
  mou_expiry?: string

  // Engagement metrics
  total_sessions: number
  sessions_this_year: number
  pending_bookings: number

  // Student reach
  total_students_reached: number
  registered_students?: number

  // Engagement health
  last_engagement: string
  engagement_status: EngagementStatus

  // Coordinator info
  coordinator_count: number

  // Quality
  avg_feedback_score: number
}

export interface StakeholderEngagementReportParams {
  chapter_id?: string
  stakeholder_types?: string[]
  engagement_status?: EngagementStatus[]
  date_from: string
  date_to: string
  has_mou?: boolean
}

// ============================================================================
// VERTICAL IMPACT REPORT
// ============================================================================

export interface VerticalImpactData {
  vertical_id: string
  vertical_name: string
  chapter_id: string

  // Leadership
  chair_count: number
  primary_chair_name?: string

  // Member metrics
  assigned_members: number
  active_trainers: number
  star_members: number
  enthusiast_members: number

  // Activity metrics
  total_sessions: number
  sessions_this_month: number
  total_students_impacted: number

  // Stakeholder reach
  total_stakeholders: number
  active_stakeholders: number

  // Quality
  avg_feedback_score: number
  approved_materials: number

  // Performance score
  performance_score: number
}

export interface VerticalImpactReportParams {
  chapter_id?: string
  vertical_ids?: string[]
  date_from: string
  date_to: string
  min_performance_score?: number
}

// ============================================================================
// MEMBER ACTIVITY REPORT
// ============================================================================

export interface MemberActivityData {
  member_id: string
  member_name: string
  chapter_id: string
  membership_status: string
  join_date?: string

  // Assessment
  skill_will_category?: SkillWillCategory
  skill_score?: number
  will_score?: number
  assigned_vertical?: string

  // Training activity
  sessions_conducted: number
  students_impacted: number
  training_hours: number

  // Event participation
  events_attended: number
  events_organized: number
  volunteer_hours: number

  // Sub-chapter activity
  subchapter_events_led: number

  // Recognition
  awards_received: number
  nominations_received: number

  // Engagement score
  engagement_score: number

  // Last activity
  last_activity_date: string
}

export interface MemberActivityReportParams {
  chapter_id?: string
  vertical_id?: string
  categories?: SkillWillCategory[]
  min_engagement_score?: number
  date_from: string
  date_to: string
}

// ============================================================================
// REPORT SUBSCRIPTION
// ============================================================================

export interface ReportSubscription {
  id: string
  configuration_id: string
  user_id: string
  delivery_method: 'email' | 'in_app' | 'both'
  email_address?: string
  format_preference: ReportFormat
  is_active: boolean
  subscribed_at: string
  unsubscribed_at?: string
}

// ============================================================================
// REPORT GENERATION REQUEST
// ============================================================================

export interface GenerateReportRequest {
  report_type: ReportType
  format: ReportFormat
  chapter_id?: string
  parameters: Record<string, unknown>
  date_from: string
  date_to: string
  email_recipients?: string[]
}

export interface GenerateReportResponse {
  success: boolean
  report_id?: string
  error?: string
  download_url?: string
}

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

export interface ReportDashboardSummary {
  total_configurations: number
  active_schedules: number
  reports_generated_this_month: number
  pending_generation: number
  recent_reports: GeneratedReport[]
  upcoming_schedules: Array<{
    configuration_id: string
    name: string
    report_type: ReportType
    next_run_at: string
  }>
}
