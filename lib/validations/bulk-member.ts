/**
 * Bulk Member Validation Schemas
 *
 * Zod validation schemas for bulk member upload operations.
 */

import { z } from 'zod'

// Phone regex that allows various formats
const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
const urlRegex = /^https?:\/\/.+/
const pincodeRegex = /^[0-9]{6}$/

/**
 * Schema for a single member row from bulk upload
 */
export const bulkMemberRowSchema = z.object({
  // Required fields
  email: z
    .string()
    .email({ message: 'Invalid email address' })
    .transform(val => val.toLowerCase().trim()),
  full_name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters' })
    .max(200, { message: 'Name must not exceed 200 characters' }),

  // Optional fields
  phone: z
    .string()
    .optional()
    .nullable()
    .transform(val => val || null),

  // Professional info
  company: z.string().max(200).optional().nullable(),
  designation: z.string().max(200).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  years_of_experience: z
    .number()
    .int()
    .min(0, { message: 'Experience must be 0 or greater' })
    .max(70, { message: 'Experience must be less than 70 years' })
    .optional()
    .nullable(),
  linkedin_url: z
    .string()
    .optional()
    .nullable()
    .transform(val => {
      if (!val) return null
      // Add https:// if missing
      if (val && !val.startsWith('http')) {
        return `https://${val}`
      }
      return val
    }),

  // Personal info
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable().default('India'),
  pincode: z.string().optional().nullable(),

  // Emergency contact
  emergency_contact_name: z.string().max(200).optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  emergency_contact_relationship: z.string().max(100).optional().nullable(),

  // Membership
  membership_number: z.string().max(50).optional().nullable(),
  member_since: z.string().optional().nullable(),
  membership_status: z
    .enum(['active', 'inactive', 'suspended', 'alumni'])
    .optional()
    .nullable()
    .default('active'),

  // Chapter (optional - will use default if not specified)
  chapter_name: z.string().max(200).optional().nullable(),
})

export type BulkMemberRow = z.infer<typeof bulkMemberRowSchema>

/**
 * Validate a single row and return detailed errors
 */
export function validateBulkMemberRow(data: Record<string, any>): {
  success: boolean
  data?: BulkMemberRow
  errors: string[]
} {
  const result = bulkMemberRowSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: []
    }
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.')
    return `${path}: ${issue.message}`
  })

  return {
    success: false,
    errors
  }
}

/**
 * Bulk upload options schema
 */
export const bulkUploadOptionsSchema = z.object({
  skipExisting: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
  sendWelcomeEmail: z.boolean().default(true),
  defaultChapterId: z.string().uuid().optional(),
  defaultMembershipStatus: z.enum(['active', 'inactive', 'suspended', 'alumni']).default('active'),
})

export type BulkUploadOptions = z.infer<typeof bulkUploadOptionsSchema>

/**
 * Bulk upload result types
 */
export interface BulkUploadRowResult {
  rowNumber: number
  email: string
  fullName: string
  status: 'success' | 'skipped' | 'error' | 'updated'
  message: string
  memberId?: string
}

export interface BulkUploadResult {
  success: boolean
  totalProcessed: number
  successCount: number
  skippedCount: number
  errorCount: number
  updatedCount: number
  results: BulkUploadRowResult[]
  errors: string[]
}
