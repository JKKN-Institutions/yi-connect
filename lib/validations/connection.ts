/**
 * Connection Validation Schemas (Stutzee Feature 4A)
 */

import { z } from 'zod';

// Profile QR tokens are 32-char hex (16 random bytes), but we accept 16-64
// hex chars in case the default length ever changes.
const qrTokenRegex = /^[a-f0-9]{16,64}$/i;

export const createConnectionSchema = z.object({
  targetQrToken: z
    .string()
    .trim()
    .regex(qrTokenRegex, 'Invalid QR token'),
  eventId: z
    .string()
    .uuid('Invalid event id')
    .optional()
    .nullable(),
  note: z
    .string()
    .max(500, 'Note is too long (max 500 chars)')
    .optional()
    .nullable(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const updateConnectionNoteSchema = z.object({
  connectionId: z.string().uuid('Invalid connection id'),
  note: z
    .string()
    .max(500, 'Note is too long (max 500 chars)')
    .nullable(),
});

export type UpdateConnectionNoteInput = z.infer<typeof updateConnectionNoteSchema>;

export const deleteConnectionSchema = z.object({
  connectionId: z.string().uuid('Invalid connection id'),
});

export const toggleNetworkingOptOutSchema = z.object({
  enabled: z.boolean(),
});
