/**
 * Industrial Visits Module - Zod Validation Schemas
 * All validation schemas for IV operations
 */

import { z } from 'zod';

// ==================== ENUM SCHEMAS ====================

export const carpoolStatusSchema = z.enum(['not_needed', 'need_ride', 'offering_ride']);

export const waitlistStatusSchema = z.enum(['waiting', 'promoted', 'expired', 'withdrawn']);

export const industryPortalUserStatusSchema = z.enum(['invited', 'active', 'inactive', 'suspended']);

export const entryMethodSchema = z.enum(['manual', 'self_service']);

// ==================== INDUSTRIAL VISIT SCHEMAS ====================

/**
 * Create Industrial Visit
 */
export const createIVSchema = z.object({
  // Basic Event Info
  title: z.string().min(3, 'Title must be at least 3 characters').max(255, 'Title must be less than 255 characters'),
  description: z.string().nullable().optional(),
  start_date: z.string().datetime({ message: 'Invalid start date format' }),
  end_date: z.string().datetime({ message: 'Invalid end date format' }),
  max_capacity: z.number().int().positive('Capacity must be positive').nullable().optional(),

  // IV Specific
  industry_id: z.string().uuid('Invalid industry ID'),
  requirements: z.string().max(1000, 'Requirements must be less than 1000 characters').nullable().optional(),
  learning_outcomes: z.string().max(1000, 'Learning outcomes must be less than 1000 characters').nullable().optional(),

  // Contact Person
  contact_person_name: z.string().max(255).nullable().optional(),
  contact_person_phone: z.string().regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format').max(20).nullable().optional(),
  contact_person_role: z.string().max(100).nullable().optional(),

  // Logistics
  logistics_parking: z.string().max(500).nullable().optional(),
  logistics_food: z.string().max(500).nullable().optional(),
  logistics_meeting_point: z.string().max(500).nullable().optional(),
  logistics_arrival_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (HH:MM)').nullable().optional(),

  // Settings
  entry_method: entryMethodSchema.default('manual'),
  waitlist_enabled: z.boolean().default(false),
  send_reminders: z.boolean().default(true),
  allow_guests: z.boolean().default(false),
  guest_limit: z.number().int().min(0).default(0),

  // Optional
  banner_image_url: z.string().url('Invalid URL format').nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  {
    message: 'End date must be after start date',
    path: ['end_date'],
  }
);

/**
 * Update Industrial Visit
 */
export const updateIVSchema = createIVSchema.partial().extend({
  id: z.string().uuid('Invalid IV ID'),
});

/**
 * Publish Industrial Visit
 */
export const publishIVSchema = z.object({
  id: z.string().uuid('Invalid IV ID'),
});

/**
 * Cancel Industrial Visit
 */
export const cancelIVSchema = z.object({
  id: z.string().uuid('Invalid IV ID'),
  reason: z.string().min(10, 'Cancellation reason must be at least 10 characters').max(500),
});

/**
 * Rate Industry Host (Post-Visit)
 */
export const rateHostSchema = z.object({
  id: z.string().uuid('Invalid IV ID'),
  host_willingness_rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comments: z.string().max(1000).nullable().optional(),
});

// ==================== IV BOOKING SCHEMAS ====================

/**
 * Create IV Booking (RSVP)
 */
export const createIVBookingSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  member_id: z.string().uuid('Invalid member ID'),

  // Family
  family_count: z.number().int().min(0).max(10, 'Family count cannot exceed 10').default(0),
  family_names: z.array(z.string().min(1).max(100)).nullable().optional(),

  // Carpool
  carpool_status: carpoolStatusSchema.default('not_needed'),
  seats_available: z.number().int().min(0).max(10).nullable().optional(),
  pickup_location: z.string().max(255).nullable().optional(),
  pickup_details: z.string().max(500).nullable().optional(),

  // Optional
  dietary_restrictions: z.string().max(500).nullable().optional(),
  special_requirements: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).refine(
  (data) => {
    // If offering ride, seats_available must be provided
    if (data.carpool_status === 'offering_ride') {
      return data.seats_available != null && data.seats_available > 0;
    }
    return true;
  },
  {
    message: 'Seats available must be specified when offering a ride',
    path: ['seats_available'],
  }
).refine(
  (data) => {
    // Family names array length should match family_count
    if (data.family_count > 0 && data.family_names) {
      return data.family_names.length === data.family_count;
    }
    return true;
  },
  {
    message: 'Number of family names must match family count',
    path: ['family_names'],
  }
);

