/**
 * Event Module Validation Schemas
 *
 * Zod validation schemas for Event Lifecycle Manager module.
 * All schemas include comprehensive validation rules.
 */

import { z } from 'zod'
import { Constants } from '@/types/database'

// ============================================================================
// Helper Schemas
// ============================================================================

const urlRegex = /^https?:\/\/.+/
const urlOrDataUrlRegex = /^(https?:\/\/.+|data:image\/.+;base64,.+)$/
const phoneRegex = /^[\d\s\-\+\(\)]+$/

// ============================================================================
// Event Schemas
// ============================================================================

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().optional(),
  category: z.enum(Constants.public.Enums.event_category, {
    message: 'Category is required',
  }),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  registration_start_date: z.string().optional(),
  registration_end_date: z.string().optional(),
  venue_id: z.string().optional().refine((val) => !val || z.string().uuid().safeParse(val).success, {
    message: 'Invalid UUID',
  }),
  venue_address: z.string().optional(),
  venue_latitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? null : val),
    z.number().min(-90).max(90).nullable().optional()
  ),
  venue_longitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? null : val),
    z.number().min(-180).max(180).nullable().optional()
  ),
  is_virtual: z.boolean().default(false),
  virtual_meeting_link: z.string().optional(),
  max_capacity: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.number().int().min(1).optional()
  ),
  waitlist_enabled: z.boolean().default(false),
  requires_approval: z.boolean().default(false),
  send_reminders: z.boolean().default(true),
  allow_guests: z.boolean().default(false),
  guest_limit: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.number().int().min(0).optional()
  ),
  estimated_budget: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.number().min(0).optional()
  ),
  banner_image_url: z.string().optional().refine((val) => !val || urlOrDataUrlRegex.test(val), {
    message: 'Invalid URL or image',
  }),
  tags: z.array(z.string()).optional(),
  template_id: z.string().optional().refine((val) => !val || z.string().uuid().safeParse(val).success, {
    message: 'Invalid UUID',
  }),
  chapter_id: z.string().optional().refine((val) => !val || z.string().uuid().safeParse(val).success, {
    message: 'Invalid UUID',
  }),
}).refine(
  (data) => {
    if (data.end_date && data.start_date) {
      return new Date(data.end_date) > new Date(data.start_date)
    }
    return true
  },
  {
    message: 'End date must be after start date',
    path: ['end_date'],
  }
).refine(
  (data) => {
    if (data.registration_end_date && data.registration_start_date) {
      return new Date(data.registration_end_date) > new Date(data.registration_start_date)
    }
    return true
  },
  {
    message: 'Registration end date must be after registration start date',
    path: ['registration_end_date'],
  }
).refine(
  (data) => {
    if (data.is_virtual) {
      return true // Virtual events don't need venue
    }
    // Only validate if we have start_date (indicates form is being filled)
    // This prevents validation errors on empty forms during tab navigation
    if (!data.start_date) {
      return true
    }
    return data.venue_id || (data.venue_address && data.venue_address.trim() !== '')
  },
  {
    message: 'Venue address is required for in-person events',
    path: ['venue_address'],
  }
).refine(
  (data) => {
    if (!data.is_virtual) {
      return true // In-person events don't need meeting link
    }
    // Only validate if we have start_date (indicates form is being filled)
    if (!data.start_date) {
      return true
    }
    return !!data.virtual_meeting_link && data.virtual_meeting_link.trim() !== ''
  },
  {
    message: 'Meeting link is required for virtual events',
    path: ['virtual_meeting_link'],
  }
).refine(
  (data) => {
    // Validate URL format if virtual_meeting_link is provided
    if (data.virtual_meeting_link && data.virtual_meeting_link.trim() !== '') {
      return urlRegex.test(data.virtual_meeting_link)
    }
    return true
  },
  {
    message: 'Invalid meeting link URL. Must start with http:// or https://',
    path: ['virtual_meeting_link'],
  }
)

export const updateEventSchema = createEventSchema.partial().safeExtend({
  status: z.enum(Constants.public.Enums.event_status).optional(),
  current_registrations: z.coerce.number().int().min(0).optional(),
  actual_expense: z.coerce.number().min(0).optional(),
})

export const publishEventSchema = z.object({
  id: z.string().uuid(),
})

export const cancelEventSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1, 'Cancellation reason is required'),
})

