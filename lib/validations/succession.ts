// ============================================================================
// MODULE 5: SUCCESSION & LEADERSHIP PIPELINE - VALIDATION SCHEMAS
// ============================================================================
// Zod validation schemas for all succession entities with:
// - Comprehensive business rule validation
// - Custom error messages
// - Type inference for forms
// - Reusable sub-schemas
// ============================================================================

import { z } from 'zod'

// ============================================================================
// REUSABLE VALIDATORS
// ============================================================================

const uuidSchema = z.string().uuid('Invalid ID format')

const futureDateSchema = z.string().refine(
  (date) => new Date(date) > new Date(),
  { message: 'Date must be in the future' }
)

const pastOrPresentDateSchema = z.string().refine(
  (date) => new Date(date) <= new Date(),
  { message: 'Date cannot be in the future' }
)

const dateRangeSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'End date must be after start date', path: ['end_date'] }
)

const percentageSchema = z.number().min(0, 'Must be at least 0').max(100, 'Must be at most 100')

const positiveIntSchema = z.number().int('Must be a whole number').positive('Must be positive')

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const SuccessionCycleStatusSchema = z.enum([
  'draft',
  'active',
  'nominations_open',
  'nominations_closed',
  'applications_open',
  'applications_closed',
  'evaluations',
  'evaluations_closed',
  'interviews',
  'interviews_closed',
  'selection',
  'approval_pending',
  'completed',
  'archived',
])

export const SuccessionApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
])

export const SuccessionInterviewStatusSchema = z.enum([
  'scheduled',
  'attended',
  'no_show',
  'rescheduled',
  'cancelled',
])

// ============================================================================
// NESTED OBJECT SCHEMAS
// ============================================================================

export const PhaseConfigSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  description: z.string().optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'Phase end date must be after start date', path: ['end_date'] }
)

export const PhaseConfigsSchema = z.object({
  nominations: PhaseConfigSchema.optional(),
  applications: PhaseConfigSchema.optional(),
  evaluations: PhaseConfigSchema.optional(),
  interviews: PhaseConfigSchema.optional(),
  selection: PhaseConfigSchema.optional(),
})

export const PositionEligibilityCriteriaSchema = z.object({
  min_tenure: z.number().min(0, 'Tenure must be non-negative').optional(),
  min_events: z.number().int().min(0, 'Events must be non-negative').optional(),
  required_skills: z.array(z.string()).optional(),
  min_leadership_experience: z.boolean().optional(),
  tenure_weight: percentageSchema.optional(),
  events_weight: percentageSchema.optional(),
  leadership_weight: percentageSchema.optional(),
  skills_weight: percentageSchema.optional(),
  minimum_score: percentageSchema.optional(),
}).refine(
  (data) => {
    // If weights are provided, they should sum to 100
    const weights = [
      data.tenure_weight || 0,
      data.events_weight || 0,
      data.leadership_weight || 0,
      data.skills_weight || 0,
    ]
    const sum = weights.reduce((a, b) => a + b, 0)
    return sum === 0 || sum === 100
  },
  { message: 'Weights must sum to 100%', path: ['tenure_weight'] }
)

export const SupportingEvidenceSchema = z.object({
  type: z.enum(['document', 'link', 'note']),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required'),
  url: z.string().url('Invalid URL').optional(),
})

export const SupportingDocumentSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  url: z.string().url('Invalid URL'),
  size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'),
  type: z.string().refine(
    (type) => ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(type),
    { message: 'Only PDF and Word documents are allowed' }
  ),
  uploaded_at: z.string(),
})

export const EndorsementSchema = z.object({
  endorser_name: z.string().min(1, 'Endorser name is required').max(100),
  endorser_designation: z.string().min(1, 'Designation is required').max(100),
  endorser_organization: z.string().min(1, 'Organization is required').max(200),
  endorsement_text: z.string().min(50, 'Endorsement must be at least 50 characters').max(1000),
  endorsed_at: z.string(),
})

// ============================================================================
// SUCCESSION CYCLE SCHEMAS
// ============================================================================

export const CreateSuccessionCycleSchema = z.object({
  year: z.number().int().min(2020, 'Year must be 2020 or later').max(2100, 'Invalid year'),
  cycle_name: z.string().min(1, 'Cycle name is required').max(100, 'Cycle name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  phase_configs: PhaseConfigsSchema.optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) > new Date(data.start_date)
    }
    return true
  },
  { message: 'End date must be after start date', path: ['end_date'] }
)

