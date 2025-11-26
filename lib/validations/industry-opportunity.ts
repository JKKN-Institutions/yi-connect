/**
 * Industry Opportunity Validation Schemas
 *
 * Zod validation schemas for Industry Opportunities bidirectional system.
 * Covers opportunities, applications, visit requests, and related operations.
 */

import { z } from 'zod'

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const opportunityTypeSchema = z.enum([
  'industrial_visit',
  'internship',
  'mentorship',
  'guest_lecture',
  'job_opening',
  'project_collaboration',
  'training_program',
  'sponsorship',
  'csr_partnership',
  'other'
])

export const opportunityStatusSchema = z.enum([
  'draft',
  'published',
  'accepting_applications',
  'closed',
  'completed',
  'cancelled',
  'expired'
])

export const applicationStatusSchema = z.enum([
  'draft',
  'pending_review',
  'under_review',
  'shortlisted',
  'accepted',
  'waitlisted',
  'declined',
  'withdrawn'
])

export const visitRequestStatusSchema = z.enum([
  'pending_yi_review',
  'yi_approved',
  'forwarded_to_industry',
  'industry_accepted',
  'industry_declined',
  'scheduled',
  'completed',
  'cancelled'
])

export const visitTypeSchema = z.enum(['solo', 'group'])

export const partnershipStageSchema = z.enum([
  'initial_contact',
  'negotiation',
  'active_collaboration',
  'renewal_phase',
  'dormant'
])

export const engagementTierSchema = z.enum([
  'platinum',
  'gold',
  'silver',
  'bronze',
  'new'
])

export const visibilitySchema = z.enum(['chapter', 'national', 'public'])

export const experienceLevelSchema = z.enum(['entry', 'mid', 'senior'])

// ============================================================================
// COMMON VALIDATION PATTERNS
// ============================================================================

const urlRegex = /^https?:\/\/.+/
const phoneRegex = /^[\d\s\-\+\(\)]+$/
const uuidSchema = z.string().uuid('Invalid UUID')

// ============================================================================
// ELIGIBILITY CRITERIA SCHEMA
// ============================================================================

export const eligibilityCriteriaSchema = z.object({
  industries: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  experience_levels: z.array(experienceLevelSchema).optional(),
  min_experience_years: z.coerce.number().int().min(0).max(50).optional(),
  min_engagement_score: z.coerce.number().int().min(0).max(100).optional(),
  membership_types: z.array(z.string()).optional(),
  custom_requirements: z.array(z.string()).optional(),
})

// ============================================================================
// OPPORTUNITY SCHEMAS
// ============================================================================

export const createOpportunitySchema = z.object({
  industry_id: uuidSchema,
  chapter_id: uuidSchema.optional(),
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  opportunity_type: opportunityTypeSchema,

  // Dates
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  duration_description: z.string().max(255).optional(),
  application_deadline: z.string().min(1, 'Application deadline is required'),

  // Capacity
  max_participants: z.coerce.number().int().min(1).max(10000).optional(),

  // Eligibility
  eligibility_criteria: eligibilityCriteriaSchema.default({}),

  // Location
  location: z.string().max(500).optional(),
  is_remote: z.boolean().default(false),
  meeting_link: z.string().regex(urlRegex, 'Invalid URL').optional().or(z.literal('')),

  // Compensation
  is_paid: z.boolean().default(false),
  compensation_type: z.string().max(100).optional(),
  compensation_details: z.string().max(500).optional(),

  // Details
  benefits: z.array(z.string()).optional(),
  learning_outcomes: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  what_to_bring: z.array(z.string()).optional(),

  // Contact
  contact_person_name: z.string().max(255).optional(),
  contact_person_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_person_phone: z.string().regex(phoneRegex, 'Invalid phone').optional().or(z.literal('')),

  // Metadata
  tags: z.array(z.string()).optional(),
  banner_image_url: z.string().regex(urlRegex, 'Invalid URL').optional().or(z.literal('')),
  visibility: visibilitySchema.optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date)
    }
    return true
  },
  {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  }
).refine(
  (data) => {
    const deadline = new Date(data.application_deadline)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return deadline >= today
  },
  {
    message: 'Application deadline must be today or in the future',
    path: ['application_deadline'],
  }
).refine(
  (data) => {
    if (data.is_remote && !data.meeting_link) {
      return true // Remote opportunities may provide link later
    }
    return true
  },
  {
    message: 'Meeting link is recommended for remote opportunities',
    path: ['meeting_link'],
  }
)

