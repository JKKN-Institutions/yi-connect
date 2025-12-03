/**
 * Event Module Type Definitions
 *
 * Type definitions for Event Lifecycle Manager module.
 * Includes events, venues, RSVPs, volunteers, and feedback.
 */

import type { Tables, Enums } from './database';
import type { MemberListItem } from './member';

// ============================================================================
// Database Table Types
// ============================================================================

export type Event = Tables<'events'>;
export type EventTemplate = Tables<'event_templates'>;
export type Venue = Tables<'venues'>;
export type VenueBooking = Tables<'venue_bookings'>;
export type Resource = Tables<'resources'>;
export type ResourceBooking = Tables<'resource_bookings'>;
export type EventRSVP = Tables<'event_rsvps'>;
export type GuestRSVP = Tables<'guest_rsvps'>;
export type VolunteerRole = Tables<'volunteer_roles'>;
export type EventVolunteer = Tables<'event_volunteers'>;
export type EventCheckin = Tables<'event_checkins'>;
export type EventFeedback = Tables<'event_feedback'>;
export type EventDocument = Tables<'event_documents'>;
export type EventImpactMetrics = Tables<'event_impact_metrics'>;

// ============================================================================
// Enum Types
// ============================================================================

export type EventStatus = Enums<'event_status'>;
export type EventCategory = Enums<'event_category'>;
export type RSVPStatus = Enums<'rsvp_status'>;
export type BookingStatus = Enums<'booking_status'>;
export type VolunteerStatus = Enums<'volunteer_status'>;

// ============================================================================
// Extended Types (with relationships)
// ============================================================================

export interface EventWithDetails
  extends Omit<
    Event,
    'venue_id' | 'template_id' | 'organizer_id' | 'chapter_id'
  > {
  venue?: Venue | null;
  template?: EventTemplate | null;
  organizer?: {
    id: string;
    profile: {
      full_name: string;
      email: string;
      avatar_url?: string | null;
    } | null;
  } | null;
  chapter?: {
    id: string;
    name: string;
    location: string;
  } | null;
  tags?: string[] | null;
  // Location coordinates for map integration
  venue_latitude?: number | null;
  venue_longitude?: number | null;
}

export interface EventWithRSVPs extends EventWithDetails {
  rsvps: Array<
    EventRSVP & {
      member: MemberListItem;
    }
  >;
  guest_rsvps: GuestRSVP[];
}

export interface EventWithVolunteers extends EventWithDetails {
  volunteers: Array<
    EventVolunteer & {
      member: MemberListItem;
      role?: VolunteerRole | null;
    }
  >;
}

export interface EventWithMetrics extends EventWithDetails {
  impact_metrics: EventImpactMetrics | null;
}

export interface EventFull
  extends Omit<
    Event,
    | 'venue_id'
    | 'template_id'
    | 'organizer_id'
    | 'chapter_id'
    | 'status'
    | 'category'
  > {
  status: EventStatus;
  category: EventCategory;
  venue?: Venue | null;
  template?: EventTemplate | null;
  organizer?: {
    id: string;
    profile: {
      full_name: string;
      email: string;
      avatar_url?: string | null;
    } | null;
  } | null;
  chapter?: {
    id: string;
    name: string;
    location: string;
  } | null;
  rsvps: Array<
    EventRSVP & {
      member: MemberListItem;
    }
  >;
  guest_rsvps: GuestRSVP[];
  volunteers: Array<
    EventVolunteer & {
      member: MemberListItem;
      role?: VolunteerRole | null;
    }
  >;
  venue_booking?: VenueBooking | null;
  resource_bookings: Array<
    ResourceBooking & {
      resource: Resource;
    }
  >;
  impact_metrics?: EventImpactMetrics | null;
  feedback: EventFeedback[];
  documents: EventDocument[];
}

// ============================================================================
// List/Display Types
// ============================================================================

