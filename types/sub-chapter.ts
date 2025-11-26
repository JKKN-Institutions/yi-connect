/**
 * Sub-Chapter Type Definitions
 *
 * Types for Yuva (college) and Thalir (school) student-led sub-chapters.
 */

// ============================================================================
// Enums
// ============================================================================

export type SubChapterType = 'yuva' | 'thalir'

export type SubChapterStatus = 'pending' | 'active' | 'inactive' | 'suspended'

export type SubChapterEventType =
  | 'campus_event'
  | 'guest_speaker'
  | 'industrial_visit'
  | 'workshop'
  | 'competition'
  | 'other'

export type SubChapterEventStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type SubChapterLeadRole = 'lead' | 'co_lead' | 'coordinator' | 'member'

// ============================================================================
// Base Types
// ============================================================================

export interface SubChapter {
  id: string
  chapter_id: string
  type: SubChapterType
  stakeholder_type: 'school' | 'college'
  stakeholder_id: string
  name: string
  description: string | null
  logo_url: string | null
  status: SubChapterStatus
  established_date: string | null
  yi_mentor_id: string | null
  yi_mentor_assigned_at: string | null
  vertical_id: string | null
  total_members: number
  total_events: number
  total_students_reached: number
  events_this_year: number
  students_reached_this_year: number
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface SubChapterLead {
  id: string
  sub_chapter_id: string
  full_name: string
  email: string
  phone: string | null
  student_id: string | null
  department: string | null
  year_of_study: string | null
  avatar_url: string | null
  password_hash: string
  status: 'pending' | 'active' | 'inactive'
  role: SubChapterLeadRole
  is_primary_lead: boolean
  last_login_at: string | null
  login_count: number
  requires_password_change: boolean
  joined_at: string
  left_at: string | null
  created_at: string
  updated_at: string
}

export interface SubChapterMember {
  id: string
  sub_chapter_id: string
  full_name: string
  email: string | null
  phone: string | null
  student_id: string | null
  department: string | null
  year_of_study: string | null
  is_active: boolean
  joined_at: string
  left_at: string | null
  events_participated: number
  volunteer_hours: number
  created_at: string
  updated_at: string
}

export interface SubChapterEvent {
  id: string
  sub_chapter_id: string
  event_type: SubChapterEventType
  title: string
  description: string | null
  event_date: string
  start_time: string | null
  end_time: string | null
  venue: string | null
  is_online: boolean
  meeting_link: string | null
  expected_participants: number | null
  actual_participants: number | null
  requested_speaker_id: string | null
  speaker_topic: string | null
  speaker_confirmed: boolean
  speaker_confirmed_at: string | null
  industry_id: string | null
  visit_purpose: string | null
  status: SubChapterEventStatus
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  completed_at: string | null
  impact_summary: string | null
  photos_url: string[] | null
  report_url: string | null
  feedback_score: number | null
  feedback_count: number
  volunteer_count: number
  volunteer_hours: number
  created_at: string
  updated_at: string
  created_by: string | null
}

// ============================================================================
// Extended Types with Relations
// ============================================================================

export interface SubChapterFull extends SubChapter {
  yi_mentor?: {
    id: string
    profile?: {
      full_name: string
      email: string
      phone: string | null
      avatar_url: string | null
    }
  } | null
  vertical?: {
    id: string
    name: string
    color: string | null
  } | null
  stakeholder?: {
    id: string
    name: string
  } | null
  leads?: SubChapterLead[]
  _count?: {
    members: number
    events: number
  }
}

export interface SubChapterEventFull extends SubChapterEvent {
  sub_chapter?: SubChapter
  requested_speaker?: {
    id: string
    profile?: {
      full_name: string
      email: string
      phone: string | null
      avatar_url: string | null
    }
  } | null
  approved_by_member?: {
    id: string
    profile?: {
      full_name: string
    }
  } | null
}

// ============================================================================
// Form Input Types
// ============================================================================

export interface CreateSubChapterInput {
  chapter_id: string
  type: SubChapterType
  stakeholder_type: 'school' | 'college'
  stakeholder_id: string
  name: string
  description?: string
  yi_mentor_id?: string
  vertical_id?: string
}

export interface CreateSubChapterLeadInput {
  sub_chapter_id: string
  full_name: string
  email: string
  phone?: string
  student_id?: string
  department?: string
  year_of_study?: string
  role?: SubChapterLeadRole
  is_primary_lead?: boolean
}

export interface CreateSubChapterMemberInput {
  sub_chapter_id: string
  full_name: string
  email?: string
  phone?: string
  student_id?: string
  department?: string
  year_of_study?: string
}

export interface CreateSubChapterEventInput {
  sub_chapter_id: string
  event_type: SubChapterEventType
  title: string
  description?: string
  event_date: string
  start_time?: string
  end_time?: string
  venue?: string
  is_online?: boolean
  meeting_link?: string
  expected_participants?: number
  requested_speaker_id?: string
  speaker_topic?: string
  industry_id?: string
  visit_purpose?: string
}

export interface UpdateSubChapterEventInput {
  id: string
  title?: string
  description?: string
  event_date?: string
  start_time?: string
  end_time?: string
  venue?: string
  is_online?: boolean
  meeting_link?: string
  expected_participants?: number
  requested_speaker_id?: string
  speaker_topic?: string
}

export interface CompleteSubChapterEventInput {
  id: string
  actual_participants: number
  impact_summary?: string
  photos_url?: string[]
  report_url?: string
}

// ============================================================================
// Filter Types
// ============================================================================

export interface SubChapterFilters {
  chapter_id?: string
  type?: SubChapterType
  status?: SubChapterStatus
  stakeholder_type?: 'school' | 'college'
  stakeholder_id?: string
  yi_mentor_id?: string
  vertical_id?: string
}

export interface SubChapterEventFilters {
  sub_chapter_id?: string
  event_type?: SubChapterEventType
  status?: SubChapterEventStatus | SubChapterEventStatus[]
  date_from?: string
  date_to?: string
  requested_speaker_id?: string
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface SubChapterStats {
  total_sub_chapters: number
  active_sub_chapters: number
  total_members: number
  total_events: number
  total_students_reached: number
  by_type: {
    yuva: number
    thalir: number
  }
}

export interface SubChapterDashboardStats {
  total_events: number
  students_reached: number
  total_members: number
  pending_events: number
  upcoming_events: number
}

// ============================================================================
// Constants
// ============================================================================

export const SUB_CHAPTER_TYPE_INFO: Record<SubChapterType, {
  label: string
  description: string
  stakeholderType: 'school' | 'college'
}> = {
  yuva: {
    label: 'Yuva Chapter',
    description: 'Student-led chapter at colleges',
    stakeholderType: 'college',
  },
  thalir: {
    label: 'Thalir Chapter',
    description: 'Student-led chapter at schools',
    stakeholderType: 'school',
  },
}

export const SUB_CHAPTER_STATUS_INFO: Record<SubChapterStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  active: {
    label: 'Active',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-500/20',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-500/20',
  },
  suspended: {
    label: 'Suspended',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
}

export const SUB_CHAPTER_EVENT_TYPE_INFO: Record<SubChapterEventType, {
  label: string
  description: string
  icon: string
}> = {
  campus_event: {
    label: 'Campus Event',
    description: 'Event organized on campus by chapter members',
    icon: 'Calendar',
  },
  guest_speaker: {
    label: 'Guest Speaker',
    description: 'Request a Yi member to speak at your event',
    icon: 'Mic',
  },
  industrial_visit: {
    label: 'Industrial Visit',
    description: 'Request an industry visit for chapter members',
    icon: 'Building2',
  },
  workshop: {
    label: 'Workshop',
    description: 'Hands-on workshop or training session',
    icon: 'Wrench',
  },
  competition: {
    label: 'Competition',
    description: 'Contest or competition event',
    icon: 'Trophy',
  },
  other: {
    label: 'Other',
    description: 'Other type of event',
    icon: 'MoreHorizontal',
  },
}

export const SUB_CHAPTER_EVENT_STATUS_INFO: Record<SubChapterEventStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-500/20',
  },
  pending_approval: {
    label: 'Pending Approval',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  approved: {
    label: 'Approved',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/20',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-cyan-700 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/20',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
}