// ============================================================================
// Venue Schemas
// ============================================================================

export const createVenueSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode').optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  amenities: z.array(z.string()).optional(),
  contact_person: z.string().optional(),
  contact_phone: z.string().regex(phoneRegex, 'Invalid phone number').optional(),
  contact_email: z.string().email('Invalid email').optional(),
  booking_link: z.string().regex(urlRegex, 'Invalid URL').optional(),
  notes: z.string().optional(),
})

export const updateVenueSchema = createVenueSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const deleteVenueSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Venue Booking Schemas
// ============================================================================

export const createVenueBookingSchema = z.object({
  event_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  booking_reference: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    if (data.end_time && data.start_time) {
      return new Date(data.end_time) > new Date(data.start_time)
    }
    return true
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
)

export const updateVenueBookingSchema = createVenueBookingSchema.partial().safeExtend({
  status: z.enum(Constants.public.Enums.booking_status).optional(),
})

// ============================================================================
// Resource Schemas
// ============================================================================

export const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity_available: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unit_cost: z.coerce.number().min(0).optional(),
})

export const updateResourceSchema = createResourceSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const createResourceBookingSchema = z.object({
  event_id: z.string().uuid(),
  resource_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
})

export const updateResourceBookingSchema = createResourceBookingSchema.partial()

// ============================================================================
// RSVP Schemas
// ============================================================================

export const createRSVPSchema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: z.enum(Constants.public.Enums.rsvp_status).default('pending'),
  guests_count: z.coerce.number().int().min(0).max(10, 'Maximum 10 guests allowed').default(0),
  dietary_restrictions: z.string().optional(),
  special_requirements: z.string().optional(),
  notes: z.string().optional(),
})

export const updateRSVPSchema = z.object({
  status: z.enum(Constants.public.Enums.rsvp_status).optional(),
  guests_count: z.coerce.number().int().min(0).max(10).optional(),
  dietary_restrictions: z.string().optional(),
  special_requirements: z.string().optional(),
  notes: z.string().optional(),
})

export const deleteRSVPSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Guest RSVP Schemas
// ============================================================================

export const createGuestRSVPSchema = z.object({
  event_id: z.string().uuid(),
  invited_by_member_id: z.string().uuid().optional(),
  full_name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(phoneRegex, 'Invalid phone number').optional(),
  company: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum(Constants.public.Enums.rsvp_status).default('pending'),
  dietary_restrictions: z.string().optional(),
  special_requirements: z.string().optional(),
  notes: z.string().optional(),
})

export const updateGuestRSVPSchema = createGuestRSVPSchema.partial().omit({
  event_id: true,
  invited_by_member_id: true,
})

export const deleteGuestRSVPSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Volunteer Schemas
// ============================================================================

export const createVolunteerRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().optional(),
  required_skills: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
})

export const updateVolunteerRoleSchema = createVolunteerRoleSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const deleteVolunteerRoleSchema = z.object({
  id: z.string().uuid(),
})

export const assignVolunteerSchema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid(),
  role_id: z.string().uuid().optional(),
  role_name: z.string().min(1, 'Role name is required'),
  notes: z.string().optional(),
})

export const updateVolunteerSchema = z.object({
  status: z.enum(Constants.public.Enums.volunteer_status).optional(),
  hours_contributed: z.coerce.number().min(0).max(24, 'Maximum 24 hours per day').optional(),
  feedback: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5').optional(),
  notes: z.string().optional(),
})

export const deleteVolunteerSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Check-in Schemas
// ============================================================================

export const checkInSchema = z.object({
  event_id: z.string().uuid(),
  attendee_type: z.enum(['member', 'guest']),
  attendee_id: z.string().uuid(),
  check_in_method: z.enum(['qr_code', 'manual', 'self_checkin']).optional(),
  notes: z.string().optional(),
})

export const deleteCheckInSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Feedback Schemas
// ============================================================================

export const createEventFeedbackSchema = z.object({
  event_id: z.string().uuid(),
  member_id: z.string().uuid().optional(),
  overall_rating: z.coerce.number().int().min(1).max(5).optional(),
  content_rating: z.coerce.number().int().min(1).max(5).optional(),
  venue_rating: z.coerce.number().int().min(1).max(5).optional(),
  organization_rating: z.coerce.number().int().min(1).max(5).optional(),
  what_went_well: z.string().optional(),
  what_could_improve: z.string().optional(),
  suggestions: z.string().optional(),
  would_attend_again: z.boolean().optional(),
  is_anonymous: z.boolean().default(false),
})

