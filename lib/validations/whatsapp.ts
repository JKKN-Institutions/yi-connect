/**
 * WhatsApp Validation Schemas
 *
 * Zod schemas for WhatsApp Management module operations
 */

import { z } from 'zod'

// ============================================================================
// Constants for validation
// ============================================================================

export const GROUP_TYPES = ['chapter', 'leadership', 'ec_team', 'yuva', 'thalir', 'fun', 'core', 'other'] as const
export const TEMPLATE_CATEGORIES = ['event', 'announcement', 'reminder', 'follow_up', 'greeting', 'custom'] as const
export const RECIPIENT_TYPES = ['individual', 'group', 'bulk'] as const
export const MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const

// ============================================================================
// WhatsApp Group Schemas
// ============================================================================

/**
 * Create WhatsApp Group Schema
 */
export const createWhatsAppGroupSchema = z.object({
  chapter_id: z.string().uuid('Invalid chapter ID'),
  jid: z
    .string()
    .min(10, 'JID must be at least 10 characters')
    .max(100, 'JID must be less than 100 characters')
    .regex(/^[\d\-@.a-z]+$/, 'Invalid JID format'),
  name: z
    .string()
    .min(2, 'Group name must be at least 2 characters')
    .max(255, 'Group name must be less than 255 characters'),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
  group_type: z.enum(GROUP_TYPES).optional(),
  is_default: z.boolean().optional().default(false),
  member_count: z.number().int().min(0).optional(),
})

/**
 * Update WhatsApp Group Schema
 */
