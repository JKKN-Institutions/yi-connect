# Module 3: Event Lifecycle Manager 🎯

## Purpose
Reduce 40+ hours/month in event coordination by automating planning, RSVPs, logistics, and reporting.

**Problem:** Manual WhatsApp coordination, messy RSVP lists, missing updates, and manual reports.

**Goal:** Automate 80% of event management workflow.

---

## 3.1 Event Planning Dashboard

### Features
- Centralized screen for all upcoming events across verticals.
- Color-coded by type: Masoom (blue), Road Safety (red), Health (green), etc.
- Automatic red flags for incomplete event data.
- Smart filters: date, type, vertical, status.

---

## 3.2 Smart Event Creation

### Process
1. Select vertical → System suggests similar past events.
2. Option to copy setup (venue, team, materials, budget).
3. Auto-fills: trainers, materials, estimated cost.
4. Suggests data-driven templates: “Last Masoom at Railway School had 400 students — reuse setup?”

Reusable Component: `<EventQuickCreate/>`

---

## 3.3 Intelligent RSVP System

### Workflow
- Single link RSVP → instant responses tracked in real-time.
- Automatic reminders (3 days and 1 day before event).
- Dashboard display: “32 confirmed, 15 pending, 8 declined.”
- Family count tracking for attendance logistics.

Reusable Component: `<RSVPForm/>`, `<RSVPReminder/>`

---

## 3.4 Venue & Resource Booking

### Functionality
- Calendar view of JKKN facilities (availability shown).
- One-click booking → automatic email to facilities team.
- Tracks: Projector, sound system, chairs, lunch.
- Prevents double booking and overlapping events.

Reusable Component: `<VenueBooking/>`

---

## 3.5 Team Auto-Assignment

### Features
- Uses skill/will data from Module 1 to suggest best volunteers.
- Prioritizes under-utilized members to balance workload.
- Auto-suggests based on success history: “Priyadharshini led last 3 Masoom events — assign again?”

Reusable Component: `<TeamAssignment/>`

---

## 3.6 Materials Checklist

### Functionality
- Preloaded templates per event type.
- Example (Masoom): Trainers (5), Books (500), Registration sheets, Snacks.
- Live progress indicators (✅ Ready / ⚠️ Pending / ❌ Missing).
- Alerts if checklist incomplete 48h before event.

Reusable Component: `<MaterialsChecklist/>`

---

## 3.7 Day-of-Event Mode

### Mobile-Optimized Features
- One-tap check-in for attendees (faster than paper lists).
- Quick expense logging (voice or manual input).
- Live updates: attendance count, uploaded photos, and status indicators.

Reusable Components: `<CheckInMode/>`, `<ExpenseLogger/>`, `<PhotoUpload/>`

---

## 3.8 Instant Post-Event Reporting

### Automation
- Auto-compiles attendance, expenses, photos, and impact.
- One-click generation of report → auto-email to EC/National.
- Keeps permanent archive for each event.

Reusable Components: `<ReportGenerator/>`, `<EventSummaryCard/>`

---

## 3.9 Automation Triggers

| Scenario | Trigger | Action |
|-----------|----------|---------|
| Low RSVP Rate | 5 days before event <50% confirmed | Email Chair → “Send reminder?” |
| Budget Overrun | Expenses > planned by 20% | Alert Chair + EM to approve increase |
| Venue Conflict | Two events booked same time/place | Red alert + suggest alternate venues |
| Missing Role | 3 days before event, no MC assigned | Suggest available member |
| Best Practice Recognition | 90%+ satisfaction rating | Auto-tag as template for reuse |

---

## 3.10 Reusable Components Summary
**Forms:** `<EventQuickCreate/>`, `<RSVPForm/>`, `<VenueBooking/>`, `<TeamAssignment/>`, `<MaterialsChecklist/>`, `<ExpenseLogger/>`  
**Displays:** `<EventCalendar/>`, `<EventCard/>`, `<AttendeeList/>`, `<TimelineView/>`, `<BudgetTracker/>`  
**Workflows:** `<EventWizard/>`, `<RSVPReminder/>`, `<CheckInMode/>`, `<ReportGenerator/>`

---

_End of Module 3 – Event Lifecycle Manager_