export const updateEventFeedbackSchema = createEventFeedbackSchema.partial().omit({
  event_id: true,
})

export const deleteEventFeedbackSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Event Document Schemas
// ============================================================================

export const uploadEventDocumentSchema = z.object({
  event_id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().optional(),
  document_type: z.enum(['photo', 'report', 'certificate', 'invoice', 'other']),
  file_url: z.string().regex(urlRegex, 'Invalid URL'),
  file_size_kb: z.coerce.number().int().min(0).optional(),
  is_public: z.boolean().default(false),
})

export const updateEventDocumentSchema = uploadEventDocumentSchema.partial().omit({
  event_id: true,
})

export const deleteEventDocumentSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Event Template Schemas
// ============================================================================

export const createEventTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  description: z.string().optional(),
  category: z.enum(Constants.public.Enums.event_category),
  default_duration_hours: z.coerce.number().int().min(1).max(48).default(2),
  default_capacity: z.coerce.number().int().min(1).optional(),
  default_volunteer_roles: z.array(z.object({
    role: z.string(),
    count: z.number().int().min(1),
  })).optional(),
  checklist: z.array(z.string()).optional(),
})

export const updateEventTemplateSchema = createEventTemplateSchema.partial()

export const deleteEventTemplateSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// Filter & Query Schemas
// ============================================================================

export const eventFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.array(z.enum(Constants.public.Enums.event_status)).optional(),
  category: z.array(z.enum(Constants.public.Enums.event_category)).optional(),
  start_date_from: z.string().optional(),
  start_date_to: z.string().optional(),
  is_virtual: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  organizer_id: z.string().uuid().optional(),
  chapter_id: z.string().uuid().optional(),
  has_capacity: z.boolean().optional(),
})

export const eventSortSchema = z.object({
  field: z.enum(['start_date', 'end_date', 'title', 'current_registrations', 'created_at', 'status']),
  direction: z.enum(['asc', 'desc']),
})

export const eventQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  filters: eventFiltersSchema.optional(),
  sort: eventSortSchema.optional(),
})

export const venueFiltersSchema = z.object({
  search: z.string().optional(),
  city: z.array(z.string()).optional(),
  capacity_min: z.coerce.number().int().min(0).optional(),
  capacity_max: z.coerce.number().int().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const rsvpFiltersSchema = z.object({
  event_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  status: z.array(z.enum(Constants.public.Enums.rsvp_status)).optional(),
  has_guests: z.boolean().optional(),
})

export const volunteerFiltersSchema = z.object({
  event_id: z.string().uuid().optional(),
  member_id: z.string().uuid().optional(),
  role_id: z.string().uuid().optional(),
  status: z.array(z.enum(Constants.public.Enums.volunteer_status)).optional(),
})

// ============================================================================
// Type Exports
// ============================================================================

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type PublishEventInput = z.infer<typeof publishEventSchema>
export type CancelEventInput = z.infer<typeof cancelEventSchema>

export type CreateVenueInput = z.infer<typeof createVenueSchema>
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>

export type CreateRSVPInput = z.infer<typeof createRSVPSchema>
export type UpdateRSVPInput = z.infer<typeof updateRSVPSchema>

export type CreateGuestRSVPInput = z.infer<typeof createGuestRSVPSchema>
export type UpdateGuestRSVPInput = z.infer<typeof updateGuestRSVPSchema>

export type AssignVolunteerInput = z.infer<typeof assignVolunteerSchema>
export type UpdateVolunteerInput = z.infer<typeof updateVolunteerSchema>

export type CheckInInput = z.infer<typeof checkInSchema>

export type CreateEventFeedbackInput = z.infer<typeof createEventFeedbackSchema>
export type UpdateEventFeedbackInput = z.infer<typeof updateEventFeedbackSchema>

export type UploadEventDocumentInput = z.infer<typeof uploadEventDocumentSchema>

export type CreateEventTemplateInput = z.infer<typeof createEventTemplateSchema>
export type UpdateEventTemplateInput = z.infer<typeof updateEventTemplateSchema>

export type EventFilters = z.infer<typeof eventFiltersSchema>
export type EventSortOptions = z.infer<typeof eventSortSchema>
export type EventQueryParams = z.infer<typeof eventQueryParamsSchema>

// ============================================================================
// PART 2: SERVICE EVENT SCHEMAS
// ============================================================================

const serviceEventTypes = ['masoom', 'thalir', 'yuva', 'road_safety', 'career_guidance', 'soft_skills', 'other'] as const
const stakeholderTypes = ['school', 'college', 'industry', 'ngo', 'government'] as const

export const createServiceEventSchema = createEventSchema.safeExtend({
  is_service_event: z.literal(true),
  service_type: z.enum(serviceEventTypes, {
    message: 'Service type is required',
  }),
  stakeholder_type: z.enum(stakeholderTypes, {
    message: 'Stakeholder type is required',
  }),
  stakeholder_id: z.string().uuid('Invalid stakeholder'),
  contact_person_name: z.string().max(255).optional(),
  contact_person_phone: z.string().regex(phoneRegex, 'Invalid phone number').optional(),
  contact_person_email: z.string().email('Invalid email').optional(),
  expected_students: z.coerce.number().int().min(1, 'Expected students must be at least 1'),
})

// ============================================================================
// PART 2: TRAINER ASSIGNMENT SCHEMAS
// ============================================================================

const trainerAssignmentStatuses = ['recommended', 'selected', 'invited', 'accepted', 'declined', 'confirmed', 'completed', 'cancelled'] as const
const selectionMethods = ['auto', 'manual'] as const

export const assignTrainersSchema = z.object({
  event_id: z.string().uuid(),
  trainer_profile_ids: z.array(z.string().uuid()).min(1, 'At least one trainer is required'),
  selection_method: z.enum(selectionMethods).default('manual'),
  notes: z.string().max(1000).optional(),
})

export const updateTrainerAssignmentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(trainerAssignmentStatuses).optional(),
  is_lead_trainer: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
})

