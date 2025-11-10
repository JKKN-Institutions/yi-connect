/**
 * Member Validation Schemas
 *
 * Zod validation schemas for Member Intelligence Hub operations.
 */

import { z } from 'zod'
import {
  MEMBERSHIP_STATUSES,
  PROFICIENCY_LEVELS,
  AVAILABILITY_STATUSES,
  GENDERS,
} from '@/types/member'

// ============================================================================
// Helper Schemas
// ============================================================================

const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/
const urlRegex = /^https?:\/\/.+/
const pincodeRegex = /^[0-9]{6}$/

export const communicationPreferencesSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
})

export const timeSlotSchema = z.object({
  morning: z.enum(['available', 'busy', 'unavailable']).optional(),
  afternoon: z.enum(['available', 'busy', 'unavailable']).optional(),
  evening: z.enum(['available', 'busy', 'unavailable']).optional(),
})

// ============================================================================
// Member Schemas
// ============================================================================

export const createMemberSchema = z.object({
  // Profile info (inherited from signup)
  id: z.string().uuid({ message: 'Invalid user ID' }),
  email: z.string().email({ message: 'Invalid email address' }),
  full_name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  phone: z
    .string()
    .regex(phoneRegex, { message: 'Invalid phone number' })
    .optional()
    .or(z.literal('')),

  // Member-specific info
  chapter_id: z.string().uuid({ message: 'Invalid chapter ID' }).optional(),
  membership_number: z.string().optional().or(z.literal('')),
  member_since: z.string().date({ message: 'Invalid date format' }).optional(),
  membership_status: z.enum(MEMBERSHIP_STATUSES as [string, ...string[]]).optional(),

  // Professional info
  company: z.string().max(200).optional().or(z.literal('')),
  designation: z.string().max(200).optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  years_of_experience: z
    .number()
    .int()
    .min(0, { message: 'Experience must be 0 or greater' })
    .max(70, { message: 'Experience must be less than 70 years' })
    .optional(),
  linkedin_url: z
    .string()
    .regex(urlRegex, { message: 'Invalid URL format' })
    .optional()
    .or(z.literal('')),

  // Personal info
  date_of_birth: z.string().date({ message: 'Invalid date format' }).optional(),
  gender: z.enum(GENDERS as [string, ...string[]]).optional(),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  pincode: z
    .string()
    .regex(pincodeRegex, { message: 'Pincode must be 6 digits' })
    .optional()
    .or(z.literal('')),

  // Emergency contact
  emergency_contact_name: z.string().max(200).optional().or(z.literal('')),
  emergency_contact_phone: z
    .string()
    .regex(phoneRegex, { message: 'Invalid phone number' })
    .optional()
    .or(z.literal('')),
  emergency_contact_relationship: z.string().max(100).optional().or(z.literal('')),

  // Preferences
  interests: z.array(z.string()).optional(),
  preferred_event_types: z.array(z.string()).optional(),
  communication_preferences: communicationPreferencesSchema.optional(),

  notes: z.string().max(1000).optional().or(z.literal('')),
})

export const updateMemberSchema = z
  .object({
    id: z.string().uuid({ message: 'Invalid member ID' }),
  })
  .and(createMemberSchema.partial().omit({ id: true, email: true }))

// ============================================================================
// Member Skill Schemas
// ============================================================================

export const addMemberSkillSchema = z.object({
  member_id: z.string().uuid({ message: 'Invalid member ID' }),
  skill_id: z.string().uuid({ message: 'Invalid skill ID' }),
  proficiency: z.enum(PROFICIENCY_LEVELS as [string, ...string[]], {
    message: 'Invalid proficiency level',
  }),
  years_of_experience: z
    .number()
    .int()
    .min(0, { message: 'Experience must be 0 or greater' })
    .max(50, { message: 'Experience must be less than 50 years' })
    .optional(),
  is_willing_to_mentor: z.boolean().optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const updateMemberSkillSchema = z.object({
  id: z.string().uuid({ message: 'Invalid member skill ID' }),
  proficiency: z.enum(PROFICIENCY_LEVELS as [string, ...string[]]).optional(),
  years_of_experience: z
    .number()
    .int()
    .min(0, { message: 'Experience must be 0 or greater' })
    .max(50, { message: 'Experience must be less than 50 years' })
    .optional(),
  is_willing_to_mentor: z.boolean().optional(),
  notes: z.string().max(500).optional(),
})

export const deleteMemberSkillSchema = z.object({
  id: z.string().uuid({ message: 'Invalid member skill ID' }),
})

// ============================================================================
// Member Certification Schemas
// ============================================================================

export const addMemberCertificationSchema = z
  .object({
    member_id: z.string().uuid({ message: 'Invalid member ID' }),
    certification_id: z.string().uuid({ message: 'Invalid certification ID' }),
    certificate_number: z.string().max(100).optional().or(z.literal('')),
    issued_date: z.string().date({ message: 'Invalid date format' }),
    expiry_date: z.string().date({ message: 'Invalid date format' }).optional(),
    document_url: z
      .string()
      .regex(urlRegex, { message: 'Invalid URL format' })
      .optional()
      .or(z.literal('')),
    notes: z.string().max(500).optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.expiry_date && data.issued_date) {
        return new Date(data.expiry_date) > new Date(data.issued_date)
      }
      return true
    },
    {
      message: 'Expiry date must be after issued date',
      path: ['expiry_date'],
    }
  )

export const updateMemberCertificationSchema = z
  .object({
    id: z.string().uuid({ message: 'Invalid member certification ID' }),
    certificate_number: z.string().max(100).optional(),
    issued_date: z.string().date({ message: 'Invalid date format' }).optional(),
    expiry_date: z.string().date({ message: 'Invalid date format' }).optional(),
    document_url: z.string().regex(urlRegex, { message: 'Invalid URL format' }).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.expiry_date && data.issued_date) {
        return new Date(data.expiry_date) > new Date(data.issued_date)
      }
      return true
    },
    {
      message: 'Expiry date must be after issued date',
      path: ['expiry_date'],
    }
  )