/**
 * Update IV Booking
 */
export const updateIVBookingSchema = createIVBookingSchema.partial().extend({
  id: z.string().uuid('Invalid booking ID'),
});

/**
 * Cancel IV Booking
 */
export const cancelIVBookingSchema = z.object({
  id: z.string().uuid('Invalid booking ID'),
  reason: z.string().max(500).nullable().optional(),
});

// ==================== WAITLIST SCHEMAS ====================

/**
 * Join Waitlist
 */
export const joinWaitlistSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  member_id: z.string().uuid('Invalid member ID'),
});

/**
 * Leave Waitlist
 */
export const leaveWaitlistSchema = z.object({
  id: z.string().uuid('Invalid waitlist ID'),
});

/**
 * Promote from Waitlist
 */
export const promoteFromWaitlistSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
});

// ==================== INDUSTRY PORTAL SCHEMAS ====================

/**
 * Create Industry Portal User
 */
export const createIndustryPortalUserSchema = z.object({
  industry_id: z.string().uuid('Invalid industry ID'),
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  phone: z.string().regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format').max(20).nullable().optional(),
  role: z.string().max(100).nullable().optional(),
  permissions: z.object({
    add_slot: z.boolean().default(true),
    edit_slot: z.boolean().default(true),
    cancel_slot: z.boolean().default(true),
    view_bookings: z.boolean().default(true),
    export_attendees: z.boolean().default(true),
  }).optional(),
});

/**
 * Update Industry Portal User
 */
export const updateIndustryPortalUserSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
  full_name: z.string().min(2).max(255).optional(),
  phone: z.string().regex(/^[0-9+\-\s()]+$/).max(20).nullable().optional(),
  role: z.string().max(100).nullable().optional(),
  status: industryPortalUserStatusSchema.optional(),
  permissions: z.object({
    add_slot: z.boolean().optional(),
    edit_slot: z.boolean().optional(),
    cancel_slot: z.boolean().optional(),
    view_bookings: z.boolean().optional(),
    export_attendees: z.boolean().optional(),
  }).optional(),
});

/**
 * Delete Industry Portal User
 */
export const deleteIndustryPortalUserSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

/**
 * Industry Portal Login
 */
export const industryPortalLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Send Industry Portal Invitation
 */
export const sendIndustryPortalInvitationSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ==================== FILTER SCHEMAS ====================

/**
 * IV Filters
 */
export const ivFiltersSchema = z.object({
  search: z.string().optional(),
  industry_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  has_capacity: z.boolean().optional(),
  entry_method: entryMethodSchema.optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['start_date', 'created_at', 'title', 'capacity', 'industry_name']).default('start_date'),
  sort_direction: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * IV Booking Filters
 */
export const ivBookingFiltersSchema = z.object({
  search: z.string().optional(),
  event_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'waitlisted', 'attended', 'no_show']).optional(),
  carpool_status: carpoolStatusSchema.optional(),
  has_family: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});

/**
 * Waitlist Filters
 */
export const waitlistFiltersSchema = z.object({
  event_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  status: waitlistStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});

// ==================== CARPOOL SCHEMAS ====================

/**
 * Update Carpool Preference
 */
export const updateCarpoolPreferenceSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
  carpool_status: carpoolStatusSchema,
  seats_available: z.number().int().min(0).max(10).nullable().optional(),
  pickup_location: z.string().max(255).nullable().optional(),
  pickup_details: z.string().max(500).nullable().optional(),
}).refine(
  (data) => {
    if (data.carpool_status === 'offering_ride') {
      return data.seats_available != null && data.seats_available > 0;
    }
    return true;
  },
  {
    message: 'Seats available must be specified when offering a ride',
    path: ['seats_available'],
  }
);

/**
 * Request Carpool Match
 */
export const requestCarpoolMatchSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  member_id: z.string().uuid('Invalid member ID'),
});

// ==================== ANALYTICS SCHEMAS ====================

/**
 * Get IV Analytics
 */
export const getIVAnalyticsSchema = z.object({
  chapter_id: z.string().uuid('Invalid chapter ID'),
  date_from: z.string().datetime().nullable().optional(),
  date_to: z.string().datetime().nullable().optional(),
});