export const respondToTrainerInviteSchema = z.object({
  assignment_id: z.string().uuid(),
  accept: z.boolean(),
  decline_reason: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (!data.accept && !data.decline_reason) {
      return false
    }
    return true
  },
  {
    message: 'Please provide a reason for declining',
    path: ['decline_reason'],
  }
)

export const confirmTrainerSchema = z.object({
  assignment_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
})

export const rateTrainerSchema = z.object({
  assignment_id: z.string().uuid(),
  trainer_rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  trainer_feedback: z.string().max(1000).optional(),
})

export const rateCoordinatorSchema = z.object({
  assignment_id: z.string().uuid(),
  coordinator_rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  coordinator_feedback: z.string().max(1000).optional(),
})

// ============================================================================
// PART 2: MATERIAL SCHEMAS
// ============================================================================

const materialTypes = ['presentation', 'handout', 'worksheet', 'video', 'assessment', 'certificate_template', 'other'] as const
const materialApprovalStatuses = ['draft', 'pending_review', 'approved', 'revision_requested', 'superseded'] as const

export const uploadMaterialSchema = z.object({
  event_id: z.string().uuid(),
  trainer_assignment_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().max(1000).optional(),
  material_type: z.enum(materialTypes, {
    message: 'Material type is required',
  }),
  file_url: z.string().regex(urlRegex, 'Invalid file URL'),
  file_name: z.string().min(1, 'File name is required').max(255),
  file_size_kb: z.coerce.number().int().min(0).optional(),
  mime_type: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
})

export const updateMaterialSchema = uploadMaterialSchema.partial().omit({
  event_id: true,
  trainer_assignment_id: true,
}).extend({
  version_notes: z.string().max(500).optional(),
})

export const submitMaterialForReviewSchema = z.object({
  material_id: z.string().uuid(),
})

export const reviewMaterialSchema = z.object({
  material_id: z.string().uuid(),
  action: z.enum(['approve', 'request_revision']),
  review_notes: z.string().max(1000).optional(),
  rejection_reason: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.action === 'request_revision' && !data.rejection_reason) {
      return false
    }
    return true
  },
  {
    message: 'Please provide a reason for requesting revision',
    path: ['rejection_reason'],
  }
)

