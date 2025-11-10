/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for validation across the application.
 */

import { z } from 'zod'

// Email validation
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')

// Password validation
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

// Phone number validation (international format)
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional()

// URL validation
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .optional()
  .or(z.literal(''))

// Date validation
export const dateSchema = z.coerce.date()

// Positive number validation
export const positiveNumberSchema = z.coerce
  .number({ message: 'Must be a valid number' })
  .positive('Must be a positive number')

// Non-negative number validation
export const nonNegativeNumberSchema = z.coerce
  .number({ message: 'Must be a valid number' })
  .nonnegative('Must be a non-negative number')

// Integer validation
export const integerSchema = z.coerce
  .number({ message: 'Must be a valid number' })
  .int('Must be a whole number')

// ID validation (UUID)
export const uuidSchema = z.string().uuid('Invalid ID format')

// Name validation
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name is too long')

// Text area validation
export const textAreaSchema = z
  .string()
  .max(5000, 'Text is too long (maximum 5000 characters)')
  .optional()

// Search query validation
export const searchQuerySchema = z.string().max(255, 'Search query is too long').optional()

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
})

// Sort validation
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
})

// Base filters schema
export const baseFiltersSchema = paginationSchema.merge(sortSchema).extend({
  search: searchQuerySchema,
})

// File upload validation
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const imageFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_FILE_SIZE, 'File size must be less than 5MB')
  .refine(
    (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
    'Only .jpg, .jpeg, .png and .webp formats are supported'
  )

export const documentFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= MAX_FILE_SIZE, 'File size must be less than 5MB')
  .refine(
    (file) => [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOCUMENT_TYPES].includes(file.type),
    'Invalid file type'
  )
