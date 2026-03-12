# Yi Connect SSO Event Data Schema

> **For Yi Creative Studio Team**
> Updated: February 9, 2026

## Overview

When a user clicks "Create Poster" in Yi Connect, we send an SSO token containing event data. This document describes the exact data format Yi Creative Studio should expect.

## SSO Token Payload Structure

The JWT token contains an `event_data` object with the following fields:

```typescript
interface EventData {
  // === REQUIRED FIELDS ===
  id: string              // Event UUID (e.g., "ef000005-0000-4000-a000-000000000001")
  name: string            // Event title (e.g., "Road Safety Helmet Awareness Rally")
  date: string            // ISO date ONLY: "2026-02-15" (no timestamp)
  startTime: string       // 24h format: "10:00"
  endTime: string         // 24h format: "17:00"
  eventType: string       // Category (e.g., "conference", "workshop", "seminar")

  // === LOCATION (nullable) ===
  venue: string | null        // Venue NAME only (e.g., "City Center")
  venueAddress: string | null // Full address (e.g., "123 Main Circle Road")
  city: string | null         // City name (e.g., "Demo City")

  // === CHAPTER INFO ===
  chapterId: string           // Chapter UUID
  chapterName: string         // e.g., "Yi Chennai"
  chapterLocation: string     // e.g., "Chennai, Tamil Nadu"

  // === CONTENT (nullable) ===
  description: string | null      // Event description
  bannerImageUrl: string | null   // Existing banner image URL

  // === VIRTUAL EVENT ===
  isVirtual: boolean                  // true for online events
  virtualMeetingLink?: string | null  // Zoom/Meet URL if virtual
}
```

## Example Payload

```json
{
  "event_data": {
    "id": "ef000005-0000-4000-a000-000000000001",
    "name": "Road Safety Helmet Awareness Rally",
    "date": "2026-02-15",
    "startTime": "10:00",
    "endTime": "17:00",
    "venue": "City Center",
    "venueAddress": "Main Circle Road",
    "city": "Demo City",
    "description": "Motorcycle rally to spread awareness about helmet safety. Expected 200+ participants.",
    "bannerImageUrl": null,
    "eventType": "awareness",
    "chapterId": "ch000001-0000-4000-a000-000000000001",
    "chapterName": "Yi Chennai",
    "chapterLocation": "Chennai",
    "isVirtual": false,
    "virtualMeetingLink": null
  }
}
```

## Field Mapping for Yi Creative Form

| Yi Connect Sends | Yi Creative Form Field | Format |
|------------------|------------------------|--------|
| `name` | Event Title | String |
| `description` | Event Description | String (nullable) |
| `date` | Event Date | "YYYY-MM-DD" |
| `startTime` | Event Time (Start) | "HH:MM" (24h) |
| `endTime` | Event Time (End) | "HH:MM" (24h) |
| `venue` | Venue Name | String (nullable) |
| `venueAddress` | Venue Address | String (nullable) |
| `city` | City | String (nullable) |
| `chapterName` | Chapter Name | String |
| `bannerImageUrl` | Existing Banner | URL (nullable) |

## Important Notes

1. **Date Format**: We send ISO date only (`2026-02-15`), NOT a full timestamp
2. **Time Format**: We send 24-hour format (`10:00`, `17:00`), NOT 12-hour AM/PM
3. **Venue Fields**: `venue`, `venueAddress`, and `city` are sent as **separate fields** - do NOT concatenate them
4. **All field names are camelCase** to match the ExternalEvent schema

## Environment Variable Required

Yi Creative Studio needs the public key to verify SSO tokens:

```env
YI_CONNECT_SSO_PUBLIC_KEY="LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF0NGd6MVAxK0haeFdDOU5ZcHpSUQo1MkVpUklYNUNBWm9hZTJwdDU4SWNwcTBERUNqZ0h0bzZHcGE0Y2JyWThMRmRac1hQenNPSDZzT0tzNkxiTkVYClVOeGRkVzJMVlR0YVFlTURrNEROSUtTTGZkVXBSQVcxTFZ4Q0lqeHUyM2hTQVh4N3hRQkZYNWFlVHgxRHVlRDAKNi9Nc3ltb09LNVhwQVdFSlNTdzZ4RHV5cWxINTl4c2VWY21ENUlQbW1FSnE3MkkyNzFLNjJ4QkhYa1lFcW5NMwpsVU52RmNQcDEwclRBS1dvUkdXOWlQYzF5Qjlqb1JzZ3c1WVpHVjBCbG5CeDNoS0RrSThxUHNNeTk1K2tycTczCk5kOVU4THlBUlNzaThxTUU0SXVDN3ZFMU1tdjhkbjk2eXdTR3FkYkdWSTN4UXhuWVMrelh5TXg0Yzl2SG1iYncKVVFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg=="
```

## Contact

For questions about this integration, contact the Yi Connect development team.
