/**
 * WhatsApp Data Fetching Layer
 *
 * Cached data fetching functions for WhatsApp Management module
 * following Next.js 16 patterns.
 *
 * IMPORTANT: We don't use Next.js 16's 'use cache' directive here because
 * all functions access Supabase client which uses cookies() - a dynamic data source.
 *
 * Note: Empty tables will return null/[] - not errors.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type {
  WhatsAppConnection,
  WhatsAppGroup,
  WhatsAppTemplate,
  WhatsAppMessageLog,
  WhatsAppGroupWithChapter,
  WhatsAppTemplateWithCreator,
  WhatsAppMessageLogWithDetails,
  WhatsAppDashboardStats,
  RecentMessageActivity,
  GroupListItem,
  TemplateListItem,
  MessageLogItem,
  GroupFilters,
  TemplateFilters,
  MessageLogFilters,
  PaginatedMessageLogs,
  ConnectionStatus,
} from '@/types/whatsapp'

// ============================================================================
// Connection Functions
// ============================================================================

/**
 * Get WhatsApp connection for a chapter
 *
 * @param chapterId - Chapter ID
 * @returns Connection data or null
 */
export async function getWhatsAppConnection(
  chapterId: string
): Promise<WhatsAppConnection | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_connections')
    .select('*')
    .eq('chapter_id', chapterId)
    .single()

  if (error) {
    // No connection exists yet is not an error
    if (error.code === 'PGRST116') {
      return null
    }
    // Log error with full details
    console.error('Error fetching WhatsApp connection:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
    })
    return null
  }

  return data
}

/**
 * Get connection status for a chapter
 *
 * @param chapterId - Chapter ID
 * @returns Connection status
 */
export async function getConnectionStatus(
  chapterId: string
): Promise<ConnectionStatus> {
  const connection = await getWhatsAppConnection(chapterId)
  return (connection?.status as ConnectionStatus) || 'disconnected'
}

// ============================================================================
// Group Functions
// ============================================================================

/**
 * Get all WhatsApp groups for a chapter
 *
 * @param chapterId - Chapter ID
 * @param filters - Optional filters
 * @returns Array of groups
 */
export async function getWhatsAppGroups(
  chapterId: string,
  filters?: GroupFilters
): Promise<GroupListItem[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('whatsapp_groups')
    .select('id, jid, name, group_type, description, member_count, is_default, is_active')
    .eq('chapter_id', chapterId)

  // Apply search filter
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  // Apply group type filter
  if (filters?.group_type && filters.group_type.length > 0) {
    query = query.in('group_type', filters.group_type)
  }

  // Apply active filter
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  // Sort: default groups first, then by name
  query = query
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching WhatsApp groups:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
    })
    return []
  }

  return data as GroupListItem[]
}

/**
 * Get a single WhatsApp group by ID
 *
 * @param id - Group ID
 * @returns Group data or null
 */
