/**
 * AAA Pathfinder Module
 * Zod Validation Schemas
 */

import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const aaaItemStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'cancelled'])
export const milestoneStatusSchema = z.enum(['pending', 'in_progress', 'completed'])
export const aaaPlanStatusSchema = z.enum(['draft', 'submitted', 'approved', 'active'])
export const mentorAssignmentStatusSchema = z.enum(['active', 'completed', 'cancelled'])

// ============================================================================
// AAA PLAN SCHEMAS
// ============================================================================

export const createAAAPlanSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  fiscal_year: z.number().int().min(2020).max(2100),
  chapter_id: z.string().uuid('Invalid chapter ID'),

  // Awareness (3)
  awareness_1_title: z.string().max(255).optional(),
  awareness_1_description: z.string().optional(),
  awareness_1_audience: z.string().max(255).optional(),
  awareness_1_target_date: z.string().optional(),

  awareness_2_title: z.string().max(255).optional(),
  awareness_2_description: z.string().optional(),
  awareness_2_audience: z.string().max(255).optional(),
  awareness_2_target_date: z.string().optional(),

  awareness_3_title: z.string().max(255).optional(),
  awareness_3_description: z.string().optional(),
  awareness_3_audience: z.string().max(255).optional(),
  awareness_3_target_date: z.string().optional(),

  // Action (2)
  action_1_title: z.string().max(255).optional(),
  action_1_description: z.string().optional(),
  action_1_target: z.string().max(255).optional(),
  action_1_target_date: z.string().optional(),

  action_2_title: z.string().max(255).optional(),
  action_2_description: z.string().optional(),
  action_2_target: z.string().max(255).optional(),
  action_2_target_date: z.string().optional(),

  first_event_date: z.string().optional(),

  // Advocacy (1)
  advocacy_goal: z.string().optional(),
  advocacy_target_contact: z.string().max(255).optional(),
  advocacy_approach: z.string().optional(),

  // Milestones
  milestone_jan_target: z.string().optional(),
  milestone_feb_target: z.string().optional(),
  milestone_mar_target: z.string().optional(),
})

export const updateAAAPlanSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),

  // All create fields optional
  vertical_id: z.string().uuid().optional(),
  fiscal_year: z.number().int().min(2020).max(2100).optional(),

  // Awareness
  awareness_1_title: z.string().max(255).optional(),
  awareness_1_description: z.string().optional(),
  awareness_1_audience: z.string().max(255).optional(),
  awareness_1_target_date: z.string().optional(),
  awareness_1_status: aaaItemStatusSchema.optional(),

  awareness_2_title: z.string().max(255).optional(),
  awareness_2_description: z.string().optional(),
  awareness_2_audience: z.string().max(255).optional(),
  awareness_2_target_date: z.string().optional(),
  awareness_2_status: aaaItemStatusSchema.optional(),

  awareness_3_title: z.string().max(255).optional(),
  awareness_3_description: z.string().optional(),
  awareness_3_audience: z.string().max(255).optional(),
  awareness_3_target_date: z.string().optional(),
  awareness_3_status: aaaItemStatusSchema.optional(),

  // Action
  action_1_title: z.string().max(255).optional(),
  action_1_description: z.string().optional(),
  action_1_target: z.string().max(255).optional(),
  action_1_target_date: z.string().optional(),
  action_1_status: aaaItemStatusSchema.optional(),

  action_2_title: z.string().max(255).optional(),
  action_2_description: z.string().optional(),
  action_2_target: z.string().max(255).optional(),
  action_2_target_date: z.string().optional(),
  action_2_status: aaaItemStatusSchema.optional(),

  first_event_date: z.string().optional(),
  first_event_locked: z.boolean().optional(),

  // Advocacy
  advocacy_goal: z.string().optional(),
  advocacy_target_contact: z.string().max(255).optional(),
  advocacy_approach: z.string().optional(),
  advocacy_status: aaaItemStatusSchema.optional(),
  advocacy_outcome: z.string().optional(),

  // Milestones
  milestone_jan_target: z.string().optional(),
  milestone_jan_status: milestoneStatusSchema.optional(),
  milestone_jan_notes: z.string().optional(),

  milestone_feb_target: z.string().optional(),
  milestone_feb_status: milestoneStatusSchema.optional(),
  milestone_feb_notes: z.string().optional(),

  milestone_mar_target: z.string().optional(),
  milestone_mar_status: milestoneStatusSchema.optional(),
  milestone_mar_notes: z.string().optional(),

  // Status
  status: aaaPlanStatusSchema.optional(),
})

