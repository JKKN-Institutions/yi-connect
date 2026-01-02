/**
 * Health Card Activity Reporting Module
 * Zod Validation Schemas
 */

import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const submitterRoleSchema = z.enum([
  'chapter_em',
  'chair',
  'co_chair',
  'vertical_head',
  'member',
])

export const aaaTypeSchema = z.enum([
  'awareness',
  'action',
  'advocacy',
])

export const yiRegionSchema = z.enum([
  'east_region',
  'jksn',
  'north_region',
  'south_region',
  'srtn',
  'west_region',
])

// ============================================================================
// HEALTH CARD SCHEMAS
// ============================================================================

export const createHealthCardSchema = z.object({
  // Submitter Info
  submitter_name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name too long'),
  submitter_role: submitterRoleSchema,
  email: z
    .string()
    .email('Invalid email address'),

  // Activity Info
  activity_date: z
    .string()
    .min(1, 'Activity date is required'),
  activity_name: z
    .string()
    .min(1, 'Activity name is required')
    .max(500, 'Activity name too long'),
  activity_description: z
    .string()
    .max(2000, 'Description too long')
    .optional(),

  // AAA Classification (optional)
  aaa_type: aaaTypeSchema.optional().nullable(),

  // Chapter/Region
  chapter_id: z
    .string()
    .uuid('Invalid chapter ID'),
  region: yiRegionSchema,

  // Participation
  ec_members_count: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),
  non_ec_members_count: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),

  // Vertical
  vertical_id: z
    .string()
    .uuid('Invalid vertical ID'),

  // Vertical-specific data (flexible JSONB)
  vertical_specific_data: z
    .record(z.string(), z.unknown())
    .optional(),
})

export const updateHealthCardSchema = z.object({
  id: z.string().uuid('Invalid entry ID'),

  // All fields optional for update
  submitter_name: z.string().max(255).optional(),
  submitter_role: submitterRoleSchema.optional(),
  email: z.string().email().optional(),
  activity_date: z.string().optional(),
  activity_name: z.string().max(500).optional(),
  activity_description: z.string().max(2000).optional().nullable(),
  aaa_type: aaaTypeSchema.optional().nullable(),
  chapter_id: z.string().uuid().optional(),
  region: yiRegionSchema.optional(),
  ec_members_count: z.number().int().min(0).optional(),
  non_ec_members_count: z.number().int().min(0).optional(),
  vertical_id: z.string().uuid().optional(),
  vertical_specific_data: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const healthCardFiltersSchema = z.object({
  chapter_id: z.string().uuid().optional(),
  vertical_id: z.string().uuid().optional(),
  region: yiRegionSchema.optional(),
  fiscal_year: z.number().int().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  submitter_role: submitterRoleSchema.optional(),
})

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type CreateHealthCardInput = z.infer<typeof createHealthCardSchema>
export type UpdateHealthCardInput = z.infer<typeof updateHealthCardSchema>
export type HealthCardFilters = z.infer<typeof healthCardFiltersSchema>
