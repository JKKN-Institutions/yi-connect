// ============================================================================
// Module 10: National Integration Layer - Zod Validation Schemas
// ============================================================================
// Description: Validation schemas for national integration forms and actions
// Version: 1.0
// Created: 2025-11-22
// ============================================================================

import { z } from 'zod';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const syncStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'partial',
  'cancelled'
]);

export const syncDirectionSchema = z.enum([
  'inbound',
  'outbound',
  'bidirectional'
]);

export const syncEntityTypeSchema = z.enum([
  'members',
  'events',
  'financials',
  'awards',
  'projects',
  'verticals',
  'leadership'
]);

export const syncFrequencySchema = z.enum([
  'realtime',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'manual'
]);

export const benchmarkMetricSchema = z.enum([
  'event_count',
  'member_engagement',
  'csr_value',
  'vertical_impact',
  'membership_growth',
  'volunteer_hours',
  'sponsorship_raised',
  'awards_won'
]);

export const benchmarkPeriodSchema = z.enum(['monthly', 'quarterly', 'yearly']);

export const nationalEventTypeSchema = z.enum([
  'rcm',
  'summit',
  'yuva_conclave',
  'national_meet',
  'training',
  'workshop',
  'conference',
  'other'
]);

export const registrationStatusSchema = z.enum([
  'pending',
  'confirmed',
  'waitlisted',
  'cancelled',
  'attended',
  'no_show'
]);

export const broadcastPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const broadcastTypeSchema = z.enum([
  'announcement',
  'directive',
  'update',
  'alert',
  'newsletter'
]);

export const conflictTypeSchema = z.enum([
  'data_mismatch',
  'version_conflict',
  'missing_local',
  'missing_national',
  'schema_change'
]);

export const conflictResolutionSchema = z.enum([
  'pending',
  'keep_local',
  'accept_national',
  'merged',
  'ignored'
]);

// ============================================================================
// SYNC CONFIG SCHEMAS
// ============================================================================

export const entitySyncSettingsSchema = z.object({
  enabled: z.boolean(),
  frequency: syncFrequencySchema
});

export const entitySyncConfigSchema = z.object({
  members: entitySyncSettingsSchema,
  events: entitySyncSettingsSchema,
  financials: entitySyncSettingsSchema,
  awards: entitySyncSettingsSchema,
  projects: entitySyncSettingsSchema,
  verticals: entitySyncSettingsSchema.optional(),
  leadership: entitySyncSettingsSchema.optional()
});

export const syncConfigFormSchema = z.object({
  api_endpoint: z
    .string()
    .url('Please enter a valid URL')
    .min(1, 'API endpoint is required'),
  api_version: z.string().min(1, 'API version is required'),
  auth_token: z.string().optional(),
  sync_enabled: z.boolean(),
  sync_frequency: syncFrequencySchema,
  entity_sync_settings: entitySyncConfigSchema
});

export const updateSyncConfigSchema = syncConfigFormSchema.partial();

// ============================================================================
// SYNC OPERATION SCHEMAS
// ============================================================================

export const triggerSyncSchema = z.object({
  entity_type: syncEntityTypeSchema,
  direction: syncDirectionSchema.optional().default('bidirectional'),
  force: z.boolean().optional().default(false)
});

export const manualSyncSchema = z.object({
  entity_types: z.array(syncEntityTypeSchema).min(1, 'Select at least one entity type'),
  direction: syncDirectionSchema
});

export const cancelSyncSchema = z.object({
  sync_log_id: z.string().uuid('Invalid sync log ID')
});

export const retrySyncSchema = z.object({
  sync_log_id: z.string().uuid('Invalid sync log ID')
});

// ============================================================================
// SYNC LOG FILTER SCHEMAS
// ============================================================================

export const syncLogFiltersSchema = z.object({
  sync_type: z.array(syncEntityTypeSchema).optional(),
  status: z.array(syncStatusSchema).optional(),
  direction: z.array(syncDirectionSchema).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional()
});

// ============================================================================
// BENCHMARK SCHEMAS
// ============================================================================

export const benchmarkFiltersSchema = z.object({
  metric_type: z.array(benchmarkMetricSchema).optional(),
  period_type: benchmarkPeriodSchema.optional(),
  performance_tier: z
    .array(
      z.enum(['top_10', 'above_average', 'average', 'below_average', 'bottom_10'])
    )
    .optional(),
  fiscal_year: z.number().int().min(2020).max(2100).optional(),
  quarter: z.number().int().min(1).max(4).optional()
});

// ============================================================================
// NATIONAL EVENT SCHEMAS
// ============================================================================

export const nationalEventFiltersSchema = z.object({
  event_type: z.array(nationalEventTypeSchema).optional(),
  status: z
    .array(
      z.enum([
        'upcoming',
        'registration_open',
        'registration_closed',
        'ongoing',
        'completed',
        'cancelled'
      ])
    )
    .optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  is_virtual: z.boolean().optional(),
  search: z.string().optional()
});

// ============================================================================
// EVENT REGISTRATION SCHEMAS
// ============================================================================

