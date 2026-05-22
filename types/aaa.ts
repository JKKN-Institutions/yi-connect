/**
 * AAA Pathfinder Module
 * TypeScript Type Definitions
 *
 * Types for AAA Framework: Awareness → Action → Advocacy
 */

// ============================================================================
// STATUS ENUMS
// ============================================================================

export type AAAItemStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed'
export type AAAPlanStatus = 'draft' | 'submitted' | 'approved' | 'active'
export type MentorAssignmentStatus = 'active' | 'completed' | 'cancelled'

// ============================================================================
// AAA PLAN TYPES
// ============================================================================

export interface AAAActivity {
  title: string | null
  description: string | null
  audience?: string | null
  target?: string | null
  target_date: string | null // ISO date string
  status: AAAItemStatus
  event_id?: string | null
  // Depth Metrics
  target_attendance?: number | null
  engagement_goal?: string | null
  impact_measures?: string | null
}

export interface AAAPlan {
  id: string
  vertical_id: string
  calendar_year: number
  chapter_id: string

  // Awareness (3)
  awareness_1_title: string | null
  awareness_1_description: string | null
  awareness_1_audience: string | null
  awareness_1_target_date: string | null
  awareness_1_status: AAAItemStatus
  awareness_1_target_attendance: number | null
  awareness_1_engagement_goal: string | null
  awareness_1_impact_measures: string | null

  awareness_2_title: string | null
  awareness_2_description: string | null
  awareness_2_audience: string | null
  awareness_2_target_date: string | null
  awareness_2_status: AAAItemStatus
  awareness_2_target_attendance: number | null
  awareness_2_engagement_goal: string | null
  awareness_2_impact_measures: string | null

  awareness_3_title: string | null
  awareness_3_description: string | null
  awareness_3_audience: string | null
  awareness_3_target_date: string | null
  awareness_3_status: AAAItemStatus
  awareness_3_target_attendance: number | null
  awareness_3_engagement_goal: string | null
  awareness_3_impact_measures: string | null

  // Action (2)
  action_1_title: string | null
  action_1_description: string | null
  action_1_target: string | null
  action_1_target_date: string | null
  action_1_status: AAAItemStatus
  action_1_event_id: string | null
  action_1_target_attendance: number | null
  action_1_engagement_goal: string | null
  action_1_impact_measures: string | null

  action_2_title: string | null
  action_2_description: string | null
  action_2_target: string | null
  action_2_target_date: string | null
  action_2_status: AAAItemStatus
  action_2_event_id: string | null
  action_2_target_attendance: number | null
  action_2_engagement_goal: string | null
  action_2_impact_measures: string | null

  // First Event
  first_event_date: string | null
  first_event_locked: boolean
  first_event_locked_at: string | null

  // Advocacy (1)
  advocacy_goal: string | null
  advocacy_target_contact: string | null
  advocacy_approach: string | null
  advocacy_status: AAAItemStatus
  advocacy_outcome: string | null

  // 90-Day Milestones
  milestone_jan_target: string | null
  milestone_jan_status: MilestoneStatus
  milestone_jan_notes: string | null

  milestone_feb_target: string | null
  milestone_feb_status: MilestoneStatus
  milestone_feb_notes: string | null

  milestone_mar_target: string | null
  milestone_mar_status: MilestoneStatus
  milestone_mar_notes: string | null

  // ============================================================================
  // STRETCH GOALS - Optional bonus activities beyond core AAA
  // ============================================================================

  // Stretch Goal Flags (which stretch goals are enabled)
  has_stretch_awareness: boolean
  has_stretch_action: boolean
  has_stretch_advocacy: boolean

  // Awareness 4 (Optional Stretch)
  awareness_4_title: string | null
  awareness_4_description: string | null
  awareness_4_audience: string | null
  awareness_4_target_date: string | null
  awareness_4_status: AAAItemStatus
  awareness_4_target_attendance: number | null
  awareness_4_engagement_goal: string | null
  awareness_4_impact_measures: string | null

  // Action 3 (Optional Stretch)
  action_3_title: string | null
  action_3_description: string | null
  action_3_target: string | null
  action_3_target_date: string | null
  action_3_status: AAAItemStatus
  action_3_event_id: string | null
  action_3_target_attendance: number | null
  action_3_engagement_goal: string | null
  action_3_impact_measures: string | null

  // Advocacy 2 (Optional Stretch)
  advocacy_2_goal: string | null
  advocacy_2_target_contact: string | null
  advocacy_2_approach: string | null
  advocacy_2_status: AAAItemStatus
  advocacy_2_outcome: string | null