export const UpdateSuccessionCycleSchema = CreateSuccessionCycleSchema.partial().extend({
  id: uuidSchema,
  status: SuccessionCycleStatusSchema.optional(),
  selection_committee_ids: z.array(uuidSchema).optional(),
  version: z.number().int().positive().optional(),
})

export const AdvanceSuccessionStatusSchema = z.object({
  id: uuidSchema,
  new_status: SuccessionCycleStatusSchema,
})

// ============================================================================
// POSITION SCHEMAS
// ============================================================================

export const CreateSuccessionPositionSchema = z.object({
  cycle_id: uuidSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  hierarchy_level: z.number().int().min(1, 'Level must be 1-5').max(5, 'Level must be 1-5'),
  number_of_openings: positiveIntSchema,
  eligibility_criteria: PositionEligibilityCriteriaSchema,
})

export const UpdateSuccessionPositionSchema = CreateSuccessionPositionSchema.partial().extend({
  id: uuidSchema,
})

// ============================================================================
// NOMINATION SCHEMAS
// ============================================================================

export const CreateNominationSchema = z.object({
  cycle_id: uuidSchema,
  position_id: uuidSchema,
  nominee_id: uuidSchema,
  nominated_by_id: uuidSchema,
  justification: z.string()
    .min(100, 'Justification must be at least 100 characters')
    .max(2000, 'Justification too long'),
  supporting_evidence: z.array(SupportingEvidenceSchema).optional(),
  status: SuccessionApplicationStatusSchema.optional(),
}).refine(
  (data) => data.nominee_id !== data.nominated_by_id,
  { message: 'You cannot nominate yourself', path: ['nominee_id'] }
)

export const UpdateNominationSchema = CreateNominationSchema.partial().extend({
  id: uuidSchema,
})

export const WithdrawNominationSchema = z.object({
  id: uuidSchema,
  reason: z.string().min(10, 'Please provide a reason').max(500),
})

export const ReviewNominationSchema = z.object({
  id: uuidSchema,
  status: z.enum(['approved', 'rejected']),
  review_notes: z.string().min(10, 'Please provide review notes').max(1000),
  reviewed_by_id: uuidSchema,
})

// ============================================================================
// APPLICATION SCHEMAS
// ============================================================================

export const CreateApplicationSchema = z.object({
  cycle_id: uuidSchema,
  position_id: uuidSchema,
  member_id: uuidSchema,
  personal_statement: z.string()
    .min(200, 'Personal statement must be at least 200 characters')
    .max(5000, 'Personal statement too long'),
  supporting_documents: z.array(SupportingDocumentSchema).optional(),
  status: SuccessionApplicationStatusSchema.optional(),
})

export const UpdateApplicationSchema = CreateApplicationSchema.partial().extend({
  id: uuidSchema,
})

export const SubmitApplicationSchema = z.object({
  id: uuidSchema,
})

// ============================================================================
// SECONDMENT SCHEMAS
// ============================================================================

export const CreateSecondmentSchema = z.object({
  cycle_id: uuidSchema,
  position_id: uuidSchema,
  member_id: uuidSchema,
  organization_name: z.string().min(1, 'Organization name is required').max(200),
  secondment_details: z.string().min(100, 'Details must be at least 100 characters').max(2000),
  duration_months: z.number().int().min(1, 'Duration must be at least 1 month').max(24, 'Duration cannot exceed 24 months'),
  endorsements: z.array(EndorsementSchema).min(1, 'At least one endorsement is required'),
})

export const ApproveSecondmentSchema = z.object({
  id: uuidSchema,
  hr_approved: z.boolean(),
  hr_approved_by_id: uuidSchema,
})

// ============================================================================
// EVALUATION SCHEMAS
// ============================================================================

export const CreateEvaluationCriteriaSchema = z.object({
  position_id: uuidSchema,
  criterion_name: z.string().min(1, 'Criterion name is required').max(100),
  description: z.string().max(500).optional(),
  weight: percentageSchema,
  max_score: z.number().min(1).max(100),
  display_order: z.number().int().min(0).optional(),
})

export const AssignEvaluatorSchema = z.object({
  cycle_id: uuidSchema,
  member_id: uuidSchema,
  assigned_by_id: uuidSchema,
})

export const SubmitEvaluationScoresSchema = z.object({
  nomination_id: uuidSchema,
  evaluator_id: uuidSchema,
  scores: z.array(
    z.object({
      criterion_id: uuidSchema,
      score: z.number().min(0, 'Score cannot be negative'),
      comments: z.string().max(500).optional(),
    })
  ).min(1, 'At least one criterion must be scored'),
})