export const lockFirstEventSchema = z.object({
  plan_id: z.string().uuid('Invalid plan ID'),
  first_event_date: z.string().min(1, 'First event date is required'),
})

export const approveAAAPlanSchema = z.object({
  plan_id: z.string().uuid('Invalid plan ID'),
})

// ============================================================================
// COMMITMENT CARD SCHEMAS
// ============================================================================

export const signCommitmentCardSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
  aaa_plan_id: z.string().uuid().optional(),
  chapter_id: z.string().uuid('Invalid chapter ID'),
  pathfinder_year: z.number().int().min(2020).max(2100),
  commitment_1: z.string().min(1, 'At least one commitment is required').max(500),
  commitment_2: z.string().max(500).optional(),
  commitment_3: z.string().max(500).optional(),
  signature_data: z.string().optional(), // Base64 signature
})

export const updateCommitmentCardSchema = z.object({
  id: z.string().uuid('Invalid commitment card ID'),
  commitment_1: z.string().min(1).max(500).optional(),
  commitment_2: z.string().max(500).optional(),
  commitment_3: z.string().max(500).optional(),
  signature_data: z.string().optional(),
})

// ============================================================================
// MENTOR ASSIGNMENT SCHEMAS
// ============================================================================

export const assignMentorSchema = z.object({
  ec_chair_id: z.string().uuid('Invalid EC chair ID'),
  mentor_id: z.string().uuid('Invalid mentor ID'),
  chapter_id: z.string().uuid('Invalid chapter ID'),
  vertical_id: z.string().uuid().optional(),
  pathfinder_year: z.number().int().min(2020).max(2100),
  mentor_name: z.string().max(255).optional(),
  mentor_title: z.string().max(255).optional(),
  mentor_expertise: z.string().optional(),
  notes: z.string().optional(),
})

export const updateMentorAssignmentSchema = z.object({
  id: z.string().uuid('Invalid assignment ID'),
  mentor_id: z.string().uuid().optional(),
  mentor_name: z.string().max(255).optional(),
  mentor_title: z.string().max(255).optional(),
  mentor_expertise: z.string().optional(),
  notes: z.string().optional(),
  status: mentorAssignmentStatusSchema.optional(),
})

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

export const aaaPlanFiltersSchema = z.object({
  vertical_id: z.string().uuid().optional(),
  fiscal_year: z.number().int().optional(),
  status: aaaPlanStatusSchema.optional(),
  has_first_event: z.boolean().optional(),
  chapter_id: z.string().uuid().optional(),
})

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type CreateAAAPlanInput = z.infer<typeof createAAAPlanSchema>
export type UpdateAAAPlanInput = z.infer<typeof updateAAAPlanSchema>
export type LockFirstEventInput = z.infer<typeof lockFirstEventSchema>
export type SignCommitmentCardInput = z.infer<typeof signCommitmentCardSchema>
export type UpdateCommitmentCardInput = z.infer<typeof updateCommitmentCardSchema>
export type AssignMentorInput = z.infer<typeof assignMentorSchema>
export type UpdateMentorAssignmentInput = z.infer<typeof updateMentorAssignmentSchema>
export type AAAPlanFilters = z.infer<typeof aaaPlanFiltersSchema>
