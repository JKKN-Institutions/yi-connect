# External Event Integration Guide

## For External Applications (MyJKKN, Yi Connect, etc.)

This guide explains how to integrate your event management application with Yi CreativeStudio to enable seamless poster creation from your events.

---

## Architecture Overview

```
┌──────────────────────┐         ┌──────────────────────┐
│   External App       │         │   Yi CreativeStudio  │
│  (MyJKKN, Yi Connect)│         │                      │
├──────────────────────┤         ├──────────────────────┤
│                      │  POST   │                      │
│  Event Created ──────┼────────►│  /api/webhooks/events│
│  Event Updated ──────┼────────►│                      │
│  Event Deleted ──────┼────────►│  Stores in           │
│                      │         │  synced_events table │
│                      │         │                      │
│  "Create Poster" ────┼────────►│  /create?eventId=xxx │
│  button click        │         │  (Deep Link)         │
└──────────────────────┘         └──────────────────────┘
```

---

## Step 1: Webhook Integration

### Endpoint
```
POST https://yi-studio.yichapter.org/api/webhooks/events
```

### Required Headers
| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/json` | Required |
| `X-Source-App-Id` | `myjkkn` or `yi-connect` | Identifies your app |
| `X-Webhook-Secret` | `your-shared-secret` | Optional but recommended |

### Request Body

```typescript
interface WebhookPayload {
  action: 'create' | 'update' | 'delete'
  event: ExternalEvent
  organization_id: string  // Yi Studio organization UUID
}
```

### ExternalEvent Schema (v2.0)

> **Version 2.0** includes support for virtual events, capacity tracking, chapter info, and guest policies.

```typescript
interface ExternalEvent {
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
  venueLatitude?: number  // GPS latitude (e.g., 13.0827) - NEW v2.0
  venueLongitude?: number // GPS longitude (e.g., 80.2707) - NEW v2.0
  venueCapacity?: number  // Maximum venue capacity - NEW v2.0

  // === VIRTUAL EVENT (Optional) - NEW v2.0 ===
  isVirtual?: boolean           // true for online-only events
  virtualMeetingLink?: string   // Zoom/Meet/Teams URL

  // === PEOPLE (Optional) ===
  speakers?: ExternalEventSpeaker[]
  organizerName?: string
  organizationId?: string
  organizationName?: string
  chapterName?: string      // Yi chapter name (e.g., "Yi Chapter Chennai") - NEW v2.0
  chapterLocation?: string  // Chapter city/region - NEW v2.0

  // === CONTENT (Optional) ===
  description?: string
  tagline?: string
  eventType?: string      // "conference", "workshop", "seminar", etc.
  tags?: string[]         // Event tags/labels (e.g., ["annual", "flagship"]) - NEW v2.0
  isFeatured?: boolean    // Featured/highlighted event - NEW v2.0

  // === REGISTRATION (Optional) ===
  registrationUrl?: string
  entryFee?: string               // "Free" or "₹500"
  registrationDeadline?: string   // ISO date
  registrationStartDate?: string  // When registration opens (ISO date) - NEW v2.0
  maxCapacity?: number            // Maximum attendees - NEW v2.0
  currentRegistrations?: number   // Current RSVP count (snapshot) - NEW v2.0
  waitlistEnabled?: boolean       // Whether waitlist is active - NEW v2.0

  // === GUEST POLICY (Optional) - NEW v2.0 ===
  allowGuests?: boolean   // Whether +1 guests are allowed
  guestLimit?: number     // Maximum guests per attendee

  // === AUDIENCE (Optional) ===
  targetAudience?: string

  // === MEDIA (Optional) ===
  bannerImageUrl?: string
}

interface ExternalEventSpeaker {
  id: string
  name: string
  designation?: string    // "CEO", "CTO", etc.
  organization?: string   // "TechCorp"
  photoUrl?: string       // URL to speaker photo
  bio?: string
}
```

### New Fields Summary (v2.0)

| Field | Type | Poster Use Case |
|-------|------|-----------------|
| `isVirtual` | boolean | "Virtual Event" badge |
| `virtualMeetingLink` | string | QR code to join meeting |
| `venueLatitude/Longitude` | number | Map QR code generation |
| `venueCapacity` | number | Context for capacity messaging |
| `chapterName` | string | Yi chapter branding on poster |
| `chapterLocation` | string | Chapter city context |
| `tags` | string[] | Hashtags on poster (e.g., #annual #flagship) |
| `isFeatured` | boolean | Featured event badge/styling |
| `registrationStartDate` | string | "Registration opens" date |
| `maxCapacity` | number | "Limited seats" messaging |
| `currentRegistrations` | number | "Only X spots left!" text |
| `waitlistEnabled` | boolean | "Waitlist available" text |
| `allowGuests` | boolean | "+1 allowed" messaging |
| `guestLimit` | number | Guest limit info |

---

## Step 2: Implement Webhook Sync in Your App

Add this code to your external application:

### Environment Variables
```env
# .env.local
YI_STUDIO_WEBHOOK_URL=https://yi-studio.yichapter.org/api/webhooks/events
YI_STUDIO_WEBHOOK_SECRET=your-shared-secret-here
YI_STUDIO_ORG_ID=your-yi-studio-organization-uuid
```

### Webhook Sync Service

```typescript
// lib/webhooks/yi-studio-sync.ts

