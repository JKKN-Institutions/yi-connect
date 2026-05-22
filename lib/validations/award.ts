// ============================================================================
// Module 6: Take Pride Award Automation - Zod Validation Schemas
// ============================================================================

import { z } from 'zod'

// ============================================================================
// Award Category Schemas
// ============================================================================

export const ScoringCriteriaSchema = z.object({
  name: z.string().min(1, 'Criteria name is required'),
  weight: z.number().min(0).max(1, 'Weight must be between 0 and 1'),
  description: z.string().optional(),
})

export const ScoringWeightsSchema = z.object({
  impact: z.number().min(0).max(1).default(0.3),
  innovation: z.number().min(0).max(1).default(0.25),
  participation: z.number().min(0).max(1).default(0.2),
  consistency: z.number().min(0).max(1).default(0.15),
  leadership: z.number().min(0).max(1).default(0.1),
}).refine(
  (data) => {
    const sum = data.impact + data.innovation + data.participation + data.consistency + data.leadership
    return Math.abs(sum - 1) < 0.01 // Allow tiny floating point errors
  },
  { message: 'Scoring weights must sum to 1.0' }
)

export const CreateAwardCategorySchema = z.object({
  chapter_id: z.string().uuid('Invalid chapter ID'),
  name: z.string()
    .min(1, 'Category name is required')
    .max(255, 'Category name is too long'),
  description: z.string().max(1000).optional(),
  criteria: z.array(ScoringCriteriaSchema).optional(),
  scoring_weights: ScoringWeightsSchema.optional(),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time']),
  icon: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
})

export const UpdateAwardCategorySchema = CreateAwardCategorySchema.partial().extend({
  id: z.string().uuid('Invalid category ID'),
})

// ============================================================================
// Award Cycle Schemas
// ============================================================================

// Base schema for award cycle without refinements
const AwardCycleBaseSchema = z.object({
  category_id: z.string().uuid('Invalid category ID'),
  cycle_name: z.string()
    .min(1, 'Cycle name is required')
    .max(255, 'Cycle name is too long'),
  year: z.number()
    .int('Year must be a whole number')
    .min(2020, 'Year must be 2020 or later')
    .max(2100, 'Year must be before 2100'),
  period_identifier: z.string()
    .max(50, 'Period identifier is too long')
    .optional(),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date format',
  }),
  end_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date format',
  }),
  nomination_deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid nomination deadline format',
  }),
  jury_deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid jury deadline format',
  }),
  status: z.enum(['draft', 'open', 'nominations_closed', 'judging', 'completed', 'cancelled']).optional(),
  description: z.string().max(1000).optional(),
  max_nominations_per_member: z.number().int().min(1).default(1).optional(),
})

export const CreateAwardCycleSchema = AwardCycleBaseSchema.refine(
  (data) => new Date(data.start_date) <= new Date(data.end_date),
  { message: 'Start date must be before or equal to end date', path: ['end_date'] }
).refine(
  (data) => new Date(data.nomination_deadline) <= new Date(data.jury_deadline),
  { message: 'Nomination deadline must be before or equal to jury deadline', path: ['jury_deadline'] }
)

export const UpdateAwardCycleSchema = AwardCycleBaseSchema.partial().extend({
  id: z.string().uuid('Invalid cycle ID'),
})

// ============================================================================
// Nomination Schemas
// ============================================================================

export const SupportingDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  url: z.string().url('Invalid document URL'),
  type: z.string().min(1, 'Document type is required'),
  size: z.number().int().positive('Document size must be positive'),
})

// Base schema for nomination without refinements
const NominationBaseSchema = z.object({
  cycle_id: z.string().uuid('Invalid cycle ID'),
  nominee_id: z.string().uuid('Invalid nominee ID'),
  nominator_id: z.string().uuid('Invalid nominator ID'),
  justification: z.string()
    .min(50, 'Justification must be at least 50 characters')
    .max(2000, 'Justification is too long'),
  supporting_documents: z.array(SupportingDocumentSchema).optional(),
  status: z.enum(['draft', 'submitted', 'under_review', 'shortlisted', 'rejected', 'winner']).optional(),
})

