/**
 * Notification Type Definitions
 *
 * Type definitions for the notifications system.
 */

// ============================================================================
// Notification Types
// ============================================================================

export const NOTIFICATION_TYPES = [
  'event',
  'member',
  'finance',
  'communication',
  'system',
  'general',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

// ============================================================================
// Database Row Type
// ============================================================================

export interface Notification {
  id: string;
  member_id: string;
  chapter_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  category: string | null;
  read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType;
  date_from?: string;
  date_to?: string;
}
