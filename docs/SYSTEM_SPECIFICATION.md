# Yi Connect - System Specification

> **Generated:** December 30, 2025
> **Source:** Codebase exploration + stakeholder interview
> **Status:** Authoritative specification for implementation decisions

---

## 1. System Overview

### 1.1 Core Purpose

Yi Connect automates manual processes for Yi Chapter operations. Previously, member info, events, finance, and communications lived in scattered spreadsheets with manual RSVP tracking, approval workflows, and reporting. This system unifies and automates everything.

### 1.2 Architecture Summary

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 + React 19 | App Router, Server Components default |
| Styling | Tailwind CSS 4 + shadcn/ui | New York style, 50+ Radix primitives |
| Backend | Supabase | PostgreSQL, Auth, Storage, RLS |
| PWA | Serwist 9.2 | Offline sync, push notifications |
| External | WhatsApp (separate service), Resend email, Anthropic AI |

### 1.3 Deployment Model

**Single Tenant** - Each chapter deploys their own instance with isolated database. No multi-tenancy planned.

---

## 2. User Personas & Access

### 2.1 Primary Persona

**Mobile-first members** - Busy professionals checking events and engagement on the go between meetings. Desktop is secondary for admin operations.

### 2.2 Role Hierarchy (6 Levels)

| Level | Role | Typical Permissions |
|-------|------|---------------------|
| 1 | Yi Member | View events, RSVP, update own profile |
| 2 | Sub-Chapter Lead / Coordinator | Manage sub-chapter members, create events |
| 3 | Co-Chair | Assist Chair, approve certain requests |
| 4 | Chair | Full chapter management, final approvals |
| 5 | Executive Member | Cross-chapter visibility, policy decisions |
| 6 | National Admin | All chapters, national sync, benchmarking |

### 2.3 Permission Model

**Hybrid Matrix** - Hierarchy governs general access, but functional roles (Finance Lead, Communications Lead) have cross-cutting permissions for their specific domains regardless of hierarchy level.

---

## 3. Module Specifications

### 3.1 Member Intelligence Hub

#### Engagement Score Calculation

**Formula:** Event-weighted composite score

| Factor | Weight | Measurement |
|--------|--------|-------------|
| Event Attendance | 50% | Events attended / Events eligible |
| Volunteer Hours | 30% | Hours volunteered in period |
| Feedback Given | 15% | Post-event feedback submissions |
| Skills Added | 5% | Profile completeness, certifications |

**Implementation:** Replace placeholder `0` in `/lib/data/members.ts` line 249 with calculated score.

#### Leadership Readiness Score

**Formula:** Composite with configurable weights

| Factor | Default Weight | Source |
|--------|----------------|--------|
| Tenure | 25% | Years of Yi membership |
| Positions Held | 25% | Previous leadership roles |
| Training Completed | 25% | Leadership modules finished |
| Peer Input | 25% | Nominations + committee recommendations |

**Implementation:** Replace placeholder `0` in `/lib/data/members.ts` line 250.

#### AI Skill Validation

**Purpose:** Anthropic AI reviews self-reported skills against industry standards and suggests corrections.

**Flow:**
1. Member adds skill to profile
2. AI validates against known skill taxonomies
3. Suggests standardized skill name if non-standard
4. Flags potential mismatches for review

---

### 3.2 Event Lifecycle Manager

#### QR Check-in System