/**
 * Get Industry Performance
 */
export const getIndustryPerformanceSchema = z.object({
  industry_id: z.string().uuid('Invalid industry ID'),
  date_from: z.string().datetime().nullable().optional(),
  date_to: z.string().datetime().nullable().optional(),
});

// ==================== EXPORT SCHEMAS ====================

/**
 * Export IV Attendees
 */
export const exportIVAttendeesSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  format: z.enum(['csv', 'xlsx', 'json']).default('xlsx'),
  include_family: z.boolean().default(true),
  include_carpool: z.boolean().default(true),
});

/**
 * Export IVs List
 */
export const exportIVsSchema = z.object({
  filters: ivFiltersSchema.optional(),
  format: z.enum(['csv', 'xlsx', 'json']).default('xlsx'),
  include_stats: z.boolean().default(true),
});

// ==================== INDUSTRY-CREATED IV SCHEMAS ====================

/**
 * Industry Creates IV Slot (Simplified)
 */
export const industryCreateIVSlotSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().nullable().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  max_capacity: z.number().int().positive(),

  // Auto-filled from industry context
  // industry_id: filled from authenticated industry user
  // entry_method: auto-set to 'self_service'

  // Contact person (optional, can use industry defaults)
  contact_person_name: z.string().max(255).nullable().optional(),
  contact_person_phone: z.string().regex(/^[0-9+\-\s()]+$/).max(20).nullable().optional(),
  contact_person_role: z.string().max(100).nullable().optional(),

  // Logistics
  requirements: z.string().max(1000).nullable().optional(),
  learning_outcomes: z.string().max(1000).nullable().optional(),
  logistics_parking: z.string().max(500).nullable().optional(),
  logistics_food: z.string().max(500).nullable().optional(),
  logistics_meeting_point: z.string().max(500).nullable().optional(),
  logistics_arrival_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).nullable().optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  {
    message: 'End date must be after start date',
    path: ['end_date'],
  }
);

/**
 * Industry Increases Capacity
 */
export const industryIncreaseCapacitySchema = z.object({
  id: z.string().uuid('Invalid IV ID'),
  new_capacity: z.number().int().positive('Capacity must be positive'),
}).refine(
  async (data) => {
    // This will be validated in the server action to ensure new capacity > current capacity
    return true;
  },
  {
    message: 'New capacity must be greater than current capacity',
    path: ['new_capacity'],
  }
);

// ==================== MEMBER REQUEST IV SCHEMAS ====================

/**
 * Member Requests New IV
 */
export const memberRequestIVSchema = z.object({
  industry_id: z.string().uuid('Invalid industry ID').nullable().optional(),
  suggested_industry_name: z.string().max(255).nullable().optional(),
  preferred_dates: z.array(z.string().date()).min(1, 'At least one preferred date required').max(5),
  desired_learning_outcomes: z.string().min(10).max(1000),
  estimated_participants: z.number().int().min(5).max(100, 'Estimated participants must be between 5 and 100'),
  additional_notes: z.string().max(1000).nullable().optional(),
}).refine(
  (data) => {
    // Either industry_id or suggested_industry_name must be provided
    return data.industry_id != null || (data.suggested_industry_name != null && data.suggested_industry_name.length > 0);
  },
  {
    message: 'Either select an existing industry or provide a suggestion',
    path: ['industry_id'],
  }
);

// ==================== TYPE EXPORTS ====================

export type CreateIVInput = z.infer<typeof createIVSchema>;
export type UpdateIVInput = z.infer<typeof updateIVSchema>;
export type CreateIVBookingInput = z.infer<typeof createIVBookingSchema>;
export type UpdateIVBookingInput = z.infer<typeof updateIVBookingSchema>;
export type IVFiltersInput = z.infer<typeof ivFiltersSchema>;
export type IVBookingFiltersInput = z.infer<typeof ivBookingFiltersSchema>;
export type WaitlistFiltersInput = z.infer<typeof waitlistFiltersSchema>;
export type CreateIndustryPortalUserInput = z.infer<typeof createIndustryPortalUserSchema>;
export type UpdateIndustryPortalUserInput = z.infer<typeof updateIndustryPortalUserSchema>;
export type IndustryCreateIVSlotInput = z.infer<typeof industryCreateIVSlotSchema>;
export type MemberRequestIVInput = z.infer<typeof memberRequestIVSchema>;