export interface EventListItem {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  status: EventStatus;
  start_date: string;
  end_date: string;
  is_virtual: boolean;
  venue_id: string | null;
  venue_address: string | null;
  max_capacity: number | null;
  current_registrations: number;
  organizer_id: string | null;
  banner_image_url: string | null;
  is_featured: boolean;
  created_at: string;
  venue?: {
    id: string;
    name: string;
    city: string | null;
  } | null;
  organizer?: {
    id: string;
    profile: {
      full_name: string;
      email: string;
      avatar_url?: string | null;
    } | null;
  } | null;
}

export interface VenueWithBookings extends Venue {
  bookings: VenueBooking[];
  upcoming_bookings_count: number;
}

export interface VolunteerRoleWithMembers extends VolunteerRole {
  members_count: number;
  volunteers: Array<
    EventVolunteer & {
      member: MemberListItem;
    }
  >;
}

// ============================================================================
// Analytics & Statistics Types
// ============================================================================

export interface EventAnalytics {
  total_events: number;
  upcoming_events: number;
  ongoing_events: number;
  completed_events: number;
  draft_events: number;
  cancelled_events: number;
  total_attendees: number;
  average_attendance_rate: number;
  total_volunteers: number;
  total_volunteer_hours: number;
  events_by_category: Record<EventCategory, number>;
  events_by_month: Array<{
    month: string;
    count: number;
  }>;
}

