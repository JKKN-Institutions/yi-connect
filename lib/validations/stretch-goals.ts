/**
 * Stretch Goals Validation Schemas
 */

import { z } from 'zod'

// ============================================================================
// CREATE SCHEMA
// ============================================================================

export const createStretchGoalSchema = z.object({
  cmp_target_id: z.string().uuid().nullable().optional(),
  vertical_id: z.string().uuid({ message: 'Please select a vertical' }),
  chapter_id: z.string().uuid().nullable().optional(),
  fiscal_year: z.number().int().min(2020).max(2100).optional(),

  stretch_activities: z
    .number()
    .int()
    .min(1, 'Minimum 1 activity required'),
  stretch_participants: z
    .number()
    .int()
    .min(0, 'Cannot be negative'),
  stretch_ec_participation: z
    .number()
    .int()
    .min(0, 'Cannot be negative'),

  stretch_awareness: z.number().int().min(0).nullable().optional(),
  stretch_action: z.number().int().min(0).nullable().optional(),
  stretch_advocacy: z.number().int().min(0).nullable().optional(),

  name: z.string().max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  reward_description: z.string().max(1000).nullable().optional(),
})

export type CreateStretchGoalSchemaInput = z.input<typeof createStretchGoalSchema>

// ============================================================================
// UPDATE SCHEMA
// ============================================================================

export const updateStretchGoalSchema = z.object({
  id: z.string().uuid(),

  stretch_activities: z
    .number()
    .int()
    .min(1, 'Minimum 1 activity required')
    .optional(),
  stretch_participants: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .optional(),
  stretch_ec_participation: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .optional(),

  stretch_awareness: z.number().int().min(0).nullable().optional(),
  stretch_action: z.number().int().min(0).nullable().optional(),
  stretch_advocacy: z.number().int().min(0).nullable().optional(),

  name: z.string().max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  reward_description: z.string().max(1000).nullable().optional(),
  is_achieved: z.boolean().optional(),
})

export type UpdateStretchGoalSchemaInput = z.infer<typeof updateStretchGoalSchema>