export const updateOpportunitySchema = createOpportunitySchema.partial().extend({
  status: opportunityStatusSchema.optional(),
  banner_image_url: z.string().regex(urlRegex, 'Invalid URL').optional().or(z.literal('')),
  attachment_urls: z.array(z.string().regex(urlRegex)).optional(),
  is_featured: z.boolean().optional(),
  visibility: visibilitySchema.optional(),
})

export const publishOpportunitySchema = z.object({
  id: uuidSchema,
})

export const closeOpportunitySchema = z.object({
  id: uuidSchema,
  reason: z.string().max(500).optional(),
})

export const featureOpportunitySchema = z.object({
  id: uuidSchema,
  is_featured: z.boolean(),
})

// ============================================================================
// APPLICATION SCHEMAS
// ============================================================================

export const submitApplicationSchema = z.object({
  opportunity_id: uuidSchema,
  motivation_statement: z.string()
    .min(50, 'Motivation statement must be at least 50 characters')
    .max(2000, 'Motivation statement is too long'),
  learning_goals: z.string().max(1000).optional(),
  relevant_experience: z.string().max(1500).optional(),
  skills_to_contribute: z.string().max(1000).optional(),
  availability_notes: z.string().max(500).optional(),
  transportation_preference: z.string().max(100).optional(),
  dietary_preference: z.string().max(100).optional(),
  special_requirements: z.string().max(500).optional(),
  resume_url: z.string().regex(urlRegex, 'Invalid URL').optional().or(z.literal('')),
  portfolio_url: z.string().regex(urlRegex, 'Invalid URL').optional().or(z.literal('')),
  additional_documents: z.array(z.string().regex(urlRegex)).optional(),
})

export const updateApplicationSchema = submitApplicationSchema.partial().omit({
  opportunity_id: true,
})

export const withdrawApplicationSchema = z.object({
  application_id: uuidSchema,
  reason: z.string().max(500).optional(),
})

export const reviewApplicationSchema = z.object({
  application_id: uuidSchema,
  status: z.enum(['shortlisted', 'accepted', 'waitlisted', 'declined']),
  reviewer_notes: z.string().max(1000).optional(),
  outcome_notes: z.string().max(500).optional(),
  priority_rank: z.coerce.number().int().min(1).optional(),
})

export const bulkReviewApplicationsSchema = z.object({
  application_ids: z.array(uuidSchema).min(1, 'At least one application is required'),
  status: z.enum(['accepted', 'waitlisted', 'declined']),
  reviewer_notes: z.string().max(1000).optional(),
})

export const scheduleInterviewSchema = z.object({
  application_id: uuidSchema,
  scheduled_at: z.string().min(1, 'Interview date/time is required'),
  location: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    const scheduledDate = new Date(data.scheduled_at)
    const now = new Date()
    return scheduledDate > now
  },
  {
    message: 'Interview must be scheduled in the future',
    path: ['scheduled_at'],
  }
)

export const recordInterviewSchema = z.object({
  application_id: uuidSchema,
  interview_notes: z.string().max(2000).optional(),
  interview_rating: z.coerce.number().int().min(1).max(5).optional(),
})

// ============================================================================
// VISIT REQUEST SCHEMAS
// ============================================================================

export const preferredDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time_slot: z.enum(['morning', 'afternoon', 'full_day']),
})

