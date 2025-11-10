/**
 * Chapter Validation Schemas
 *
 * Zod schemas for chapter operations
 */

import { z } from 'zod'

/**
 * Create Chapter Schema
 *
 * Validation for creating a new Yi chapter
 */
export const createChapterSchema = z.object({
  name: z
    .string()
    .min(2, 'Chapter name must be at least 2 characters')
    .max(100, 'Chapter name must be less than 100 characters'),
  location: z
    .string()
    .min(2, 'Location must be at least 2 characters')
    .max(200, 'Location must be less than 200 characters'),
  region: z
    .string()
    .min(2, 'Region must be at least 2 characters')
    .max(100, 'Region must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  established_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .optional()
    .or(z.literal('')),
})

/**
 * Update Chapter Schema
 *
 * Validation for updating an existing chapter
 */
export const updateChapterSchema = createChapterSchema.partial()

export type CreateChapterInput = z.infer<typeof createChapterSchema>
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>