export interface EventImpactSummary {
  attendance_rate: number;
  satisfaction_rate: number;
  volunteer_engagement: number;
  budget_utilization: number;
  top_performers: Array<{
    event_id: string;
    event_title: string;
    metric: string;
    value: number;
  }>;
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface EventFilters {
  search?: string;
  status?: EventStatus[];
  category?: EventCategory[];
  start_date_from?: string;
  start_date_to?: string;
  is_virtual?: boolean;
  is_featured?: boolean;
  organizer_id?: string;
  chapter_id?: string;
  has_capacity?: boolean;
}

export type EventSortField =
  | 'start_date'
  | 'end_date'
  | 'title'
  | 'current_registrations'
  | 'created_at'
  | 'status';

export interface EventSortOptions {
  field: EventSortField;
  direction: 'asc' | 'desc';
}

export interface EventQueryParams {
  page?: number;
  pageSize?: number;
  filters?: EventFilters;
  sort?: EventSortOptions;
}

export interface PaginatedEvents {
  data: EventListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VenueFilters {
  search?: string;
  city?: string[];
  capacity_min?: number;
  capacity_max?: number;
  amenities?: string[];
  is_active?: boolean;
}

export interface RSVPFilters {
  event_id?: string;
  member_id?: string;
  status?: RSVPStatus[];
  has_guests?: boolean;
}

export interface VolunteerFilters {
  event_id?: string;
  member_id?: string;
  role_id?: string;
  status?: VolunteerStatus[];
}

// ============================================================================
// Form Input Types
// ============================================================================

export interface CreateEventInput {
  title: string;
  description?: string;
  category: EventCategory;
  start_date: string;
  end_date: string;
  registration_start_date?: string;
  registration_end_date?: string;
  venue_id?: string;
  venue_address?: string;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
  is_virtual: boolean;
  virtual_meeting_link?: string;
  max_capacity?: number;
  waitlist_enabled: boolean;
  requires_approval: boolean;
  send_reminders: boolean;
  allow_guests: boolean;
  guest_limit?: number;
  estimated_budget?: number;
  banner_image_url?: string;
  tags?: string[];
  template_id?: string;
  chapter_id?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  status?: EventStatus;
  current_registrations?: number;
  actual_expense?: number;
}

export interface CreateVenueInput {
  name: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  capacity?: number;
  amenities?: string[];
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  booking_link?: string;
  notes?: string;
}

export interface UpdateVenueInput extends Partial<CreateVenueInput> {
  is_active?: boolean;
}

export interface CreateRSVPInput {
  event_id: string;
  member_id: string;
  status?: RSVPStatus;
  guests_count?: number;
  dietary_restrictions?: string;
  special_requirements?: string;
  notes?: string;
}

export interface UpdateRSVPInput {
  status?: RSVPStatus;
  guests_count?: number;
  dietary_restrictions?: string;
  special_requirements?: string;
  notes?: string;
}

export interface CreateGuestRSVPInput {
  event_id: string;
  invited_by_member_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  designation?: string;
  status?: RSVPStatus;
  dietary_restrictions?: string;
  special_requirements?: string;
  notes?: string;
}

export interface AssignVolunteerInput {
  event_id: string;
  member_id: string;
  role_id?: string;
  role_name: string;
  notes?: string;
}

export interface UpdateVolunteerInput {
  status?: VolunteerStatus;
  hours_contributed?: number;
  feedback?: string;
  rating?: number;
  notes?: string;
}

export interface CreateEventFeedbackInput {
  event_id: string;
  member_id?: string;
  overall_rating?: number;
  content_rating?: number;
  venue_rating?: number;
  organization_rating?: number;
  what_went_well?: string;
  what_could_improve?: string;
  suggestions?: string;
  would_attend_again?: boolean;
  is_anonymous?: boolean;
}

export interface CheckInInput {
  event_id: string;
  attendee_type: 'member' | 'guest';
  attendee_id: string;
  check_in_method?: 'qr_code' | 'manual' | 'self_checkin';
  notes?: string;
}

export interface UploadEventDocumentInput {
  event_id: string;
  title: string;
  description?: string;
  document_type: 'photo' | 'report' | 'certificate' | 'invoice' | 'other';
  file_url: string;
  file_size_kb?: number;
  is_public?: boolean;
}

// ============================================================================
// Volunteer Matching Types
// ============================================================================

export interface VolunteerMatch {
  member_id: string;
  member_name: string;
  match_score: number;
  matching_skills: string[];
  availability_status: 'available' | 'busy' | 'unavailable';
  volunteer_hours: number;
  events_volunteered: number;
  preferred_roles: string[];
}

export interface VolunteerMatchCriteria {
  event_id: string;
  required_skills?: string[];
  preferred_roles?: string[];
  min_availability?: 'available' | 'busy';
  sort_by?: 'match_score' | 'volunteer_hours' | 'events_volunteered';
}

// ============================================================================
// Constants
// ============================================================================

export const EVENT_STATUSES: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const EVENT_CATEGORIES: Record<EventCategory, string> = {
  networking: 'Networking',
  social: 'Social',
  professional_development: 'Professional Development',
  community_service: 'Community Service',
  sports: 'Sports',
  cultural: 'Cultural',
  fundraising: 'Fundraising',
  workshop: 'Workshop',
  seminar: 'Seminar',
  conference: 'Conference',
  webinar: 'Webinar',
  other: 'Other',
  industrial_visit: 'Industrial Visit'
};

export const RSVP_STATUSES: Record<RSVPStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  waitlist: 'Waitlisted',
  attended: 'Attended',
  no_show: 'No Show'
};

export const VOLUNTEER_STATUSES: Record<VolunteerStatus, string> = {
  invited: 'Invited',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed'
} as const;

export const BOOKING_STATUSES: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled'
};

export const CHECK_IN_METHODS = ['qr_code', 'manual', 'self_checkin'] as const;
export const DOCUMENT_TYPES = [
  'photo',
  'report',
  'certificate',
  'invoice',
  'other'
] as const;
export const ATTENDEE_TYPES = ['member', 'guest'] as const;

// ============================================================================
// Utility Types
// ============================================================================

export type EventStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive';

export function getEventStatusVariant(
  status: EventStatus
): EventStatusBadgeVariant {
  const variants: Record<EventStatus, EventStatusBadgeVariant> = {
    draft: 'default',
    published: 'secondary',
    ongoing: 'warning',
    completed: 'success',
    cancelled: 'destructive'
  };
  return variants[status];
}

export type RSVPStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive';

export function getRSVPStatusVariant(
  status: RSVPStatus
): RSVPStatusBadgeVariant {
  const variants: Record<RSVPStatus, RSVPStatusBadgeVariant> = {
    pending: 'default',
    confirmed: 'success',
    declined: 'destructive',
    waitlist: 'warning',
    attended: 'secondary',
    no_show: 'destructive'
  };
  return variants[status];
}