export const eventRegistrationSchema = z.object({
  national_event_id: z.string().uuid('Invalid event ID'),
  requires_accommodation: z.boolean().optional().default(false),
  travel_mode: z.string().optional(),
  arrival_date: z.string().optional(),
  departure_date: z.string().optional(),
  special_requirements: z.string().max(500, 'Maximum 500 characters').optional()
});

export const updateRegistrationSchema = z.object({
  registration_id: z.string().uuid('Invalid registration ID'),
  status: registrationStatusSchema.optional(),
  requires_accommodation: z.boolean().optional(),
  travel_mode: z.string().optional(),
  arrival_date: z.string().optional(),
  departure_date: z.string().optional(),
  special_requirements: z.string().max(500).optional()
});

export const cancelRegistrationSchema = z.object({
  registration_id: z.string().uuid('Invalid registration ID'),
  reason: z.string().max(500, 'Maximum 500 characters').optional()
});

export const submitFeedbackSchema = z.object({
  registration_id: z.string().uuid('Invalid registration ID'),
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(2000, 'Maximum 2000 characters').optional()
});

// ============================================================================
// ROLE MAPPING SCHEMAS
// ============================================================================

export const createRoleMappingSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
  national_role_id: z.string().uuid('Invalid national role ID'),
  local_role_id: z.string().uuid('Invalid local role ID').optional(),
  valid_from: z.string(),
  valid_until: z.string().optional()
});

export const updateRoleMappingSchema = z.object({
  mapping_id: z.string().uuid('Invalid mapping ID'),
  status: z.enum(['active', 'pending_approval', 'expired', 'revoked']).optional(),
  valid_until: z.string().optional()
});

// ============================================================================
// BROADCAST SCHEMAS
// ============================================================================

export const broadcastFiltersSchema = z.object({
  broadcast_type: z.array(broadcastTypeSchema).optional(),
  priority: z.array(broadcastPrioritySchema).optional(),
  read_status: z.enum(['read', 'unread', 'all']).optional(),
  requires_acknowledgment: z.boolean().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional()
});

export const acknowledgeBroadcastSchema = z.object({
  broadcast_id: z.string().uuid('Invalid broadcast ID'),
  response_text: z.string().max(1000, 'Maximum 1000 characters').optional()
});

export const markBroadcastReadSchema = z.object({
  broadcast_id: z.string().uuid('Invalid broadcast ID')
});

// ============================================================================
// CONFLICT RESOLUTION SCHEMAS
// ============================================================================

export const conflictFiltersSchema = z.object({
  entity_type: z.array(syncEntityTypeSchema).optional(),
  conflict_type: z.array(conflictTypeSchema).optional(),
  resolution_status: z.array(conflictResolutionSchema).optional(),
  priority: z.array(z.enum(['low', 'normal', 'high', 'critical'])).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional()
});

export const resolveConflictSchema = z.object({
  conflict_id: z.string().uuid('Invalid conflict ID'),
  resolution: conflictResolutionSchema,
  resolution_notes: z.string().max(1000, 'Maximum 1000 characters').optional(),
  resolved_data: z.record(z.string(), z.unknown()).optional()
});

export const bulkResolveConflictsSchema = z.object({
  conflict_ids: z.array(z.string().uuid()).min(1, 'Select at least one conflict'),
  resolution: z.enum(['keep_local', 'accept_national', 'ignored']),
  resolution_notes: z.string().max(1000).optional()
});

// ============================================================================
// ROLLBACK SCHEMAS
// ============================================================================

export const rollbackSyncSchema = z.object({
  sync_log_id: z.string().uuid('Invalid sync log ID'),
  confirm: z.literal(true)
});

export const rollbackEntitySchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  version: z.number().int().min(1, 'Invalid version number')
});

// ============================================================================
// API CONNECTION TEST SCHEMA
// ============================================================================

export const testConnectionSchema = z.object({
  api_endpoint: z.string().url('Please enter a valid URL'),
  auth_token: z.string().min(1, 'Auth token is required for testing')
});

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SyncConfigFormData = z.infer<typeof syncConfigFormSchema>;
export type TriggerSyncData = z.infer<typeof triggerSyncSchema>;
export type ManualSyncData = z.infer<typeof manualSyncSchema>;
export type SyncLogFiltersData = z.infer<typeof syncLogFiltersSchema>;
export type BenchmarkFiltersData = z.infer<typeof benchmarkFiltersSchema>;
export type NationalEventFiltersData = z.infer<typeof nationalEventFiltersSchema>;
export type EventRegistrationData = z.infer<typeof eventRegistrationSchema>;
export type UpdateRegistrationData = z.infer<typeof updateRegistrationSchema>;
export type SubmitFeedbackData = z.infer<typeof submitFeedbackSchema>;
export type CreateRoleMappingData = z.infer<typeof createRoleMappingSchema>;
export type BroadcastFiltersData = z.infer<typeof broadcastFiltersSchema>;
export type AcknowledgeBroadcastData = z.infer<typeof acknowledgeBroadcastSchema>;
export type ConflictFiltersData = z.infer<typeof conflictFiltersSchema>;
export type ResolveConflictData = z.infer<typeof resolveConflictSchema>;
export type TestConnectionData = z.infer<typeof testConnectionSchema>;

// ============================================================================
// End of Validations
// ============================================================================
