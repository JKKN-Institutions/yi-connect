/**
 * Industrial Visits Module - Type Definitions
 * Extends Event types with IV-specific fields
 */

import { Database } from './database';

// ==================== ENUMS ====================

export type CarpoolStatus = 'not_needed' | 'need_ride' | 'offering_ride';

export type IndustryPortalUserStatus = 'invited' | 'active' | 'inactive' | 'suspended';

export type WaitlistStatus = 'waiting' | 'promoted' | 'expired' | 'withdrawn';

// ==================== DATABASE TABLES ====================

export type IndustryPortalUser = {
  id: string;
  industry_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  status: IndustryPortalUserStatus;
  permissions: {
    add_slot: boolean;
    edit_slot: boolean;
    cancel_slot: boolean;
    view_bookings: boolean;
    export_attendees: boolean;
  };
  invitation_token: string | null;
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
  last_login_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IVWaitlist = {
  id: string;
  event_id: string;
  member_id: string;
  position: number;
  added_at: string;
  notified_at: string | null;
  expires_at: string | null;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string;
};

// ==================== EXTENDED EVENT TYPES ====================

/**
 * Industrial Visit specific fields (extends events table)
 */
export type IndustrialVisitFields = {
  industry_id: string | null;
  requirements: string | null;
  learning_outcomes: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  contact_person_role: string | null;
  logistics_parking: string | null;
  logistics_food: string | null;
  logistics_meeting_point: string | null;
  logistics_arrival_time: string | null;  // TIME
  entry_method: 'manual' | 'self_service';
  host_willingness_rating: number | null;  // 1-5
};

/**
 * Event RSVP with carpool and family fields
 */
export type IVRSVPFields = {
  family_count: number;
  family_names: string[] | null;
  carpool_status: CarpoolStatus;
  seats_available: number | null;
  pickup_location: string | null;
  pickup_details: string | null;
  cancelled_at: string | null;
};

// ==================== COMPOSITE TYPES ====================

/**
 * Complete Industrial Visit (Event + IV fields)
 */
export type IndustrialVisit = Database['public']['Tables']['events']['Row'] & IndustrialVisitFields;

/**
 * Industrial Visit with Industry details
 */
export type IndustrialVisitWithIndustry = IndustrialVisit & {
  industry: {
    id: string;
    company_name: string;
    industry_sector: string;
    city: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    offers_industrial_visits: boolean | null;
  } | null;
};

/**
 * Industrial Visit with full relationships
 */
export type IndustrialVisitFull = IndustrialVisitWithIndustry & {
  organizer: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  rsvps_count: number;
  waitlist_count: number;
  carpool_drivers_count: number;
  carpool_riders_count: number;
  banner_image_url?: string | null;
};

/**
 * IV Booking (RSVP with carpool fields)
 */
export type IVBooking = Database['public']['Tables']['event_rsvps']['Row'] & IVRSVPFields;

/**
 * IV Booking with Member details
 */
export type IVBookingWithMember = IVBooking & {
  member: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    company: string | null;
  };
  event: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    category: string;
    status: string;
    industry: {
      name: string;
      city: string | null;
    } | null;
  };
};

/**
 * Waitlist entry with Member details
 */
export type IVWaitlistWithMember = IVWaitlist & {
  member: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
  event: {
    id: string;
    title: string;
    start_date: string;
    max_capacity: number | null;
    current_registrations: number;
  };
};

// ==================== CARPOOL TYPES ====================

export type CarpoolMatch = {
  driver_id: string;
  driver_name: string;
  driver_email: string;
  driver_phone: string | null;
  seats_available: number;
  pickup_location: string | null;
  riders_count: number;
  matched_riders?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  }[];
};

export type CarpoolPreference = {
  status: CarpoolStatus;
  seats_available?: number;
  pickup_location?: string;
  pickup_details?: string;
};

// ==================== FILTER TYPES ====================

export type IVFilters = {
  search?: string;
  industry_id?: string;
  status?: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  date_from?: string;
  date_to?: string;
  has_capacity?: boolean;
  entry_method?: 'manual' | 'self_service';
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
};

export type IVBookingFilters = {
  search?: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted' | 'attended' | 'no_show';
  carpool_status?: CarpoolStatus;
  has_family?: boolean;
};

export type WaitlistFilters = {
  event_id?: string;
  member_id?: string;
  status?: WaitlistStatus;
};

// ==================== FORM INPUT TYPES ====================

