/**
 * Profile Validation Schemas
 *
 * Zod schemas for profile operations
 */

import { z } from 'zod'

/**
 * Update Profile Schema
 *
 * Validation for updating user profile information
 */
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  phone: z
    .string()
    .regex(/^[\d\s\-+()]*$/, 'Invalid phone number format')
    .min(10, 'Phone number must be at least 10 digits')
    .max(20, 'Phone number must be less than 20 characters')
    .optional()
    .or(z.literal('')),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