export async function getWhatsAppGroupById(
  id: string
): Promise<WhatsAppGroupWithChapter | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_groups')
    .select(`
      *,
      chapter:chapters!whatsapp_groups_chapter_id_fkey (
        id,
        name
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching WhatsApp group:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      groupId: id,
    })
    return null
  }

  return data as WhatsAppGroupWithChapter
}

/**
 * Get the default group for a chapter
 *
 * @param chapterId - Chapter ID
 * @returns Default group or null
 */
export async function getDefaultGroup(
  chapterId: string
): Promise<WhatsAppGroup | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_groups')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching default group:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
    })
    return null
  }

  return data
}

/**
 * Get groups by type
 *
 * @param chapterId - Chapter ID
 * @param groupType - Group type
 * @returns Array of groups
 */
export async function getGroupsByType(
  chapterId: string,
  groupType: string
): Promise<WhatsAppGroup[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_groups')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('group_type', groupType)
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching groups by type:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
      groupType,
    })
    return []
  }

  return data
}

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Get all templates for a chapter (includes national templates)
 *
 * @param chapterId - Chapter ID (or null for national only)
 * @param filters - Optional filters
 * @returns Array of templates
 */
export async function getWhatsAppTemplates(
  chapterId: string | null,
  filters?: TemplateFilters
): Promise<TemplateListItem[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('whatsapp_templates')
    .select('id, name, category, content, variables, is_active, usage_count, chapter_id')

  // Filter by chapter OR national (chapter_id is null)
  if (chapterId) {
    query = query.or(`chapter_id.eq.${chapterId},chapter_id.is.null`)
  } else {
    // Only national templates
    query = query.is('chapter_id', null)
  }

  // Apply search filter
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  // Apply category filter
  if (filters?.category && filters.category.length > 0) {
    query = query.in('category', filters.category)
  }

  // Apply national filter
  if (filters?.is_national !== undefined) {
    if (filters.is_national) {
      query = query.is('chapter_id', null)
    } else {
      query = query.not('chapter_id', 'is', null)
    }
  }

  // Apply active filter
  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  // Sort by usage count (most used first), then name
  query = query
    .order('usage_count', { ascending: false })
    .order('name', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching WhatsApp templates:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
    })
    return []
  }

  return data.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    content: t.content,
    variables: (t.variables as string[]) || [],
    is_national: t.chapter_id === null,
    usage_count: t.usage_count || 0,
    is_active: t.is_active,
  })) as TemplateListItem[]
}

/**
 * Get a single template by ID
 *
 * @param id - Template ID
 * @returns Template data or null
 */
export async function getWhatsAppTemplateById(
  id: string
): Promise<WhatsAppTemplateWithCreator | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select(`
      *,
      chapter:chapters (
        id,
        name
      ),
      creator:profiles!whatsapp_templates_created_by_fkey (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching WhatsApp template:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      templateId: id,
    })
    return null
  }

  return data as WhatsAppTemplateWithCreator
}

/**
 * Get templates by category
 *
 * @param chapterId - Chapter ID
 * @param category - Template category
 * @returns Array of templates
 */
export async function getTemplatesByCategory(
  chapterId: string,
  category: string
): Promise<WhatsAppTemplate[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .or(`chapter_id.eq.${chapterId},chapter_id.is.null`)
    .eq('category', category)
    .eq('is_active', true)
    .order('usage_count', { ascending: false })

  if (error) {
    console.error('Error fetching templates by category:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
      category,
    })
    return []
  }

  return data
}

// ============================================================================
// Message Log Functions
// ============================================================================

/**
 * Get message logs for a chapter with pagination
 *
 * @param chapterId - Chapter ID
 * @param page - Page number
 * @param pageSize - Items per page
 * @param filters - Optional filters
 * @returns Paginated message logs
 */
export async function getMessageLogs(
  chapterId: string,
  page: number = 1,
  pageSize: number = 20,
  filters?: MessageLogFilters
): Promise<PaginatedMessageLogs> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('whatsapp_message_logs')
    .select(`
      id,
      recipient_type,
      recipient_name,
      message_content,
      status,
      sent_at,
      template:whatsapp_templates (name),
      sender:profiles!whatsapp_message_logs_sent_by_fkey (full_name)
    `, { count: 'exact' })
    .eq('chapter_id', chapterId)

  // Apply search filter
  if (filters?.search) {
    query = query.or(
      `recipient_name.ilike.%${filters.search}%,message_content.ilike.%${filters.search}%`
    )
  }

  // Apply recipient type filter
  if (filters?.recipient_type && filters.recipient_type.length > 0) {
    query = query.in('recipient_type', filters.recipient_type)
  }

  // Apply status filter
  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }

  // Apply date filters
  if (filters?.date_from) {
    query = query.gte('sent_at', filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte('sent_at', filters.date_to)
  }

  // Apply sender filter
  if (filters?.sent_by) {
    query = query.eq('sent_by', filters.sent_by)
  }

  // Sort by most recent
  query = query.order('sent_at', { ascending: false })

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching message logs:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
      page,
      pageSize,
    })
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    }
  }

  const items: MessageLogItem[] = (data || []).map((log) => {
    // Supabase joins can return arrays or single objects depending on relationship
    const template = Array.isArray(log.template) ? log.template[0] : log.template
    const sender = Array.isArray(log.sender) ? log.sender[0] : log.sender

    return {
      id: log.id,
      recipient_type: log.recipient_type,
      recipient_name: log.recipient_name,
      message_preview: log.message_content.substring(0, 100) + (log.message_content.length > 100 ? '...' : ''),
      status: log.status,
      sent_at: log.sent_at,
      template_name: template?.name || null,
      sender_name: sender?.full_name || null,
    }
  })

  return {
    data: items,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  }
}

