# Yi Connect Event Schema

## For Yi Creative Studio Integration

This document describes all available event fields from Yi Connect that can be included in the webhook payload to Yi Creative Studio.

---

## Environment Variables

Add these to your `.env.local` file to enable Yi Creative Studio integration:

```env
# Yi Creative Studio Integration (optional - sync disabled if not set)
YI_STUDIO_WEBHOOK_URL=https://yi-studio.yichapter.org/api/webhooks/events
YI_STUDIO_WEBHOOK_SECRET=your-shared-secret
YI_STUDIO_ORG_ID=your-yi-studio-organization-uuid
NEXT_PUBLIC_YI_STUDIO_URL=https://yi-studio.yichapter.org
```

| Variable | Required | Description |
|----------|----------|-------------|
| `YI_STUDIO_WEBHOOK_URL` | Yes | Webhook endpoint for syncing events |
| `YI_STUDIO_WEBHOOK_SECRET` | Recommended | Shared secret for webhook authentication |
| `YI_STUDIO_ORG_ID` | Yes | Your organization UUID in Yi Studio |
| `NEXT_PUBLIC_YI_STUDIO_URL` | For UI | Base URL for "Create Poster" button deep links |

---

## Core Event Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique event identifier (UUID) |
| `title` | `string` | Yes | Event title/name |
| `description` | `string \| null` | No | Event description (can be HTML or plain text) |
| `category` | `enum` | Yes | Event type (see Category Mapping below) |
| `status` | `enum` | Yes | Event status (see Status Mapping below) |

---

## Date & Time Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start_date` | `string` | Yes | Event start datetime (ISO 8601 format, e.g., `2026-03-15T10:00:00Z`) |
| `end_date` | `string` | Yes | Event end datetime (ISO 8601 format) |
| `registration_start_date` | `string \| null` | No | When registration opens |
| `registration_end_date` | `string \| null` | No | Registration deadline |

**Note:** To extract date and time separately:
- Date: `start_date.split('T')[0]` → `2026-03-15`
- Time: Extract time portion → `10:00`

---

## Venue Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `venue_id` | `string \| null` | No | Reference to venue table (UUID) |
| `venue_address` | `string \| null` | No | Direct address override (used when no venue_id) |
| `venue_latitude` | `number \| null` | No | GPS latitude for map integration |
| `venue_longitude` | `number \| null` | No | GPS longitude for map integration |
| `is_virtual` | `boolean` | Yes | Whether event is online-only (default: false) |
| `virtual_meeting_link` | `string \| null` | No | Meeting URL (Zoom, Google Meet, etc.) |

### Venue Object (when joined)

| Field | Type | Description |
|-------|------|-------------|
| `venue.id` | `string` | Venue UUID |
| `venue.name` | `string` | Venue name (e.g., "Convention Center") |
| `venue.address` | `string` | Full venue address |
| `venue.capacity` | `number \| null` | Maximum venue capacity |

---

## Organization Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chapter_id` | `string` | Yes | Yi Chapter ID (organization UUID) |
| `organizer_id` | `string` | Yes | Event organizer member ID (UUID) |

### Chapter Object (when joined)

| Field | Type | Description |
|-------|------|-------------|
| `chapter.id` | `string` | Chapter UUID |
| `chapter.name` | `string` | Chapter name (e.g., "Yi Chapter Chennai") |
| `chapter.location` | `string` | Chapter city/location |

### Organizer Object (when joined)

| Field | Type | Description |
|-------|------|-------------|
| `organizer.id` | `string` | Member UUID |
| `organizer.profile.full_name` | `string` | Organizer's full name |
| `organizer.profile.email` | `string` | Organizer's email address |
| `organizer.profile.avatar_url` | `string \| null` | Organizer's profile photo URL |

---

## Capacity & Registration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_capacity` | `number \| null` | No | Maximum number of attendees |
| `current_registrations` | `number` | Yes | Current RSVP count (default: 0) |
| `waitlist_enabled` | `boolean` | Yes | Whether waitlist is enabled when at capacity |
| `requires_approval` | `boolean` | Yes | Whether RSVPs require organizer approval |
| `allow_guests` | `boolean` | Yes | Whether members can bring +1 guests |
| `guest_limit` | `number \| null` | No | Maximum guests per member |

---

## Media Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `banner_image_url` | `string \| null` | No | Event banner/cover image URL (preferred) |
| `banner_url` | `string \| null` | No | Alternative banner field (legacy) |

**Note:** Use `banner_image_url` if available, fall back to `banner_url`.

---

## Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_featured` | `boolean` | Yes | Whether event is featured/highlighted |
| `send_reminders` | `boolean` | Yes | Whether to send reminder notifications |
| `tags` | `string[] \| null` | No | Event tags/labels for categorization |
| `estimated_budget` | `number \| null` | No | Estimated budget amount (confidential) |
| `template_id` | `string \| null` | No | Reference to event template used |
| `attachments` | `JSON \| null` | No | Additional file attachments |
| `custom_fields` | `JSON \| null` | No | Custom metadata fields |
| `created_at` | `string` | Yes | Creation timestamp (ISO 8601) |
| `updated_at` | `string` | Yes | Last update timestamp (ISO 8601) |

