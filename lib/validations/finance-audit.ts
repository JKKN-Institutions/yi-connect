// ================================================
// FINANCE AUDIT & PAYMENT METHOD VALIDATION SCHEMAS
// ================================================
// Zod validation schemas for payment methods and financial audit logs.
// Re-exports relevant schemas from the main finance validations and adds
// audit-log-specific schemas.
// ================================================

import { z } from 'zod'

// Re-export payment method schemas from the main finance validations
export {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  deletePaymentMethodSchema,
  type CreatePaymentMethodInput,
  type UpdatePaymentMethodInput,
} from './finance'

// ================================================
// FINANCIAL AUDIT LOG VALIDATION SCHEMAS
// ================================================

export const logFinancialActionSchema = z.object({
  action: z.string()
    .min(1, 'Action is required')
    .max(50, 'Action is too long'),
  entity_type: z.string()
    .min(1, 'Entity type is required')
    .max(50, 'Entity type is too long'),
  entity_id: z.string().uuid('Invalid entity ID'),
  old_values: z.record(z.unknown()).optional().nullable(),
  new_values: z.record(z.unknown()).optional().nullable(),
  changed_fields: z.array(z.string()).optional(),
  amount_changed: z.number().optional().nullable(),
  description: z.string().max(1000).optional(),
})

export const auditLogFiltersSchema = z.object({
  entity_type: z.string().max(50).optional(),
  action: z.string().max(50).optional(),
  entity_id: z.string().uuid().optional(),
  performed_by: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
})

export const togglePaymentMethodSchema = z.object({
  method_id: z.string().uuid('Invalid payment method ID'),
})

// ================================================
// INFERRED TYPES
// ================================================

export type LogFinancialActionInput = z.infer<typeof logFinancialActionSchema>
export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>
export type TogglePaymentMethodInput = z.infer<typeof togglePaymentMethodSchema>