export const createVisitRequestSchema = z.object({
  industry_id: uuidSchema,
  request_title: z.string().min(1, 'Title is required').max(255),
  visit_purpose: z.string().min(20, 'Purpose must be at least 20 characters').max(2000),
  visit_type: visitTypeSchema,
  preferred_dates: z.array(preferredDateSchema)
    .min(1, 'At least one preferred date is required')
    .max(5, 'Maximum 5 preferred dates allowed'),
  expected_participants: z.coerce.number().int().min(1).max(500).optional(),
  participant_profile: z.string().max(500).optional(),
  group_details: z.string().max(1000).optional(),
  additional_notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return data.preferred_dates.every(pd => new Date(pd.date) >= today)
  },
  {
    message: 'All preferred dates must be today or in the future',
    path: ['preferred_dates'],
  }
).refine(
  (data) => {
    if (data.visit_type === 'group' && (!data.expected_participants || data.expected_participants < 2)) {
      return false
    }
    return true
  },
  {
    message: 'Group visits must have at least 2 expected participants',
    path: ['expected_participants'],
  }
)

export const reviewVisitRequestSchema = z.object({
  request_id: uuidSchema,
  action: z.enum(['approve', 'decline', 'forward_to_industry']),
  notes: z.string().max(1000).optional(),
  rejection_reason: z.string().max(500).optional(),
}).refine(
  (data) => {
    if (data.action === 'decline' && !data.rejection_reason) {
      return false
    }
    return true
  },
  {
    message: 'Please provide a reason for declining',
    path: ['rejection_reason'],
  }
)