// ============================================================================
// PART 2: SERVICE EVENT TYPES
// ============================================================================

export type ServiceEventType =
  | 'masoom'
  | 'thalir'
  | 'yuva'
  | 'road_safety'
  | 'career_guidance'
  | 'soft_skills'
  | 'other';

export type StakeholderType =
  | 'school'
  | 'college'
  | 'industry'
  | 'ngo'
  | 'government';

export interface ServiceEventDetails {
  is_service_event: boolean;
  service_type: ServiceEventType | null;
  stakeholder_type: StakeholderType | null;
  stakeholder_id: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  expected_students: number | null;
  trainers_needed: number; // Generated column
}

export interface EventWithServiceDetails extends EventWithDetails {
  // Service event fields (directly on event from database)
  is_service_event: boolean;
  service_type?: ServiceEventType | null;
  stakeholder_id?: string | null;
  contact_person_name?: string | null;
  contact_person_phone?: string | null;
  contact_person_email?: string | null;
  expected_students?: number | null;
  trainers_needed?: number | null;
  // Nested details (optional)
  service_details?: ServiceEventDetails;
  stakeholder?: {
    id: string;
    name: string;
    type: StakeholderType;
    city?: string;
    state?: string;
  } | null;
}

// ============================================================================
// PART 2: TRAINER ASSIGNMENT TYPES
// ============================================================================

export type TrainerAssignmentStatus =
  | 'recommended'
  | 'selected'
  | 'invited'
  | 'accepted'
  | 'declined'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface TrainerScoreBreakdown {
  location_score: number; // Max 30
  distribution_score: number; // Max 30
  performance_score: number; // Max 25
  engagement_score: number; // Max 15
}

export interface TrainerStats {
  days_since_last_session: number | null;
  average_rating: number | null;
  total_sessions: number;
  sessions_this_month: number;
}