export const CreateNominationSchema = NominationBaseSchema.refine(
  (data) => data.nominee_id !== data.nominator_id,
  { message: 'Cannot nominate yourself', path: ['nominee_id'] }
)

export const UpdateNominationSchema = NominationBaseSchema.partial().extend({
  id: z.string().uuid('Invalid nomination ID'),
})

// ============================================================================
// Jury Member Schemas
// ============================================================================

export const AssignJuryMemberSchema = z.object({
  cycle_id: z.string().uuid('Invalid cycle ID'),
  member_id: z.string().uuid('Invalid member ID'),
  assigned_by: z.string().uuid().optional(),
})

export const RemoveJuryMemberSchema = z.object({
  id: z.string().uuid('Invalid jury member ID'),
})

// ============================================================================
// Jury Score Schemas
// ============================================================================

const scoreValidator = z.number()
  .min(1, 'Score must be at least 1')
  .max(10, 'Score must be at most 10')
  .multipleOf(0.5, 'Score must be in increments of 0.5')

export const CreateJuryScoreSchema = z.object({
  nomination_id: z.string().uuid('Invalid nomination ID'),
  jury_member_id: z.string().uuid('Invalid jury member ID'),
  impact_score: scoreValidator,
  innovation_score: scoreValidator,
  participation_score: scoreValidator,
  consistency_score: scoreValidator,
  leadership_score: scoreValidator,
  comments: z.string().max(1000).optional(),
})

export const UpdateJuryScoreSchema = CreateJuryScoreSchema.partial().extend({
  id: z.string().uuid('Invalid score ID'),
})

// ============================================================================
// Award Winner Schemas
// ============================================================================

export const CreateAwardWinnerSchema = z.object({
  cycle_id: z.string().uuid('Invalid cycle ID'),
  nomination_id: z.string().uuid('Invalid nomination ID'),
  rank: z.number()
    .int('Rank must be a whole number')
    .min(1, 'Rank must be at least 1')
    .max(3, 'Rank must be at most 3'),
  final_score: z.number()
    .positive('Final score must be positive')
    .max(10, 'Final score must be at most 10'),
  announced_by: z.string().uuid().optional(),
})

export const AnnounceWinnersSchema = z.object({
  cycle_id: z.string().uuid('Invalid cycle ID'),
  announcement_message: z.string().max(1000).optional(),
  send_notifications: z.boolean().default(true),
})

// ============================================================================
// Filter Schemas
// ============================================================================

export const AwardCategoryFiltersSchema = z.object({
  chapter_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time']).optional(),
  search: z.string().optional(),
})

export const AwardCycleFiltersSchema = z.object({
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'open', 'nominations_closed', 'judging', 'review', 'completed', 'archived']).optional(),
  year: z.number().int().optional(),
  search: z.string().optional(),
})

export const NominationFiltersSchema = z.object({
  cycle_id: z.string().uuid().optional(),
  nominee_id: z.string().uuid().optional(),
  nominator_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'under_review', 'verified', 'rejected', 'winner', 'archived']).optional(),
  search: z.string().optional(),
})

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type CreateAwardCategoryInput = z.infer<typeof CreateAwardCategorySchema>
export type UpdateAwardCategoryInput = z.infer<typeof UpdateAwardCategorySchema>
export type CreateAwardCycleInput = z.infer<typeof CreateAwardCycleSchema>
export type UpdateAwardCycleInput = z.infer<typeof UpdateAwardCycleSchema>
export type CreateNominationInput = z.infer<typeof CreateNominationSchema>
export type UpdateNominationInput = z.infer<typeof UpdateNominationSchema>
export type AssignJuryMemberInput = z.infer<typeof AssignJuryMemberSchema>
export type CreateJuryScoreInput = z.infer<typeof CreateJuryScoreSchema>
export type UpdateJuryScoreInput = z.infer<typeof UpdateJuryScoreSchema>
export type CreateAwardWinnerInput = z.infer<typeof CreateAwardWinnerSchema>
export type AnnounceWinnersInput = z.infer<typeof AnnounceWinnersSchema>