export type CreateIVInput = {
  // Basic Event Info
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  max_capacity: number | null;

  // IV Specific
  industry_id: string;
  requirements: string | null;
  learning_outcomes: string | null;

  // Contact Person
  contact_person_name: string | null;
  contact_person_phone: string | null;
  contact_person_role: string | null;

  // Logistics
  logistics_parking: string | null;
  logistics_food: string | null;
  logistics_meeting_point: string | null;
  logistics_arrival_time: string | null;

  // Settings
  entry_method: 'manual' | 'self_service';
  waitlist_enabled: boolean;
  send_reminders: boolean;
  allow_guests: boolean;
  guest_limit: number;

  // Optional
  banner_image_url: string | null;
  tags: string[] | null;
};

export type UpdateIVInput = Partial<CreateIVInput> & {
  id: string;
};

export type CreateIVBookingInput = {
  event_id: string;
  member_id: string;

  // Family
  family_count: number;
  family_names: string[] | null;

  // Carpool
  carpool_status: CarpoolStatus;
  seats_available: number | null;
  pickup_location: string | null;
  pickup_details: string | null;

  // Optional
  dietary_restrictions: string | null;
  special_requirements: string | null;
  notes: string | null;
};

export type UpdateIVBookingInput = Partial<CreateIVBookingInput> & {
  id: string;
};

export type CreateIndustryPortalUserInput = {
  industry_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  permissions?: {
    add_slot?: boolean;
    edit_slot?: boolean;
    cancel_slot?: boolean;
    view_bookings?: boolean;
    export_attendees?: boolean;
  };
};

// ==================== ANALYTICS TYPES ====================

export type IVAnalytics = {
  total_ivs: number;
  upcoming_ivs: number;
  completed_ivs: number;
  total_participants: number;
  avg_attendance_rate: number;
  total_carpool_seats_shared: number;
  unique_industries_visited: number;
};

export type IVCapacityInfo = {
  has_capacity: boolean;
  available_slots: number;
  total_capacity: number;
  current_bookings: number;
  waitlist_count: number;
};

export type IndustryPerformance = {
  industry_id: string;
  company_name: string;
  total_ivs_hosted: number;
  total_participants: number;
  avg_rating: number | null;
  last_iv_date: string | null;
  willingness_to_host_again: number | null;  // 1-5
};

// ==================== LIST & DISPLAY TYPES ====================

export type IVListItem = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  industry_id: string | null;
  industry_name: string | null;
  industry_sector: string | null;
  max_capacity: number | null;
  current_registrations: number;
  capacity_percentage: number;
  status: string;
  entry_method: 'manual' | 'self_service';
  requirements: string | null;
  learning_outcomes: string | null;
  waitlist_count: number;
  has_capacity: boolean;
};

export type IVMarketplaceItem = IVListItem & {
  banner_image_url: string | null;
  logistics_meeting_point: string | null;
  contact_person_name: string | null;
  tags: string[] | null;
  carpool_drivers_count: number;
};

// ==================== PAGINATION TYPES ====================

export type PaginatedIVs = {
  data: IVListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PaginatedIVBookings = {
  data: IVBookingWithMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PaginatedWaitlist = {
  data: IVWaitlistWithMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ==================== ACTION RETURN TYPES ====================

export type IVActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type WaitlistPromotion = {
  waitlist_id: string;
  member_id: string;
  member_email: string;
  member_name: string;
  expires_at: string;
};

// ==================== UTILITY TYPES ====================

export type IVSortField =
  | 'start_date'
  | 'created_at'
  | 'title'
  | 'capacity'
  | 'industry_name';

export type SortDirection = 'asc' | 'desc';

export type IVSort = {
  field: IVSortField;
  direction: SortDirection;
};

// ==================== CONSTANTS ====================

export const CARPOOL_STATUS_LABELS: Record<CarpoolStatus, string> = {
  not_needed: 'Not Needed',
  need_ride: 'Need Ride',
  offering_ride: 'Offering Ride',
};

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Waiting',
  promoted: 'Promoted',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

export const INDUSTRY_PORTAL_USER_STATUS_LABELS: Record<IndustryPortalUserStatus, string> = {
  invited: 'Invited',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

export const ENTRY_METHOD_LABELS: Record<'manual' | 'self_service', string> = {
  manual: 'Manual (Admin Created)',
  self_service: 'Self-Service (Industry Created)',
};