export const UpdateEvaluationScoreSchema = z.object({
  id: uuidSchema,
  score: z.number().min(0, 'Score cannot be negative'),
  comments: z.string().max(500).optional(),
})

export const LockEvaluationCriteriaSchema = z.object({
  position_id: uuidSchema,
})

// ============================================================================
// INTERVIEW SCHEMAS
// ============================================================================

export const ScheduleInterviewSchema = z.object({
  cycle_id: uuidSchema,
  nomination_id: uuidSchema,
  interview_date: futureDateSchema,
  location: z.string().max(200).optional(),
  meeting_link: z.string().url('Invalid meeting link').optional(),
  duration_minutes: z.number().int().min(15, 'Duration must be at least 15 minutes').max(180, 'Duration cannot exceed 3 hours'),
  panel_member_ids: z.array(uuidSchema).min(1, 'At least one panel member is required').max(10, 'Maximum 10 panel members allowed'),
  scheduled_by_id: uuidSchema,
}).refine(
  (data) => data.location || data.meeting_link,
  { message: 'Either location or meeting link must be provided', path: ['location'] }
)

export const RescheduleInterviewSchema = z.object({
  id: uuidSchema,
  new_date: futureDateSchema,
  reason: z.string().min(10, 'Please provide a reason').max(500),
})

export const SubmitInterviewFeedbackSchema = z.object({
  interview_schedule_id: uuidSchema,
  panel_member_id: uuidSchema,
  overall_rating: z.number().min(1, 'Rating must be 1-10').max(10, 'Rating must be 1-10'),
  strengths: z.string().min(20, 'Strengths must be at least 20 characters').max(1000).optional(),
  areas_for_improvement: z.string().min(20, 'Areas for improvement must be at least 20 characters').max(1000).optional(),
  recommendation: z.string().max(500).optional(),
  additional_notes: z.string().max(1000).optional(),
})

export const UpdateInterviewAttendanceSchema = z.object({
  id: uuidSchema,
  attendance_status: SuccessionInterviewStatusSchema,
})

// ============================================================================
// SELECTION SCHEMAS
// ============================================================================

export const DeclareSelectionsSchema = z.object({
  cycle_id: uuidSchema,
  selections: z.array(
    z.object({
      position_id: uuidSchema,
      nomination_id: uuidSchema,
      rank: positiveIntSchema,
      final_score: z.number().min(0).max(100),
      selection_rationale: z.string().min(100, 'Rationale must be at least 100 characters').max(2000),
    })
  ).min(1, 'At least one selection is required'),
  announced_by_id: uuidSchema,
}).refine(
  (data) => {
    // Check for unique ranks per position
    const ranksByPosition = new Map<string, Set<number>>()
    for (const selection of data.selections) {
      if (!ranksByPosition.has(selection.position_id)) {
        ranksByPosition.set(selection.position_id, new Set())
      }
      const ranks = ranksByPosition.get(selection.position_id)!
      if (ranks.has(selection.rank)) {
        return false
      }
      ranks.add(selection.rank)
    }
    return true
  },
  { message: 'Each position must have unique ranks', path: ['selections'] }
)

export const ApproveSelectionSchema = z.object({
  cycle_id: uuidSchema,
  approved_by_id: uuidSchema,
})

export const PublishResultsSchema = z.object({
  cycle_id: uuidSchema,
  publish_date: z.string().optional(),
})

// ============================================================================
// BULK OPERATION SCHEMAS
// ============================================================================

export const BulkCalculateEligibilitySchema = z.object({
  cycle_id: uuidSchema,
})

export const BulkAssignEvaluatorsSchema = z.object({
  cycle_id: uuidSchema,
  evaluators: z.array(
    z.object({
      member_id: uuidSchema,
      candidate_ids: z.array(uuidSchema).min(1),
    })
  ).min(1, 'At least one evaluator must be assigned'),
  assigned_by_id: uuidSchema,
})

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

export const SuccessionCycleFiltersSchema = z.object({
  status: z.union([SuccessionCycleStatusSchema, z.array(SuccessionCycleStatusSchema)]).optional(),
  year: z.number().int().optional(),
  search: z.string().optional(),
})

export const SuccessionNominationFiltersSchema = z.object({
  cycle_id: uuidSchema.optional(),
  position_id: uuidSchema.optional(),
  status: z.union([SuccessionApplicationStatusSchema, z.array(SuccessionApplicationStatusSchema)]).optional(),
  nominee_id: uuidSchema.optional(),
  nominated_by_id: uuidSchema.optional(),
})

