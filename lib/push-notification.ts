/**
 * Push Notification Utility
 *
 * Server-side utility for sending Web Push notifications.
 * Uses the web-push library to send notifications to subscribed devices.
 */

import webpush from 'web-push'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@yiconnect.com'

// Initialize web-push if VAPID keys are configured
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
  requireInteraction?: boolean
  data?: Record<string, unknown>
}

export interface SendPushResult {
  success: boolean
  sent: number
  failed: number
  errors?: Array<{ subscriptionId: string; error: string }>
}

/**
 * Check if push notifications are configured
 */
export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey)
}

/**
 * Get all active push subscriptions for a user
 */
export async function getUserPushSubscriptions(userId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching push subscriptions:', error)
    return []
  }

  return data || []
}

/**
 * Get all active push subscriptions for multiple users
 */
export async function getMultipleUsersPushSubscriptions(userIds: string[]) {
  if (userIds.length === 0) return []

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching push subscriptions:', error)
    return []
  }

  return data || []
}

/**
 * Send a push notification to a single subscription
 */
export async function sendPushToSubscription(
  subscription: {
    id: string
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!isPushConfigured()) {
    return { success: false, error: 'Push notifications not configured' }
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    }

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    )

    // Update last_used timestamp
    const supabase = await createServerSupabaseClient()
    await supabase
      .from('push_subscriptions')
      .update({ last_used: new Date().toISOString() })
      .eq('id', subscription.id)

    return { success: true }
  } catch (error: any) {
    // Handle subscription expiration
    if (error.statusCode === 404 || error.statusCode === 410) {
      // Subscription no longer valid, mark as inactive
      const supabase = await createServerSupabaseClient()
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscription.id)

      return { success: false, error: 'Subscription expired' }
    }

    console.error('Push notification error:', error)
    return { success: false, error: error.message || 'Failed to send push notification' }
  }
}

/**
 * Send push notifications to all subscriptions for a user
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  if (!isPushConfigured()) {
    return { success: false, sent: 0, failed: 0, errors: [{ subscriptionId: '', error: 'Push not configured' }] }
  }

  const subscriptions = await getUserPushSubscriptions(userId)

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const errors: Array<{ subscriptionId: string; error: string }> = []

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPushToSubscription(sub, payload)
      if (result.success) {
        sent++
      } else {
        failed++
        if (result.error) {
          errors.push({ subscriptionId: sub.id, error: result.error })
        }
      }
    })
  )

  return {
    success: sent > 0 || subscriptions.length === 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Send push notifications to multiple users
 */
export async function sendPushToMultipleUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  if (!isPushConfigured()) {
    return { success: false, sent: 0, failed: 0, errors: [{ subscriptionId: '', error: 'Push not configured' }] }
  }

  if (userIds.length === 0) {
    return { success: true, sent: 0, failed: 0 }
  }

  const subscriptions = await getMultipleUsersPushSubscriptions(userIds)

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const errors: Array<{ subscriptionId: string; error: string }> = []

  // Process in batches of 100 to avoid overwhelming the system
  const batchSize = 100
  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (sub) => {
        const result = await sendPushToSubscription(sub, payload)
        if (result.success) {
          sent++
        } else {
          failed++
          if (result.error) {
            errors.push({ subscriptionId: sub.id, error: result.error })
          }
        }
      })
    )
  }

  return {
    success: sent > 0 || subscriptions.length === 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Send announcement as push notification to all members in a chapter
 */
export async function sendAnnouncementPush(
  chapterId: string,
  announcement: {
    id: string
    title: string
    content: string
  }
): Promise<SendPushResult> {
  if (!isPushConfigured()) {
    console.log('Push notifications not configured, skipping...')
    return { success: true, sent: 0, failed: 0 }
  }

  const supabase = await createServerSupabaseClient()

  // Get all active members in the chapter
  const { data: members, error } = await supabase
    .from('members')
    .select('id')
    .eq('chapter_id', chapterId)
    .eq('is_active', true)

  if (error || !members || members.length === 0) {
    console.error('Error fetching members for push:', error)
    return { success: false, sent: 0, failed: 0 }
  }

  const memberIds = members.map((m) => m.id)

  const payload: PushNotificationPayload = {
    title: announcement.title,
    body: announcement.content.length > 100
      ? announcement.content.substring(0, 100) + '...'
      : announcement.content,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `announcement-${announcement.id}`,
    url: '/communications/announcements',
    requireInteraction: false,
    data: {
      type: 'announcement',
      announcementId: announcement.id
    }
  }

  return sendPushToMultipleUsers(memberIds, payload)
}
