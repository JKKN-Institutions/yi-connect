// ============================================================================
// MODULE 5: SUCCESSION & LEADERSHIP PIPELINE - TYPE DEFINITIONS
// ============================================================================
// Comprehensive type system for succession module covering:
// - Core entities (cycles, positions, nominations, etc.)
// - Enums matching database types
// - Utility types for pagination, filters, and dashboards
// - Integration types for other modules
// ============================================================================

// ============================================================================
// ENUMS (matching database enums exactly)
// ============================================================================

export type SuccessionCycleStatus =
  | 'draft'
  | 'active'
  | 'nominations_open'
  | 'nominations_closed'
  | 'applications_open'
  | 'applications_closed'
  | 'evaluations'
  | 'evaluations_closed'
  | 'interviews'
  | 'interviews_closed'
  | 'selection'
  | 'approval_pending'
  | 'completed'
  | 'archived'

export type SuccessionApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'

export type SuccessionInterviewStatus =
  | 'scheduled'
  | 'attended'
  | 'no_show'
  | 'rescheduled'
  | 'cancelled'

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export interface SuccessionCycle {
  id: string
  year: number
  cycle_name: string
  status: SuccessionCycleStatus
  description: string | null
  phase_configs: PhaseConfigs
  start_date: string | null
  end_date: string | null
  selection_committee_ids: string[]
  is_published: boolean
  published_at: string | null
  created_by_id: string | null
  created_at: string
  updated_at: string
  version: number
}

export interface PhaseConfigs {
  nominations?: PhaseConfig
  applications?: PhaseConfig
  evaluations?: PhaseConfig
  interviews?: PhaseConfig
  selection?: PhaseConfig
}

export interface PhaseConfig {
  start_date: string
  end_date: string
  description?: string
}

export interface SuccessionPosition {
  id: string
  cycle_id: string
  title: string
  description: string | null
  hierarchy_level: number // 1-5
  number_of_openings: number
  eligibility_criteria: PositionEligibilityCriteria
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PositionEligibilityCriteria {
  min_tenure?: number // years
  min_events?: number // event participation count
  required_skills?: string[]
  min_leadership_experience?: boolean
  tenure_weight?: number // percentage (0-100)
  events_weight?: number
  leadership_weight?: number
  skills_weight?: number
  minimum_score?: number // threshold to be eligible
}

export interface SuccessionEligibilityRecord {
  id: string
  cycle_id: string
  position_id: string
  member_id: string
  is_eligible: boolean
  eligibility_score: number
  score_breakdown: EligibilityScoreBreakdown
  calculated_at: string
}

export interface EligibilityScoreBreakdown {
  tenure?: {
    value: number
    score: number
    required: number
  }
  events?: {
    value: number
    score: number
    required: number
  }
  leadership?: {
    value: boolean
    score: number
  }
  skills?: {
    matched: string[]
    score: number
  }
}

export interface SuccessionNomination {
  id: string
  cycle_id: string
  position_id: string
  nominee_id: string
  nominated_by_id: string
  justification: string
  supporting_evidence: SupportingEvidence[]
  status: SuccessionApplicationStatus
  reviewed_by_id: string | null
  reviewed_at: string | null
  review_notes: string | null
  submitted_at: string | null
  withdrawn_at: string | null
  created_at: string
  updated_at: string
}

export interface SupportingEvidence {
  type: 'document' | 'link' | 'note'
  title: string
  content: string
  url?: string
}

export interface SuccessionApplication {
  id: string
  cycle_id: string
  position_id: string
  member_id: string
  personal_statement: string
  supporting_documents: SupportingDocument[]
  status: SuccessionApplicationStatus
  reviewed_by_id: string | null
  reviewed_at: string | null
  review_notes: string | null
  submitted_at: string | null
  withdrawn_at: string | null
  created_at: string
  updated_at: string
}

export interface SupportingDocument {
  name: string
  url: string
  size: number
  type: string
  uploaded_at: string
}

export interface SuccessionSecondment {
  id: string
  cycle_id: string
  position_id: string
  member_id: string
  organization_name: string
  secondment_details: string
  duration_months: number
  endorsements: Endorsement[]
  status: SuccessionApplicationStatus
  hr_approved: boolean
  hr_approved_by_id: string | null
  hr_approved_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface Endorsement {
  endorser_name: string
  endorser_designation: string
  endorser_organization: string
  endorsement_text: string
  endorsed_at: string
}

export interface SuccessionEvaluationCriteria {
  id: string
  position_id: string
  criterion_name: string
  description: string | null
  weight: number // 0-100
  max_score: number
  locked_at: string | null
  display_order: number
  created_at: string
}

export interface SuccessionEvaluator {
  id: string
  cycle_id: string
  member_id: string
  assigned_by_id: string | null
  assigned_at: string
  total_nominations: number
  scored_nominations: number
}

export interface SuccessionEvaluationScore {
  id: string
  cycle_id: string
  nomination_id: string
  evaluator_id: string
  criterion_id: string
  score: number
  comments: string | null
  submitted_at: string
}

export interface SuccessionInterviewSchedule {
  id: string
  cycle_id: string
  nomination_id: string
  interview_date: string
  location: string | null
  meeting_link: string | null
  duration_minutes: number
  panel_member_ids: string[]
  attendance_status: SuccessionInterviewStatus
  scheduled_by_id: string | null
  created_at: string
  updated_at: string
}

export interface SuccessionInterviewFeedback {
  id: string
  interview_schedule_id: string
  panel_member_id: string
  overall_rating: number // 1-10
  strengths: string | null
  areas_for_improvement: string | null
  recommendation: string | null
  additional_notes: string | null
  submitted_at: string
}

export interface SuccessionSelection {
  id: string
  cycle_id: string
  position_id: string
  nomination_id: string
  rank: number
  final_score: number
  selection_rationale: string
  approved_by_id: string | null
  approved_at: string | null
  announced_by_id: string | null
  announced_at: string | null
  created_at: string
}

export interface SuccessionAuditLog {
  id: string
  cycle_id: string | null
  action: string
  entity_type: string
  entity_id: string
  old_value: Record<string, any> | null
  new_value: Record<string, any> | null
  performed_by_id: string | null
  performed_at: string
  ip_address: string | null
  user_agent: string | null
}

// ============================================================================
// EXTENDED TYPES (with relations for display)
// ============================================================================

export interface SuccessionCycleWithPositions extends SuccessionCycle {
  positions: SuccessionPosition[]
  position_count: number
  nomination_count: number
  application_count: number
}

export interface SuccessionNominationWithDetails extends SuccessionNomination {
  nominee: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url: string | null
  }
  nominator: {
    id: string
    first_name: string
    last_name: string
  }
  position: {
    id: string
    title: string
  }
  cycle: {
    id: string
    cycle_name: string
    year: number
  }
}

export interface SuccessionApplicationWithDetails extends SuccessionApplication {
  member: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url: string | null
  }
  position: {
    id: string
    title: string
  }
  cycle: {
    id: string
    cycle_name: string
    year: number
  }
}