const YI_STUDIO_WEBHOOK_URL = process.env.YI_STUDIO_WEBHOOK_URL
const WEBHOOK_SECRET = process.env.YI_STUDIO_WEBHOOK_SECRET
const YI_STUDIO_ORG_ID = process.env.YI_STUDIO_ORG_ID

interface SyncResult {
  success: boolean
  action?: string
  error?: string
}

/**
 * Sync an event to Yi CreativeStudio
 * Call this whenever an event is created, updated, or deleted
 */
export async function syncEventToYiStudio(
  action: 'create' | 'update' | 'delete',
  event: YourEventType
): Promise<SyncResult> {
  if (!YI_STUDIO_WEBHOOK_URL) {
    console.warn('[Yi Studio] Webhook URL not configured, skipping sync')
    return { success: false, error: 'Webhook URL not configured' }
  }

  try {
    const response = await fetch(YI_STUDIO_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source-App-Id': 'myjkkn', // Change to your app ID
        'X-Webhook-Secret': WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        action,
        organization_id: YI_STUDIO_ORG_ID,
        event: transformToExternalEvent(event),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Yi Studio] Sync failed:', data.error)
      return { success: false, error: data.error }
    }

    console.log(`[Yi Studio] Event ${action}d successfully:`, data.synced_event?.id)
    return { success: true, action: data.action }
  } catch (error) {
    console.error('[Yi Studio] Sync error:', error)
    return { success: false, error: 'Network error' }
  }
}

/**
 * Transform your event schema to Yi Studio's ExternalEvent format (v2.0)
 */
function transformToExternalEvent(event: YourEventType): ExternalEvent {
  return {
    // Required
    id: event.id,
    name: event.title || event.name,
    date: event.date, // Ensure YYYY-MM-DD format
    status: event.status,
    createdAt: event.created_at,
    updatedAt: event.updated_at,

    // Time
    startTime: event.start_time || event.startTime,
    endTime: event.end_time || event.endTime,

    // Location
    venue: event.venue || event.location,
    venueAddress: event.venue_address || event.address,
    city: event.city,
    // v2.0: GPS coordinates
    venueLatitude: event.venue_latitude || undefined,
    venueLongitude: event.venue_longitude || undefined,
    venueCapacity: event.venue_capacity || undefined,

    // v2.0: Virtual event
    isVirtual: event.is_virtual || false,
    virtualMeetingLink: event.virtual_meeting_link || undefined,

    // Content
    description: event.description,
    tagline: event.tagline || event.subtitle,
    eventType: event.event_type || event.category,
    // v2.0: Tags and featured
    tags: event.tags || undefined,
    isFeatured: event.is_featured || false,

    // People
    speakers: event.speakers?.map(s => ({
      id: s.id,
      name: s.name,
      designation: s.designation || s.title,
      organization: s.organization || s.company,
      photoUrl: s.photo_url || s.avatar,
    })),
    organizerName: event.organizer_name,
    organizationId: event.organization_id,
    organizationName: event.organization_name,
    // v2.0: Chapter info
    chapterName: event.chapter_name || undefined,
    chapterLocation: event.chapter_location || undefined,

    // Registration
    registrationUrl: event.registration_url,
    entryFee: event.entry_fee || event.price,
    // v2.0: Capacity fields
    registrationDeadline: event.registration_deadline || undefined,
    registrationStartDate: event.registration_start_date || undefined,
    maxCapacity: event.max_capacity || undefined,
    currentRegistrations: event.current_registrations || 0,
    waitlistEnabled: event.waitlist_enabled || false,

    // v2.0: Guest policy
    allowGuests: event.allow_guests ?? true,
    guestLimit: event.guest_limit || undefined,

    // Audience & Media
    targetAudience: event.target_audience,
    bannerImageUrl: event.banner_url || event.cover_image,
  }
}
```

### Usage in Your Event CRUD Operations

```typescript
// When creating an event
export async function createEvent(eventData: CreateEventInput) {
  const event = await db.events.create(eventData)

  // Sync to Yi Studio (non-blocking)
  syncEventToYiStudio('create', event).catch(console.error)

  return event
}