export interface EventTrainerAssignment {
  id: string;
  event_id: string;
  trainer_profile_id: string;
  status: TrainerAssignmentStatus;
  is_lead_trainer: boolean;
  match_score: number | null;
  score_breakdown: TrainerScoreBreakdown | null;
  assigned_by: string | null;
  assigned_at: string | null;
  selection_method: 'auto' | 'manual' | null;
  response_deadline: string | null;
  responded_at: string | null;
  decline_reason: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  attendance_confirmed: boolean | null;
  trainer_rating: number | null;
  trainer_feedback: string | null;
  coordinator_rating: number | null;
  coordinator_feedback: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainerRecommendation {
  trainer_profile_id: string;
  member_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  match_score: number;
  score_breakdown: TrainerScoreBreakdown;
  trainer_stats: TrainerStats;
  eligible_session_types: string[];
  certifications_count: number;
  is_available: boolean;
}

export interface EventTrainerAssignmentWithDetails extends EventTrainerAssignment {
  trainer?: {
    id: string;
    member_id: string;
    member?: {
      id: string;
      profile?: {
        full_name: string;
        email: string;
        avatar_url: string | null;
        phone: string | null;
      };
    };
    total_sessions: number;
    average_rating: number | null;
  };
}

// ============================================================================
// PART 2: EVENT MATERIALS TYPES
// ============================================================================

export type MaterialApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'revision_requested'
  | 'superseded';

export type MaterialType =
  | 'presentation'
  | 'handout'
  | 'worksheet'
  | 'video'
  | 'assessment'
  | 'certificate_template'
  | 'other';

export interface EventMaterial {
  id: string;
  event_id: string;
  trainer_assignment_id: string | null;
  title: string;
  description: string | null;
  material_type: MaterialType;
  file_url: string;
  file_name: string;
  file_size_kb: number | null;
  mime_type: string | null;
  version: number;
  is_current_version: boolean;
  parent_material_id: string | null;
  version_notes: string | null;
  status: MaterialApprovalStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  rejection_reason: string | null;
  is_coordinator_visible: boolean;
  download_count: number;
  last_downloaded_at: string | null;
  is_template: boolean;
  is_shared: boolean;
  tags: string[] | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventMaterialWithUploader extends EventMaterial {
  uploader?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  reviewer?: {
    id: string;
    full_name: string;
  } | null;
}

export interface MaterialVersionHistory {
  current: EventMaterial;
  versions: EventMaterial[];
}

// ============================================================================
// PART 2: SESSION REPORT TYPES
// ============================================================================

export type VenueCondition = 'excellent' | 'good' | 'adequate' | 'poor';
export type EngagementLevel = 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';

export interface ClassBreakdown {
  [className: string]: number; // e.g., { "class_8": 30, "class_9": 25 }
}

export interface EventSessionReport {
  id: string;
  event_id: string;
  trainer_assignment_id: string | null;
  expected_attendance: number | null;
  actual_attendance: number;
  male_count: number;
  female_count: number;
  staff_present: number;
  class_breakdown: ClassBreakdown | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  actual_duration_minutes: number | null;
  topics_covered: string[] | null;
  venue_condition: VenueCondition | null;
  av_equipment_worked: boolean;
  logistical_issues: string | null;
  engagement_level: EngagementLevel | null;
  knowledge_retention_score: number | null;
  behavioral_change_observed: string | null;
  coordinator_name: string | null;
  coordinator_feedback: string | null;
  coordinator_rating: number | null;
  willing_to_host_again: boolean | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  follow_up_date: string | null;
  follow_up_completed: boolean;
  follow_up_completed_at: string | null;
  photo_urls: string[] | null;
  attendance_sheet_url: string | null;
  certificate_distribution_url: string | null;
  trainer_notes: string | null;
  highlights: string | null;
  challenges_faced: string | null;
  recommendations: string | null;
  best_practices_noted: string | null;
  submitted_by: string;
  submitted_at: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PART 2: CARPOOL TYPES
// ============================================================================

export type CarpoolMatchStatus =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed';

export type TravelPreference =
  | 'own_vehicle'
  | 'need_ride'
  | 'arrange_own'
  | 'not_applicable';

export interface EventCarpoolMatch {
  id: string;
  event_id: string;
  driver_rsvp_id: string;
  driver_member_id: string;
  passenger_rsvp_id: string;
  passenger_member_id: string;
  match_status: CarpoolMatchStatus;
  proposed_at: string;
  driver_confirmed_at: string | null;
  passenger_confirmed_at: string | null;
  agreed_pickup_location: string | null;
  agreed_pickup_time: string | null;
  pickup_notes: string | null;
  ride_completed: boolean | null;
  driver_feedback: string | null;
  passenger_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarpoolMatchWithMembers extends EventCarpoolMatch {
  driver?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  };
  passenger?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  };
}

export interface CarpoolGroup {
  driver: {
    member_id: string;
    full_name: string;
    avatar_url: string | null;
    available_seats: number;
    pickup_location: string | null;
  };
  passengers: Array<{
    member_id: string;
    full_name: string;
    avatar_url: string | null;
    pickup_location: string | null;
  }>;
}

// ============================================================================
// PART 2: FORM INPUT TYPES
// ============================================================================

export interface CreateServiceEventInput extends CreateEventInput {
  is_service_event: true;
  service_type: ServiceEventType;
  stakeholder_type: StakeholderType;
  stakeholder_id: string;
  contact_person_name?: string;
  contact_person_phone?: string;
  contact_person_email?: string;
  expected_students: number;
}

export interface AssignTrainerInput {
  event_id: string;
  trainer_profile_ids: string[];
  selection_method: 'auto' | 'manual';
  notes?: string;
}

export interface RespondToTrainerInviteInput {
  assignment_id: string;
  accept: boolean;
  decline_reason?: string;
}

export interface UploadMaterialInput {
  event_id: string;
  trainer_assignment_id?: string;
  title: string;
  description?: string;
  material_type: MaterialType;
  file_url: string;
  file_name: string;
  file_size_kb?: number;
  mime_type?: string;
  tags?: string[];
}

export interface ReviewMaterialInput {
  material_id: string;
  action: 'approve' | 'request_revision';
  review_notes?: string;
  rejection_reason?: string;
}

export interface SubmitSessionReportInput {
  event_id: string;
  trainer_assignment_id?: string;
  actual_attendance: number;
  male_count?: number;
  female_count?: number;
  staff_present?: number;
  class_breakdown?: ClassBreakdown;
  actual_start_time?: string;
  actual_end_time?: string;
  topics_covered?: string[];
  venue_condition?: VenueCondition;
  av_equipment_worked?: boolean;
  logistical_issues?: string;
  engagement_level?: EngagementLevel;
  knowledge_retention_score?: number;
  behavioral_change_observed?: string;
  coordinator_name?: string;
  coordinator_feedback?: string;
  coordinator_rating?: number;
  willing_to_host_again?: boolean;
  follow_up_required?: boolean;
  follow_up_notes?: string;
  follow_up_date?: string;
  photo_urls?: string[];
  attendance_sheet_url?: string;
  trainer_notes?: string;
  highlights?: string;
  challenges_faced?: string;
  recommendations?: string;
  best_practices_noted?: string;
}

export interface UpdateRSVPWithCarpoolInput extends UpdateRSVPInput {
  travel_preference?: TravelPreference;
  available_seats?: number;
  pickup_location?: string;
  pickup_notes?: string;
}

// ============================================================================
// PART 2: CONSTANTS
// ============================================================================

export const SERVICE_EVENT_TYPES: Record<ServiceEventType, string> = {
  masoom: 'Masoom',
  thalir: 'Thalir',
  yuva: 'Yuva',
  road_safety: 'Road Safety',
  career_guidance: 'Career Guidance',
  soft_skills: 'Soft Skills',
  other: 'Other'
};

export const STAKEHOLDER_TYPES: Record<StakeholderType, string> = {
  school: 'School',
  college: 'College',
  industry: 'Industry',
  ngo: 'NGO',
  government: 'Government'
};

export const TRAINER_ASSIGNMENT_STATUSES: Record<TrainerAssignmentStatus, string> = {
  recommended: 'Recommended',
  selected: 'Selected',
  invited: 'Invited',
  accepted: 'Accepted',
  declined: 'Declined',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const MATERIAL_APPROVAL_STATUSES: Record<MaterialApprovalStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  revision_requested: 'Revision Requested',
  superseded: 'Superseded'
};

export const MATERIAL_TYPES: Record<MaterialType, string> = {
  presentation: 'Presentation',
  handout: 'Handout',
  worksheet: 'Worksheet',
  video: 'Video',
  assessment: 'Assessment',
  certificate_template: 'Certificate Template',
  other: 'Other'
};

export const VENUE_CONDITIONS: Record<VenueCondition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  adequate: 'Adequate',
  poor: 'Poor'
};

export const ENGAGEMENT_LEVELS: Record<EngagementLevel, string> = {
  very_high: 'Very High',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  very_low: 'Very Low'
};

export const TRAVEL_PREFERENCES: Record<TravelPreference, string> = {
  own_vehicle: 'Own Vehicle',
  need_ride: 'Need a Ride',
  arrange_own: 'Arrange Own',
  not_applicable: 'Not Applicable'
};

export const CARPOOL_MATCH_STATUSES: Record<CarpoolMatchStatus, string> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

// Helper functions for Part 2 types
export function getTrainerAssignmentStatusVariant(
  status: TrainerAssignmentStatus
): EventStatusBadgeVariant {
  const variants: Record<TrainerAssignmentStatus, EventStatusBadgeVariant> = {
    recommended: 'default',
    selected: 'secondary',
    invited: 'warning',
    accepted: 'success',
    declined: 'destructive',
    confirmed: 'success',
    completed: 'success',
    cancelled: 'destructive'
  };
  return variants[status];
}

export function getMaterialApprovalStatusVariant(
  status: MaterialApprovalStatus
): EventStatusBadgeVariant {
  const variants: Record<MaterialApprovalStatus, EventStatusBadgeVariant> = {
    draft: 'default',
    pending_review: 'warning',
    approved: 'success',
    revision_requested: 'destructive',
    superseded: 'secondary'
  };
  return variants[status];
}
