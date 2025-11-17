// ============================================================================
// Module 7: Communication Hub - Zod Validation Schemas
// ============================================================================
// Description: Comprehensive validation schemas for all Communication Hub forms
//              and API inputs using Zod v4
// Version: 1.0
// Created: 2025-11-17
// ============================================================================

import { z } from 'zod';
import {
  ANNOUNCEMENT_CHANNELS,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_PRIORITIES,
  NOTIFICATION_CATEGORIES,
  TEMPLATE_TYPES,
  NEWSLETTER_STATUSES,
  AUTOMATION_TRIGGER_TYPES,
} from '@/types/communication';

// ============================================================================
// ANNOUNCEMENT SCHEMAS
// ============================================================================

// Audience filter schema (JSONB structure)
export const audienceFilterSchema = z.object({
  roles: z.array(z.string()).optional(),
  engagement: z.object({
    min: z.number().min(0).max(100).optional(),
    max: z.number().min(0).max(100).optional(),
  }).optional(),
  leadership_readiness: z.object({
    min: z.number().min(0).max(100).optional(),
    max: z.number().min(0).max(100).optional(),
  }).optional(),
  member_status: z.array(z.string()).optional(),
  membership_type: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  joined_after: z.string().datetime().optional(),
  joined_before: z.string().datetime().optional(),
  has_skills: z.array(z.string()).optional(),
  attended_event_types: z.array(z.string()).optional(),
  last_event_attendance: z.object({
    within_days: z.number().positive().optional(),
  }).optional(),
  vertical_interests: z.array(z.string()).optional(),
  custom_filters: z.record(z.string(), z.any()).optional(),
  include_members: z.array(z.string().uuid()).optional(),
  exclude_members: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => {
    // If engagement filter is set, min must be less than or equal to max
    if (data.engagement?.min !== undefined && data.engagement?.max !== undefined) {
      return data.engagement.min <= data.engagement.max;
    }
    return true;
  },
  { message: 'Engagement min must be less than or equal to max' }
);

export const createAnnouncementSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters'),
  content: z.string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must not exceed 10,000 characters'),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS))
    .min(1, 'At least one channel must be selected')
    .refine(
      (channels) => {
        // Ensure no duplicates
        return new Set(channels).size === channels.length;
      },
      { message: 'Duplicate channels are not allowed' }
    ),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
  audience_filter: audienceFilterSchema.optional(),
  segment_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime().optional().refine(
    (date) => {
      if (!date) return true;
      return new Date(date) > new Date();
    },
    { message: 'Scheduled time must be in the future' }
  ),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => {
    // Either audience_filter or segment_id should be provided, not both
    const hasFilter = data.audience_filter !== undefined;
    const hasSegment = data.segment_id !== undefined;
    return !(hasFilter && hasSegment);
  },
  { message: 'Cannot use both audience_filter and segment_id. Choose one.' }
);

export const updateAnnouncementSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters')
    .optional(),
  content: z.string()
    .min(10, 'Content must be at least 10 characters')
    .max(10000, 'Content must not exceed 10,000 characters')
    .optional(),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS))
    .min(1, 'At least one channel must be selected')
    .optional(),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
  audience_filter: audienceFilterSchema.optional(),
  segment_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime().optional().refine(
    (date) => {
      if (!date) return true;
      return new Date(date) > new Date();
    },
    { message: 'Scheduled time must be in the future' }
  ),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const sendAnnouncementSchema = z.object({
  announcement_id: z.string().uuid(),
});

export const scheduleAnnouncementSchema = z.object({
  announcement_id: z.string().uuid(),
  scheduled_at: z.string().datetime().refine(
    (date) => new Date(date) > new Date(),
    { message: 'Scheduled time must be in the future' }
  ),
});

export const cancelAnnouncementSchema = z.object({
  announcement_id: z.string().uuid(),
  reason: z.string().min(3).max(500).optional(),
});

