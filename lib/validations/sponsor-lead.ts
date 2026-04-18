/**
 * Sponsor Lead Validations (Stutzee Feature 3D)
 *
 * Zod schemas for create/update of sponsor leads.
 */

import { z } from 'zod'

const interestLevelEnum = z.enum(['hot', 'warm', 'medium', 'cold'])

const interestAreaEnum = z.enum([
  'hiring',
  'csr',
  'partnership',
  'investment',
  'mentoring',
])

export const createSponsorLeadSchema = z.object({
  event_id: z.string().uuid('Invalid event id'),
  sponsor_id: z.string().uuid('Invalid sponsor id'),
  rsvp_id: z.string().uuid().nullable().optional(),
  guest_rsvp_id: z.string().uuid().nullable().optional(),
  ticket_token: z.string().min(8).max(128).nullable().optional(),
  full_name: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(200, 'Full name must be under 200 characters'),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .max(200)
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(32).nullable().optional().or(z.literal('')),
  company: z.string().trim().max(200).nullable().optional().or(z.literal('')),
  designation: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .or(z.literal('')),
  interest_level: interestLevelEnum.default('medium'),
  interest_areas: z.array(interestAreaEnum).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional().or(z.literal('')),
  follow_up_requested: z.boolean().default(false),
  follow_up_by: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Must be YYYY-MM-DD')
    .nullable()
    .optional()
    .or(z.literal('')),
})

export const updateSponsorLeadSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(200).optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .nullable()
    .optional()
    .or(z.literal('')),
  phone: z.string().trim().max(32).nullable().optional().or(z.literal('')),
  company: z.string().trim().max(200).nullable().optional().or(z.literal('')),
  designation: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .or(z.literal('')),
  interest_level: interestLevelEnum.optional(),
  interest_areas: z.array(interestAreaEnum).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional().or(z.literal('')),
  follow_up_requested: z.boolean().optional(),
  follow_up_by: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .nullable()
    .optional()
    .or(z.literal('')),
})

export type CreateSponsorLeadSchema = z.infer<typeof createSponsorLeadSchema>
export type UpdateSponsorLeadSchema = z.infer<typeof updateSponsorLeadSchema>
