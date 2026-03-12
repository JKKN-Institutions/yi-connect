/**
 * Yi Creative Studio Webhook Sync Service
 *
 * Syncs events to Yi Creative Studio for poster generation.
 * Based on integration guide: docs/yi-studio/integration.md
 */

import { createClient } from '@/lib/supabase/server'
import type {
  ExternalEvent,
  SyncResult,
  YiConnectEventForSync,
  YiConnectEventDeletePayload,
  YiConnectEventSyncPayload,
} from '@/types/yi-studio'

// Environment configuration
const YI_STUDIO_WEBHOOK_URL = process.env.YI_STUDIO_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.YI_STUDIO_WEBHOOK_SECRET
const YI_STUDIO_ORG_ID = process.env.YI_STUDIO_ORG_ID

/**
 * Check if Yi Studio sync is enabled
 */
export function isYiStudioSyncEnabled(): boolean {
  return Boolean(YI_STUDIO_WEBHOOK_URL && YI_STUDIO_ORG_ID)
}

/**
 * Sync an event to Yi Creative Studio
 *
 * Call this whenever an event is created, updated, or deleted.
 * This function is non-blocking and safe to call without await.
 *
 * @param action - The sync action: 'create', 'update', or 'delete'
 * @param event - The event data to sync
 * @returns Promise<SyncResult> - Result of the sync operation
 */
export async function syncEventToYiStudio(
  action: 'create' | 'update' | 'delete',
  event: YiConnectEventSyncPayload
): Promise<SyncResult> {
  // Skip sync if not configured
  if (!YI_STUDIO_WEBHOOK_URL) {
    console.warn('[Yi Studio] Webhook URL not configured, skipping sync')
    return { success: false, error: 'Webhook URL not configured' }
  }

  if (!YI_STUDIO_ORG_ID) {
    console.warn('[Yi Studio] Organization ID not configured, skipping sync')
    return { success: false, error: 'Organization ID not configured' }
  }

  try {
    // For delete action, we only need the event ID
    const externalEvent =
      action === 'delete'
        ? { id: (event as YiConnectEventDeletePayload).id } as ExternalEvent
        : transformYiConnectEvent(event as YiConnectEventForSync)

    const response = await fetch(YI_STUDIO_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source-App-Id': 'yi-connect',
        'X-Webhook-Secret': WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        action,
        organization_id: YI_STUDIO_ORG_ID,
        event: externalEvent,
      }),
    })

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      console.error('[Yi Studio] Non-JSON response:', text)
      return { success: false, error: 'Invalid response from Yi Studio' }
    }

    const data = await response.json()

    if (!response.ok) {
      console.error('[Yi Studio] Sync failed:', data.error || data.message)
      return { success: false, error: data.error || data.message || 'Sync failed' }
    }

    console.log(
      `[Yi Studio] Event ${action}d successfully:`,
      data.synced_event?.id || event.id
    )
    return {
      success: true,
      action: data.action,
      synced_event: data.synced_event,
    }
  } catch (error) {
    // Network errors, JSON parse errors, etc.
    const message = error instanceof Error ? error.message : 'Network error'
    console.error('[Yi Studio] Sync error:', message)
    return { success: false, error: message }
  }
}

/**
 * Transform Yi Connect event to Yi Studio's ExternalEvent format (v2.0)
 *
 * Based on the field mapping in docs/yi-studio/integration.md
 */
function transformYiConnectEvent(event: YiConnectEventForSync): ExternalEvent {
  // Extract date and time from ISO datetime
  const startDate = event.start_date ? event.start_date.split('T')[0] : ''
  const startTime = event.start_date ? extractTime(event.start_date) : undefined
  const endTime = event.end_date ? extractTime(event.end_date) : undefined

  return {
    // Required
    id: event.id,
    name: event.title,
    date: startDate,
    status: mapYiConnectStatus(event.status),
    createdAt: event.created_at,
    updatedAt: event.updated_at,

    // Time
    startTime,
    endTime,

    // Location
    venue: event.venue?.name || undefined,
    venueAddress: event.venue?.address || event.venue_address || undefined,
    city: event.chapter?.location || undefined,
    venueLatitude: event.venue_latitude || undefined,
    venueLongitude: event.venue_longitude || undefined,
    venueCapacity: event.venue?.capacity || undefined,

    // Virtual event
    isVirtual: event.is_virtual,
    virtualMeetingLink: event.virtual_meeting_link || undefined,

    // Organization
    organizerName: event.organizer?.profile?.full_name || undefined,
    organizationName: event.chapter?.name || undefined,
    chapterName: event.chapter?.name || undefined,
    chapterLocation: event.chapter?.location || undefined,

    // Content
    description: event.description || undefined,
    eventType: event.category,
    tags: event.tags || undefined,
    isFeatured: event.is_featured,

    // Registration
    registrationStartDate: event.registration_start_date?.split('T')[0] || undefined,
    registrationDeadline: event.registration_end_date?.split('T')[0] || undefined,
    maxCapacity: event.max_capacity || undefined,
    currentRegistrations: event.current_registrations || 0,
    waitlistEnabled: event.waitlist_enabled,

    // Guests
    allowGuests: event.allow_guests,
    guestLimit: event.guest_limit || undefined,

    // Media
    bannerImageUrl: event.banner_image_url || undefined,
  }
}