  // Metadata
  status: AAAPlanStatus
  created_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

// Extended type with relations
export interface AAAPlanWithDetails extends AAAPlan {
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
    avatar_url: string | null
  }
  approved_by_member?: {
    id: string
    full_name: string
  } | null
  commitment_card?: CommitmentCard | null
  mentor_assignment?: MentorAssignment | null
  // Computed
  aaa_completion?: number
  milestone_completion?: number
}

// ============================================================================
// COMMITMENT CARD TYPES
// ============================================================================

export interface CommitmentCard {
  id: string
  member_id: string
  aaa_plan_id: string | null
  chapter_id: string
  pathfinder_year: number

  commitment_1: string
  commitment_2: string | null
  commitment_3: string | null

  signed_at: string | null
  signature_data: string | null

  created_at: string
  updated_at: string
}

export interface CommitmentCardWithMember extends CommitmentCard {
  member?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
    designation: string | null
    company: string | null
  }
  aaa_plan?: {
    id: string
    vertical?: {
      name: string
    }
  } | null
}

// ============================================================================
// MENTOR ASSIGNMENT TYPES
// ============================================================================

export interface MentorAssignment {
  id: string
  ec_chair_id: string
  mentor_id: string
  chapter_id: string
  vertical_id: string | null
  pathfinder_year: number

  mentor_name: string | null
  mentor_title: string | null
  mentor_expertise: string | null

  status: MentorAssignmentStatus
  notes: string | null

  assigned_at: string
  created_at: string
  updated_at: string
}

export interface MentorAssignmentWithDetails extends MentorAssignment {
  ec_chair?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
  }
  mentor?: {
    id: string
    full_name: string
    email: string
    avatar_url: string | null
    designation: string | null
    company: string | null
  }
  vertical?: {
    id: string
    name: string
    slug: string
  } | null
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface VerticalAAAStatus {
  vertical_id: string
  vertical_name: string
  vertical_slug: string
  vertical_color: string | null
  vertical_icon: string | null

  // Chair info
  ec_chair_id: string | null
  ec_chair_name: string | null
  ec_chair_avatar: string | null

  // AAA Plan
  has_plan: boolean
  plan_id: string | null
  plan_status: AAAPlanStatus | null

  // Progress
  awareness_count: number // 0-3
  action_count: number // 0-2
  advocacy_done: boolean
  aaa_completion: number // 0-100

  // First Event
  first_event_date: string | null
  first_event_locked: boolean

  // Milestones
  milestone_completion: number // 0-100

  // Depth Metrics (Feature 2: Progress Tracking)
  total_target_attendance: number // Sum of all activity target attendances
  depth_metrics_filled: number // 0-5, how many activities have depth metrics
  has_engagement_goals: boolean // At least one engagement goal defined
  has_impact_measures: boolean // At least one impact measure defined

  // Progress Tracking - Planned vs Actual (Feature 3)
  planned_activities: number // 5 (3 awareness + 2 action) or 6 with advocacy
  completed_activities: number // Activities marked as 'completed' in plan
  actual_activities: number // Activities logged in health card
  activity_progress: number // 0-100, % of planned completed
  target_attendance: number // Sum of target_attendance from plan
  actual_attendance: number // Sum of participants from health card entries
  attendance_progress: number // 0-100, % of target attendance achieved

  // Commitment
  has_commitment: boolean
  commitment_signed: boolean

  // Mentor
  has_mentor: boolean
  mentor_name: string | null

  // Stretch Goals Summary
  has_stretch_awareness: boolean
  has_stretch_action: boolean
  has_stretch_advocacy: boolean
  stretch_awareness_completed: boolean
  stretch_action_completed: boolean
  stretch_advocacy_completed: boolean
  total_stretch_activities: number // 0-3 (how many stretch goals added)
  completed_stretch_activities: number // 0-3 (how many stretch goals completed)
}

export interface PathfinderDashboard {
  calendar_year: number
  chapter_id: string
  chapter_name: string

  // Summary stats
  total_verticals: number
  verticals_with_plans: number
  plans_approved: number
  commitments_signed: number
  mentors_assigned: number

  // Overall progress
  avg_aaa_completion: number
  avg_milestone_completion: number

  // Depth Metrics Summary (Feature 2: Progress Tracking)
  total_target_attendance: number // Total across all verticals
  avg_depth_coverage: number // 0-100, % of activities with depth metrics
  verticals_with_engagement_goals: number // Count of verticals with engagement goals
  verticals_with_impact_measures: number // Count of verticals with impact measures