export const deleteMemberCertificationSchema = z.object({
  id: z.string().uuid({ message: 'Invalid member certification ID' }),
})

// ============================================================================
// Availability Schemas
// ============================================================================

export const setAvailabilitySchema = z.object({
  member_id: z.string().uuid({ message: 'Invalid member ID' }),
  date: z.string().date({ message: 'Invalid date format' }),
  status: z.enum(AVAILABILITY_STATUSES as [string, ...string[]], {
    message: 'Invalid availability status',
  }),
  time_slots: timeSlotSchema.optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export const deleteAvailabilitySchema = z.object({
  id: z.string().uuid({ message: 'Invalid availability ID' }),
})

// ============================================================================
// Skill Schemas
// ============================================================================

export const createSkillSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Skill name must be at least 2 characters' })
    .max(100, { message: 'Skill name must not exceed 100 characters' }),
  category: z.enum(['technical', 'business', 'creative', 'leadership', 'communication', 'other'], {
    message: 'Invalid skill category',
  }),
  description: z.string().max(500).optional().or(z.literal('')),
  is_active: z.boolean().optional(),
})

export const updateSkillSchema = z.object({
  id: z.string().uuid({ message: 'Invalid skill ID' }),
  name: z.string().min(2).max(100).optional(),
  category: z
    .enum(['technical', 'business', 'creative', 'leadership', 'communication', 'other'])
    .optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
})

export const deleteSkillSchema = z.object({
  id: z.string().uuid({ message: 'Invalid skill ID' }),
})

// ============================================================================
// Certification Schemas
// ============================================================================

export const createCertificationSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Certification name must be at least 2 characters' })
    .max(200, { message: 'Certification name must not exceed 200 characters' }),
  issuing_organization: z
    .string()
    .min(2, { message: 'Organization name must be at least 2 characters' })
    .max(200, { message: 'Organization name must not exceed 200 characters' }),
  description: z.string().max(500).optional().or(z.literal('')),
  validity_period_months: z
    .number()
    .int()
    .min(1, { message: 'Validity period must be at least 1 month' })
    .max(120, { message: 'Validity period must not exceed 120 months' })
    .optional(),
  is_active: z.boolean().optional(),
})

export const updateCertificationSchema = z.object({
  id: z.string().uuid({ message: 'Invalid certification ID' }),
  name: z.string().min(2).max(200).optional(),
  issuing_organization: z.string().min(2).max(200).optional(),
  description: z.string().max(500).optional(),
  validity_period_months: z.number().int().min(1).max(120).optional(),
  is_active: z.boolean().optional(),
})

export const deleteCertificationSchema = z.object({
  id: z.string().uuid({ message: 'Invalid certification ID' }),
})

// ============================================================================
// Filter & Query Schemas
// ============================================================================

export const memberFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  membership_status: z.array(z.enum(MEMBERSHIP_STATUSES as [string, ...string[]])).optional(),
  skills: z.array(z.string().uuid()).optional(),
  min_engagement_score: z.number().int().min(0).max(100).optional(),
  max_engagement_score: z.number().int().min(0).max(100).optional(),
  min_readiness_score: z.number().int().min(0).max(100).optional(),
  max_readiness_score: z.number().int().min(0).max(100).optional(),
  availability_status: z.array(z.enum(AVAILABILITY_STATUSES as [string, ...string[]])).optional(),
  city: z.array(z.string()).optional(),
  company: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const memberSortSchema = z.object({
  field: z.enum(['full_name', 'member_since', 'engagement_score', 'readiness_score', 'company']),
  direction: z.enum(['asc', 'desc']),
})

export const memberQueryParamsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  filters: memberFiltersSchema.optional(),
  sort: memberSortSchema.optional(),
})

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type CreateMemberInput = z.infer<typeof createMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
export type AddMemberSkillInput = z.infer<typeof addMemberSkillSchema>
export type UpdateMemberSkillInput = z.infer<typeof updateMemberSkillSchema>
export type AddMemberCertificationInput = z.infer<typeof addMemberCertificationSchema>
export type UpdateMemberCertificationInput = z.infer<typeof updateMemberCertificationSchema>
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>
export type CreateSkillInput = z.infer<typeof createSkillSchema>
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>
export type CreateCertificationInput = z.infer<typeof createCertificationSchema>
export type UpdateCertificationInput = z.infer<typeof updateCertificationSchema>
export type MemberFilters = z.infer<typeof memberFiltersSchema>
export type MemberSort = z.infer<typeof memberSortSchema>
export type MemberQueryParams = z.infer<typeof memberQueryParamsSchema>