export const deleteAnnouncementSchema = z.object({
  announcement_id: z.string().uuid(),
});

export const duplicateAnnouncementSchema = z.object({
  announcement_id: z.string().uuid(),
  new_title: z.string().min(3).max(200).optional(),
});

// ============================================================================
// TEMPLATE SCHEMAS
// ============================================================================

export const createTemplateSchema = z.object({
  name: z.string()
    .min(3, 'Template name must be at least 3 characters')
    .max(200, 'Template name must not exceed 200 characters'),
  type: z.enum(TEMPLATE_TYPES),
  content_template: z.string()
    .min(10, 'Template content must be at least 10 characters')
    .max(10000, 'Template content must not exceed 10,000 characters'),
  default_channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS))
    .default(['in_app']),
  category: z.string().max(50).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string()
    .min(3, 'Template name must be at least 3 characters')
    .max(200, 'Template name must not exceed 200 characters')
    .optional(),
  type: z.enum(TEMPLATE_TYPES).optional(),
  content_template: z.string()
    .min(10, 'Template content must be at least 10 characters')
    .max(10000, 'Template content must not exceed 10,000 characters')
    .optional(),
  default_channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS)).optional(),
  category: z.string().max(50).optional(),
});

export const deleteTemplateSchema = z.object({
  template_id: z.string().uuid(),
});

export const duplicateTemplateSchema = z.object({
  template_id: z.string().uuid(),
  new_name: z.string().min(3).max(200),
});

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

export const createNotificationSchema = z.object({
  member_id: z.string().uuid(),
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters'),
  message: z.string()
    .min(3, 'Message must be at least 3 characters')
    .max(1000, 'Message must not exceed 1,000 characters'),
  category: z.enum(NOTIFICATION_CATEGORIES),
  action_url: z.string().url().max(500).optional().or(z.literal('')),
  metadata: z.record(z.string(), z.any()).optional(),
  expires_at: z.string().datetime().optional().refine(
    (date) => {
      if (!date) return true;
      return new Date(date) > new Date();
    },
    { message: 'Expiry time must be in the future' }
  ),
});

export const markNotificationReadSchema = z.object({
  notification_id: z.string().uuid(),
});

export const markAllNotificationsReadSchema = z.object({
  member_id: z.string().uuid(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
});

export const deleteNotificationSchema = z.object({
  notification_id: z.string().uuid(),
});

export const bulkDeleteNotificationsSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1).max(100),
});

// ============================================================================
// NEWSLETTER SCHEMAS
// ============================================================================

export const newsletterSectionSchema = z.object({
  id: z.string(),
  type: z.enum(['events', 'awards', 'achievements', 'article', 'custom']),
  title: z.string().min(3).max(200),
  content: z.union([z.string(), z.record(z.string(), z.any())]),
  order: z.number().int().min(0),
});

export const newsletterContentSchema = z.object({
  sections: z.array(newsletterSectionSchema),
  events: z.array(z.any()).optional(),
  awards: z.array(z.any()).optional(),
  achievements: z.array(z.any()).optional(),
});

export const createNewsletterSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters'),
  edition_number: z.number().int().positive(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  content: newsletterContentSchema,
  chair_message: z.string().max(5000).optional(),
  chair_image_url: z.string().url().max(500).optional(),
});

export const updateNewsletterSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters')
    .optional(),
  content: newsletterContentSchema.optional(),
  chair_message: z.string().max(5000).optional(),
  chair_image_url: z.string().url().max(500).optional(),
});

export const publishNewsletterSchema = z.object({
  newsletter_id: z.string().uuid(),
});

export const sendNewsletterSchema = z.object({
  newsletter_id: z.string().uuid(),
  recipient_segment_id: z.string().uuid().optional(),
});

export const generateNewsletterPDFSchema = z.object({
  newsletter_id: z.string().uuid(),
});

export const deleteNewsletterSchema = z.object({
  newsletter_id: z.string().uuid(),
});

