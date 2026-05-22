/**
 * Event Auto-Pilot Validation Schemas
 */

import { z } from 'zod';

export const autopilotSettingsSchema = z.object({
  feedback_reminder_hours: z.number().int().min(0).max(168).default(24),
  auto_log_health_card: z.boolean().default(true),
  points_per_attendance: z.number().int().min(0).max(100).default(10),
  email_chair_summary: z.boolean().default(true),
  whatsapp_reminder: z.boolean().default(true),
});

export type AutopilotSettingsInput = z.infer<typeof autopilotSettingsSchema>;

export const triggerAutopilotSchema = z.object({
  event_id: z.string().uuid(),
});

export type TriggerAutopilotInput = z.infer<typeof triggerAutopilotSchema>;

export const updateAutopilotFeatureSchema = z.object({
  chapter_id: z.string().uuid(),
  is_enabled: z.boolean(),
  settings: autopilotSettingsSchema.optional(),
});

export type UpdateAutopilotFeatureInput = z.infer<
  typeof updateAutopilotFeatureSchema
>;

export const generateQuarterlyReportSchema = z.object({
  chapter_id: z.string().uuid(),
  fiscal_year: z.number().int().min(2020).max(2100),
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export type GenerateQuarterlyReportInput = z.infer<
  typeof generateQuarterlyReportSchema
>;

export const sendReportToNationalSchema = z.object({
  report_id: z.string().uuid(),
  recipient_emails: z.array(z.string().email()).min(1).max(10),
});

export type SendReportToNationalInput = z.infer<
  typeof sendReportToNationalSchema
>;