export const scheduleVisitSchema = z.object({
  request_id: uuidSchema,
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  scheduled_time: z.string().max(50).optional(),
  scheduled_duration: z.string().max(50).optional(),
  visit_location: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    const scheduledDate = new Date(data.scheduled_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return scheduledDate >= today
  },
  {
    message: 'Scheduled date must be today or in the future',
    path: ['scheduled_date'],
  }
)

export const completeVisitSchema = z.object({
  request_id: uuidSchema,
  feedback: z.string().max(2000).optional(),
  feedback_rating: z.coerce.number().int().min(1).max(5).optional(),
})

export const cancelVisitRequestSchema = z.object({
  request_id: uuidSchema,
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

// ============================================================================
// VISIT REQUEST INTEREST SCHEMAS
// ============================================================================

export const expressInterestSchema = z.object({
  visit_request_id: uuidSchema,
  interest_reason: z.string().max(500).optional(),
})

export const withdrawInterestSchema = z.object({
  visit_request_id: uuidSchema,
})

// ============================================================================
// BOOKMARK SCHEMAS
// ============================================================================

export const bookmarkOpportunitySchema = z.object({
  opportunity_id: uuidSchema,
  notes: z.string().max(500).optional(),
})

export const removeBookmarkSchema = z.object({
  opportunity_id: uuidSchema,
})

export const updateBookmarkNotesSchema = z.object({
  opportunity_id: uuidSchema,
  notes: z.string().max(500).optional(),
})

// ============================================================================
// PARTNERSHIP LIFECYCLE SCHEMAS
// ============================================================================

export const updatePartnershipStageSchema = z.object({
  mou_id: uuidSchema,
  partnership_stage: partnershipStageSchema,
  notes: z.string().max(1000).optional(),
})

export const recordOpportunityFromMouSchema = z.object({
  mou_id: uuidSchema,
  opportunity_id: uuidSchema,
})

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

export const opportunityFiltersSchema = z.object({
  search: z.string().max(255).optional(),
  opportunity_type: z.array(opportunityTypeSchema).optional(),
  status: z.array(opportunityStatusSchema).optional(),
  industry_id: uuidSchema.optional(),
  industry_sector: z.array(z.string()).optional(),
  is_remote: z.boolean().optional(),
  is_paid: z.boolean().optional(),
  min_match_score: z.coerce.number().int().min(0).max(100).optional(),
  deadline_within_days: z.coerce.number().int().min(1).max(365).optional(),
  has_spots_available: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  visibility: visibilitySchema.optional(),
})

export const applicationFiltersSchema = z.object({
  opportunity_id: uuidSchema.optional(),
  member_id: uuidSchema.optional(),
  status: z.array(applicationStatusSchema).optional(),
  min_match_score: z.coerce.number().int().min(0).max(100).optional(),
  max_match_score: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().max(255).optional(),
  sort_by: z.enum(['match_score', 'applied_at', 'priority_rank']).optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
})

export const visitRequestFiltersSchema = z.object({
  status: z.array(visitRequestStatusSchema).optional(),
  visit_type: z.array(visitTypeSchema).optional(),
  industry_id: uuidSchema.optional(),
  member_id: uuidSchema.optional(),
  chapter_id: uuidSchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

export const industryImpactFiltersSchema = z.object({
  industry_id: uuidSchema.optional(),
  chapter_id: uuidSchema.optional(),
  engagement_tier: z.array(engagementTierSchema).optional(),
  min_engagement_score: z.coerce.number().int().min(0).max(100).optional(),
})

// ============================================================================
// QUERY PARAMS SCHEMAS
// ============================================================================

export const opportunityQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  filters: opportunityFiltersSchema.optional(),
  sort_by: z.enum(['created_at', 'application_deadline', 'title', 'match_score', 'view_count']).optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
})

export const applicationQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  filters: applicationFiltersSchema.optional(),
})

export const visitRequestQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  filters: visitRequestFiltersSchema.optional(),
  sort_by: z.enum(['created_at', 'scheduled_date']).optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Opportunity types
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>
export type PublishOpportunityInput = z.infer<typeof publishOpportunitySchema>
export type CloseOpportunityInput = z.infer<typeof closeOpportunitySchema>
export type FeatureOpportunityInput = z.infer<typeof featureOpportunitySchema>

// Application types
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>
export type WithdrawApplicationInput = z.infer<typeof withdrawApplicationSchema>
export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>
export type BulkReviewApplicationsInput = z.infer<typeof bulkReviewApplicationsSchema>
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>
export type RecordInterviewInput = z.infer<typeof recordInterviewSchema>

// Visit request types
export type CreateVisitRequestInput = z.infer<typeof createVisitRequestSchema>
export type ReviewVisitRequestInput = z.infer<typeof reviewVisitRequestSchema>
export type ScheduleVisitInput = z.infer<typeof scheduleVisitSchema>
export type CompleteVisitInput = z.infer<typeof completeVisitSchema>
export type CancelVisitRequestInput = z.infer<typeof cancelVisitRequestSchema>

// Interest types
export type ExpressInterestInput = z.infer<typeof expressInterestSchema>
export type WithdrawInterestInput = z.infer<typeof withdrawInterestSchema>

// Bookmark types
export type BookmarkOpportunityInput = z.infer<typeof bookmarkOpportunitySchema>
export type RemoveBookmarkInput = z.infer<typeof removeBookmarkSchema>
export type UpdateBookmarkNotesInput = z.infer<typeof updateBookmarkNotesSchema>

// Partnership types
export type UpdatePartnershipStageInput = z.infer<typeof updatePartnershipStageSchema>
export type RecordOpportunityFromMouInput = z.infer<typeof recordOpportunityFromMouSchema>

// Filter types
export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>
export type ApplicationFilters = z.infer<typeof applicationFiltersSchema>
export type VisitRequestFilters = z.infer<typeof visitRequestFiltersSchema>
export type IndustryImpactFilters = z.infer<typeof industryImpactFiltersSchema>

// Query param types
export type OpportunityQueryParams = z.infer<typeof opportunityQueryParamsSchema>
export type ApplicationQueryParams = z.infer<typeof applicationQueryParamsSchema>
export type VisitRequestQueryParams = z.infer<typeof visitRequestQueryParamsSchema>

// Eligibility types
export type EligibilityCriteria = z.infer<typeof eligibilityCriteriaSchema>
export type PreferredDate = z.infer<typeof preferredDateSchema>