/**
 * Extract time (HH:MM) from ISO datetime string
 */
function extractTime(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Map Yi Connect status to Yi Studio status
 */
function mapYiConnectStatus(
  status: string
): 'draft' | 'published' | 'completed' | 'cancelled' {
  const statusMap: Record<string, 'draft' | 'published' | 'completed' | 'cancelled'> = {
    draft: 'draft',
    published: 'published',
    ongoing: 'published', // Map ongoing to published
    completed: 'completed',
    cancelled: 'cancelled',
  }
  return statusMap[status] || 'published'
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform organizer data from Supabase query result
 * Handles array vs object for nested profile relation
 */
function transformOrganizer(
  organizer: unknown
): YiConnectEventForSync['organizer'] {
  if (!organizer) return null

  // Handle array case (Supabase sometimes returns arrays for relations)
  const org = Array.isArray(organizer) ? organizer[0] : organizer
  if (!org) return null

  const profile = org.profile
  const profileData = Array.isArray(profile) ? profile[0] : profile

  return {
    id: org.id,
    profile: profileData || null,
  }
}

/**
 * Fetch event with full details for Yi Studio sync
 *
 * This function fetches the event with all relationships needed for sync.
 * Returns null if event not found.
 */
export async function getEventForSync(
  eventId: string
): Promise<YiConnectEventForSync | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('events')
    .select(
      `
      id,
      title,
      description,
      category,
      status,
      start_date,
      end_date,
      registration_start_date,
      registration_end_date,
      venue_address,
      venue_latitude,
      venue_longitude,
      is_virtual,
      virtual_meeting_link,
      max_capacity,
      current_registrations,
      waitlist_enabled,
      allow_guests,
      guest_limit,
      is_featured,
      banner_image_url,
      tags,
      created_at,
      updated_at,
      venue:venues (
        id,
        name,
        address,
        capacity
      ),
      chapter:chapters (
        id,
        name,
        location
      ),
      organizer:members!organizer_id (
        id,
        profile:profiles (
          full_name,
          email,
          avatar_url
        )
      )
    `
    )
    .eq('id', eventId)
    .single()

  if (error || !data) {
    console.error('[Yi Studio] Failed to fetch event for sync:', error?.message)
    return null
  }

  // Transform the data to match YiConnectEventForSync type
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    start_date: data.start_date,
    end_date: data.end_date,
    registration_start_date: data.registration_start_date,
    registration_end_date: data.registration_end_date,
    venue_address: data.venue_address,
    venue_latitude: data.venue_latitude,
    venue_longitude: data.venue_longitude,
    is_virtual: data.is_virtual,
    virtual_meeting_link: data.virtual_meeting_link,
    max_capacity: data.max_capacity,
    current_registrations: data.current_registrations,
    waitlist_enabled: data.waitlist_enabled,
    allow_guests: data.allow_guests,
    guest_limit: data.guest_limit,
    is_featured: data.is_featured,
    banner_image_url: data.banner_image_url,
    tags: data.tags,
    created_at: data.created_at,
    updated_at: data.updated_at,
    venue: (Array.isArray(data.venue) ? data.venue[0] : data.venue) as unknown as YiConnectEventForSync['venue'],
    chapter: (Array.isArray(data.chapter) ? data.chapter[0] : data.chapter) as unknown as YiConnectEventForSync['chapter'],
    organizer: transformOrganizer(data.organizer),
  }
}

/**
 * Sync event to Yi Studio by event ID
 *
 * Convenience function that fetches the event and syncs it.
 * Use this when you only have the event ID.
 */
export async function syncEventByIdToYiStudio(
  action: 'create' | 'update',
  eventId: string
): Promise<SyncResult> {
  // Skip if sync is not enabled
  if (!isYiStudioSyncEnabled()) {
    return { success: false, error: 'Yi Studio sync not enabled' }
  }

  const event = await getEventForSync(eventId)
  if (!event) {
    return { success: false, error: 'Event not found' }
  }

  return syncEventToYiStudio(action, event)
}
