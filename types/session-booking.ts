/**
 * Session Booking Type Definitions
 *
 * Types for the coordinator portal session booking system.
 */

// ============================================================================
// Enums and Constants
// ============================================================================

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'pending_trainer'
  | 'trainer_assigned'
  | 'materials_pending'
  | 'in_progress'
  | 'completed'
  | 'rescheduled'

export type TimeSlot = 'morning' | 'afternoon' | 'evening'

export type CoordinatorStatus = 'pending_verification' | 'active' | 'inactive' | 'blocked'

// ============================================================================
// Base Types
// ============================================================================

export interface SessionType {
  id: string
  name: string
  display_name: string
  description: string | null
  vertical_id: string | null
  target_age_groups: string[]
  typical_duration_minutes: number
  default_duration_minutes: number | null
  min_participants: number | null
  max_participants: number | null
  requires_certification: string[]
  requires_materials: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SessionTypeWithVertical extends SessionType {
  vertical?: {
    id: string
    name: string
    color: string | null
  } | null
}

export interface StakeholderCoordinator {
  id: string
  stakeholder_type: 'school' | 'college' | 'industry' | 'government' | 'ngo'
  stakeholder_id: string
  email: string
  full_name: string
  designation: string | null
  phone: string | null
  avatar_url: string | null
  status: CoordinatorStatus
  verified_at: string | null
  verified_by: string | null
  can_book_sessions: boolean
  can_view_reports: boolean
  can_manage_students: boolean
  last_login_at: string | null
  login_count: number
  created_at: string
  updated_at: string
}

export interface SessionBooking {
  id: string
  coordinator_id: string
  stakeholder_type: string
  stakeholder_id: string
  session_type_id: string
  preferred_date: string
  preferred_time_slot: TimeSlot | null
  alternate_date: string | null
  alternate_time_slot: TimeSlot | null
  expected_participants: number
  participant_details: ParticipantDetails | null
  topics_requested: string[] | null
  custom_requirements: string | null
  assigned_trainer_id: string | null
  assigned_at: string | null
  assigned_by: string | null
  ai_suggestions: AISuggestions | null
  confirmed_date: string | null
  confirmed_time_start: string | null
  confirmed_time_end: string | null
  venue: string | null
  status: BookingStatus
  status_history: StatusHistoryItem[]
  attendance_count: number | null
  feedback_score: number | null
  session_notes: string | null
  materials_provided: string[] | null
  created_at: string
  updated_at: string
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
}

export interface ParticipantDetails {
  grade?: string
  department?: string
  age_range?: string
  gender_distribution?: {
    male?: number
    female?: number
    other?: number
  }
  special_needs?: string
  language_preference?: string[]
  is_refresher?: boolean
}

export interface AISuggestions {
  recommended_trainers?: Array<{
    trainer_id: string
    trainer_name: string
    match_score: number
    reason: string
  }>
  recommended_date?: string
  recommended_time?: string
  suggested_topics?: string[]
  based_on_history?: boolean
}

export interface StatusHistoryItem {
  status: BookingStatus
  changed_at: string
  changed_by?: string
  notes?: string
}

// ============================================================================
// Full Types with Relations
// ============================================================================

export interface SessionBookingFull extends SessionBooking {
  coordinator?: StakeholderCoordinator
  session_type?: SessionType
  assigned_trainer?: {
    id: string
    member_id: string
    member?: {
      id: string
      profile?: {
        full_name: string
        email: string
        phone: string | null
        avatar_url: string | null
      }
    }
  } | null
  stakeholder?: {
    id: string
    name: string
    type: string
  } | null
}

// ============================================================================
// Form Types
// ============================================================================

export interface CreateBookingInput {
  coordinator_id: string
  stakeholder_type: string
  stakeholder_id: string
  session_type_id: string
  preferred_date: string
  preferred_time_slot?: TimeSlot
  alternate_date?: string
  alternate_time_slot?: TimeSlot
  expected_participants: number
  participant_details?: ParticipantDetails
  topics_requested?: string[]
  custom_requirements?: string
}

export interface AssignTrainerInput {
  booking_id: string
  trainer_id: string
  confirmed_date: string
  confirmed_time_start: string
  confirmed_time_end: string
  venue?: string
  notes?: string
}

export interface CompleteSessionInput {
  booking_id: string
  attendance_count: number
  feedback_score?: number
  session_notes?: string
  materials_provided?: string[]
}

export interface RescheduleBookingInput {
  booking_id: string
  new_date: string
  new_time_slot?: TimeSlot
  reason?: string
}

export interface CancelBookingInput {
  booking_id: string
  reason: string
}

// ============================================================================
// Query Types
// ============================================================================

export interface SessionBookingFilters {
  coordinator_id?: string
  stakeholder_id?: string
  stakeholder_type?: string
  session_type_id?: string
  status?: BookingStatus | BookingStatus[]
  date_from?: string
  date_to?: string
  assigned_trainer_id?: string
  has_trainer?: boolean
}

export interface CoordinatorFilters {
  stakeholder_type?: string
  stakeholder_id?: string
  status?: CoordinatorStatus | CoordinatorStatus[]
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface BookingStats {
  total: number
  by_status: Record<BookingStatus, number>
  pending_trainer_assignment: number
  upcoming_this_week: number
  completed_this_month: number
  average_participants: number
  average_feedback_score: number | null
}

export interface CoordinatorDashboardStats {
  total_bookings: number
  pending_bookings: number
  confirmed_bookings: number
  completed_sessions: number
  total_students_impacted: number
  average_rating: number | null
}

// ============================================================================
// Constants
// ============================================================================

export const BOOKING_STATUS_INFO: Record<BookingStatus, {
  label: string
  color: string
  bgColor: string
  description: string
}> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    description: 'Waiting for trainer assignment',
  },
  pending_trainer: {
    label: 'Pending Trainer',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-500/20',
    description: 'Finding available trainer',
  },
  trainer_assigned: {
    label: 'Trainer Assigned',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-500/20',
    description: 'Trainer confirmed, preparing materials',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-500/20',
    description: 'Session confirmed and scheduled',
  },
  materials_pending: {
    label: 'Materials Pending',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-500/20',
    description: 'Waiting for materials upload',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    description: 'Session is currently ongoing',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    description: 'Session completed successfully',
  },
  rescheduled: {
    label: 'Rescheduled',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    description: 'Session moved to new date',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-500/20',
    description: 'Session was cancelled',
  },
}

export const TIME_SLOT_INFO: Record<TimeSlot, {
  label: string
  startTime: string
  endTime: string
}> = {
  morning: {
    label: 'Morning',
    startTime: '09:00',
    endTime: '12:00',
  },
  afternoon: {
    label: 'Afternoon',
    startTime: '13:00',
    endTime: '16:00',
  },
  evening: {
    label: 'Evening',
    startTime: '17:00',
    endTime: '20:00',
  },
}

export const DEFAULT_SESSION_TYPES = [
  'masoom',
  'road_safety',
  'career_guidance',
  'soft_skills',
  'entrepreneurship',
] as const