/**
 * Get recent message activity
 *
 * @param chapterId - Chapter ID
 * @param limit - Number of messages to return
 * @returns Array of recent messages
 */
export async function getRecentMessages(
  chapterId: string,
  limit: number = 10
): Promise<RecentMessageActivity[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('whatsapp_message_logs')
    .select('id, recipient_type, recipient_name, status, sent_at, message_content')
    .eq('chapter_id', chapterId)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent messages:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
      limit,
    })
    return []
  }

  return (data || []).map((log) => ({
    id: log.id,
    recipient_type: log.recipient_type,
    recipient_name: log.recipient_name,
    status: log.status,
    sent_at: log.sent_at,
    message_preview: log.message_content.substring(0, 80) + (log.message_content.length > 80 ? '...' : ''),
  }))
}

// ============================================================================
// Dashboard Stats Functions
// ============================================================================

/**
 * Get dashboard statistics for WhatsApp module
 *
 * @param chapterId - Chapter ID
 * @returns Dashboard stats
 */
export async function getWhatsAppDashboardStats(
  chapterId: string
): Promise<WhatsAppDashboardStats> {
  const supabase = await createServerSupabaseClient()

  // Get connection status
  const connection = await getWhatsAppConnection(chapterId)

  // Get message counts
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)
  const weekAgoISO = weekAgo.toISOString()

  const monthAgo = new Date()
  monthAgo.setMonth(monthAgo.getMonth() - 1)
  monthAgo.setHours(0, 0, 0, 0)
  const monthAgoISO = monthAgo.toISOString()

  // Parallel queries for counts
  const [
    { count: messagesToday },
    { count: messagesWeek },
    { count: messagesMonth },
    { count: groupsCount },
    { count: templatesCount },
  ] = await Promise.all([
    supabase
      .from('whatsapp_message_logs')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)
      .gte('sent_at', todayISO),
    supabase
      .from('whatsapp_message_logs')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)
      .gte('sent_at', weekAgoISO),
    supabase
      .from('whatsapp_message_logs')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)
      .gte('sent_at', monthAgoISO),
    supabase
      .from('whatsapp_groups')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)
      .eq('is_active', true),
    supabase
      .from('whatsapp_templates')
      .select('*', { count: 'exact', head: true })
      .or(`chapter_id.eq.${chapterId},chapter_id.is.null`)
      .eq('is_active', true),
  ])

  return {
    connection_status: (connection?.status as ConnectionStatus) || 'disconnected',
    connected_phone: connection?.connected_phone || null,
    last_active_at: connection?.last_active_at || null,
    messages_today: messagesToday || 0,
    messages_this_week: messagesWeek || 0,
    messages_this_month: messagesMonth || 0,
    groups_count: groupsCount || 0,
    templates_count: templatesCount || 0,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Increment template usage count
 *
 * @param templateId - Template ID
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.rpc('increment_template_usage', {
    template_id: templateId,
  })

  if (error) {
    console.error('Error incrementing template usage:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      templateId,
    })
  }
}

/**
 * Check if a group JID exists for a chapter
 *
 * @param chapterId - Chapter ID
 * @param jid - Group JID
 * @returns True if exists
 */
export async function groupJidExists(
  chapterId: string,
  jid: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { count, error } = await supabase
    .from('whatsapp_groups')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)
    .eq('jid', jid)

  if (error) {
    console.error('Error checking group JID:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      chapterId,
      jid,
    })
    return false
  }

  return (count || 0) > 0
}