export const SuccessionApplicationFiltersSchema = z.object({
  cycle_id: uuidSchema.optional(),
  position_id: uuidSchema.optional(),
  status: z.union([SuccessionApplicationStatusSchema, z.array(SuccessionApplicationStatusSchema)]).optional(),
  member_id: uuidSchema.optional(),
})

// ============================================================================
// TIMELINE STEP SCHEMAS
// ============================================================================

export const TimelineStepStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'overdue',
])

export const CreateTimelineStepSchema = z.object({
  cycle_id: uuidSchema,
  step_number: z.number().int().min(1, 'Step number must be 1-7').max(7, 'Step number must be 1-7'),
  step_name: z.string().min(1, 'Step name is required').max(200, 'Step name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  start_date: z.string(),
  end_date: z.string(),
  status: TimelineStepStatusSchema.optional(),
  auto_trigger_action: z.string().max(200).optional(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'End date must be after start date', path: ['end_date'] }
)

export const UpdateTimelineStepSchema = CreateTimelineStepSchema.partial().extend({
  id: uuidSchema,
})

// ============================================================================
// CANDIDATE APPROACH SCHEMAS
// ============================================================================

export const ApproachResponseStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'conditional',
])

export const CreateApproachSchema = z.object({
  cycle_id: uuidSchema,
  position_id: uuidSchema,
  nominee_id: uuidSchema,
  approached_by: uuidSchema,
  response_status: ApproachResponseStatusSchema.optional(),
  conditions_text: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateApproachSchema = CreateApproachSchema.partial().extend({
  id: uuidSchema,
})

// ============================================================================
// STEERING COMMITTEE MEETING SCHEMAS
// ============================================================================

export const MeetingTypeSchema = z.enum([
  'steering_committee',
  'rc_review',
  'final_selection',
  'interview',
])

export const MeetingStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
])

export const CreateMeetingSchema = z.object({
  cycle_id: uuidSchema,
  meeting_date: z.string(),
  meeting_type: MeetingTypeSchema,
  location: z.string().max(200).optional(),
  meeting_link: z.string().url('Invalid meeting link').optional(),
  agenda: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  status: MeetingStatusSchema.optional(),
  created_by: uuidSchema,
}).refine(
  (data) => data.location || data.meeting_link,
  { message: 'Either location or meeting link must be provided', path: ['location'] }
)

export const UpdateMeetingSchema = CreateMeetingSchema.partial().extend({
  id: uuidSchema,
})

// ============================================================================
// VOTING SCHEMAS
// ============================================================================

export const VoteValueSchema = z.enum(['yes', 'no', 'abstain'])

export const CreateVoteSchema = z.object({
  meeting_id: uuidSchema,
  position_id: uuidSchema,
  nominee_id: uuidSchema,
  voter_member_id: uuidSchema,
  vote: VoteValueSchema,
  comments: z.string().max(1000).optional(),
})

export const UpdateVoteSchema = z.object({
  id: uuidSchema,
  vote: VoteValueSchema,
  comments: z.string().max(1000).optional(),
})

// ============================================================================
// TYPE INFERENCE EXPORTS
// ============================================================================

export type CreateSuccessionCycleInput = z.infer<typeof CreateSuccessionCycleSchema>
export type UpdateSuccessionCycleInput = z.infer<typeof UpdateSuccessionCycleSchema>
export type CreateSuccessionPositionInput = z.infer<typeof CreateSuccessionPositionSchema>
export type CreateNominationInput = z.infer<typeof CreateNominationSchema>
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>
export type SubmitEvaluationScoresInput = z.infer<typeof SubmitEvaluationScoresSchema>
export type ScheduleInterviewInput = z.infer<typeof ScheduleInterviewSchema>
export type SubmitInterviewFeedbackInput = z.infer<typeof SubmitInterviewFeedbackSchema>
export type DeclareSelectionsInput = z.infer<typeof DeclareSelectionsSchema>
export type CreateTimelineStepInput = z.infer<typeof CreateTimelineStepSchema>
export type UpdateTimelineStepInput = z.infer<typeof UpdateTimelineStepSchema>
export type CreateApproachInput = z.infer<typeof CreateApproachSchema>
export type UpdateApproachInput = z.infer<typeof UpdateApproachSchema>
export type CreateMeetingInput = z.infer<typeof CreateMeetingSchema>
export type UpdateMeetingInput = z.infer<typeof UpdateMeetingSchema>
export type CreateVoteInput = z.infer<typeof CreateVoteSchema>
export type UpdateVoteInput = z.infer<typeof UpdateVoteSchema>