export interface EvaluatorWithProgress extends SuccessionEvaluator {
  member: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  progress_percentage: number
  remaining_nominations: number
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginatedSuccessionCycles {
  data: SuccessionCycle[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginatedSuccessionNominations {
  data: SuccessionNominationWithDetails[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginatedSuccessionApplications {
  data: SuccessionApplicationWithDetails[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SuccessionCycleFilters {
  status?: SuccessionCycleStatus | SuccessionCycleStatus[]
  year?: number
  search?: string
}

export interface SuccessionNominationFilters {
  cycle_id?: string
  position_id?: string
  status?: SuccessionApplicationStatus | SuccessionApplicationStatus[]
  nominee_id?: string
  nominated_by_id?: string
}

export interface SuccessionApplicationFilters {
  cycle_id?: string
  position_id?: string
  status?: SuccessionApplicationStatus | SuccessionApplicationStatus[]
  member_id?: string
}

// ============================================================================
// DASHBOARD & ANALYTICS TYPES
// ============================================================================

export interface SuccessionCycleStatistics {
  cycle_id: string
  total_positions: number
  total_nominations: number
  total_applications: number
  total_evaluators: number
  total_interviews_scheduled: number
  total_selections: number

  // By status
  nominations_by_status: Record<SuccessionApplicationStatus, number>
  applications_by_status: Record<SuccessionApplicationStatus, number>

  // Progress
  evaluation_progress: {
    total_required_scores: number
    completed_scores: number
    percentage: number
  }

  interview_progress: {
    total_scheduled: number
    completed: number
    percentage: number
  }
}

export interface MemberEligibilityDashboard {
  member_id: string
  eligible_positions: Array<{
    position: SuccessionPosition
    eligibility: SuccessionEligibilityRecord
    cycle: SuccessionCycle
  }>
  application_status: Array<{
    position: SuccessionPosition
    application: SuccessionApplication | null
    nomination: SuccessionNomination | null
    cycle: SuccessionCycle
  }>
  leadership_readiness_score: number
}

export interface EvaluatorDashboard {
  evaluator: SuccessionEvaluator
  assigned_nominations: SuccessionNominationWithDetails[]
  completed_scores: number
  pending_scores: number
  progress_percentage: number
  cycle: SuccessionCycle
}

export interface AdminDashboard {
  cycle: SuccessionCycleWithPositions
  statistics: SuccessionCycleStatistics
  pending_reviews: {
    nominations: number
    applications: number
  }
  upcoming_deadlines: Array<{
    phase: string
    deadline: string
    days_remaining: number
  }>
  recent_activity: SuccessionAuditLog[]
}

export interface AnalyticsDashboard {
  historical_cycles: Array<{
    cycle: SuccessionCycle
    statistics: SuccessionCycleStatistics
  }>
  trends: {
    nominations_per_cycle: number[]
    applications_per_cycle: number[]
    completion_rates: number[]
  }
  position_popularity: Array<{
    position_title: string
    nomination_count: number
    application_count: number
  }>
}

// ============================================================================
// TIMELINE & WORKFLOW TYPES
// ============================================================================

export interface CycleTimeline {
  cycle_id: string
  events: TimelineEvent[]
}

export interface TimelineEvent {
  id: string
  type: 'status_change' | 'nomination' | 'application' | 'evaluation' | 'interview' | 'selection'
  title: string
  description: string
  timestamp: string
  actor: {
    id: string
    name: string
  } | null
  metadata: Record<string, any>
}

export interface StateTransition {
  from: SuccessionCycleStatus
  to: SuccessionCycleStatus
  allowed: boolean
  reason?: string
}

// ============================================================================
// FORM DATA TYPES (for client-side forms)
// ============================================================================

export interface CreateSuccessionCycleData {
  year: number
  cycle_name: string
  description?: string
  start_date?: string
  end_date?: string
  phase_configs?: PhaseConfigs
}

export interface UpdateSuccessionCycleData extends Partial<CreateSuccessionCycleData> {
  id: string
  status?: SuccessionCycleStatus
  selection_committee_ids?: string[]
}

export interface CreateSuccessionPositionData {
  cycle_id: string
  title: string
  description?: string
  hierarchy_level: number
  number_of_openings: number
  eligibility_criteria: PositionEligibilityCriteria
}

export interface CreateNominationData {
  cycle_id: string
  position_id: string
  nominee_id: string
  justification: string
  supporting_evidence?: SupportingEvidence[]
}

export interface CreateApplicationData {
  cycle_id: string
  position_id: string
  personal_statement: string
  supporting_documents?: File[]
}

export interface SubmitEvaluationScoresData {
  nomination_id: string
  evaluator_id: string
  scores: Array<{
    criterion_id: string
    score: number
    comments?: string
  }>
}

export interface ScheduleInterviewData {
  cycle_id: string
  nomination_id: string
  interview_date: string
  location?: string
  meeting_link?: string
  duration_minutes: number
  panel_member_ids: string[]
}

export interface SubmitInterviewFeedbackData {
  interview_schedule_id: string
  overall_rating: number
  strengths?: string
  areas_for_improvement?: string
  recommendation?: string
  additional_notes?: string
}

export interface DeclareSelectionsData {
  cycle_id: string
  selections: Array<{
    position_id: string
    nomination_id: string
    rank: number
    final_score: number
    selection_rationale: string
  }>
}

// ============================================================================
// ACTION RESULT TYPES
// ============================================================================

export interface SuccessionActionResult<T = any> {
  success: boolean
  data?: T
  error?: string
  validation_errors?: Record<string, string[]>
}

// ============================================================================
// INTEGRATION TYPES (with other modules)
// ============================================================================

export interface MemberEligibilityInput {
  member_id: string
  position_id: string
  member_data: {
    member_since: string
    event_participation_count: number
    has_leadership_experience: boolean
    skills: string[]
  }
  criteria: PositionEligibilityCriteria
}

export interface EligibilityCalculationResult {
  is_eligible: boolean
  total_score: number
  breakdown: EligibilityScoreBreakdown
  reasons: string[]
}

// ============================================================================
// NOTIFICATION TYPES (Module 7 integration)
// ============================================================================

export type SuccessionNotificationEvent =
  | 'nominations_opened'
  | 'nominations_closing'
  | 'applications_opened'
  | 'evaluation_started'
  | 'interviews_scheduled'
  | 'results_announced'
  | 'you_are_eligible'
  | 'you_are_nominated'
  | 'application_received'
  | 'assigned_evaluator'
  | 'interview_invitation'
  | 'you_are_selected'
  | 'not_selected'
  | 'phase_deadline_warning'
  | 'scores_incomplete'

export interface SuccessionNotificationData {
  event: SuccessionNotificationEvent
  cycle_id: string
  cycle_name: string
  recipient_ids: string[]
  template_variables: Record<string, string | number>
}
