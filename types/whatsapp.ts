/**
 * WhatsApp Module Type Definitions
 *
 * Type definitions for WhatsApp Management module.
 * Supports chapter-aware connections, groups, templates, and message logs.
 */

// ============================================================================
// Base Types from Database
// ============================================================================
// Note: Explicit types until Supabase types are regenerated

export interface WhatsAppConnection {
  id: string
  chapter_id: string
  session_path: string
  connected_phone: string | null
  connected_at: string | null
  last_active_at: string | null
  status: 'disconnected' | 'connecting' | 'connected' | 'failed'
  created_at: string
  updated_at: string
}

export interface WhatsAppGroup {
  id: string
  chapter_id: string
  jid: string
  name: string
  description: string | null
  group_type: 'chapter' | 'leadership' | 'ec_team' | 'yuva' | 'thalir' | 'fun' | 'core' | 'other' | null
  is_default: boolean
  member_count: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppTemplate {
  id: string
  chapter_id: string | null
  name: string
  category: 'event' | 'announcement' | 'reminder' | 'follow_up' | 'greeting' | 'custom'
  content: string
  variables: string[]
  is_active: boolean
  usage_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppMessageLog {
  id: string
  chapter_id: string
  recipient_type: 'individual' | 'group' | 'bulk'
  recipient_id: string | null
  recipient_name: string | null
  template_id: string | null
  message_content: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  error_message: string | null
  sent_by: string | null
  sent_at: string
  metadata: Record<string, unknown> | null
}

// ============================================================================
// Enums / Constants
// ============================================================================

export const CONNECTION_STATUSES = ['disconnected', 'connecting', 'connected', 'failed'] as const
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export const GROUP_TYPES = ['chapter', 'leadership', 'ec_team', 'yuva', 'thalir', 'fun', 'core', 'other'] as const
export type GroupType = (typeof GROUP_TYPES)[number]

export const TEMPLATE_CATEGORIES = ['event', 'announcement', 'reminder', 'follow_up', 'greeting', 'custom'] as const
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export const RECIPIENT_TYPES = ['individual', 'group', 'bulk'] as const
export type RecipientType = (typeof RECIPIENT_TYPES)[number]

export const MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

// ============================================================================
// Extended Types (with relationships)
// ============================================================================

export interface WhatsAppConnectionWithChapter extends WhatsAppConnection {
  chapter?: {
    id: string
    name: string
    location: string
  }
}

export interface WhatsAppGroupWithChapter extends WhatsAppGroup {
  chapter?: {
    id: string
    name: string
  }
}

export interface WhatsAppTemplateWithCreator extends WhatsAppTemplate {
  chapter?: {
    id: string
    name: string
  } | null
  creator?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

export interface WhatsAppMessageLogWithDetails extends WhatsAppMessageLog {
  chapter?: {
    id: string
    name: string
  }
  template?: {
    id: string
    name: string
    category: string
  } | null
  sender?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

// ============================================================================
// UI/Display Types
// ============================================================================

export interface GroupListItem {
  id: string
  jid: string
  name: string
  group_type: GroupType | null
  description: string | null
  member_count: number | null
  is_default: boolean
  is_active: boolean
}

export interface TemplateListItem {
  id: string
  name: string
  category: TemplateCategory
  content: string
  variables: string[]
  is_national: boolean
  usage_count: number
  is_active: boolean
}

export interface MessageLogItem {
  id: string
  recipient_type: RecipientType
  recipient_name: string | null
  message_preview: string
  status: MessageStatus
  sent_at: string
  template_name: string | null
  sender_name: string | null
}

// ============================================================================
// Dashboard Stats Types
// ============================================================================

export interface WhatsAppDashboardStats {
  connection_status: ConnectionStatus
  connected_phone: string | null
  last_active_at: string | null
  messages_today: number
  messages_this_week: number
  messages_this_month: number
  groups_count: number
  templates_count: number
}

export interface RecentMessageActivity {
  id: string
  recipient_type: RecipientType
  recipient_name: string | null
  status: MessageStatus
  sent_at: string
  message_preview: string
}

// ============================================================================
// Form Input Types
// ============================================================================

export interface CreateWhatsAppGroupInput {
  chapter_id: string
  jid: string
  name: string
  description?: string
  group_type?: GroupType
  is_default?: boolean
  member_count?: number
}

export interface UpdateWhatsAppGroupInput {
  id: string
  name?: string
  description?: string
  group_type?: GroupType
  is_default?: boolean
  member_count?: number
  is_active?: boolean
}

export interface CreateWhatsAppTemplateInput {
  chapter_id?: string | null // null for national template
  name: string
  category: TemplateCategory
  content: string
  variables?: string[]
}

export interface UpdateWhatsAppTemplateInput {
  id: string
  name?: string
  category?: TemplateCategory
  content?: string
  variables?: string[]
  is_active?: boolean
}

export interface LogMessageInput {
  chapter_id: string
  recipient_type: RecipientType
  recipient_id?: string
  recipient_name?: string
  template_id?: string
  message_content: string
  status?: MessageStatus
  error_message?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Compose Form Types
// ============================================================================

export interface ComposeRecipient {
  type: 'individual' | 'group'
  id: string // phone number or group JID
  name: string
  phone?: string // for individuals
}

export interface ComposeFormData {
  recipients: ComposeRecipient[]
  template_id?: string
  message: string
  variables?: Record<string, string>
}

export interface BulkComposeFormData {
  recipient_ids: string[] // member IDs
  template_id?: string
  message: string
  variables?: Record<string, string>
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface GroupFilters {
  search?: string
  group_type?: GroupType[]
  is_active?: boolean
}

export interface TemplateFilters {
  search?: string
  category?: TemplateCategory[]
  is_national?: boolean
  is_active?: boolean
}

export interface MessageLogFilters {
  search?: string
  recipient_type?: RecipientType[]
  status?: MessageStatus[]
  date_from?: string
  date_to?: string
  sent_by?: string
}

export interface PaginatedMessageLogs {
  data: MessageLogItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// Template Variable Types
// ============================================================================

export interface TemplateVariable {
  key: string
  label: string
  description?: string
  required?: boolean
  defaultValue?: string
}

// Standard variables available for templates
export const STANDARD_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'member_name', label: 'Member Name', description: 'Full name of the member' },
  { key: 'chapter_name', label: 'Chapter Name', description: 'Name of the Yi chapter' },
  { key: 'event_name', label: 'Event Name', description: 'Name of the event' },
  { key: 'date', label: 'Date', description: 'Date in readable format' },
  { key: 'time', label: 'Time', description: 'Time of the event/meeting' },
  { key: 'venue', label: 'Venue', description: 'Location/venue of the event' },
  { key: 'description', label: 'Description', description: 'Event or announcement description' },
  { key: 'rsvp_link', label: 'RSVP Link', description: 'Link to RSVP' },
  { key: 'days_until', label: 'Days Until', description: 'Days remaining until event (e.g., "tomorrow", "in 3 days")' },
  { key: 'status', label: 'Status', description: 'Status of RSVP or action' },
  { key: 'title', label: 'Title', description: 'Title of announcement' },
  { key: 'body', label: 'Body', description: 'Main body content' },
  { key: 'meeting_title', label: 'Meeting Title', description: 'Title of the meeting' },
  { key: 'location', label: 'Location', description: 'Meeting location' },
]

// ============================================================================
// Helper Types
// ============================================================================

export interface WhatsAppQuickAction {
  type: 'message_chapter' | 'message_leadership' | 'message_ec' | 'compose_new'
  label: string
  icon: string
  group?: WhatsAppGroup
}

export interface GroupTypeInfo {
  value: GroupType
  label: string
  description: string
  color: string
}

export const GROUP_TYPE_INFO: GroupTypeInfo[] = [
  { value: 'chapter', label: 'Chapter', description: 'Main chapter group', color: 'blue' },
  { value: 'leadership', label: 'Leadership', description: 'Leadership team', color: 'purple' },
  { value: 'ec_team', label: 'EC Team', description: 'Executive Committee team', color: 'orange' },
  { value: 'yuva', label: 'Yuva', description: 'College student group', color: 'green' },
  { value: 'thalir', label: 'Thalir', description: 'School student group', color: 'cyan' },
  { value: 'fun', label: 'Fun', description: 'Casual/fun group', color: 'pink' },
  { value: 'core', label: 'Core', description: 'Core committee', color: 'red' },
  { value: 'other', label: 'Other', description: 'Other groups', color: 'gray' },
]

export interface TemplateCategoryInfo {
  value: TemplateCategory
  label: string
  description: string
  icon: string
}

export const TEMPLATE_CATEGORY_INFO: TemplateCategoryInfo[] = [
  { value: 'event', label: 'Event', description: 'Event announcements and RSVPs', icon: 'calendar' },
  { value: 'announcement', label: 'Announcement', description: 'General announcements', icon: 'megaphone' },
  { value: 'reminder', label: 'Reminder', description: 'Reminders and follow-ups', icon: 'bell' },
  { value: 'follow_up', label: 'Follow Up', description: 'Post-event follow-ups', icon: 'reply' },
  { value: 'greeting', label: 'Greeting', description: 'Welcome and birthday messages', icon: 'party' },
  { value: 'custom', label: 'Custom', description: 'Custom templates', icon: 'edit' },
]
