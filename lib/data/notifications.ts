/**
 * Notifications Data Layer
 *
 * Cached data fetching functions for the notifications system.
 * Uses React cache() for request-level deduplication.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentMemberId } from '@/lib/auth';
import { cache } from 'react';
import type { Notification, NotificationFilters } from '@/types/notifications';

// ============================================================================
// Fetch Notifications
// ============================================================================

/**
 * Get notifications for the current user.
 *
 * Returns notifications ordered by created_at DESC.
 * Supports filtering by read status, type, and date range.
 */
export const getNotifications = cache(
  async (filters?: NotificationFilters): Promise<Notification[]> => {
    const memberId = await getCurrentMemberId();
    if (!memberId) return [];

    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (filters?.read !== undefined) {
      query = query.eq('read', filters.read);
    }

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []) as Notification[];
  }
);

// ============================================================================
// Unread Count
// ============================================================================

/**
 * Get the number of unread notifications for the current user.
 */
export const getUnreadCount = cache(async (): Promise<number> => {
  const memberId = await getCurrentMemberId();
  if (!memberId) return 0;

  const supabase = await createServerSupabaseClient();

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
});