**Mode:** Flexible system supporting multiple approaches:
- Per-event QR (attendees scan event code)
- Per-attendee QR (volunteers scan member's RSVP code)
- Permanent member QR (member's profile QR scanned at any event)

Event organizer selects mode based on event type and size.

#### Event-Weighted Engagement

Events feed into member engagement scores via:
- Attendance tracking (50% weight)
- Volunteer participation (30% weight)
- Post-event feedback submission (15% weight)

---

### 3.3 Financial Command Center

#### Approval Workflow

**Two-level approval system:**

| Amount Threshold | Level 1 | Level 2 |
|------------------|---------|---------|
| Standard expenses | Vertical Head | - |
| Large expenses (configurable) | Vertical Head | Chair / Finance Lead |

**Approver Actions:**
- Approve
- Reject
- Send back for modification (with comments)

#### Budget Utilization Metrics

Already implemented in `/lib/data/finance.ts`:
- `utilization_percentage`: `(spent / total) * 100`
- `is_overbudget`: `spent > total`
- `is_near_limit`: `(spent / total) >= 0.8`

---

### 3.4 Stakeholder Relationship CRM

#### Health Score Calculation

**Method:** Auto-calculated from interaction frequency

| Signal | Impact |
|--------|--------|
| Recent contact logged | Positive |
| Meeting held | Positive |
| Communication sent | Positive |
| No interaction > 30 days | Negative decay |
| MoU expired | Significant negative |

#### MoU Expiry Automation

When MoU approaches expiry:
1. **Alert** - Notify relationship owner X days before
2. **Score Impact** - Health score automatically drops on expiry
3. **Workflow Trigger** - Create renewal task/discussion item

---

### 3.5 Succession & Leadership Pipeline

> **Note:** Keep for last implementation phase - complex but lower priority

#### Complexity Factors
- Multi-stage process (Nominations → Applications → Jury scoring → Member voting → Results)
- Role-specific eligibility and voting rules
- Audit requirements for vote anonymity and verifiability

#### Jury Selection

**Mixed system:**
- Automatic: Certain roles (past chairs, vertical heads) become jury by default
- Appointed: Chair selects additional jury members per award cycle

---

### 3.6 Take Pride Awards

#### Jury Scoring System

Same mixed selection as Succession:
- Role-based automatic jury membership
- Chair-appointed additions

Weighted scoring by category with configurable weights per award type.

---

### 3.7 Communication Hub

#### Audience Segmentation

**Multi-dimensional filtering:**
- Vertical membership
- Engagement level tier
- Skills and certifications
- Custom tags
- Combined criteria (AND/OR logic)

#### Push Notification Triggers

Comprehensive notifications for:
- Event reminders (RSVP'd events)
- New announcements (chapter-wide or targeted)
- Task assignments (volunteer, committee, reviewer)
- Deadline warnings
- Approval requests
- Mentions

---

### 3.8 Knowledge Management

#### Access Control

**Vertical Heads+** - Only vertical heads and above can create/edit wiki pages and best practices. Regular members have read-only access.

---

### 3.9 Vertical Performance Tracker

#### KPI Framework

**Core + Custom model:**

| Core KPIs (All Verticals) | Custom KPIs (Per Vertical) |
|---------------------------|---------------------------|
| Events held | Domain-specific metrics |
| Budget utilization | Vertical-defined goals |
| Member engagement | Custom deliverables |
| Attendance rates | Specialized outputs |

---

### 3.10 National Integration Layer

#### Sync Model

**Pull from chapters** - National system queries chapter databases for aggregated reports. Chapters don't push; National pulls when needed.

#### Data Shared
- Anonymized metrics
- Benchmarking data
- Leadership sync information
- Aggregated reports

---

### 3.11 Mobile Command Center (PWA)

#### Offline Conflict Resolution

**Server Wins** - When offline changes conflict with server state (e.g., RSVP to now-full event), server state prevails. User receives explanation of why offline action was rejected.

#### Mobile Architecture Rationale

Separate `/m/` route group (not just responsive design) because:
1. **Different user journeys** - Quick actions (check-in, view schedule) vs full admin
2. **Performance** - Lighter pages, smaller bundles for 3G/4G
3. **Offline-first** - Mobile routes designed around PWA capabilities

---

## 4. Business Rules

### 4.1 Configurability

**Chapter Configurable** - Business rules should be admin-configurable per chapter, not hardcoded. Different chapters have different operational needs.

| Rule | Default | Configurable |
|------|---------|--------------|
| Advance booking window | 7 days | Yes |
| Trainer max visits/month | 6 | Yes |
| Material approval required | Yes | Yes |
| Large expense threshold | TBD | Yes |
| Engagement score weights | 50/30/15/5 | Yes |
| Readiness score weights | 25/25/25/25 | Yes |

### 4.2 Industrial Visits

#### Trainer Management

**Both internal and external trainers:**
- Internal: Yi members with trainer flag in profile
- External: Professional trainers from partner organizations
- All tracked with post-session feedback ratings

---

## 5. Member Lifecycle

### 5.1 Onboarding Workflow

**Multi-step verification:**
1. **Application** - Prospective member submits request
2. **Document Verification** - Verify professional credentials/company/education
3. **Interview** - Meeting with chapter leadership
4. **Admin Approval** - Final approval by chapter admin
5. **Whitelist Addition** - Email added to approved_emails table
6. **Account Creation** - Member can now register

### 5.2 Data Retention

**GDPR-style deletion:**
- Full data deletion upon member request
- Historical records anonymized (not deleted) for reporting continuity
- PII removed, aggregate data retained

---

## 6. Technical Decisions

### 6.1 Caching Strategy

**Intentional mix:**
- `revalidatePath()` - Page-level cache invalidation
- `updateTag()` - Component-level granular invalidation

Both are needed for different use cases. Not consolidating.

### 6.2 Pagination Strategy

**Hybrid approach:**
- Client-side (TanStack Table) for small datasets (members list, events)
- Server-side pagination needed for large datasets (audit logs, transactions, historical data)

### 6.3 Toast Notifications

**Leave both libraries:**
- react-hot-toast (data tables)
- sonner (forms)

Working, not worth refactor time.

### 6.4 WhatsApp Integration

**Separate Node.js service** due to whatsapp-web.js requiring persistent Chromium session. Cannot run serverless/Edge Function.

### 6.5 Testing Strategy

**Claude-in-Chrome** - AI-assisted manual testing via Chrome plugin. No automated test suite currently.

---

## 7. Dashboard Configuration

### 7.1 Widget System

**Customizable** - Users configure their own dashboard widgets regardless of role. No forced role-based layouts.

### 7.2 Suggested Widgets

| For Members | For Leaders |
|-------------|-------------|
| My engagement score | Chapter health % |
| Upcoming events | Budget utilization |
| Pending tasks | Event attendance trends |
| Recent badges | Pending approvals |
| Quick RSVP | Member activity |

---

## 8. Implementation Priorities

### Phase 1: Foundation (Current)
- [x] All 11 modules structurally complete
- [ ] Engagement score calculation (replace placeholder)
- [ ] Readiness score calculation (replace placeholder)
- [ ] Business rules configurability

### Phase 2: Refinement
- [ ] Server-side pagination for large tables
- [ ] MoU expiry automation
- [ ] Health score auto-calculation
- [ ] AI skill validation integration

### Phase 3: Polish
- [ ] Succession module refinement (last priority)
- [ ] Dashboard widget customization
- [ ] Advanced segmentation UI
- [ ] Offline conflict UX improvements

---

## 9. Files Reference

### Core Data Layer
- `/lib/data/members.ts` - Member queries, engagement/readiness placeholders
- `/lib/data/events.ts` - Event lifecycle, attendance
- `/lib/data/finance.ts` - Budget, expenses, utilization metrics
- `/lib/data/communication.ts` - Announcements, segmentation
- `/lib/data/succession.ts` - Leadership pipeline (largest: 2,051 lines)

### Configuration
- `/lib/permissions.ts` - Role hierarchy, permission checks
- `/lib/business-rules.ts` - Hardcoded rules (need to make configurable)
- `/lib/validations/` - 22 Zod schema files

### Server Actions
- `/app/actions/` - 462 total actions across 34 files

### Mobile PWA
- `/app/(mobile)/` - Mobile-optimized routes
- `/app/sw.ts` - Service worker
- `/lib/offline/` - IndexedDB sync

---

## 10. Open Questions

| Question | Status | Owner |
|----------|--------|-------|
| Engagement score calculation frequency | TBD | Dev |
| Business rules admin UI design | TBD | Design |
| National sync API contract | TBD | National team |
| Server-side pagination thresholds | TBD | Dev |

---

*This specification is the authoritative source for implementation decisions. Update this document when decisions change.*