export const createNewMaterialVersionSchema = z.object({
  parent_material_id: z.string().uuid(),
  file_url: z.string().regex(urlRegex, 'Invalid file URL'),
  file_name: z.string().min(1).max(255),
  file_size_kb: z.coerce.number().int().min(0).optional(),
  version_notes: z.string().max(500).optional(),
})

export const deleteMaterialSchema = z.object({
  id: z.string().uuid(),
})

// ============================================================================
// PART 2: SESSION REPORT SCHEMAS
// ============================================================================

const venueConditions = ['excellent', 'good', 'adequate', 'poor'] as const
const engagementLevels = ['very_high', 'high', 'moderate', 'low', 'very_low'] as const

export const classBreakdownSchema = z.record(z.string(), z.number().int().min(0))

export const submitSessionReportSchema = z.object({
  event_id: z.string().uuid(),
  trainer_assignment_id: z.string().uuid().optional(),

  // Attendance
  actual_attendance: z.coerce.number().int().min(0, 'Attendance is required'),
  male_count: z.coerce.number().int().min(0).optional(),
  female_count: z.coerce.number().int().min(0).optional(),
  staff_present: z.coerce.number().int().min(0).optional(),
  class_breakdown: classBreakdownSchema.optional(),

  // Timing
  actual_start_time: z.string().optional(),
  actual_end_time: z.string().optional(),

  // Content
  topics_covered: z.array(z.string()).optional(),

  // Venue & Logistics
  venue_condition: z.enum(venueConditions).optional(),
  av_equipment_worked: z.boolean().optional(),
  logistical_issues: z.string().max(1000).optional(),

  // Impact Assessment
  engagement_level: z.enum(engagementLevels).optional(),
  knowledge_retention_score: z.coerce.number().int().min(0).max(100).optional(),
  behavioral_change_observed: z.string().max(1000).optional(),

  // Coordinator Feedback
  coordinator_name: z.string().max(255).optional(),
  coordinator_feedback: z.string().max(1000).optional(),
  coordinator_rating: z.coerce.number().int().min(1).max(5).optional(),
  willing_to_host_again: z.boolean().optional(),

  // Follow-up
  follow_up_required: z.boolean().default(false),
  follow_up_notes: z.string().max(1000).optional(),
  follow_up_date: z.string().optional(),

  // Media
  photo_urls: z.array(z.string().regex(urlRegex)).optional(),
  attendance_sheet_url: z.string().regex(urlRegex).optional().or(z.literal('')),

  // Notes
  trainer_notes: z.string().max(2000).optional(),
  highlights: z.string().max(1000).optional(),
  challenges_faced: z.string().max(1000).optional(),
  recommendations: z.string().max(1000).optional(),
  best_practices_noted: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.actual_start_time && data.actual_end_time) {
      return new Date(data.actual_end_time) > new Date(data.actual_start_time)
    }
    return true
  },
  {
    message: 'End time must be after start time',
    path: ['actual_end_time'],
  }
).refine(
  (data) => {
    if (data.male_count !== undefined && data.female_count !== undefined) {
      const total = (data.male_count || 0) + (data.female_count || 0)
      return total <= data.actual_attendance
    }
    return true
  },
  {
    message: 'Male + Female count cannot exceed total attendance',
    path: ['female_count'],
  }
)

export const updateSessionReportSchema = submitSessionReportSchema.partial().omit({
  event_id: true,
  trainer_assignment_id: true,
})

export const verifySessionReportSchema = z.object({
  report_id: z.string().uuid(),
  verified: z.boolean(),
  notes: z.string().max(500).optional(),
})

export const completeFollowUpSchema = z.object({
  report_id: z.string().uuid(),
  notes: z.string().max(1000).optional(),
})

// ============================================================================
// PART 2: CARPOOL SCHEMAS
// ============================================================================

const travelPreferences = ['own_vehicle', 'need_ride', 'arrange_own', 'not_applicable'] as const
const carpoolMatchStatuses = ['proposed', 'accepted', 'declined', 'cancelled', 'completed'] as const

export const updateRSVPWithCarpoolSchema = updateRSVPSchema.extend({
  travel_preference: z.enum(travelPreferences).optional(),
  available_seats: z.coerce.number().int().min(0).max(10).optional(),
  pickup_location: z.string().max(500).optional(),
  pickup_notes: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.travel_preference === 'own_vehicle' && !data.available_seats) {
      return false
    }
    return true
  },
  {
    message: 'Please specify available seats when offering a ride',
    path: ['available_seats'],
  }
)