// ============================================================================
// SEGMENT SCHEMAS
// ============================================================================

export const createSegmentSchema = z.object({
  name: z.string()
    .min(3, 'Segment name must be at least 3 characters')
    .max(200, 'Segment name must not exceed 200 characters'),
  description: z.string().max(1000).optional(),
  filter_rules: audienceFilterSchema,
});

export const updateSegmentSchema = z.object({
  name: z.string()
    .min(3, 'Segment name must be at least 3 characters')
    .max(200, 'Segment name must not exceed 200 characters')
    .optional(),
  description: z.string().max(1000).optional(),
  filter_rules: audienceFilterSchema.optional(),
});

export const deleteSegmentSchema = z.object({
  segment_id: z.string().uuid(),
});

export const calculateSegmentSizeSchema = z.object({
  filter_rules: audienceFilterSchema,
});

export const previewSegmentMembersSchema = z.object({
  filter_rules: audienceFilterSchema,
  limit: z.number().int().min(1).max(100).default(10),
});

// ============================================================================
// AUTOMATION RULE SCHEMAS
// ============================================================================

export const automationConditionsSchema = z.object({
  birthday: z.object({
    send_at_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:mm
    days_before: z.number().int().min(0).max(30).optional(),
  }).optional(),

  event_reminder: z.object({
    hours_before: z.number().int().min(1).max(168).optional(), // Max 1 week
    event_types: z.array(z.string()).optional(),
  }).optional(),

  new_member: z.object({
    delay_hours: z.number().int().min(0).max(168).optional(), // Max 1 week delay
  }).optional(),

  low_engagement: z.object({
    threshold: z.number().int().min(0).max(100).optional(),
    inactive_days: z.number().int().min(1).max(365).optional(),
  }).optional(),

  newsletter_reminder: z.object({
    day_of_month: z.number().int().min(1).max(31).optional(),
  }).optional(),

  budget_alert: z.object({
    utilization_threshold: z.number().int().min(1).max(100).default(80),
  }).optional(),

  expense_approval: z.object({
    min_amount: z.number().positive().optional(),
  }).optional(),

  custom: z.record(z.string(), z.any()).optional(),
});

export const createAutomationRuleSchema = z.object({
  name: z.string()
    .min(3, 'Rule name must be at least 3 characters')
    .max(200, 'Rule name must not exceed 200 characters'),
  trigger_type: z.enum(AUTOMATION_TRIGGER_TYPES),
  conditions: automationConditionsSchema,
  template_id: z.string().uuid(),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS))
    .min(1, 'At least one channel must be selected'),
  enabled: z.boolean().default(true),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string()
    .min(3, 'Rule name must be at least 3 characters')
    .max(200, 'Rule name must not exceed 200 characters')
    .optional(),
  conditions: automationConditionsSchema.optional(),
  template_id: z.string().uuid().optional(),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS))
    .min(1, 'At least one channel must be selected')
    .optional(),
  enabled: z.boolean().optional(),
});

export const toggleAutomationRuleSchema = z.object({
  rule_id: z.string().uuid(),
  enabled: z.boolean(),
});

export const deleteAutomationRuleSchema = z.object({
  rule_id: z.string().uuid(),
});

export const runAutomationRuleSchema = z.object({
  rule_id: z.string().uuid(),
  test_mode: z.boolean().default(false), // If true, don't actually send
});

// ============================================================================
// FILTER SCHEMAS (for data tables)
// ============================================================================

export const announcementFiltersSchema = z.object({
  status: z.array(z.enum(ANNOUNCEMENT_STATUSES)).optional(),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS)).optional(),
  created_by: z.array(z.string().uuid()).optional(),
  scheduled_after: z.string().datetime().optional(),
  scheduled_before: z.string().datetime().optional(),
  sent_after: z.string().datetime().optional(),
  sent_before: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
});

export const notificationFiltersSchema = z.object({
  category: z.array(z.enum(NOTIFICATION_CATEGORIES)).optional(),
  read: z.boolean().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
});

