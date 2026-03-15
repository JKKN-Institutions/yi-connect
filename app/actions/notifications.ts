/**
 * Notification Server Actions
 *
 * Server actions for notification mutations.
 */

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

type ActionResponse = {
  success: boolean;
  message: string;
  error?: string;
};

// ============================================================================
// Mark Single Notification as Read
// ============================================================================

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('member_id', user.id);

    if (error) {
      return { success: false, message: 'Failed to mark notification as read', error: error.message };
    }

    revalidateTag('notifications');

    return { success: true, message: 'Notification marked as read' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// Mark All Notifications as Read
// ============================================================================

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllAsRead(): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('member_id', user.id)
      .eq('read', false);

    if (error) {
      return { success: false, message: 'Failed to mark all notifications as read', error: error.message };
    }

    revalidateTag('notifications');

    return { success: true, message: 'All notifications marked as read' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// Delete Notification
// ============================================================================

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('member_id', user.id);

    if (error) {
      return { success: false, message: 'Failed to delete notification', error: error.message };
    }

    revalidateTag('notifications');

    return { success: true, message: 'Notification deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}
