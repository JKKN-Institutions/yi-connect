# Industrial Visits Module (IV)

## Overview
The Industrial Visits (IV) module is a specialized extension of the **Events Module**. It leverages the same event management framework but introduces additional workflows, fields, and access rules specific to industrial visits hosted by partnering industries.

---

## 1. Design Philosophy
**Why inside Events?**
- Industrial Visits share 80% of the same logic as regular events: date/time, RSVP, reminders, attendance, feedback, and calendar integration.
- 20% of features are unique to IVs, such as carpool coordination, self-service industry slots, and capacity management.

The IV module therefore resides **within the Events system**, using specialized forms, views, and workflows.

---

## 2. Module Structure

### Member Interface
- View all events (calendar view)
- Browse Industrial Visits (marketplace-style)
- My Bookings
- Request New Visit

### Industry Portal (Separate Access)
- Industry login (different authentication)
- Add IV slots
- View bookings and feedback
- Download attendee lists

---

## 3. Database Structure

### 3.1 IV Slot Record
Represents each industrial visit event.

**Fields:**
- ID (auto-generated)
- Industry (linked to Stakeholder CRM)
- Date, Start Time, End Time, Duration (auto-calculated)
- Capacity, Bookings Count, Remaining Slots (auto-calculated)
- Status: Draft / Published / Full / Cancelled / Completed
- Entry Method: Manual / Self-Service
- Created By, Created Date, Last Updated

**Additional IV Fields:**
- Requirements (closed shoes, long pants, safety gear, etc.)
- Learning Outcomes, Summary, Contact Person (name, phone, role)
- Logistics (parking, food, meeting point, arrival time)
- Post-Visit Data (attendance, rating, host willingness)

### 3.2 Booking Record
Captures member registrations for IV slots.

**Fields:**
- ID, IV Slot, Member, Booking Date
- Status: Confirmed / Waitlisted / Cancelled / Attended / No-Show
- Family Count and Names
- Carpool Info: Need Ride / Offering Ride / Seats Available / Pickup Details
- Attendance Details (Checked-In, Time, By Whom)
- Feedback (Submitted, Rating, Comments)

### 3.3 Industry Portal Account
Represents industry users who can self-manage IVs.

**Fields:**
- Industry, User Name, Email, Phone, Role
- Status: Active / Inactive / Suspended
- Portal Permissions (add/edit/cancel/view)
- Invitation Status (Invited / Accepted)

---

## 4. Core Workflows

### Workflow 1: Yi Admin Adds Slot
1. Admin fills form in Events > Industrial Visits.
2. Links to existing industry record from CRM.
3. Sets capacity, date, requirements, and contact person.
4. Publishes the slot → appears in both Events Calendar and IV listings.

**Automation:**
- Sends confirmation emails to industry and entrepreneurship chair.
- Publishes slot instantly to members.

### Workflow 2: Industry Adds Slot via Portal
1. Industry user logs into Industry Portal.
2. Fills date, time, and capacity.
3. Publishes slot → instantly visible to members.
4. Sends alerts to Yi admin and industry contact.

### Workflow 3: Member Books Slot
1. Member clicks “Book Now” on an available IV.
2. Confirms family count and transport preference.
3. System validates available capacity.
4. Confirms booking and reduces available slots.

**Automated Messages:**
- Member confirmation
- Industry notification (batched)
- Admin daily digest

### Workflow 4: Reminders
Triggered automatically at scheduled intervals:
- 7 days before → Reminder with checklist
- 1 day before → Final reminder
- Same day morning → Event starting alert
- Industry notified of final attendee count

### Workflow 5: Cancellations
Supports both member and industry-initiated cancellations.
- Member cancels → frees slot and notifies waitlisted users.
- Industry cancels → notifies all attendees and updates status.

### Workflow 6: Post-Visit Feedback
1. Automatically triggered next morning after IV.
2. Members receive feedback email with rating and comments.
3. System aggregates scores → updates Industry profile.
4. Sends “Thank You” email to Industry with summary report.