export const templateFiltersSchema = z.object({
  type: z.array(z.enum(TEMPLATE_TYPES)).optional(),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS)).optional(),
  search: z.string().max(200).optional(),
});

export const newsletterFiltersSchema = z.object({
  status: z.array(z.enum(NEWSLETTER_STATUSES)).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  search: z.string().max(200).optional(),
});

export const segmentFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  created_by: z.array(z.string().uuid()).optional(),
});

export const automationRuleFiltersSchema = z.object({
  trigger_type: z.array(z.enum(AUTOMATION_TRIGGER_TYPES)).optional(),
  enabled: z.boolean().optional(),
  search: z.string().max(200).optional(),
});

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// RECIPIENT SCHEMAS
// ============================================================================

export const createRecipientSchema = z.object({
  announcement_id: z.string().uuid(),
  member_id: z.string().uuid(),
  channel: z.enum(ANNOUNCEMENT_CHANNELS),
});

export const updateRecipientStatusSchema = z.object({
  recipient_id: z.string().uuid(),
  status: z.enum(['queued', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced']),
  failed_reason: z.string().max(500).optional(),
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

export const analyticsDateRangeSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
}).refine(
  (data) => new Date(data.start_date) < new Date(data.end_date),
  { message: 'Start date must be before end date' }
);

export const communicationAnalyticsQuerySchema = z.object({
  chapter_id: z.string().uuid(),
  date_range: analyticsDateRangeSchema.optional(),
  channels: z.array(z.enum(ANNOUNCEMENT_CHANNELS)).optional(),
});

export const channelPerformanceQuerySchema = z.object({
  chapter_id: z.string().uuid(),
  channel: z.enum(ANNOUNCEMENT_CHANNELS),
  date_range: analyticsDateRangeSchema.optional(),
});

// ============================================================================
// BULK OPERATION SCHEMAS
// ============================================================================

export const bulkSendAnnouncementsSchema = z.object({
  announcement_ids: z.array(z.string().uuid()).min(1).max(50),
});

export const bulkCancelAnnouncementsSchema = z.object({
  announcement_ids: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().min(3).max(500).optional(),
});

export const bulkDeleteAnnouncementsSchema = z.object({
  announcement_ids: z.array(z.string().uuid()).min(1).max(50),
});

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

export const exportAnnouncementsSchema = z.object({
  announcement_ids: z.array(z.string().uuid()).optional(), // If empty, export all
  format: z.enum(['csv', 'xlsx', 'json']).default('csv'),
  include_analytics: z.boolean().default(true),
});

export const exportNotificationsSchema = z.object({
  member_id: z.string().uuid().optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  format: z.enum(['csv', 'xlsx', 'json']).default('csv'),
  date_range: analyticsDateRangeSchema.optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type CreateNewsletterInput = z.infer<typeof createNewsletterSchema>;
export type UpdateNewsletterInput = z.infer<typeof updateNewsletterSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
export type AudienceFilter = z.infer<typeof audienceFilterSchema>;
export type AutomationConditions = z.infer<typeof automationConditionsSchema>;
export type AnnouncementFilters = z.infer<typeof announcementFiltersSchema>;
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;
export type TemplateFilters = z.infer<typeof templateFiltersSchema>;
export type NewsletterFilters = z.infer<typeof newsletterFiltersSchema>;
export type SegmentFilters = z.infer<typeof segmentFiltersSchema>;
export type AutomationRuleFilters = z.infer<typeof automationRuleFiltersSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validate and parse form data
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed and validated data or error
 */
export function validateFormData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        success: false,
        error: `${firstError.path.join('.')}: ${firstError.message}`,
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Safe parse with default value
 * @param schema - Zod schema
 * @param data - Data to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed data or default value
 */
export function safeParseWithDefault<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  defaultValue: z.infer<T>
): z.infer<T> {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}

// ============================================================================
// END OF VALIDATION SCHEMAS
// ============================================================================