  // Progress Tracking Summary (Feature 3)
  total_planned_activities: number // Total activities in all plans
  total_completed_activities: number // Activities marked completed
  total_actual_activities: number // Activities logged in health cards
  overall_activity_progress: number // 0-100
  total_target_attendance_goal: number // Sum of all target attendances
  total_actual_attendance: number // Sum of all actual participants
  overall_attendance_progress: number // 0-100
  verticals_on_track: number // Verticals with activity_progress >= 50%
  verticals_behind: number // Verticals with activity_progress < 50%

  // Health Card Stats (Activity Logging)
  health_card_total_activities: number
  health_card_total_participants: number
  health_card_activities_this_month: number

  // Stretch Goals Summary
  verticals_with_stretch_goals: number
  total_stretch_activities: number // Total across all verticals
  completed_stretch_activities: number // Completed stretch activities

  // Vertical details
  verticals: VerticalAAAStatus[]
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface CreateAAAPlanInput {
  vertical_id: string
  calendar_year: number
  chapter_id: string

  // Awareness
  awareness_1_title?: string
  awareness_1_description?: string
  awareness_1_audience?: string
  awareness_1_target_date?: string
  awareness_1_target_attendance?: number
  awareness_1_engagement_goal?: string
  awareness_1_impact_measures?: string

  awareness_2_title?: string
  awareness_2_description?: string
  awareness_2_audience?: string
  awareness_2_target_date?: string
  awareness_2_target_attendance?: number
  awareness_2_engagement_goal?: string
  awareness_2_impact_measures?: string

  awareness_3_title?: string
  awareness_3_description?: string
  awareness_3_audience?: string
  awareness_3_target_date?: string
  awareness_3_target_attendance?: number
  awareness_3_engagement_goal?: string
  awareness_3_impact_measures?: string

  // Action
  action_1_title?: string
  action_1_description?: string
  action_1_target?: string
  action_1_target_date?: string
  action_1_target_attendance?: number
  action_1_engagement_goal?: string
  action_1_impact_measures?: string

  action_2_title?: string
  action_2_description?: string
  action_2_target?: string
  action_2_target_date?: string
  action_2_target_attendance?: number
  action_2_engagement_goal?: string
  action_2_impact_measures?: string

  first_event_date?: string

  // Advocacy
  advocacy_goal?: string
  advocacy_target_contact?: string
  advocacy_approach?: string

  // Milestones
  milestone_jan_target?: string
  milestone_feb_target?: string
  milestone_mar_target?: string

  // Stretch Goals (Optional)
  has_stretch_awareness?: boolean
  has_stretch_action?: boolean
  has_stretch_advocacy?: boolean

  // Awareness 4 (Stretch)
  awareness_4_title?: string
  awareness_4_description?: string
  awareness_4_audience?: string
  awareness_4_target_date?: string
  awareness_4_target_attendance?: number
  awareness_4_engagement_goal?: string
  awareness_4_impact_measures?: string

  // Action 3 (Stretch)
  action_3_title?: string
  action_3_description?: string
  action_3_target?: string
  action_3_target_date?: string
  action_3_target_attendance?: number
  action_3_engagement_goal?: string
  action_3_impact_measures?: string

  // Advocacy 2 (Stretch)
  advocacy_2_goal?: string
  advocacy_2_target_contact?: string
  advocacy_2_approach?: string
}

export interface UpdateAAAPlanInput extends Partial<CreateAAAPlanInput> {
  id: string
  // Status updates
  awareness_1_status?: AAAItemStatus
  awareness_2_status?: AAAItemStatus
  awareness_3_status?: AAAItemStatus
  action_1_status?: AAAItemStatus
  action_2_status?: AAAItemStatus
  advocacy_status?: AAAItemStatus
  milestone_jan_status?: MilestoneStatus
  milestone_feb_status?: MilestoneStatus
  milestone_mar_status?: MilestoneStatus
  // Stretch goal status updates
  awareness_4_status?: AAAItemStatus
  action_3_status?: AAAItemStatus
  advocacy_2_status?: AAAItemStatus
  advocacy_2_outcome?: string
  // Lock first event
  first_event_locked?: boolean
}

export interface SignCommitmentCardInput {
  member_id: string
  aaa_plan_id?: string
  chapter_id: string
  pathfinder_year: number
  commitment_1: string
  commitment_2?: string
  commitment_3?: string
  signature_data?: string
}

export interface AssignMentorInput {
  ec_chair_id: string
  mentor_id: string
  chapter_id: string
  vertical_id?: string
  pathfinder_year: number
  mentor_name?: string
  mentor_title?: string
  mentor_expertise?: string
  notes?: string
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface AAAPlanFilters {
  vertical_id?: string
  calendar_year?: number
  status?: AAAPlanStatus
  has_first_event?: boolean
  chapter_id?: string
}

export interface CommitmentCardFilters {
  pathfinder_year?: number
  signed?: boolean
  chapter_id?: string
}
