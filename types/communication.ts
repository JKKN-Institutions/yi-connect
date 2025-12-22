// ============================================================================
// Module 7: Communication Hub - TypeScript Type Definitions
// ============================================================================
// Description: Comprehensive type definitions for announcements, notifications,
//              templates, segments, newsletters, and automation
// Version: 1.0
// Created: 2025-11-17
// ============================================================================

// Note: Database types will be available after running the communication_hub migration
// For now, we define standalone types that match the database schema

// ============================================================================
// DATABASE TABLE TYPES (self-contained, will match Supabase after migration)
// ============================================================================

export type DbAnnouncement = {
  id: string;
  created_at: string;
  updated_at: string;
  chapter_id: string;
  title: string;
  content: string;
  channels: string[];
  status: string;
  priority: string;
  audience_filter: any;
  segment_id: string | null;
  template_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_by: string;
};

export type DbAnnouncementTemplate = {
  id: string;
  created_at: string;
  updated_at: string;
  chapter_id: string;
  name: string;
  description: string | null;
  content: string;
  default_channels: string[] | null;
  usage_count: number;
  last_used_at: string | null;
};

export type DbAnnouncementRecipient = {
  id: string;
  created_at: string;
  updated_at: string;
  announcement_id: string;
  member_id: string;
  channel: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
};

export type DbInAppNotification = {
  id: string;
  created_at: string;
  updated_at: string;
  member_id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  action_url: string | null;
  action_label: string | null;
  read_at: string | null;
  announcement_id: string | null;
};

export type DbNewsletter = {
  id: string;
  created_at: string;
  updated_at: string;
  chapter_id: string;
  title: string;
  description: string | null;
  content: any;
  status: string;
  published_at: string | null;
  created_by: string;
};

export type DbCommunicationSegment = {
  id: string;
  created_at: string;
  updated_at: string;
  chapter_id: string;
  name: string;
  description: string | null;
  filter: any;
  member_count: number | null;
  created_by: string;
};

export type DbAutomationRule = {
  id: string;
  created_at: string;
  updated_at: string;
  chapter_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: any;
  template_id: string | null;
  channels: string[];
  audience_filter: any | null;
  segment_id: string | null;
  is_enabled: boolean;
  last_triggered_at: string | null;
  created_by: string;
};

export type DbCommunicationAnalytics = {
  id: string;
  created_at: string;
  updated_at: string;
  announcement_id: string;
  total_recipients: number;
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  engagement_rate: number;
};

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

export const ANNOUNCEMENT_CHANNELS = ['whatsapp', 'email', 'in_app'] as const;
export type AnnouncementChannel = typeof ANNOUNCEMENT_CHANNELS[number];

export const ANNOUNCEMENT_STATUSES = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
  'failed'
] as const;
export type AnnouncementStatus = typeof ANNOUNCEMENT_STATUSES[number];

export const ANNOUNCEMENT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type AnnouncementPriority = typeof ANNOUNCEMENT_PRIORITIES[number];

export const RECIPIENT_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'failed',
  'bounced'
] as const;
export type RecipientStatus = typeof RECIPIENT_STATUSES[number];

export const NOTIFICATION_CATEGORIES = [
  'events',
  'announcements',
  'awards',
  'reminders',
  'finance',
  'system',
  'stakeholders',
  'knowledge'
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export const TEMPLATE_TYPES = [
  'event_reminder',
  'chair_message',
  'achievement',
  'birthday',
  'sponsorship_appeal',
  'low_engagement',
  'new_member_welcome',
  'custom'
] as const;
export type TemplateType = typeof TEMPLATE_TYPES[number];

export const NEWSLETTER_STATUSES = ['draft', 'published', 'sent'] as const;
export type NewsletterStatus = typeof NEWSLETTER_STATUSES[number];

export const AUTOMATION_TRIGGER_TYPES = [
  'birthday',
  'event_reminder',
  'new_member',
  'low_engagement',
  'newsletter_reminder',
  'budget_alert',
  'expense_approval',
  'custom'
] as const;
export type AutomationTriggerType = typeof AUTOMATION_TRIGGER_TYPES[number];

// ============================================================================
// ANNOUNCEMENT TYPES
// ============================================================================

export interface Announcement {
  id: string;
  chapter_id: string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  channels: AnnouncementChannel[];
  audience_filter?: AudienceFilter;
  segment_id?: string;
  template_id?: string;
  scheduled_at?: string;
  sent_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface AnnouncementListItem {
  id: string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  channels: AnnouncementChannel[];
  scheduled_at?: string;
  sent_at?: string;
  created_by: string;
  created_by_name?: string; // Joined from members
  creator?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
  };
  segment_name?: string; // Joined from segments
  recipient_count?: number;
  delivered_count?: number;
  opened_count?: number;
  created_at: string;
  analytics?: {
    total_recipients: number;
    opened: number;
    open_rate: number;
    clicked: number;
    click_rate: number;
    engagement_rate: number;
  };
}

export interface AnnouncementWithAnalytics extends Announcement {
  analytics: CommunicationAnalytics[];
  recipients_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  overall_engagement_rate?: number;
}

export interface AnnouncementWithDetails extends Announcement {
  created_by_name: string;
  created_by_email: string;
  creator?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    avatar_url?: string;
  };
  segment?: CommunicationSegment;
  template?: AnnouncementTemplate;
  analytics: CommunicationAnalytics[];
  recipients_summary: {
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    bounced: number;
  };
}

