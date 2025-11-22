'use server'

/**
 * Push Notification Server Actions
 *
 * Handles push subscription management and notification sending.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// ============================================================================
// Validation Schemas
// ============================================================================

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    platform: z.string().optional(),
    language: z.string().optional(),
    screenWidth: z.number().optional(),
    screenHeight: z.number().optional()
  }).optional()
})

const notificationPreferencesSchema = z.object({
  eventsEnabled: z.boolean().optional(),
  announcementsEnabled: z.boolean().optional(),
  approvalsEnabled: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
  awardsEnabled: z.boolean().optional(),
  tasksEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional()
})

// ============================================================================
// Push Subscription Actions
// ============================================================================

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  subscription: z.infer<typeof pushSubscriptionSchema>
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const validated = pushSubscriptionSchema.parse(subscription)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: validated.endpoint,
        p256dh: validated.p256dh,
        auth: validated.auth,
        device_info: validated.deviceInfo || {},
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      })
      .select('id')
      .single()

    if (error) {
      console.error('Push subscription error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (error) {
    console.error('Subscribe to push error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to subscribe'
    }
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  endpoint?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    let query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)

    if (endpoint) {
      query = query.eq('endpoint', endpoint)
    }

    const { error } = await query

    if (error) {
      console.error('Unsubscribe error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Unsubscribe from push error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unsubscribe'
    }
  }
}

/**
 * Get user's push subscriptions
 */
export async function getPushSubscriptions(): Promise<{
  success: boolean
  data?: Array<{
    id: string
    endpoint: string
    deviceInfo: Record<string, unknown>
    createdAt: string
    lastUsed: string | null
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, device_info, created_at, last_used')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: data?.map(sub => ({
        id: sub.id,
        endpoint: sub.endpoint,
        deviceInfo: sub.device_info as Record<string, unknown>,
        createdAt: sub.created_at,
        lastUsed: sub.last_used
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get subscriptions'
    }
  }
}

// ============================================================================
// Notification Preferences Actions
// ============================================================================

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(): Promise<{
  success: boolean
  data?: {
    eventsEnabled: boolean
    announcementsEnabled: boolean
    approvalsEnabled: boolean
    remindersEnabled: boolean
    awardsEnabled: boolean
    tasksEnabled: boolean
    quietHoursEnabled: boolean
    quietHoursStart: string
    quietHoursEnd: string
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message }
    }

    // Return defaults if no preferences exist
    const preferences = data || {
      events_enabled: true,
      announcements_enabled: true,
      approvals_enabled: true,
      reminders_enabled: true,
      awards_enabled: true,
      tasks_enabled: true,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00'
    }

    return {
      success: true,
      data: {
        eventsEnabled: preferences.events_enabled,
        announcementsEnabled: preferences.announcements_enabled,
        approvalsEnabled: preferences.approvals_enabled,
        remindersEnabled: preferences.reminders_enabled,
        awardsEnabled: preferences.awards_enabled,
        tasksEnabled: preferences.tasks_enabled,
        quietHoursEnabled: preferences.quiet_hours_enabled,
        quietHoursStart: preferences.quiet_hours_start,
        quietHoursEnd: preferences.quiet_hours_end
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get preferences'
    }
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  preferences: z.infer<typeof notificationPreferencesSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = notificationPreferencesSchema.parse(preferences)
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const updateData: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString()
    }

    if (validated.eventsEnabled !== undefined) {
      updateData.events_enabled = validated.eventsEnabled
    }
    if (validated.announcementsEnabled !== undefined) {
      updateData.announcements_enabled = validated.announcementsEnabled
    }
    if (validated.approvalsEnabled !== undefined) {
      updateData.approvals_enabled = validated.approvalsEnabled
    }
    if (validated.remindersEnabled !== undefined) {
      updateData.reminders_enabled = validated.remindersEnabled
    }
    if (validated.awardsEnabled !== undefined) {
      updateData.awards_enabled = validated.awardsEnabled
    }
    if (validated.tasksEnabled !== undefined) {
      updateData.tasks_enabled = validated.tasksEnabled
    }
    if (validated.quietHoursEnabled !== undefined) {
      updateData.quiet_hours_enabled = validated.quietHoursEnabled
    }
    if (validated.quietHoursStart !== undefined) {
      updateData.quiet_hours_start = validated.quietHoursStart
    }
    if (validated.quietHoursEnd !== undefined) {
      updateData.quiet_hours_end = validated.quietHoursEnd
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(updateData, { onConflict: 'user_id' })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/m/settings/notifications')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update preferences'
    }
  }
}

// ============================================================================
// Push Notification Sending (Server-side only)
// ============================================================================

/**
 * Log a push notification
 */
export async function logPushNotification(
  userId: string,
  subscriptionId: string | null,
  title: string,
  body: string,
  category: string,
  actionUrl?: string,
  payload?: Record<string, unknown>
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('push_notification_logs')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        title,
        body,
        category,
        action_url: actionUrl,
        payload: payload || {},
        status: 'pending'
      })
      .select('id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log notification'
    }
  }
}

/**
 * Update notification log status
 */
export async function updateNotificationLogStatus(
  logId: string,
  status: 'sent' | 'delivered' | 'clicked' | 'failed',
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const updateData: Record<string, unknown> = { status }

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    } else if (status === 'clicked') {
      updateData.clicked_at = new Date().toISOString()
    } else if (status === 'failed' && errorMessage) {
      updateData.error_message = errorMessage
    }

    const { error } = await supabase
      .from('push_notification_logs')
      .update(updateData)
      .eq('id', logId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update log'
    }
  }
}