### Workflow 7: Waitlist & Capacity Changes
- When full → converts to waitlist.
- If industry increases capacity → auto-notifies waitlisted members.

---

## 5. Email System Overview

### Email Categories
| Type | Recipient | Trigger |
|------|------------|----------|
| Slot Confirmation | Industry | Admin adds slot manually |
| Slot Published | Admin | Industry publishes slot |
| Booking Confirmation | Member | Booking completed |
| Booking Digest | Admin | Daily 6 PM summary |
| Reminder (7d / 1d / Same Day) | Member | Scheduled interval |
| Final Count | Industry | Day before visit |
| Feedback Request | Member | Day after visit |
| Thank You Summary | Industry | 48 hours after visit |
| Cancellation Notice | All affected | Slot cancelled |
| Waitlist Open | Waitlisted Members | Slot reopens |

**Email Rules:**
- Always from noreply@yierode.in or notifications@yierode.in.
- Mobile-friendly HTML + plain text version.
- Unsubscribe applies only to IV-specific notifications.
- Batch notifications when multiple bookings occur.

---

## 6. Permissions Matrix

| Action | Yi Admin | Chair | EC | Member | Industry |
|---------|-----------|--------|-----|----------|
| Add Slot (Manual) | Yes | Yes | No | No | No |
| Add Slot (Portal) | No | No | No | No | Yes |
| Edit Slot | Yes | Yes | No | No | Yes (own) |
| Cancel Slot | Yes | Yes | No | No | Yes (own) |
| Book Slot | Yes | Yes | Yes | Yes | No |
| Cancel Booking | Yes | Yes | Yes | Yes | N/A |
| Check-In | Yes | Yes | Yes | No | Yes (own) |
| View Analytics | Yes | Yes | Limited | No | Own IVs |

**Visibility Rules:**
- Industry sees full details for attendees of its own IVs.
- Members see only attendee names.
- EC sees names + phone numbers.
- Admins see full data.

---

## 7. Reports & Analytics

**Reports to Implement:**
1. Upcoming IVs Dashboard – real-time status, color-coded by capacity.
2. Booking Report – date, capacity, booked, remaining, status.
3. Participation Report – per-member participation history.
4. Industry Performance Report – IV count, rating, feedback summary.
5. Carpool Efficiency – total rides offered, seats shared, carbon saved.
6. Entrepreneurship Vertical Summary – KPI linkage for quarterly reports.

---

## 8. Edge Cases & Handling

- Overbooking: Lock slot record before final save.
- Industry capacity increase: Notify waitlist automatically.
- Member late cancellations: Tracked and flagged.
- Industry contact change: Pulls from updated Stakeholder CRM record.
- Accidental deletion: Implement soft delete with 30-day recovery.

---

## 9. Integration Points

| Module | Integration |
|---------|--------------|
| Stakeholder CRM | Industry records & contacts |
| Member Intelligence | Profiles & notifications |
| Vertical Tracker | Entrepreneurship metrics |
| Knowledge Management | Stores IV best practices |
| Communication Hub | Announcement templates |

---

## 10. Development Phases

| Phase | Duration | Deliverables |
|--------|-----------|---------------|
| Phase 1 | Weeks 1–3 | Manual IV slot creation, booking, and reminders |
| Phase 2 | Weeks 4–5 | Carpool, capacity alerts, waitlist |
| Phase 3 | Weeks 6–8 | Industry Portal (self-service) |
| Phase 4 | Later | WhatsApp notifications integration |

---

## 11. Migration Plan
1. Build and test internally with dummy data.
2. Soft launch to Entrepreneurship EC.
3. Pilot with one industry (e.g., Saint Gobain).
4. Gradually expand to all IVs.
5. Transition fully from WhatsApp-based RSVP to system booking.

---

## 12. Completion Checklist
- Admin slot management
- Member booking & cancellation
- Capacity enforcement
- Email workflows & reminders
- Feedback & reporting
- Industry portal (Phase 3)
- Carpool & waitlist (Phase 2)
- Integration testing with other modules

---

_End of Industrial Visits Module Documentation_

