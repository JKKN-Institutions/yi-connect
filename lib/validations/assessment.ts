/**
 * Skill-Will Assessment Validation Schemas
 *
 * Zod schemas for validating assessment inputs.
 */

import { z } from 'zod'

// ============================================================================
// Base Enums
// ============================================================================

export const assessmentStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'expired'])

export const skillWillCategorySchema = z.enum(['star', 'enthusiast', 'cynic', 'dead_wood'])

export const energyFocusSchema = z.enum([
  'teaching_mentoring',
  'organizing_events',
  'corporate_partnerships',
  'fieldwork',
  'creative_work',
])

export const ageGroupSchema = z.enum([
  'children_5_12',
  'teenagers_15_22',
  'adults_25_plus',
  'all_ages',
])

export const skillLevelSchema = z.enum(['none', 'beginner', 'intermediate', 'expert'])

export const timeCommitmentSchema = z.enum([
  'under_2_hours',
  'hours_5_10',
  'hours_10_15',
  'hours_15_plus',
])

export const travelWillingnessSchema = z.enum([
  'city_only',
  'district',
  'neighboring',
  'all_state',
])

// ============================================================================
// Supporting Schemas
// ============================================================================

export const alternativeVerticalSchema = z.object({
  vertical_id: z.string().uuid(),
  vertical_name: z.string(),
  match_pct: z.number().min(0).max(100),
  reason: z.string(),
})

export const roadmapMilestoneSchema = z.object({
  month: z.number().int().min(1).max(6),
  title: z.string().min(1, 'Milestone title is required'),
  description: z.string(),
  tasks: z.array(z.string()),
  completed: z.boolean().default(false),
  completed_at: z.string().datetime().optional(),
})

// ============================================================================
// Action Schemas
// ============================================================================

/**
 * Schema for starting a new assessment
 */
export const startAssessmentSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
  chapter_id: z.string().uuid('Invalid chapter ID'),
})

/**
 * Schema for updating assessment answers (wizard step)
 */
export const updateAssessmentAnswersSchema = z.object({
  id: z.string().uuid('Invalid assessment ID'),
  q1_energy_focus: energyFocusSchema.optional(),
  q2_age_group: ageGroupSchema.optional(),
  q3_skill_level: skillLevelSchema.optional(),
  q4_time_commitment: timeCommitmentSchema.optional(),
  q5_travel_willingness: travelWillingnessSchema.optional(),
})

/**
 * Schema for completing an assessment
 */
export const completeAssessmentSchema = z.object({
  id: z.string().uuid('Invalid assessment ID'),
  accept_ai_suggestion_q1: z.boolean().optional(),
  accept_ai_suggestion_q2: z.boolean().optional(),
})

/**
 * Schema for assigning a vertical to a member
 */
export const assignVerticalSchema = z.object({
  assessment_id: z.string().uuid('Invalid assessment ID'),
  vertical_id: z.string().uuid('Invalid vertical ID'),
  assigned_by: z.string().uuid('Invalid assigner ID'),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

/**
 * Schema for assigning a mentor to a member
 */
export const assignMentorSchema = z.object({
  assessment_id: z.string().uuid('Invalid assessment ID'),
  mentor_id: z.string().uuid('Invalid mentor ID'),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
})

/**
 * Schema for updating the development roadmap
 */
export const updateRoadmapSchema = z.object({
  assessment_id: z.string().uuid('Invalid assessment ID'),
  roadmap: z.array(roadmapMilestoneSchema).min(1).max(6),
})

/**
 * Schema for the wizard step 1 (energy focus)
 */
export const wizardStep1Schema = z.object({
  energy_focus: energyFocusSchema,
})

/**
 * Schema for the wizard step 2 (age group)
 */
export const wizardStep2Schema = z.object({
  age_group: ageGroupSchema,
})

/**
 * Schema for the wizard step 3 (skill level)
 */
export const wizardStep3Schema = z.object({
  skill_level: skillLevelSchema,
})

/**
 * Schema for the wizard step 4 (time commitment)
 */
export const wizardStep4Schema = z.object({
  time_commitment: timeCommitmentSchema,
})

/**
 * Schema for the wizard step 5 (travel willingness)
 */
export const wizardStep5Schema = z.object({
  travel_willingness: travelWillingnessSchema,
})

/**
 * Schema for the complete wizard form (all steps)
 */
export const completeWizardSchema = z.object({
  energy_focus: energyFocusSchema,
  age_group: ageGroupSchema,
  skill_level: skillLevelSchema,
  time_commitment: timeCommitmentSchema,
  travel_willingness: travelWillingnessSchema,
})

// ============================================================================
// Type Exports
// ============================================================================

export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>
export type UpdateAssessmentAnswersInput = z.infer<typeof updateAssessmentAnswersSchema>
export type CompleteAssessmentInput = z.infer<typeof completeAssessmentSchema>
export type AssignVerticalInput = z.infer<typeof assignVerticalSchema>
export type AssignMentorInput = z.infer<typeof assignMentorSchema>
export type UpdateRoadmapInput = z.infer<typeof updateRoadmapSchema>
export type WizardStep1Input = z.infer<typeof wizardStep1Schema>
export type WizardStep2Input = z.infer<typeof wizardStep2Schema>
export type WizardStep3Input = z.infer<typeof wizardStep3Schema>
export type WizardStep4Input = z.infer<typeof wizardStep4Schema>
export type WizardStep5Input = z.infer<typeof wizardStep5Schema>
export type CompleteWizardInput = z.infer<typeof completeWizardSchema>