export const proposeCarpoolMatchSchema = z.object({
  event_id: z.string().uuid(),
  driver_rsvp_id: z.string().uuid(),
  passenger_rsvp_id: z.string().uuid(),
})

export const respondToCarpoolSchema = z.object({
  match_id: z.string().uuid(),
  accept: z.boolean(),
})

export const updateCarpoolDetailsSchema = z.object({
  match_id: z.string().uuid(),
  agreed_pickup_location: z.string().max(500).optional(),
  agreed_pickup_time: z.string().optional(),
  pickup_notes: z.string().max(500).optional(),
})

export const completeCarpoolSchema = z.object({
  match_id: z.string().uuid(),
  driver_feedback: z.string().max(500).optional(),
  passenger_feedback: z.string().max(500).optional(),
})

export const cancelCarpoolSchema = z.object({
  match_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

// ============================================================================
// PART 2: FILTER SCHEMAS
// ============================================================================

export const serviceEventFiltersSchema = eventFiltersSchema.extend({
  is_service_event: z.literal(true).optional(),
  service_type: z.array(z.enum(serviceEventTypes)).optional(),
  stakeholder_type: z.array(z.enum(stakeholderTypes)).optional(),
  stakeholder_id: z.string().uuid().optional(),
})

export const trainerAssignmentFiltersSchema = z.object({
  event_id: z.string().uuid().optional(),
  trainer_profile_id: z.string().uuid().optional(),
  status: z.array(z.enum(trainerAssignmentStatuses)).optional(),
  selection_method: z.enum(selectionMethods).optional(),
  is_lead_trainer: z.boolean().optional(),
})

export const materialFiltersSchema = z.object({
  event_id: z.string().uuid().optional(),
  trainer_assignment_id: z.string().uuid().optional(),
  material_type: z.array(z.enum(materialTypes)).optional(),
  status: z.array(z.enum(materialApprovalStatuses)).optional(),
  is_current_version: z.boolean().optional(),
  uploaded_by: z.string().uuid().optional(),
})

// ============================================================================
// PART 2: TYPE EXPORTS
// ============================================================================

export type CreateServiceEventInput = z.infer<typeof createServiceEventSchema>
export type AssignTrainersInput = z.infer<typeof assignTrainersSchema>
export type UpdateTrainerAssignmentInput = z.infer<typeof updateTrainerAssignmentSchema>
export type RespondToTrainerInviteInput = z.infer<typeof respondToTrainerInviteSchema>
export type ConfirmTrainerInput = z.infer<typeof confirmTrainerSchema>
export type RateTrainerInput = z.infer<typeof rateTrainerSchema>
export type RateCoordinatorInput = z.infer<typeof rateCoordinatorSchema>

export type UploadMaterialInput = z.infer<typeof uploadMaterialSchema>
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>
export type SubmitMaterialForReviewInput = z.infer<typeof submitMaterialForReviewSchema>
export type ReviewMaterialInput = z.infer<typeof reviewMaterialSchema>
export type CreateNewMaterialVersionInput = z.infer<typeof createNewMaterialVersionSchema>

export type SubmitSessionReportInput = z.infer<typeof submitSessionReportSchema>
export type UpdateSessionReportInput = z.infer<typeof updateSessionReportSchema>
export type VerifySessionReportInput = z.infer<typeof verifySessionReportSchema>
export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>

export type UpdateRSVPWithCarpoolInput = z.infer<typeof updateRSVPWithCarpoolSchema>
export type ProposeCarpoolMatchInput = z.infer<typeof proposeCarpoolMatchSchema>
export type RespondToCarpoolInput = z.infer<typeof respondToCarpoolSchema>
export type UpdateCarpoolDetailsInput = z.infer<typeof updateCarpoolDetailsSchema>
export type CompleteCarpoolInput = z.infer<typeof completeCarpoolSchema>
export type CancelCarpoolInput = z.infer<typeof cancelCarpoolSchema>

export type ServiceEventFilters = z.infer<typeof serviceEventFiltersSchema>
export type TrainerAssignmentFilters = z.infer<typeof trainerAssignmentFiltersSchema>
export type MaterialFilters = z.infer<typeof materialFiltersSchema>
