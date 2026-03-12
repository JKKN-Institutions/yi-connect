/**
 * Yi Creative Studio Integration Types (v2.0)
 *
 * Type definitions for Yi Studio webhook integration.
 * Based on ExternalEvent Schema v2.0 from docs/yi-studio/integration.md
 */

// ============================================================================
// ExternalEvent Schema (v2.0)
// ============================================================================

/**
 * External event format accepted by Yi Creative Studio webhook.
 * Version 2.0 includes support for virtual events, capacity tracking,
 * chapter info, and guest policies.
 */
export interface ExternalEvent {
  // === REQUIRED FIELDS ===
  id: string              // Your app's event ID (unique identifier)
  name: string            // Event title
  date: string            // ISO date format: "2026-02-15"
  status: 'draft' | 'published' | 'completed' | 'cancelled'
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp

  // === TIME (Optional) ===
  startTime?: string      // 24h format: "10:00"
  endTime?: string        // 24h format: "17:00"

  // === LOCATION (Optional) ===
  venue?: string          // "Convention Center, Hall A"
  venueAddress?: string   // "123 Main St, Chennai"
  city?: string           // "Chennai"
  venueLatitude?: number  // GPS latitude (e.g., 13.0827)
  venueLongitude?: number // GPS longitude (e.g., 80.2707)
  venueCapacity?: number  // Maximum venue capacity

  // === VIRTUAL EVENT (Optional) ===
  isVirtual?: boolean           // true for online-only events
  virtualMeetingLink?: string   // Zoom/Meet/Teams URL

  // === PEOPLE (Optional) ===
  speakers?: ExternalEventSpeaker[]
  organizerName?: string
  organizationId?: string
  organizationName?: string
  chapterName?: string      // Yi chapter name (e.g., "Yi Chapter Chennai")
  chapterLocation?: string  // Chapter city/region

  // === CONTENT (Optional) ===
  description?: string
  tagline?: string
  eventType?: string      // "conference", "workshop", "seminar", etc.
  tags?: string[]         // Event tags/labels (e.g., ["annual", "flagship"])
  isFeatured?: boolean    // Featured/highlighted event

  // === REGISTRATION (Optional) ===
  registrationUrl?: string
  entryFee?: string               // "Free" or "₹500"
  registrationDeadline?: string   // ISO date
  registrationStartDate?: string  // When registration opens (ISO date)
  maxCapacity?: number            // Maximum attendees
  currentRegistrations?: number   // Current RSVP count (snapshot)
  waitlistEnabled?: boolean       // Whether waitlist is active

  // === GUEST POLICY (Optional) ===
  allowGuests?: boolean   // Whether +1 guests are allowed
  guestLimit?: number     // Maximum guests per attendee

  // === AUDIENCE (Optional) ===
  targetAudience?: string

  // === MEDIA (Optional) ===
  bannerImageUrl?: string
}

/**
 * Speaker information for external events
 */
export interface ExternalEventSpeaker {
  id: string
  name: string
  designation?: string    // "CEO", "CTO", etc.
  organization?: string   // "TechCorp"
  photoUrl?: string       // URL to speaker photo
  bio?: string
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Webhook payload sent to Yi Creative Studio
 */
export interface WebhookPayload {
  action: 'create' | 'update' | 'delete'
  event: ExternalEvent
  organization_id: string  // Yi Studio organization UUID
}

/**
 * Result from sync operation
 */
export interface SyncResult {
  success: boolean
  action?: string
  error?: string
  synced_event?: {
    id: string
    external_id: string
    name: string
    synced_at: string
  }
}

// ============================================================================
// Yi Connect Event Type (for transformation)
// ============================================================================

/**
 * Yi Connect event with all relations needed for transformation.
 * This matches the EventWithDetails type from types/event.ts
 */
export interface YiConnectEventForSync {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  start_date: string
  end_date: string
  registration_start_date: string | null
  registration_end_date: string | null
  venue_address: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  is_virtual: boolean
  virtual_meeting_link: string | null
  max_capacity: number | null
  current_registrations: number
  waitlist_enabled: boolean
  allow_guests: boolean
  guest_limit: number | null
  is_featured: boolean
  banner_image_url: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  // Joined relations
  venue?: {
    id: string
    name: string
    address: string
    capacity: number | null
  } | null
  chapter?: {
    id: string
    name: string
    location: string
  } | null
  organizer?: {
    id: string
    profile: {
      full_name: string
      email: string
      avatar_url: string | null
    } | null
  } | null
}

/**
 * Minimal event data needed for delete sync
 */
export interface YiConnectEventDeletePayload {
  id: string
}

/**
 * Union type for sync operations
 */
export type YiConnectEventSyncPayload = YiConnectEventForSync | YiConnectEventDeletePayload
