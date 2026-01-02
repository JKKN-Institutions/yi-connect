/**
 * CMP (Common Minimum Program) Targets
 * Zod Validation Schemas
 */

import { z } from 'zod'

// ============================================================================
// CMP TARGET SCHEMAS
// ============================================================================

export const createCMPTargetSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  fiscal_year: z.number().int().min(2020).max(2100).optional(),

  // Target Metrics
  min_activities: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),
  min_participants: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),
  min_ec_participation: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),

  // AAA Breakdown (optional)
  min_awareness_activities: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional(),
  min_action_activities: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional(),
  min_advocacy_activities: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional(),

  // Scope
  chapter_id: z.string().uuid().nullable().optional(),
  is_national_target: z.boolean(),

  // Metadata
  description: z.string().max(1000).optional(),
})

export const updateCMPTargetSchema = z.object({
  id: z.string().uuid('Invalid target ID'),

  min_activities: z.number().int().min(0).optional(),
  min_participants: z.number().int().min(0).optional(),
  min_ec_participation: z.number().int().min(0).optional(),

  min_awareness_activities: z.number().int().min(0).nullable().optional(),
  min_action_activities: z.number().int().min(0).nullable().optional(),
  min_advocacy_activities: z.number().int().min(0).nullable().optional(),

  description: z.string().max(1000).nullable().optional(),
})

export const cmpTargetFiltersSchema = z.object({
  vertical_id: z.string().uuid().optional(),
  fiscal_year: z.number().int().optional(),
  chapter_id: z.string().uuid().optional(),
  is_national_target: z.boolean().optional(),
})

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type CreateCMPTargetSchemaInput = z.infer<typeof createCMPTargetSchema>
export type UpdateCMPTargetSchemaInput = z.infer<typeof updateCMPTargetSchema>
export type CMPTargetFiltersSchemaInput = z.infer<typeof cmpTargetFiltersSchema>