// ============================================================================
// ANNOUNCEMENT TEMPLATE TYPES
// ============================================================================

export interface AnnouncementTemplate {
  id: string;
  chapter_id?: string;
  name: string;
  type: TemplateType;
  content_template: string;
  default_channels: AnnouncementChannel[];
  category?: string;
  usage_count: number;
  last_used_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateListItem {
  id: string;
  name: string;
  type: TemplateType;
  default_channels: AnnouncementChannel[];
  category?: string;
  usage_count: number;
  last_used_at?: string;
  created_by_name?: string;
}

export interface TemplateWithUsage extends AnnouncementTemplate {
  created_by_name?: string;
  recent_announcements?: AnnouncementListItem[];
}

// ============================================================================
// ANNOUNCEMENT RECIPIENT TYPES
// ============================================================================

export interface AnnouncementRecipient {
  id: string;
  announcement_id: string;
  member_id: string;
  channel: AnnouncementChannel;
  status: RecipientStatus;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  failed_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface RecipientWithMember extends AnnouncementRecipient {
  member_name: string;
  member_email: string;
  member_phone?: string;
}

export interface RecipientSummary {
  total: number;
  by_channel: Record<AnnouncementChannel, number>;
  by_status: Record<RecipientStatus, number>;
}

// ============================================================================
// IN-APP NOTIFICATION TYPES
// ============================================================================

export interface InAppNotification {
  id: string;
  member_id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  read: boolean;
  read_at?: string;
  action_url?: string;
  announcement_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  expires_at?: string;
}

export interface NotificationListItem extends InAppNotification {
  time_ago: string; // "2 hours ago"
}

export interface NotificationSummary {
  unread_count: number;
  by_category: Record<NotificationCategory, number>;
  recent: InAppNotification[];
}

// ============================================================================
// NEWSLETTER TYPES
// ============================================================================

export interface Newsletter {
  id: string;
  chapter_id: string;
  title: string;
  edition_number: number;
  month?: number;
  year?: number;
  content: NewsletterContent;
  chair_message?: string;
  chair_image_url?: string;
  pdf_url?: string;
  status: NewsletterStatus;
  sent_at?: string;
  recipients_count?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface NewsletterContent {
  sections: NewsletterSection[];
  events?: any[];
  awards?: any[];
  achievements?: any[];
}

export interface NewsletterSection {
  id: string;
  type: 'events' | 'awards' | 'achievements' | 'article' | 'custom';
  title: string;
  content: string | Record<string, any>;
  order: number;
}

export interface NewsletterListItem {
  id: string;
  title: string;
  edition_number: number;
  month?: number;
  year?: number;
  status: NewsletterStatus;
  sent_at?: string;
  recipients_count?: number;
  pdf_url?: string;
  created_by_name?: string;
}

export interface NewsletterWithAnalytics extends Newsletter {
  open_rate?: number;
  download_count?: number;
}

// ============================================================================
// COMMUNICATION SEGMENT TYPES
// ============================================================================

export interface CommunicationSegment {
  id: string;
  chapter_id: string;
  name: string;
  description?: string;
  filter_rules: AudienceFilter;
  member_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AudienceFilter {
  // Role-based filtering
  roles?: string[]; // ['EC Member', 'Chair', 'Member']

  // Engagement-based filtering
  engagement?: {
    min?: number; // 0-100
    max?: number; // 0-100
  };

  // Leadership readiness
  leadership_readiness?: {
    min?: number; // 0-100
    max?: number; // 0-100
  };

  // Member status
  member_status?: string[]; // ['active', 'inactive', 'alumni']

  // Member type
  membership_type?: string[]; // ['full_member', 'associate', 'honorary']

  // Location-based
  cities?: string[];
  states?: string[];

  // Date range filtering
  joined_after?: string;
  joined_before?: string;

  // Skill-based
  has_skills?: string[]; // Skill IDs

  // Event participation
  attended_event_types?: string[];
  last_event_attendance?: {
    within_days?: number; // Attended event within X days
  };

  // Vertical interests
  vertical_interests?: string[];

  // Custom filters
  custom_filters?: Record<string, any>;

  // Specific inclusions/exclusions
  include_members?: string[]; // Member IDs to include
  exclude_members?: string[]; // Member IDs to exclude
}

export interface SegmentWithMembers extends CommunicationSegment {
  members?: SegmentMember[];
  created_by_name?: string;
}

export interface SegmentMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  city?: string;
  engagement_score?: number;
}

export interface SegmentPreview {
  member_count: number;
  sample_members: SegmentMember[];
  filter_summary: string;
}

// ============================================================================
// AUTOMATION RULE TYPES
// ============================================================================

export interface AutomationRule {
  id: string;
  chapter_id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  conditions: AutomationConditions;
  template_id: string;
  channels: AnnouncementChannel[];
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  execution_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationConditions {
  // Birthday trigger
  birthday?: {
    send_at_time?: string; // "07:00" (HH:mm)
    days_before?: number; // Send X days before birthday
  };

  // Event reminder trigger
  event_reminder?: {
    hours_before?: number; // 24 hours before event
    event_types?: string[]; // Only for specific event types
  };

  // New member trigger
  new_member?: {
    delay_hours?: number; // Wait X hours after approval
  };

  // Low engagement trigger
  low_engagement?: {
    threshold?: number; // Engagement score threshold
    inactive_days?: number; // No activity for X days
  };

  // Newsletter reminder
  newsletter_reminder?: {
    day_of_month?: number; // 25th of every month
  };

  // Budget alert
  budget_alert?: {
    utilization_threshold?: number; // 80%
  };

  // Expense approval
  expense_approval?: {
    min_amount?: number; // Only for expenses above threshold
  };

  // Custom conditions
  custom?: Record<string, any>;
}

export interface AutomationRuleWithTemplate extends AutomationRule {
  template: AnnouncementTemplate;
  created_by_name?: string;
}

export interface AutomationExecutionLog {
  rule_id: string;
  executed_at: string;
  success: boolean;
  recipients_count: number;
  error_message?: string;
}

// ============================================================================
// COMMUNICATION ANALYTICS TYPES
// ============================================================================

export interface CommunicationAnalytics {
  id: string;
  announcement_id: string;
  channel: AnnouncementChannel;
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  engagement_rate: number; // Auto-calculated
  click_through_rate: number; // Auto-calculated
  calculated_at: string;
}

export interface ChannelPerformance {
  channel: AnnouncementChannel;
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  delivery_rate: number; // delivered / total_sent
  open_rate: number; // opened / delivered
  click_rate: number; // clicked / opened
  failure_rate: number; // failed / total_sent
}

export interface CommunicationDashboardAnalytics {
  overview: {
    total_announcements: number;
    total_sent: number;
    average_engagement_rate: number;
    average_click_through_rate: number;
  };
  by_channel: ChannelPerformance[];
  trends: EngagementTrend[];
  top_performing: AnnouncementListItem[];
}

export interface EngagementTrend {
  date: string; // YYYY-MM-DD
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  engagement_rate: number;
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  channels: AnnouncementChannel[];
  priority?: AnnouncementPriority;
  audience_filter?: AudienceFilter;
  segment_id?: string;
  template_id?: string;
  scheduled_at?: string; // ISO string
  metadata?: Record<string, any>;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  channels?: AnnouncementChannel[];
  priority?: AnnouncementPriority;
  audience_filter?: AudienceFilter;
  segment_id?: string;
  scheduled_at?: string;
  metadata?: Record<string, any>;
}

export interface CreateTemplateInput {
  name: string;
  type: TemplateType;
  content_template: string;
  default_channels: AnnouncementChannel[];
  category?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  type?: TemplateType;
  content_template?: string;
  default_channels?: AnnouncementChannel[];
  category?: string;
}

export interface CreateNotificationInput {
  member_id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  action_url?: string;
  metadata?: Record<string, any>;
  expires_at?: string;
}

export interface CreateNewsletterInput {
  title: string;
  edition_number: number;
  month?: number;
  year?: number;
  content: NewsletterContent;
  chair_message?: string;
  chair_image_url?: string;
}

export interface UpdateNewsletterInput {
  title?: string;
  content?: NewsletterContent;
  chair_message?: string;
  chair_image_url?: string;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  filter_rules: AudienceFilter;
}

export interface UpdateSegmentInput {
  name?: string;
  description?: string;
  filter_rules?: AudienceFilter;
}

export interface CreateAutomationRuleInput {
  name: string;
  trigger_type: AutomationTriggerType;
  conditions: AutomationConditions;
  template_id: string;
  channels: AnnouncementChannel[];
  enabled?: boolean;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  conditions?: AutomationConditions;
  template_id?: string;
  channels?: AnnouncementChannel[];
  enabled?: boolean;
}

// ============================================================================
// FILTER TYPES FOR DATA TABLES
// ============================================================================

export interface AnnouncementFilters {
  status?: AnnouncementStatus[];
  channels?: AnnouncementChannel[];
  created_by?: string[];
  scheduled_after?: string;
  scheduled_before?: string;
  sent_after?: string;
  sent_before?: string;
  search?: string; // Search title and content
}

export interface NotificationFilters {
  category?: NotificationCategory[];
  read?: boolean;
  created_after?: string;
  created_before?: string;
}

export interface TemplateFilters {
  type?: TemplateType[];
  channels?: AnnouncementChannel[];
  search?: string; // Search name and content_template
}

export interface NewsletterFilters {
  status?: NewsletterStatus[];
  year?: number;
  month?: number;
  search?: string;
}

export interface SegmentFilters {
  search?: string; // Search name and description
  created_by?: string[];
}

export interface AutomationRuleFilters {
  trigger_type?: AutomationTriggerType[];
  enabled?: boolean;
  search?: string;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginatedAnnouncements {
  data: AnnouncementListItem[];
  items: AnnouncementListItem[]; // Alias for data
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  page_count: number; // Alias for totalPages
}

export interface PaginatedNotifications {
  data: InAppNotification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unread_count: number;
}

export interface PaginatedTemplates {
  data: TemplateListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedNewsletters {
  data: NewsletterListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface DynamicTag {
  tag: string; // e.g., "firstName"
  placeholder: string; // e.g., "{firstName}"
  description: string;
  category: 'member' | 'event' | 'chapter' | 'custom';
  example: string;
}

export const AVAILABLE_DYNAMIC_TAGS: DynamicTag[] = [
  // Member tags
  { tag: 'firstName', placeholder: '{firstName}', description: 'Member first name', category: 'member', example: 'John' },
  { tag: 'lastName', placeholder: '{lastName}', description: 'Member last name', category: 'member', example: 'Doe' },
  { tag: 'email', placeholder: '{email}', description: 'Member email', category: 'member', example: 'john@example.com' },
  { tag: 'phone', placeholder: '{phone}', description: 'Member phone', category: 'member', example: '+1234567890' },
  { tag: 'city', placeholder: '{city}', description: 'Member city', category: 'member', example: 'Mumbai' },
  { tag: 'company', placeholder: '{company}', description: 'Member company', category: 'member', example: 'TechCorp' },
  { tag: 'designation', placeholder: '{designation}', description: 'Member designation', category: 'member', example: 'Software Engineer' },
  { tag: 'engagementScore', placeholder: '{engagementScore}', description: 'Engagement score', category: 'member', example: '85' },
  { tag: 'leadershipReadiness', placeholder: '{leadershipReadiness}', description: 'Leadership readiness score', category: 'member', example: '75' },

  // Event tags
  { tag: 'eventName', placeholder: '{eventName}', description: 'Event name', category: 'event', example: 'Annual Conference' },
  { tag: 'eventDate', placeholder: '{eventDate}', description: 'Event date', category: 'event', example: 'Jan 15, 2025' },
  { tag: 'eventTime', placeholder: '{eventTime}', description: 'Event time', category: 'event', example: '6:00 PM' },
  { tag: 'eventVenue', placeholder: '{eventVenue}', description: 'Event venue', category: 'event', example: 'Convention Center' },
  { tag: 'eventCategory', placeholder: '{eventCategory}', description: 'Event category', category: 'event', example: 'Networking' },

  // Chapter tags
  { tag: 'chapterName', placeholder: '{chapterName}', description: 'Chapter name', category: 'chapter', example: 'Yi Mumbai' },
  { tag: 'chairName', placeholder: '{chairName}', description: 'Chair name', category: 'chapter', example: 'Jane Smith' },
  { tag: 'chairEmail', placeholder: '{chairEmail}', description: 'Chair email', category: 'chapter', example: 'chair@yi.org' },

  // Custom tags
  { tag: 'customMessage', placeholder: '{customMessage}', description: 'Custom message', category: 'custom', example: 'Your custom content' },
  { tag: 'customField1', placeholder: '{customField1}', description: 'Custom field 1', category: 'custom', example: '' },
  { tag: 'customField2', placeholder: '{customField2}', description: 'Custom field 2', category: 'custom', example: '' },
];

// Helper function to replace placeholders in template
export function replacePlaceholders(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

// Helper function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper function to format date
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

// Helper function to format time
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

// Helper function to get time ago string
export function getTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return formatDate(date);
}

// Note: All types are already exported at their definitions above
// No need for additional export statements