// When updating an event
export async function updateEvent(id: string, eventData: UpdateEventInput) {
  const event = await db.events.update(id, eventData)

  // Sync to Yi Studio (non-blocking)
  syncEventToYiStudio('update', event).catch(console.error)

  return event
}

// When deleting an event
export async function deleteEvent(id: string) {
  await db.events.delete(id)

  // Sync to Yi Studio (only needs id for delete)
  syncEventToYiStudio('delete', { id }).catch(console.error)
}
```

---

## Step 3: Add "Create Poster" Button

Add a button in your event detail page that links to Yi Studio:

### React Component Example

```tsx
// components/CreatePosterButton.tsx

interface CreatePosterButtonProps {
  eventId: string
  eventName: string
}

export function CreatePosterButton({ eventId, eventName }: CreatePosterButtonProps) {
  const yiStudioUrl = process.env.NEXT_PUBLIC_YI_STUDIO_URL || 'https://yi-studio.yichapter.org'
  const sourceAppId = 'myjkkn' // Your app identifier

  const posterUrl = `${yiStudioUrl}/dashboard/create?eventId=${eventId}&source=${sourceAppId}`

  return (
    <a
      href={posterUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      <ImageIcon className="w-4 h-4" />
      Create Poster
    </a>
  )
}
```

### Deep Link Format
```
https://yi-studio.yichapter.org/dashboard/create?eventId={your-event-id}&source={your-app-id}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `eventId` | Yes | Your application's event ID |
| `source` | Yes | Your app identifier (e.g., `myjkkn`) |

---

## Step 4: Webhook Response Handling

### Success Response (200)
```json
{
  "success": true,
  "action": "created",
  "synced_event": {
    "id": "uuid-in-yi-studio",
    "external_id": "your-event-id",
    "name": "Annual Conference 2026",
    "synced_at": "2026-01-28T10:30:00Z"
  }
}
```

### Error Responses

| Status | Error | Resolution |
|--------|-------|------------|
| 400 | `Missing X-Source-App-Id header` | Add the header |
| 400 | `Invalid action` | Use: create, update, delete |
| 400 | `Event ID required for delete` | Include event.id |
| 400 | `Invalid event data` | Check required fields |
| 401 | `Invalid webhook secret` | Check your secret |
| 403 | `Event source is disabled` | Contact Yi Studio admin |
| 500 | `Failed to sync event` | Retry later |

---

## Complete Integration Checklist

- [ ] Set environment variables (`YI_STUDIO_WEBHOOK_URL`, `YI_STUDIO_WEBHOOK_SECRET`, `YI_STUDIO_ORG_ID`)
- [ ] Create webhook sync service (`lib/webhooks/yi-studio-sync.ts`)
- [ ] Call `syncEventToYiStudio('create', event)` when creating events
- [ ] Call `syncEventToYiStudio('update', event)` when updating events
- [ ] Call `syncEventToYiStudio('delete', { id })` when deleting events
- [ ] Add "Create Poster" button with deep link to event detail page
- [ ] Test the integration with a sample event

---

## Testing

### Test Webhook Endpoint (Basic)
```bash
curl -X POST https://yi-studio.yichapter.org/api/webhooks/events \
  -H "Content-Type: application/json" \
  -H "X-Source-App-Id: myjkkn" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "action": "create",
    "organization_id": "your-yi-studio-org-uuid",
    "event": {
      "id": "test-event-001",
      "name": "Test Conference 2026",
      "date": "2026-03-15",
      "startTime": "10:00",
      "endTime": "17:00",
      "venue": "Convention Center",
      "status": "published",
      "createdAt": "2026-01-28T10:00:00Z",
      "updatedAt": "2026-01-28T10:00:00Z"
    }
  }'
```

### Test Webhook Endpoint (v2.0 Full)
```bash
curl -X POST https://yi-studio.yichapter.org/api/webhooks/events \
  -H "Content-Type: application/json" \
  -H "X-Source-App-Id: yi-connect" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "action": "create",
    "organization_id": "your-yi-studio-org-uuid",
    "event": {
      "id": "test-event-002",
      "name": "Annual Yi Conference 2026",
      "date": "2026-03-15",
      "startTime": "10:00",
      "endTime": "17:00",
      "venue": "Chennai Trade Centre",
      "venueAddress": "Nandambakkam, Chennai, Tamil Nadu 600089",
      "city": "Chennai",
      "venueLatitude": 13.0067,
      "venueLongitude": 80.1802,
      "venueCapacity": 500,
      "isVirtual": false,
      "chapterName": "Yi Chapter Chennai",
      "chapterLocation": "Chennai",
      "eventType": "conference",
      "description": "Join us for the biggest Yi event of the year!",
      "tags": ["annual", "flagship", "networking"],
      "isFeatured": true,
      "registrationStartDate": "2026-02-01",
      "registrationDeadline": "2026-03-10",
      "maxCapacity": 500,
      "currentRegistrations": 245,
      "waitlistEnabled": true,
      "allowGuests": true,
      "guestLimit": 1,
      "bannerImageUrl": "https://example.com/banners/conference-2026.jpg",
      "status": "published",
      "createdAt": "2026-01-15T08:30:00Z",
      "updatedAt": "2026-01-28T14:22:00Z"
    }
  }'
```

### Check Webhook Health
```bash
curl https://yi-studio.yichapter.org/api/webhooks/events
```

Response:
```json
{
  "status": "ok",
  "endpoint": "/api/webhooks/events",
  "methods": ["POST"],
  "headers": {
    "required": ["X-Source-App-Id"],
    "optional": ["X-Webhook-Secret"]
  },
  "actions": ["create", "update", "delete"]
}
```

---

## Yi Connect Integration Example

If you're integrating from Yi Connect, use this transformation function:

```typescript
/**
 * Transform Yi Connect event to Yi Studio's ExternalEvent format
 */
function transformYiConnectEvent(event: YiConnectEvent): ExternalEvent {
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
    bannerImageUrl: event.banner_image_url || event.banner_url || undefined,
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
function mapYiConnectStatus(status: string): 'draft' | 'published' | 'completed' | 'cancelled' {
  const statusMap: Record<string, 'draft' | 'published' | 'completed' | 'cancelled'> = {
    draft: 'draft',
    published: 'published',
    ongoing: 'published',  // Map ongoing to published
    completed: 'completed',
    cancelled: 'cancelled',
  }
  return statusMap[status] || 'published'
}
```

### Yi Connect Field Mapping Reference

| Yi Connect Field | ExternalEvent Field |
|------------------|---------------------|
| `id` | `id` |
| `title` | `name` |
| `start_date` (split) | `date`, `startTime` |
| `end_date` (split) | `endTime` |
| `venue.name` | `venue` |
| `venue.address` or `venue_address` | `venueAddress` |
| `chapter.location` | `city` |
| `venue_latitude` | `venueLatitude` |
| `venue_longitude` | `venueLongitude` |
| `venue.capacity` | `venueCapacity` |
| `is_virtual` | `isVirtual` |
| `virtual_meeting_link` | `virtualMeetingLink` |
| `chapter.name` | `chapterName`, `organizationName` |
| `chapter.location` | `chapterLocation` |
| `organizer.profile.full_name` | `organizerName` |
| `category` | `eventType` |
| `description` | `description` |
| `tags` | `tags` |
| `is_featured` | `isFeatured` |
| `registration_start_date` | `registrationStartDate` |
| `registration_end_date` | `registrationDeadline` |
| `max_capacity` | `maxCapacity` |
| `current_registrations` | `currentRegistrations` |
| `waitlist_enabled` | `waitlistEnabled` |
| `allow_guests` | `allowGuests` |
| `guest_limit` | `guestLimit` |
| `banner_image_url` | `bannerImageUrl` |
| `status` | `status` (mapped) |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |

---

## Recommended Fields for Poster Generation

For best poster results, prioritize these fields:

| Priority | Field | Use Case |
|----------|-------|----------|
| **High** | `name` | Event title on poster |
| **High** | `date`, `startTime` | Date/time display |
| **High** | `venue` | Venue name |
| **High** | `bannerImageUrl` | Background image |
| **Medium** | `isVirtual` | Virtual event badge |
| **Medium** | `chapterName` | Yi chapter branding |
| **Medium** | `tags` | Hashtags on poster |
| **Medium** | `maxCapacity` + `currentRegistrations` | "Only X spots left!" |
| **Medium** | `speakers` | Speaker info/photos |
| **Low** | `registrationDeadline` | "Register by X" text |
| **Low** | `entryFee` | Pricing info |
| **Low** | `venueLatitude/Longitude` | Map QR code |

---

## Support

For integration support, contact the Yi CreativeStudio team.
