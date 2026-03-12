# Module 7: Communication Hub 📢 - Implementation Plan

**Status:** Ready to Start (0%)
**Priority:** HIGH (Cross-Module Dependency)
**Estimated Time:** 2-3 weeks
**Start Date:** TBD
**Dependencies:** Modules 1, 2, 3, 4 (for integration)
**Skills Required:** nextjs16-web-development, advanced-tables-components

---

## 📋 Executive Summary

Module 7 - Communication Hub is the **notification backbone** for the entire Yi Connect platform. It centralizes announcements, newsletters, in-app notifications, and automated messaging across all channels (Email, WhatsApp, In-App).

**Key Impact:**
- Unblocks 15+ deferred features across Modules 1, 3, 4
- Enables real-time notifications for all modules
- Provides unified communication infrastructure
- Essential for member engagement and operational efficiency

---

## 🎯 Module Scope

### 7.1 Core Features (MVP - Phases 7A-7E)

1. **Announcement Center**
   - Multi-channel posting (Email, WhatsApp, In-App)
   - Template-based messaging
   - Audience targeting and segmentation
   - Schedule or send immediately
   - Rich text content with attachments

2. **In-App Notifications** ⭐ (Fully Functional)
   - Real-time notification bell with badge count
   - Notification center dropdown
   - Supabase Realtime integration
   - Mark as read/unread
   - Category filtering

3. **Template Library**
   - Predefined templates (Event Reminder, Birthday, Chair Message, etc.)
   - Dynamic placeholder system ({firstName}, {eventName}, etc.)
   - Custom template creation
   - Template usage tracking

4. **Audience Segmentation**
   - Role-based filtering (EC Members, All Members, etc.)
   - Engagement-based targeting (Low/High performers)
   - Custom segment builder
   - Member count preview

5. **Analytics Dashboard**
   - Channel performance comparison
   - Engagement trends (open rates, click rates)
   - Delivery statistics
   - Top performing content

### 7.2 Deferred Features (Phase 7F+ Future)

- WhatsApp Business API integration (infrastructure ready)
- Email SMTP sending (infrastructure ready)
- Newsletter PDF generation (HTML preview available)
- Advanced automation scheduler (manual trigger works)
- A/B testing for announcements
- Click tracking with URL shortening
- Send time optimization

---

## 🗄️ Database Architecture

### Tables (8 total)

#### 1. announcements
**Purpose:** Main announcement/message storage
**Key Fields:**
- `id`, `chapter_id`, `title`, `content`
- `status` (draft, scheduled, sending, sent, cancelled, failed)
- `channels` (TEXT[] - email, whatsapp, in_app)
- `audience_filter` (JSONB - targeting rules)
- `segment_id`, `template_id`
- `scheduled_at`, `sent_at`
- `created_by`, `created_at`, `updated_at`

**Relationships:**
- `chapter_id` → chapters
- `created_by` → members
- `segment_id` → communication_segments
- `template_id` → announcement_templates

#### 2. announcement_templates
**Purpose:** Reusable message templates
**Key Fields:**
- `id`, `chapter_id`, `name`, `type`
- `content_template` (with {placeholder} tags)
- `default_channels`, `category`
- `usage_count`, `last_used_at`

**Template Types:**
- event_reminder
- chair_message
- achievement
- birthday
- sponsorship_appeal
- custom

#### 3. announcement_recipients
**Purpose:** Track delivery to individual members
**Key Fields:**
- `id`, `announcement_id`, `member_id`, `channel`
- `status` (queued, sent, delivered, opened, clicked, failed)
- `sent_at`, `delivered_at`, `opened_at`, `clicked_at`
- `failed_reason`, `metadata`

**Relationships:**
- `announcement_id` → announcements (CASCADE DELETE)
- `member_id` → members

#### 4. in_app_notifications
**Purpose:** In-app notification feed
**Key Fields:**
- `id`, `member_id`, `title`, `message`
- `category` (events, announcements, awards, reminders, finance, system)
- `read`, `read_at`
- `action_url` (link to related page)
- `announcement_id`, `metadata`
- `created_at`, `expires_at`

**Relationships:**
- `member_id` → members
- `announcement_id` → announcements (optional)

#### 5. newsletters
**Purpose:** Newsletter editions
**Key Fields:**
- `id`, `chapter_id`, `title`, `edition_number`
- `month`, `year`
- `content` (JSONB - sections, events, awards)
- `chair_message`, `chair_image_url`
- `pdf_url`, `status`, `sent_at`
- `recipients_count`

#### 6. communication_segments
**Purpose:** Saved audience segments
**Key Fields:**
- `id`, `chapter_id`, `name`, `description`
- `filter_rules` (JSONB - role, vertical, engagement, custom)
- `member_count` (cached)
- `created_by`, `created_at`, `updated_at`