export const updateWhatsAppGroupSchema = z.object({
  id: z.string().uuid('Invalid group ID'),
  name: z
    .string()
    .min(2, 'Group name must be at least 2 characters')
    .max(255, 'Group name must be less than 255 characters')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
  group_type: z.enum(GROUP_TYPES).optional(),
  is_default: z.boolean().optional(),
  member_count: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export type CreateWhatsAppGroupInput = z.infer<typeof createWhatsAppGroupSchema>
export type UpdateWhatsAppGroupInput = z.infer<typeof updateWhatsAppGroupSchema>

// ============================================================================
// WhatsApp Template Schemas
// ============================================================================

/**
 * Create WhatsApp Template Schema
 */
export const createWhatsAppTemplateSchema = z.object({
  chapter_id: z.string().uuid('Invalid chapter ID').nullable().optional(), // null for national templates
  name: z
    .string()
    .min(2, 'Template name must be at least 2 characters')
    .max(100, 'Template name must be less than 100 characters'),
  category: z.enum(TEMPLATE_CATEGORIES, { message: 'Please select a valid category' }),
  content: z
    .string()
    .min(10, 'Template content must be at least 10 characters')
    .max(4000, 'Template content must be less than 4000 characters'),
  variables: z.array(z.string()).optional().default([]),
})

/**
 * Update WhatsApp Template Schema
 */
export const updateWhatsAppTemplateSchema = z.object({
  id: z.string().uuid('Invalid template ID'),
  name: z
    .string()
    .min(2, 'Template name must be at least 2 characters')
    .max(100, 'Template name must be less than 100 characters')
    .optional(),
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  content: z
    .string()
    .min(10, 'Template content must be at least 10 characters')
    .max(4000, 'Template content must be less than 4000 characters')
    .optional(),
  variables: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export type CreateWhatsAppTemplateInput = z.infer<typeof createWhatsAppTemplateSchema>
export type UpdateWhatsAppTemplateInput = z.infer<typeof updateWhatsAppTemplateSchema>

// ============================================================================
// Message Log Schemas
// ============================================================================

/**
 * Log Message Schema
 */
export const logMessageSchema = z.object({
  chapter_id: z.string().uuid('Invalid chapter ID'),
  recipient_type: z.enum(RECIPIENT_TYPES, { message: 'Please select a valid recipient type' }),
  recipient_id: z.string().max(100).optional(),
  recipient_name: z.string().max(255).optional(),
  template_id: z.string().uuid().optional(),
  message_content: z
    .string()
    .min(1, 'Message content is required')
    .max(10000, 'Message too long'),
  status: z.enum(MESSAGE_STATUSES).optional().default('sent'),
  error_message: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type LogMessageInput = z.infer<typeof logMessageSchema>

// ============================================================================
// Compose Form Schemas
// ============================================================================

/**
 * Recipient Schema
 */
export const recipientSchema = z.object({
  type: z.enum(['individual', 'group']),
  id: z.string().min(1, 'Recipient ID is required'),
  name: z.string().min(1, 'Recipient name is required'),
  phone: z.string().optional(),
})

/**
 * Compose Message Schema
 */
export const composeMessageSchema = z.object({
  recipients: z
    .array(recipientSchema)
    .min(1, 'At least one recipient is required'),
  template_id: z.string().uuid().optional(),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(4000, 'Message must be less than 4000 characters'),
  variables: z.record(z.string(), z.string()).optional(),
})

/**
 * Bulk Compose Message Schema
 */
export const bulkComposeMessageSchema = z.object({
  recipient_ids: z
    .array(z.string().uuid())
    .min(1, 'At least one recipient is required')
    .max(100, 'Maximum 100 recipients per bulk message'),
  template_id: z.string().uuid().optional(),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(4000, 'Message must be less than 4000 characters'),
  variables: z.record(z.string(), z.string()).optional(),
})

export type ComposeRecipient = z.infer<typeof recipientSchema>
export type ComposeMessageInput = z.infer<typeof composeMessageSchema>
export type BulkComposeMessageInput = z.infer<typeof bulkComposeMessageSchema>

// ============================================================================
// Filter Schemas
// ============================================================================

/**
 * Group Filters Schema
 */
export const groupFiltersSchema = z.object({
  search: z.string().optional(),
  group_type: z.array(z.enum(GROUP_TYPES)).optional(),
  is_active: z.boolean().optional(),
})

/**
 * Template Filters Schema
 */
export const templateFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.array(z.enum(TEMPLATE_CATEGORIES)).optional(),
  is_national: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

/**
 * Message Log Filters Schema
 */
export const messageLogFiltersSchema = z.object({
  search: z.string().optional(),
  recipient_type: z.array(z.enum(RECIPIENT_TYPES)).optional(),
  status: z.array(z.enum(MESSAGE_STATUSES)).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  sent_by: z.string().uuid().optional(),
})

export type GroupFilters = z.infer<typeof groupFiltersSchema>
export type TemplateFilters = z.infer<typeof templateFiltersSchema>
export type MessageLogFilters = z.infer<typeof messageLogFiltersSchema>

// ============================================================================
// Phone Number Validation
// ============================================================================

/**
 * Phone Number Schema
 * Validates phone numbers for WhatsApp (must be in international format without +)
 */
export const phoneNumberSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be less than 15 digits')
  .regex(/^\d+$/, 'Phone number must contain only digits (no + or spaces)')

/**
 * WhatsApp JID Schema
 * Validates WhatsApp JID format (phone@s.whatsapp.net or groupid@g.us)
 */
export const whatsappJidSchema = z
  .string()
  .regex(
    /^(\d+@s\.whatsapp\.net|[\d\-]+@g\.us)$/,
    'Invalid WhatsApp JID format'
  )

// ============================================================================
// Send Message Schemas (for existing send functionality)
// ============================================================================

/**
 * Send Individual Message Schema
 */
export const sendIndividualMessageSchema = z.object({
  phone: phoneNumberSchema,
  message: z
    .string()
    .min(1, 'Message is required')
    .max(4000, 'Message too long'),
})

/**
 * Send Group Message Schema
 */
export const sendGroupMessageSchema = z.object({
  jid: z
    .string()
    .min(10, 'Group JID is required')
    .regex(/^[\d\-@.a-z]+$/, 'Invalid JID format'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(4000, 'Message too long'),
})

export type SendIndividualMessageInput = z.infer<typeof sendIndividualMessageSchema>
export type SendGroupMessageInput = z.infer<typeof sendGroupMessageSchema>