---

## Extended Data (Available via Extended Queries)

These fields are available when fetching full event details:

| Field | Type | Description |
|-------|------|-------------|
| `rsvps` | `array` | List of RSVPs with member details |
| `guest_rsvps` | `array` | List of guest RSVPs |
| `volunteers` | `array` | Assigned volunteers with roles |
| `documents` | `array` | Attached files (photos, reports, certificates) |
| `feedback` | `array` | Post-event feedback submissions |
| `impact_metrics` | `object` | Post-event metrics (attendance, satisfaction, etc.) |
| `venue_booking` | `object` | Venue booking details |
| `resource_bookings` | `array` | Booked resources (projectors, chairs, etc.) |

---

## Status Mapping

Yi Connect event statuses and their meanings:

| Status | Description | Sync to Yi Studio |
|--------|-------------|-------------------|
| `draft` | Event is being created, not visible to members | `draft` |
| `published` | Event is live and accepting RSVPs | `published` |
| `ongoing` | Event is currently happening | `published` |
| `completed` | Event has ended | `completed` |
| `cancelled` | Event was cancelled | `cancelled` |

---

## Category Mapping

Available event categories in Yi Connect:

| Value | Display Name | Description |
|-------|--------------|-------------|
| `conference` | Conference | Large-scale multi-session events |
| `workshop` | Workshop | Hands-on learning sessions |
| `seminar` | Seminar | Educational presentations |
| `networking` | Networking | Professional networking events |
| `training` | Training | Skill development programs |
| `social` | Social | Social gatherings and celebrations |
| `community_service` | Community Service | Volunteer and service activities |
| `fundraiser` | Fundraiser | Fundraising events |
| `meeting` | Meeting | Chapter meetings and assemblies |
| `other` | Other | Miscellaneous events |

---

## Example Event Object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Annual Yi Conference 2026",
  "description": "Join us for the biggest Yi event of the year...",
  "category": "conference",
  "status": "published",
  "start_date": "2026-03-15T10:00:00Z",
  "end_date": "2026-03-15T18:00:00Z",
  "registration_start_date": "2026-02-01T00:00:00Z",
  "registration_end_date": "2026-03-10T23:59:59Z",
  "venue_id": "660e8400-e29b-41d4-a716-446655440001",
  "venue_address": null,
  "venue_latitude": 13.0827,
  "venue_longitude": 80.2707,
  "is_virtual": false,
  "virtual_meeting_link": null,
  "max_capacity": 500,
  "current_registrations": 245,
  "waitlist_enabled": true,
  "requires_approval": false,
  "allow_guests": true,
  "guest_limit": 1,
  "is_featured": true,
  "send_reminders": true,
  "banner_image_url": "https://example.com/banners/conference-2026.jpg",
  "banner_url": null,
  "tags": ["annual", "flagship", "networking"],
  "estimated_budget": 150000,
  "chapter_id": "770e8400-e29b-41d4-a716-446655440002",
  "organizer_id": "880e8400-e29b-41d4-a716-446655440003",
  "template_id": null,
  "created_at": "2026-01-15T08:30:00Z",
  "updated_at": "2026-01-28T14:22:00Z",
  "venue": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Chennai Trade Centre",
    "address": "Nandambakkam, Chennai, Tamil Nadu 600089",
    "capacity": 1000
  },
  "chapter": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Yi Chapter Chennai",
    "location": "Chennai"
  },
  "organizer": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "profile": {
      "full_name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "avatar_url": "https://example.com/avatars/rajesh.jpg"
    }
  }
}
```

---

## Recommended Fields for Poster Generation

For Yi Creative Studio poster generation, the most useful fields are:

| Priority | Field | Use Case |
|----------|-------|----------|
| High | `title` | Event name on poster |
| High | `start_date` | Date and time display |
| High | `venue.name` | Venue name |
| High | `venue.address` or `venue_address` | Location details |
| High | `banner_image_url` | Background or featured image |
| Medium | `description` | Event details (truncated) |
| Medium | `category` | Event type badge |
| Medium | `chapter.name` | Organizing chapter |
| Medium | `organizer.profile.full_name` | Organizer credit |
| Low | `registration_end_date` | Registration deadline |
| Low | `max_capacity` | "Limited seats" messaging |
| Low | `tags` | Hashtags or keywords |

---

## Integration Notes

1. **Date/Time Handling**: Yi Connect stores datetime in ISO 8601 format. Extract date and time portions as needed.

2. **Venue Priority**: Use `venue.name` and `venue.address` from joined data. Fall back to `venue_address` if `venue_id` is null.

3. **Banner Image**: Prefer `banner_image_url` over `banner_url`. Both may contain absolute URLs or base64 data URIs.

4. **Status Filtering**: For poster generation, typically only sync events with `status: 'published'` or `status: 'ongoing'`.

5. **Confidential Fields**: Avoid exposing `estimated_budget`, `virtual_meeting_link` (security), and internal IDs in public contexts.