#### 7. communication_automation_rules
**Purpose:** Automated messaging triggers
**Key Fields:**
- `id`, `chapter_id`, `name`, `trigger_type`
- `conditions` (JSONB)
- `template_id`, `channels`, `enabled`
- `last_run_at`, `next_run_at`, `execution_count`

**Trigger Types:**
- birthday (7 AM on member's birthday)
- event_reminder (1 day before event)
- new_member (profile approved)
- low_engagement (score < 40)
- newsletter_reminder (25th of month)

#### 8. communication_analytics
**Purpose:** Performance metrics
**Key Fields:**
- `id`, `announcement_id`, `channel`
- `total_sent`, `delivered`, `opened`, `clicked`, `failed`
- `engagement_rate`, `click_through_rate`
- `calculated_at`

### Database Functions (7 functions)

1. **send_announcement(announcement_id)** - Process sending
2. **get_segment_members(segment_id)** - Resolve audience filter
3. **calculate_announcement_analytics(announcement_id)** - Aggregate metrics
4. **process_automation_rule(rule_id)** - Execute automation
5. **get_scheduled_announcements()** - Get ready-to-send
6. **mark_notification_delivered(notification_id)** - Track delivery
7. **get_engagement_trends(chapter_id, days)** - Analytics

### Database Triggers (6 triggers)

1. **auto_create_notification_on_announcement** - Create in-app notification
2. **auto_update_analytics_on_recipient_status** - Update analytics on delivery/open
3. **auto_calculate_segment_size** - Keep segment count updated
4. **auto_schedule_automation_rules** - Daily automation scheduler
5. **auto_cleanup_old_notifications** - Delete read notifications > 90 days
6. **log_communication_audit** - Audit trail logging

### RLS Policies

**announcements:**
- SELECT: All EC members in chapter
- INSERT: EC members and above
- UPDATE: Creator (drafts/scheduled), Communication Chair (all)
- DELETE: Creator (drafts), Communication Chair (all)

**in_app_notifications:**
- SELECT: Member sees only their own
- INSERT: System/admins
- UPDATE: Member can mark own as read
- DELETE: Member can delete own

**Templates, Segments, Automation:**
- SELECT: EC members
- INSERT/UPDATE/DELETE: Communication Chair

### Indexes

```sql
-- Performance critical indexes
CREATE INDEX idx_announcements_chapter_id ON announcements(chapter_id);
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_scheduled_at ON announcements(scheduled_at);
CREATE INDEX idx_recipients_announcement_id ON announcement_recipients(announcement_id);
CREATE INDEX idx_notifications_member_id ON in_app_notifications(member_id);
CREATE INDEX idx_notifications_unread ON in_app_notifications(member_id) WHERE read = FALSE;
CREATE INDEX idx_segments_filter_rules ON communication_segments USING GIN (filter_rules);
```

---

## 📁 File Structure & Implementation Checklist

### Phase 7A - Database Infrastructure (Week 1 - Days 1-2)

#### Database Migration
- [ ] Create migration file: `supabase/migrations/[timestamp]_communication_hub.sql`
  - [ ] Create 8 tables with proper constraints
  - [ ] Add CHECK constraints for status enums
  - [ ] Create foreign key relationships
  - [ ] Add JSONB fields (audience_filter, filter_rules, content, metadata)
  - [ ] Create indexes (16+ indexes)
  - [ ] Create database functions (7 functions)
  - [ ] Create triggers (6 triggers)
  - [ ] Create RLS policies for all tables
  - [ ] Seed default templates (6 templates)
  - [ ] **Estimated:** 800-1000 lines SQL

#### Type Definitions
- [ ] Create `types/communication.ts` (~600 lines)
  - [ ] Base Types:
    - [ ] `AnnouncementChannel`, `AnnouncementStatus`
    - [ ] `Announcement`, `AnnouncementListItem`, `AnnouncementWithAnalytics`
    - [ ] `AnnouncementTemplate`, `TemplateType`
    - [ ] `AnnouncementRecipient`, `RecipientStatus`
    - [ ] `InAppNotification`, `NotificationCategory`
    - [ ] `Newsletter`, `NewsletterSection`, `NewsletterStatus`
    - [ ] `CommunicationSegment`, `AudienceFilter`
    - [ ] `AutomationRule`, `TriggerType`
    - [ ] `CommunicationAnalytics`, `ChannelPerformance`
  - [ ] Filter Types:
    - [ ] `AnnouncementFilters`, `NotificationFilters`, `TemplateFilters`
  - [ ] Form Input Types:
    - [ ] `CreateAnnouncementInput`, `CreateTemplateInput`
    - [ ] `CreateSegmentInput`, `CreateAutomationRuleInput`
    - [ ] `CreateNewsletterInput`
  - [ ] Helper Types:
    - [ ] `PaginatedAnnouncements`, `EngagementTrend`

#### Validation Schemas
- [ ] Create `lib/validations/communication.ts` (~500 lines)
  - [ ] Announcement Schemas (6 schemas):
    - [ ] `createAnnouncementSchema` - title, content, channels, audience_filter
    - [ ] `updateAnnouncementSchema`
    - [ ] `sendAnnouncementSchema`
    - [ ] `scheduleAnnouncementSchema` - validate future date
    - [ ] `cancelAnnouncementSchema`
    - [ ] `deleteAnnouncementSchema`
  - [ ] Template Schemas (4 schemas):
    - [ ] `createTemplateSchema`, `updateTemplateSchema`
    - [ ] `deleteTemplateSchema`, `duplicateTemplateSchema`
  - [ ] Notification Schemas (3 schemas):
    - [ ] `createNotificationSchema`, `markNotificationReadSchema`
    - [ ] `deleteNotificationSchema`
  - [ ] Newsletter Schemas (4 schemas):
    - [ ] `createNewsletterSchema`, `updateNewsletterSchema`
    - [ ] `publishNewsletterSchema`, `deleteNewsletterSchema`
  - [ ] Segment Schemas (3 schemas):
    - [ ] `createSegmentSchema`, `updateSegmentSchema`, `deleteSegmentSchema`
  - [ ] Automation Schemas (4 schemas):
    - [ ] `createAutomationRuleSchema`, `updateAutomationRuleSchema`
    - [ ] `toggleAutomationRuleSchema`, `deleteAutomationRuleSchema`
  - [ ] Filter Schemas (4 schemas):
    - [ ] `announcementFiltersSchema`, `notificationFiltersSchema`
    - [ ] `templateFiltersSchema`, `audienceFilterSchema`

---

### Phase 7B - Announcement System (Week 1 - Days 3-5)

#### Data Layer
- [ ] Create `lib/data/communication.ts` (~800 lines)
  - [ ] Announcement Functions (5 functions):
    - [ ] `getAnnouncements(chapterId, filters, page, pageSize)` - cacheLife('minutes')
    - [ ] `getAnnouncementById(id)` - with recipients, analytics
    - [ ] `getDraftAnnouncements(chapterId)` - quick access
    - [ ] `getScheduledAnnouncements(chapterId)` - upcoming
    - [ ] `getAnnouncementAnalytics(announcementId)` - detailed metrics
  - [ ] Template Functions (3 functions):
    - [ ] `getTemplates(filters?)` - cacheLife('hours')
    - [ ] `getTemplateById(id)`
    - [ ] `getTemplatesByType(type)`
  - [ ] Apply React `cache()` and `use cache` directives
  - [ ] Add `cacheTag` for invalidation

#### Server Actions
- [ ] Create `app/actions/communication.ts` (~1000 lines total, Phase 7B portion)
  - [ ] Announcement Actions (8 actions):
    - [ ] `createAnnouncement(formData)` - Create draft
    - [ ] `updateAnnouncement(id, formData)` - Update draft/scheduled
    - [ ] `sendAnnouncement(id)` - Send immediately
    - [ ] `scheduleAnnouncement(id, scheduledAt)` - Schedule for later
    - [ ] `cancelAnnouncement(id)` - Cancel scheduled
    - [ ] `deleteAnnouncement(id)` - Delete draft only
    - [ ] `duplicateAnnouncement(id)` - Create copy
    - [ ] `resendAnnouncement(id)` - Resend failed
  - [ ] Implement Zod validation for all actions
  - [ ] Add proper error handling with try-catch
  - [ ] Use `revalidateTag()` for cache invalidation
  - [ ] Return structured responses: `{ success, message, data?, error? }`

#### UI Components - Announcement
- [ ] Create `components/communication/announcement-composer.tsx`
  - [ ] Rich text editor for content (use Textarea with markdown support)
  - [ ] Title input field
  - [ ] Channel selector (checkboxes: Email, WhatsApp, In-App)
  - [ ] Audience tagger integration
  - [ ] Template selector dropdown
  - [ ] Schedule picker (date + time)
  - [ ] Action buttons (Save Draft, Schedule, Send Now)
  - [ ] Form validation with react-hook-form + Zod
  - [ ] Loading states and error handling
- [ ] Create `components/communication/channel-selector.tsx`
  - [ ] Multi-checkbox component
  - [ ] Default to in_app only
  - [ ] Show channel icons
- [ ] Create `components/communication/audience-tagger.tsx`
  - [ ] Segment selector dropdown
  - [ ] Quick filters (All Members, EC Only, etc.)
  - [ ] Custom filter builder
  - [ ] Member count preview
- [ ] Create `components/communication/announcement-card.tsx`
  - [ ] Display announcement summary
  - [ ] Status badge, channel badges
  - [ ] Recipient count, engagement metrics
  - [ ] Action buttons (View, Edit, Cancel)
- [ ] Create `components/communication/announcement-preview.tsx`
  - [ ] Preview content before sending
  - [ ] Show personalized example
  - [ ] Display channels and audience
- [ ] Create `components/communication/status-badges.tsx`
  - [ ] `AnnouncementStatusBadge` (draft, scheduled, sending, sent, etc.)
  - [ ] `ChannelBadge` (email, whatsapp, in_app icons)
  - [ ] `DeliveryStatusBadge` (queued, delivered, failed)

#### Data Table - Announcements
- [ ] Create `components/communication/announcements-table.tsx`
  - [ ] TanStack Table v8 setup
  - [ ] Client-side or server-side pagination
  - [ ] Row selection for bulk actions
- [ ] Create `components/communication/announcements-table-columns.tsx`
  - [ ] Columns:
    - Title (sortable, searchable, linked)
    - Status (filterable badge)
    - Channels (badges)
    - Audience (segment name or "Custom")
    - Scheduled At (sortable, formatted)
    - Sent At (sortable, formatted)
    - Recipients (count with breakdown)
    - Engagement (open rate %)
    - Created By (member name)
    - Actions (dropdown: View, Edit, Send, Cancel, Delete, Duplicate)
- [ ] Create `components/communication/announcements-table-toolbar.tsx`
  - [ ] Search input (title, content)
  - [ ] Faceted filter: Status
  - [ ] Faceted filter: Channels
  - [ ] Date range filter (scheduled, sent)
  - [ ] Clear filters button
  - [ ] Export button (CSV, XLSX, JSON)

#### Pages - Announcements
- [ ] Create `app/(dashboard)/communications/page.tsx` - Dashboard
  - [ ] Overview stats cards (Total Sent, Delivery Rate, Open Rate, Click Rate)
  - [ ] Quick action cards (New Announcement, New Template, View Queue)
  - [ ] Recent announcements list (last 5)
  - [ ] Upcoming scheduled messages
  - [ ] Channel performance summary
  - [ ] Suspense boundaries for data fetching
- [ ] Create `app/(dashboard)/communications/announcements/page.tsx` - List
  - [ ] Announcements data table
  - [ ] Create New Announcement button
  - [ ] Stats summary (drafts, scheduled, sent today)
- [ ] Create `app/(dashboard)/communications/announcements/new/page.tsx` - Create
  - [ ] AnnouncementComposer component
  - [ ] Back button to list
- [ ] Create `app/(dashboard)/communications/announcements/[id]/page.tsx` - Detail
  - [ ] Announcement content preview
  - [ ] Delivery stats (Sent, Delivered, Opened, Clicked)
  - [ ] Recipient list with status (data table or simple list)
  - [ ] Channel breakdown
  - [ ] Resend/Cancel actions
  - [ ] Edit button (if draft/scheduled)
- [ ] Create `app/(dashboard)/communications/announcements/[id]/edit/page.tsx`
  - [ ] Same form as create (AnnouncementComposer)
  - [ ] Only accessible for drafts/scheduled
  - [ ] Pre-fill with existing data

---

### Phase 7C - In-App Notifications (Week 2 - Days 1-2)

#### Data Layer - Notifications
- [ ] Add to `lib/data/communication.ts`
  - [ ] `getNotifications(memberId, filters, page)` - cacheLife('seconds')
  - [ ] `getUnreadNotificationsCount(memberId)` - cacheLife('seconds')
  - [ ] `getNotificationById(id)`

#### Server Actions - Notifications
- [ ] Add to `app/actions/communication.ts`
  - [ ] `createNotification(memberId, data)` - Manual notification
  - [ ] `markNotificationAsRead(id)` - Mark single
  - [ ] `markAllNotificationsAsRead(memberId)` - Mark all
  - [ ] `deleteNotification(id)` - Delete notification

#### UI Components - Notifications
- [ ] Create `components/communication/notification-bell.tsx` ⭐ **CRITICAL**
  - [ ] Bell icon in header
  - [ ] Unread count badge (real-time)
  - [ ] Click to open NotificationCenter dropdown
  - [ ] Supabase Realtime subscription:
    ```typescript
    useEffect(() => {
      const channel = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `member_id=eq.${currentUserId}`
        }, (payload) => {
          // Update state, show toast
        })
        .subscribe()
      return () => { channel.unsubscribe() }
    }, [])
    ```
  - [ ] Toast notification on new notification
  - [ ] Auto-update badge count
- [ ] Create `components/communication/notification-center.tsx`
  - [ ] Dropdown panel (use Popover or DropdownMenu)
  - [ ] List recent notifications (last 10)
  - [ ] Mark as read on click
  - [ ] Category icons (events, finance, awards, etc.)
  - [ ] "View All" link to full notification page
  - [ ] "Mark All as Read" button
- [ ] Create `components/communication/notification-item.tsx`
  - [ ] Title, message, timestamp
  - [ ] Read/unread indicator
  - [ ] Category badge/icon
  - [ ] Click to navigate to action_url
  - [ ] Delete button
- [ ] Create `components/communication/real-time-push.tsx` (optional wrapper)
  - [ ] Supabase Realtime provider/hook
  - [ ] Reusable subscription logic

#### Pages - Notifications
- [ ] Create `app/(dashboard)/communications/notifications/page.tsx`
  - [ ] Full notification list with pagination
  - [ ] Filter tabs: All, Events, Announcements, Finance, Awards, System
  - [ ] Mark all as read button
  - [ ] Individual delete options
  - [ ] Read/unread toggle filter
- [ ] Update `app/(dashboard)/layout.tsx`
  - [ ] Add NotificationBell to header
  - [ ] Position in top-right near user menu

---

### Phase 7D - Templates & Segmentation (Week 2 - Days 3-5)

#### Data Layer - Templates & Segments
- [ ] Add to `lib/data/communication.ts`
  - [ ] Segment Functions (4 functions):
    - [ ] `getSegments(chapterId)` - cacheLife('hours')
    - [ ] `getSegmentById(id)` - with member count
    - [ ] `getSegmentMembers(segmentId)` - preview members
    - [ ] `calculateSegmentSize(filterRules)` - live preview

#### Server Actions - Templates & Segments
- [ ] Add to `app/actions/communication.ts`
  - [ ] Template Actions (4 actions):
    - [ ] `createTemplate(formData)`
    - [ ] `updateTemplate(id, formData)`
    - [ ] `deleteTemplate(id)`
    - [ ] `duplicateTemplate(id)`
  - [ ] Segment Actions (4 actions):
    - [ ] `createSegment(formData)`
    - [ ] `updateSegment(id, formData)`
    - [ ] `deleteSegment(id)`
    - [ ] `calculateSegmentSize(filterRules)` - Preview count

#### UI Components - Templates
- [ ] Create `components/communication/template-manager.tsx`
  - [ ] Template library view
  - [ ] Filter by type dropdown
  - [ ] Search templates
  - [ ] Create/Edit/Delete/Duplicate actions
- [ ] Create `components/communication/template-selector.tsx`
  - [ ] Dropdown/Combobox to select template
  - [ ] Filter by type
  - [ ] Preview template on hover/select
- [ ] Create `components/communication/template-preview.tsx`
  - [ ] Show template content with sample data
  - [ ] Highlight placeholders
  - [ ] Show default channels
- [ ] Create `components/communication/dynamic-tag-helper.tsx`
  - [ ] List available placeholders
  - [ ] Copy to clipboard
  - [ ] Categorized: Member, Event, Chapter, Custom

#### UI Components - Segments
- [ ] Create `components/communication/segment-filter.tsx` ⭐
  - [ ] Filter builder UI
  - [ ] Role multi-select (EC Member, Member, etc.)
  - [ ] Engagement slider (min-max)
  - [ ] Member status checkboxes
  - [ ] City multi-select
  - [ ] Date range pickers (joined after/before)
  - [ ] Live member count preview
  - [ ] Save segment button
- [ ] Create `components/communication/segment-preview.tsx`
  - [ ] Display filter criteria
  - [ ] Show member count
  - [ ] Preview first 10 members
  - [ ] Refresh count button

#### Data Tables - Templates
- [ ] Create `components/communication/templates-table.tsx`
- [ ] Create `components/communication/templates-table-columns.tsx`
  - [ ] Columns:
    - Template Name (linked)
    - Type (badge)
    - Default Channels (badges)
    - Usage Count
    - Last Used (date)
    - Created By
    - Actions (View, Edit, Duplicate, Delete, Use Template)
- [ ] Create `components/communication/templates-table-toolbar.tsx`
  - [ ] Search templates
  - [ ] Filter by type
  - [ ] Filter by channels

#### Pages - Templates & Segments
- [ ] Create `app/(dashboard)/communications/templates/page.tsx`
  - [ ] Templates data table
  - [ ] Create New Template button
  - [ ] Quick filters (type selector)
- [ ] Create `app/(dashboard)/communications/templates/new/page.tsx`
  - [ ] Template creation form
  - [ ] Name, type, content with placeholders
  - [ ] Default channels selector
  - [ ] Dynamic tag helper
  - [ ] Preview panel
- [ ] Create `app/(dashboard)/communications/templates/[id]/page.tsx`
  - [ ] Template detail view
  - [ ] Preview with sample data
  - [ ] Usage statistics
  - [ ] Edit, Duplicate actions
- [ ] Create `app/(dashboard)/communications/segments/page.tsx`
  - [ ] Segments list/table
  - [ ] Member count for each
  - [ ] Create, Edit, Delete actions
- [ ] Create `app/(dashboard)/communications/segments/new/page.tsx`
  - [ ] Segment filter builder
  - [ ] Live member preview
  - [ ] Save segment
- [ ] Create `app/(dashboard)/communications/segments/[id]/page.tsx`
  - [ ] Segment details
  - [ ] Filter rules display
  - [ ] Member list (data table or simple list)
  - [ ] Edit segment

---

### Phase 7E - Analytics Dashboard (Week 3 - Days 1-2)

#### Data Layer - Analytics
- [ ] Add to `lib/data/communication.ts`
  - [ ] `getCommunicationAnalytics(chapterId, dateRange)` - cacheLife('minutes')
  - [ ] `getChannelPerformance(chapterId, channel, dateRange)`
  - [ ] `getEngagementTrends(chapterId, dateRange)` - Time series data

#### UI Components - Analytics
- [ ] Create `components/communication/communication-analytics.tsx`
  - [ ] Overview stats cards
  - [ ] Channel comparison section
  - [ ] Engagement trends chart
  - [ ] Top performing announcements list
- [ ] Create `components/communication/channel-performance-chart.tsx`
  - [ ] Bar/Line chart comparing Email, WhatsApp, In-App
  - [ ] Metrics: Delivery rate, Open rate, Click rate
  - [ ] Use recharts library
- [ ] Create `components/communication/trend-visualizer.tsx`
  - [ ] Line chart showing engagement over time
  - [ ] Daily/Weekly/Monthly views
  - [ ] Hover tooltips with details
- [ ] Create `components/communication/engagement-heatmap.tsx` (optional)
  - [ ] Activity heatmap by day/hour
  - [ ] Best send times visualization

#### Pages - Analytics
- [ ] Create `app/(dashboard)/communications/analytics/page.tsx`
  - [ ] Overall communication performance
  - [ ] Date range selector (last 7/30/90 days)
  - [ ] Channel comparison charts
  - [ ] Engagement trends
  - [ ] Top performing content
  - [ ] Best sending times analysis (if available)

---

### Phase 7F - Automation Rules (Week 3 - Days 3-4) - OPTIONAL/DEFERRED

#### Data Layer - Automation
- [ ] Add to `lib/data/communication.ts`
  - [ ] `getAutomationRules(chapterId)` - cacheLife('hours')
  - [ ] `getAutomationRuleById(id)`
  - [ ] `getActiveAutomationRules(chapterId)` - Only enabled

#### Server Actions - Automation
- [ ] Add to `app/actions/communication.ts`
  - [ ] `createAutomationRule(formData)`
  - [ ] `updateAutomationRule(id, formData)`
  - [ ] `toggleAutomationRule(id, enabled)` - Enable/disable
  - [ ] `deleteAutomationRule(id)`
  - [ ] `runAutomationRule(id)` - Manual trigger for testing

#### UI Components - Automation
- [ ] Create `components/communication/automation-rule-form.tsx`
  - [ ] Rule name input
  - [ ] Trigger type selector (birthday, event_reminder, etc.)
  - [ ] Condition builder (based on trigger type)
  - [ ] Template selector
  - [ ] Channels selector
  - [ ] Enable/disable toggle
- [ ] Create `components/communication/automation-rules-table.tsx`
- [ ] Create `components/communication/automation-rules-table-columns.tsx`
  - [ ] Columns:
    - Rule Name (linked)
    - Trigger Type (badge)
    - Status (Enabled/Disabled toggle)
    - Template (linked)
    - Last Run (date/time)
    - Next Run (calculated)
    - Execution Count
    - Actions (View, Edit, Run Now, Toggle, Delete)

#### Pages - Automation
- [ ] Create `app/(dashboard)/communications/automation/page.tsx`
  - [ ] Automation rules table
  - [ ] Create New Rule button
  - [ ] Filter: Enabled/Disabled
- [ ] Create `app/(dashboard)/communications/automation/new/page.tsx`
  - [ ] Automation rule form
- [ ] Create `app/(dashboard)/communications/automation/[id]/page.tsx`
  - [ ] Rule details
  - [ ] Execution history
  - [ ] Test run button

---

### Phase 7G - Newsletter Builder (Week 3 - Day 5) - OPTIONAL/DEFERRED

#### Data Layer - Newsletters
- [ ] Add to `lib/data/communication.ts`
  - [ ] `getNewsletters(chapterId, filters)` - cacheLife('hours')
  - [ ] `getNewsletterById(id)`
  - [ ] `getLatestNewsletter(chapterId)`

#### Server Actions - Newsletters
- [ ] Add to `app/actions/communication.ts`
  - [ ] `createNewsletter(formData)`
  - [ ] `updateNewsletter(id, formData)`
  - [ ] `publishNewsletter(id)` - Publish and send
  - [ ] `generateNewsletterPDF(id)` - Generate PDF (defer implementation)
  - [ ] `deleteNewsletter(id)`

#### UI Components - Newsletters
- [ ] Create `components/communication/newsletter-builder.tsx`
  - [ ] Section builder (add events, awards, articles)
  - [ ] Chair message editor
  - [ ] Preview panel
  - [ ] Save/Publish actions
- [ ] Create `components/communication/section-picker.tsx`
  - [ ] Add section buttons (Events, Awards, Achievements, Custom)
  - [ ] Auto-pull data from events/awards tables
- [ ] Create `components/communication/newsletter-preview.tsx`
  - [ ] HTML preview of newsletter
  - [ ] PDF download placeholder
- [ ] Create `components/communication/newsletter-archive.tsx`
  - [ ] Past editions grid/list
  - [ ] Download PDF links
  - [ ] Open rate stats
- [ ] Create `components/communication/newsletters-table.tsx`
- [ ] Create `components/communication/newsletters-table-columns.tsx`
  - [ ] Columns:
    - Title (linked)
    - Edition Number
    - Month/Year
    - Status (Draft, Published, Sent)
    - Recipients
    - Open Rate (%)
    - PDF Available (download link)
    - Sent At
    - Actions (View, Edit, Send, Download PDF, Delete)

#### Pages - Newsletters
- [ ] Create `app/(dashboard)/communications/newsletters/page.tsx`
  - [ ] Newsletter archive (grid or table)
  - [ ] Create New Newsletter button
  - [ ] Stats summary
- [ ] Create `app/(dashboard)/communications/newsletters/new/page.tsx`
  - [ ] Newsletter builder interface
- [ ] Create `app/(dashboard)/communications/newsletters/[id]/page.tsx`
  - [ ] Full newsletter view
  - [ ] Download PDF
  - [ ] View analytics
  - [ ] Resend option

---

## 🔗 Integration with Existing Modules

### Module 1 - Member Intelligence Hub
- [ ] Use member data for audience targeting
- [ ] Use engagement scores for segmentation (Low Engagement < 40)
- [ ] Use birthday data for birthday automation
- [ ] Create notifications for:
  - [ ] Profile updates
  - [ ] Skill/certification expiry

### Module 2 - Stakeholder Relationship CRM
- [ ] Extend audience to include stakeholders (not just members)
- [ ] Track communication history with stakeholders
- [ ] Targeted messaging to colleges/industries/NGOs

### Module 3 - Event Lifecycle Manager
- [ ] Create event reminder automation (1 day before)
- [ ] Send RSVP confirmation messages
- [ ] Send event updates and cancellations
- [ ] Post-event thank you messages
- [ ] Create notifications for:
  - [ ] Event published
  - [ ] RSVP confirmed
  - [ ] Event starting soon (1 hour before)
  - [ ] Event check-in successful
  - [ ] Volunteer assignment
  - [ ] Feedback request

### Module 4 - Financial Command Center
- [ ] Send budget alerts when >80% utilized (NOW ENABLED!)
- [ ] Send expense approval/rejection notifications
- [ ] Send reimbursement status updates
- [ ] Send sponsorship deal stage notifications
- [ ] Create notifications for:
  - [ ] Budget approved
  - [ ] Budget allocation changed
  - [ ] Expense requires approval
  - [ ] Expense approved/rejected
  - [ ] Reimbursement approved/paid
  - [ ] Budget alert (>80% utilized)

### Module 6 - Take Pride Awards (Future)
- [ ] Send nomination reminders
- [ ] Send award announcements
- [ ] Send winner notifications

### Module 8 - Knowledge Management (Future)
- [ ] Archive newsletter PDFs
- [ ] Link announcements to knowledge articles

---

## 🔐 Security & Permissions

### Role-Based Access Control

**Communication Chair:**
- Full access to all features
- Manage automation rules
- Manage segments
- Delete any announcement
- View all analytics

**EC Members:**
- Create announcements
- Create templates
- View segments (cannot edit)
- View automation rules (cannot edit)
- View analytics

**Members:**
- View their own notifications only
- Mark notifications as read
- Delete their own notifications

**RLS Enforcement:**
- All queries filtered by chapter_id
- Notifications filtered by member_id
- Sensitive operations require role check

---

## 📊 Analytics & Metrics

### Delivery Metrics
- Total sent (by channel)
- Delivery rate (delivered / sent)
- Failure rate (failed / sent)
- Failure reasons breakdown

### Engagement Metrics
- Open rate (opened / delivered)
- Click-through rate (clicked / opened)
- Engagement by channel comparison
- Best performing content (by open rate)

### Timing Analytics
- Best sending times (day of week, hour)
- Average time to open
- Response patterns

### Automation Metrics
- Automation rule execution count
- Success/failure rate
- Most effective automation type

---

## 🧪 Testing Checklist

### Database Testing
- [ ] All table insertions succeed
- [ ] RLS policies prevent unauthorized access
- [ ] Database functions return correct results
- [ ] Triggers fire correctly
- [ ] Foreign key constraints work
- [ ] JSONB queries perform well

### Server Action Testing
- [ ] Create announcement (draft, scheduled, send now)
- [ ] Update announcement (only drafts/scheduled)
- [ ] Cancel scheduled announcement
- [ ] Delete draft announcement
- [ ] Template CRUD operations
- [ ] Segment CRUD operations
- [ ] Notification marking as read
- [ ] Automation rule execution

### Component Testing
- [ ] AnnouncementComposer form validation works
- [ ] Channel selector state management
- [ ] Audience tagger filter building
- [ ] Template selector integration
- [ ] Notification bell real-time updates (<1s)
- [ ] Notification center mark as read
- [ ] Date/time scheduler validates future dates only

### Integration Testing
- [ ] Create announcement → generates recipients
- [ ] Send announcement → creates notifications
- [ ] Mark notification read → updates read_at
- [ ] Automation rule → creates announcement
- [ ] Segment filter → returns correct members
- [ ] Analytics calculation → aggregates correctly

### Performance Testing
- [ ] Data table pagination (1000+ announcements)
- [ ] Real-time notification delivery (<1s)
- [ ] Segment calculation (10,000+ members in <5s)
- [ ] Analytics query performance (<2s)
- [ ] Bulk operations (send to 1000+ recipients)

### Security Testing
- [ ] RLS policies prevent unauthorized access
- [ ] Only Communication Chair can manage automation
- [ ] Members only see their own notifications
- [ ] Draft announcements only visible to creator
- [ ] Template access controlled by role
- [ ] XSS prevention in rich text content
- [ ] SQL injection prevention in dynamic queries

---

## ✅ Module Completion Criteria

**Core Features Complete (MVP - Phases 7A-7E):**
- ✅ All database tables created with RLS policies (8 tables)
- ✅ Announcement CRUD operations working
- ✅ In-app notification system fully functional with real-time updates
- ✅ Template library operational with dynamic tag replacement
- ✅ Audience segmentation working with live preview
- ✅ Analytics dashboard showing channel performance
- ✅ Data tables with filtering, sorting, export (announcements, templates)
- ✅ All forms validated with Zod (15+ schemas)
- ✅ Cache invalidation working properly (revalidateTag)
- ✅ Responsive design verified (mobile, tablet, desktop)
- ✅ Role-based access control enforced (RLS policies)
- ✅ All code follows nextjs16-web-development patterns
- ✅ Supabase Realtime integration working
- ✅ Integration with Modules 1, 3, 4 tested

**Deferred to Future Phases:**
- ⚠️ WhatsApp Business API integration (infrastructure ready)
- ⚠️ Email SMTP sending (infrastructure ready)
- ⚠️ Newsletter PDF generation (HTML preview works)
- ⚠️ Advanced automation scheduler (manual trigger works)
- ⚠️ Click tracking with URL shortening
- ⚠️ A/B testing features
- ⚠️ Send time optimization
- ⚠️ Automation rules UI (Phase 7F)
- ⚠️ Newsletter builder UI (Phase 7G)

---

## 📈 Success Metrics

**Performance Targets:**
- Announcement creation: < 2 minutes
- Notification delivery: < 1 second
- Real-time updates: Instant
- Analytics dashboard load: < 2 seconds
- Segment calculation: < 5 seconds (10k members)
- Data table operations: < 1 second

**Feature Adoption:**
- 80%+ of announcements use templates
- 50%+ of announcements use segments
- 90%+ in-app notification open rate
- 60%+ email open rate (when implemented)

**Cross-Module Impact:**
- Unblocks 15+ deferred features
- Enables notifications for all modules
- Centralizes communication infrastructure

---

## 🚀 Next Steps

1. **Review this plan** - Ensure all requirements are covered
2. **Set start date** - Allocate 2-3 weeks for implementation
3. **Prepare environment** - Ensure Supabase MCP server is configured
4. **Begin Phase 7A** - Database infrastructure (1-2 days)
5. **Proceed sequentially** - Complete each phase before moving to next
6. **Test thoroughly** - Run all tests before marking phase complete
7. **Document learnings** - Update plan with issues/solutions encountered

**Ready to start?** Let's build the notification backbone for Yi Connect! 🎯

---

**END OF MODULE 7 IMPLEMENTATION PLAN**
