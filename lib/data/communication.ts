'use cache';

// ============================================================================
// Module 7: Communication Hub - Data Layer (Cached Fetching Functions)
// ============================================================================
// Description: Cached data fetching functions using React cache() and 'use cache'
//              directive for optimal performance in Next.js 16
// Version: 1.0
// Created: 2025-11-17
// ============================================================================

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentChapterId } from '@/lib/auth';
import type {
  Announcement,
  AnnouncementListItem,
  AnnouncementWithDetails,
  AnnouncementTemplate,
  TemplateListItem,
  InAppNotification,
  NotificationSummary,
  Newsletter,
  NewsletterListItem,
  CommunicationSegment,
  SegmentWithMembers,
  SegmentMember,
  AutomationRule,
  AutomationRuleWithTemplate,
  CommunicationAnalytics,
  ChannelPerformance,
  CommunicationDashboardAnalytics,
  EngagementTrend,
  AnnouncementFilters,
  NotificationFilters,
  TemplateFilters,
  NewsletterFilters,
  PaginatedAnnouncements,
  PaginatedNotifications,
  AnnouncementChannel,
} from '@/types/communication';

// ============================================================================
// ANNOUNCEMENT DATA FUNCTIONS
// ============================================================================

/**
 * Get paginated announcements with filters
 * Cache: moderate updates (use cache with 'minutes' lifetime)
 */
export const getAnnouncements = cache(async (
  chapterId?: string,
  filters?: AnnouncementFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedAnnouncements> => {

  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  let query = supabase
    .from('announcements')
    .select(`
      id,
      title,
      content,
      status,
      channels,
      scheduled_at,
      sent_at,
      created_at,
      created_by,
      segment_id,
      members!created_by (
        id,
        profiles!inner (
          first_name,
          last_name
        )
      ),
      communication_segments (
        name
      )
    `, { count: 'exact' })
    .eq('chapter_id', cId);

  // Apply filters
  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
  }

  if (filters?.scheduled_after) {
    query = query.gte('scheduled_at', filters.scheduled_after);
  }

  if (filters?.scheduled_before) {
    query = query.lte('scheduled_at', filters.scheduled_before);
  }

  if (filters?.sent_after) {
    query = query.gte('sent_at', filters.sent_after);
  }

  if (filters?.sent_before) {
    query = query.lte('sent_at', filters.sent_before);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching announcements:', error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Get recipient counts for each announcement
  const announcementIds = data?.map(a => a.id) || [];
  const { data: recipientCounts } = await supabase
    .from('announcement_recipients')
    .select('announcement_id, status')
    .in('announcement_id', announcementIds);

  // Process data
  const announcements: AnnouncementListItem[] = (data || []).map(announcement => {
    const memberData = announcement.members as any;
    const recipients = recipientCounts?.filter(r => r.announcement_id === announcement.id) || [];

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      status: announcement.status as any,
      channels: announcement.channels as AnnouncementChannel[],
      scheduled_at: announcement.scheduled_at,
      sent_at: announcement.sent_at,
      created_by: announcement.created_by,
      created_by_name: memberData?.profiles
        ? `${memberData.profiles.first_name} ${memberData.profiles.last_name}`
        : 'Unknown',
      segment_name: announcement.communication_segments?.[0]?.name,
      recipient_count: recipients.length,
      delivered_count: recipients.filter(r => r.status === 'delivered' || r.status === 'opened' || r.status === 'clicked').length,
      opened_count: recipients.filter(r => r.status === 'opened' || r.status === 'clicked').length,
      created_at: announcement.created_at,
    };
  });

  return {
    data: announcements,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
});

/**
 * Get single announcement with full details
 * Cache: stable data (use cache with 'minutes' lifetime)
 */
export const getAnnouncementById = cache(async (id: string): Promise<AnnouncementWithDetails | null> => {

  const supabase = await createClient();

  const { data: announcement, error } = await supabase
    .from('announcements')
    .select(`
      *,
      members!created_by (
        id,
        profiles!inner (
          first_name,
          last_name,
          email,
          avatar_url
        )
      ),
      communication_segments (*),
      announcement_templates (*),
      communication_analytics (*)
    `)
    .eq('id', id)
    .single();

  if (error || !announcement) {
    return null;
  }

  // Get recipient summary
  const { data: recipients } = await supabase
    .from('announcement_recipients')
    .select('status')
    .eq('announcement_id', id);

  const recipientSummary = {
    total: recipients?.length || 0,
    queued: recipients?.filter(r => r.status === 'queued').length || 0,
    sent: recipients?.filter(r => r.status === 'sent').length || 0,
    delivered: recipients?.filter(r => r.status === 'delivered').length || 0,
    opened: recipients?.filter(r => r.status === 'opened').length || 0,
    clicked: recipients?.filter(r => r.status === 'clicked').length || 0,
    failed: recipients?.filter(r => r.status === 'failed').length || 0,
    bounced: recipients?.filter(r => r.status === 'bounced').length || 0,
  };

  const memberData = announcement.members as any;

  return {
    ...announcement,
    created_by_name: memberData?.profiles
      ? `${memberData.profiles.first_name} ${memberData.profiles.last_name}`
      : 'Unknown',
    created_by_email: memberData?.profiles?.email || '',
    creator: memberData?.profiles ? {
      id: memberData.id,
      first_name: memberData.profiles.first_name,
      last_name: memberData.profiles.last_name,
      email: memberData.profiles.email,
      avatar_url: memberData.profiles.avatar_url,
    } : undefined,
    segment: announcement.communication_segments as any,
    template: announcement.announcement_templates as any,
    analytics: announcement.communication_analytics as any || [],
    recipients_summary: recipientSummary,
  } as AnnouncementWithDetails;
});

/**
 * Get announcement recipients with delivery status
 * Cache: realtime updates for delivery tracking
 */
export const getAnnouncementRecipients = cache(async (announcementId: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('announcement_recipients')
    .select(`
      id,
      channel,
      status,
      delivered_at,
      opened_at,
      clicked_at,
      failed_reason,
      member_id,
      members (
        id,
        profiles!inner (
          first_name,
          last_name,
          email,
          avatar_url
        )
      )
    `)
    .eq('announcement_id', announcementId)
    .order('delivered_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcement recipients:', error);
    return [];
  }

  return (data || []).map(recipient => ({
    id: recipient.id,
    channel: recipient.channel,
    status: recipient.status,
    delivered_at: recipient.delivered_at,
    opened_at: recipient.opened_at,
    clicked_at: recipient.clicked_at,
    failed_reason: recipient.failed_reason,
    member: recipient.members ? {
      id: (recipient.members as any).id,
      first_name: (recipient.members as any).profiles?.first_name,
      last_name: (recipient.members as any).profiles?.last_name,
      email: (recipient.members as any).profiles?.email,
      avatar_url: (recipient.members as any).profiles?.avatar_url,
    } : null,
  }));
});

/**
 * Get draft announcements for current chapter
 */
export const getDraftAnnouncements = cache(async (): Promise<AnnouncementListItem[]> => {

  const result = await getAnnouncements(undefined, { status: ['draft'] }, 1, 100);
  return result.data;
});

/**
 * Get scheduled announcements for current chapter
 */
export const getScheduledAnnouncements = cache(async (): Promise<AnnouncementListItem[]> => {

  const result = await getAnnouncements(undefined, { status: ['scheduled'] }, 1, 100);
  return result.data;
});

// ============================================================================
// TEMPLATE DATA FUNCTIONS
// ============================================================================

/**
 * Get all templates (global + chapter-specific)
 * Cache: stable data (use cache with 'hours' lifetime)
 */
export const getTemplates = cache(async (filters?: TemplateFilters): Promise<AnnouncementTemplate[]> => {

  const supabase = await createClient();
  const chapterId = await getCurrentChapterId();

  let query = supabase
    .from('announcement_templates')
    .select(`
      id,
      name,
      type,
      content_template,
      default_channels,
      category,
      usage_count,
      last_used_at,
      created_by,
      created_at,
      updated_at,
      members (
        profiles!inner (
          first_name,
          last_name
        )
      )
    `)
    .or(`chapter_id.is.null,chapter_id.eq.${chapterId}`);

  // Apply filters
  if (filters?.type?.length) {
    query = query.in('type', filters.type);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,content_template.ilike.%${filters.search}%`);
  }

  query = query.order('usage_count', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }

  return (data || []).map(template => {
    const memberData = template.members as any;
    return {
      id: template.id,
      name: template.name,
      type: template.type as any,
      content_template: template.content_template,
      content: template.content_template, // Alias for easier access
      default_channels: template.default_channels as AnnouncementChannel[],
      category: template.category,
      usage_count: template.usage_count,
      last_used_at: template.last_used_at,
      created_by: template.created_by,
      created_at: template.created_at,
      updated_at: template.updated_at,
      created_by_name: memberData?.profiles
        ? `${memberData.profiles.first_name} ${memberData.profiles.last_name}`
        : undefined,
    } as any;
  });
});

/**
 * Get single template by ID
 */
export const getTemplateById = cache(async (id: string): Promise<AnnouncementTemplate | null> => {

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('announcement_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AnnouncementTemplate;
});

/**
 * Get templates by type
 */
export const getTemplatesByType = cache(async (type: string): Promise<AnnouncementTemplate[]> => {

  const templates = await getTemplates({ type: [type] as any });
  const fullTemplates = await Promise.all(
    templates.map(t => getTemplateById(t.id))
  );
  return fullTemplates.filter(Boolean) as AnnouncementTemplate[];
});

// ============================================================================
// NOTIFICATION DATA FUNCTIONS
// ============================================================================

/**
 * Get notifications for a member
 * Cache: frequently changing (use cache with 'seconds' lifetime)
 */
export const getNotifications = cache(async (
  memberId: string,
  filters?: NotificationFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedNotifications> => {

  const supabase = await createClient();

  let query = supabase
    .from('in_app_notifications')
    .select('*', { count: 'exact' })
    .eq('member_id', memberId);

  // Apply filters
  if (filters?.category?.length) {
    query = query.in('category', filters.category);
  }

  if (filters?.read !== undefined) {
    query = query.eq('read', filters.read);
  }

  if (filters?.created_after) {
    query = query.gte('created_at', filters.created_after);
  }

  if (filters?.created_before) {
    query = query.lte('created_at', filters.created_before);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query
    .order('created_at', { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;

  // Get unread count
  const { count: unreadCount } = await supabase
    .from('in_app_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('read', false);

  if (error) {
    console.error('Error fetching notifications:', error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      unread_count: 0,
    };
  }

  return {
    data: (data || []) as InAppNotification[],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
    unread_count: unreadCount || 0,
  };
});

/**
 * Get recent notifications for dashboard
 * Cache: realtime updates for notifications
 */
export const getRecentNotifications = cache(async (
  chapterId?: string,
  limit: number = 10
): Promise<InAppNotification[]> => {
  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) {
    return [];
  }

  const { data, error } = await supabase
    .from('in_app_notifications')
    .select('*')
    .eq('chapter_id', cId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent notifications:', error);
    return [];
  }

  return (data || []) as InAppNotification[];
});

/**
 * Get unread notification count for a member
 */
export const getUnreadNotificationsCount = cache(async (memberId: string): Promise<number> => {

  const supabase = await createClient();

  const { count, error } = await supabase
    .from('in_app_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('read', false);

  if (error) {
    return 0;
  }

  return count || 0;
});

/**
 * Get notification summary for a member
 */
export const getNotificationSummary = cache(async (memberId: string): Promise<NotificationSummary> => {

  const supabase = await createClient();

  // Get unread count
  const unread_count = await getUnreadNotificationsCount(memberId);

  // Get recent notifications
  const { data: recent } = await supabase
    .from('in_app_notifications')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get counts by category
  const { data: allNotifications } = await supabase
    .from('in_app_notifications')
    .select('category')
    .eq('member_id', memberId);

  const by_category: Record<string, number> = {};
  (allNotifications || []).forEach(n => {
    by_category[n.category] = (by_category[n.category] || 0) + 1;
  });

  return {
    unread_count,
    by_category: by_category as any,
    recent: (recent || []) as InAppNotification[],
  };
});

// ============================================================================
// NEWSLETTER DATA FUNCTIONS
// ============================================================================

/**
 * Get newsletters for a chapter
 */
export const getNewsletters = cache(async (
  chapterId?: string,
  filters?: NewsletterFilters
): Promise<NewsletterListItem[]> => {

  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) return [];

  let query = supabase
    .from('newsletters')
    .select(`
      id,
      title,
      edition_number,
      month,
      year,
      status,
      sent_at,
      recipients_count,
      pdf_url,
      created_by,
      members (
        profiles!inner (
          first_name,
          last_name
        )
      )
    `)
    .eq('chapter_id', cId);

  // Apply filters
  if (filters?.status?.length) {
    query = query.in('status', filters.status);
  }

  if (filters?.year) {
    query = query.eq('year', filters.year);
  }

  if (filters?.month) {
    query = query.eq('month', filters.month);
  }

  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  query = query.order('year', { ascending: false }).order('month', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching newsletters:', error);
    return [];
  }

  return (data || []).map(newsletter => {
    const memberData = newsletter.members as any;
    return {
      id: newsletter.id,
      title: newsletter.title,
      edition_number: newsletter.edition_number,
      month: newsletter.month,
      year: newsletter.year,
      status: newsletter.status as any,
      sent_at: newsletter.sent_at,
      recipients_count: newsletter.recipients_count,
      pdf_url: newsletter.pdf_url,
      created_by_name: memberData?.profiles
        ? `${memberData.profiles.first_name} ${memberData.profiles.last_name}`
        : undefined,
    };
  });
});

/**
 * Get single newsletter by ID
 */
export const getNewsletterById = cache(async (id: string): Promise<Newsletter | null> => {

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Newsletter;
});

/**
 * Get latest newsletter for a chapter
 */
export const getLatestNewsletter = cache(async (chapterId?: string): Promise<Newsletter | null> => {

  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) return null;

  const { data, error } = await supabase
    .from('newsletters')
    .select('*')
    .eq('chapter_id', cId)
    .eq('status', 'published')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Newsletter;
});

// ============================================================================
// SEGMENT DATA FUNCTIONS
// ============================================================================

/**
 * Get all segments for a chapter
 */
export const getSegments = cache(async (chapterId?: string): Promise<CommunicationSegment[]> => {

  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) return [];

  const { data, error } = await supabase
    .from('communication_segments')
    .select('*')
    .eq('chapter_id', cId)
    .order('name');

  if (error) {
    console.error('Error fetching segments:', error);
    return [];
  }

  return (data || []) as CommunicationSegment[];
});

/**
 * Get single segment by ID
 */
export const getSegmentById = cache(async (id: string): Promise<SegmentWithMembers | null> => {

  const supabase = await createClient();

  const { data: segment, error } = await supabase
    .from('communication_segments')
    .select(`
      *,
      members (
        profiles!inner (
          first_name,
          last_name
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !segment) {
    return null;
  }

  const memberData = segment.members as any;

  return {
    ...segment,
    created_by_name: memberData?.profiles
      ? `${memberData.profiles.first_name} ${memberData.profiles.last_name}`
      : undefined,
  } as SegmentWithMembers;
});

/**
 * Get preview count of members matching segment filters
 * This is a simplified version that returns a count estimate
 */
export const getSegmentPreviewCount = cache(async (
  segmentId?: string,
  audienceFilter?: any
): Promise<number> => {
  const supabase = await createClient();
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return 0;
  }

  // Base query for members in chapter
  let query = supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)
    .eq('status', 'active');

  // If segmentId provided, get the segment's filters
  if (segmentId) {
    const { data: segment } = await supabase
      .from('communication_segments')
      .select('filters')
      .eq('id', segmentId)
      .single();

    if (segment?.filters) {
      audienceFilter = segment.filters;
    }
  }

  // Apply audience filters if provided
  if (audienceFilter) {
    // Role filter
    if (audienceFilter.roles && audienceFilter.roles.length > 0) {
      // This would need proper role filtering based on user_roles table
      // For now, return estimated count
    }

    // Engagement filter
    if (audienceFilter.engagement_level) {
      // This would filter by engagement metrics
      // For now, return estimated count
    }

    // Custom filters
    if (audienceFilter.custom_filters) {
      // Apply custom JSONB filters
      // For now, return estimated count
    }
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error getting segment preview count:', error);
    return 0;
  }

  return count || 0;
});

// ============================================================================
// AUTOMATION RULE DATA FUNCTIONS
// ============================================================================

/**
 * Get all automation rules for a chapter
 */
export const getAutomationRules = cache(async (chapterId?: string): Promise<AutomationRuleWithTemplate[]> => {

  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) return [];

  const { data, error } = await supabase
    .from('communication_automation_rules')
    .select(`
      *,
      announcement_templates (*),
      members (
        profiles!inner (
          first_name,
          last_name
        )
      )
    `)
    .eq('chapter_id', cId)
    .order('name');

  if (error) {
    console.error('Error fetching automation rules:', error);
    return [];
  }

  return (data || []).map(rule => {
    const memberData = rule.members as any;
    return {
      ...rule,
      template: rule.announcement_templates as any,
      created_by_name: memberData?.profiles
        ? `${memberData.profiles.first_name} ${memberData.profiles.last_name}`
        : undefined,
    } as AutomationRuleWithTemplate;
  });
});

/**
 * Get single automation rule by ID
 */
export const getAutomationRuleById = cache(async (id: string): Promise<AutomationRuleWithTemplate | null> => {

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('communication_automation_rules')
    .select(`
      *,
      announcement_templates (*)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    ...data,
    template: data.announcement_templates as any,
  } as AutomationRuleWithTemplate;
});

/**
 * Get active automation rules for a chapter
 */
export const getActiveAutomationRules = cache(async (chapterId?: string): Promise<AutomationRuleWithTemplate[]> => {

  const rules = await getAutomationRules(chapterId);
  return rules.filter(rule => rule.enabled);
});

// ============================================================================
// ANALYTICS DATA FUNCTIONS
// ============================================================================

/**
 * Get communication analytics for a chapter
 */
export const getCommunicationAnalytics = cache(async (
  chapterId?: string,
  dateRange?: { start_date: string; end_date: string }
): Promise<CommunicationDashboardAnalytics> => {

  const supabase = await createClient();
  const cId = chapterId || await getCurrentChapterId();

  if (!cId) {
    return {
      overview: {
        total_announcements: 0,
        total_sent: 0,
        average_engagement_rate: 0,
        average_click_through_rate: 0,
      },
      by_channel: [],
      trends: [],
      top_performing: [],
    };
  }

  // Get total announcements
  let announcementsQuery = supabase
    .from('announcements')
    .select('id, title, content, status, sent_at', { count: 'exact' })
    .eq('chapter_id', cId)
    .eq('status', 'sent');

  if (dateRange) {
    announcementsQuery = announcementsQuery
      .gte('sent_at', dateRange.start_date)
      .lte('sent_at', dateRange.end_date);
  }

  const { data: announcements, count: total_announcements } = await announcementsQuery;
  const announcementIds = announcements?.map(a => a.id) || [];

  // Get analytics for all sent announcements
  const { data: analytics } = await supabase
    .from('communication_analytics')
    .select('*')
    .in('announcement_id', announcementIds);

  // Calculate overview
  const total_sent = analytics?.reduce((sum, a) => sum + a.total_sent, 0) || 0;
  const average_engagement_rate = analytics?.length
    ? analytics.reduce((sum, a) => sum + (a.engagement_rate || 0), 0) / analytics.length
    : 0;
  const average_click_through_rate = analytics?.length
    ? analytics.reduce((sum, a) => sum + (a.click_through_rate || 0), 0) / analytics.length
    : 0;

  // Calculate channel performance
  const channelMap = new Map<string, ChannelPerformance>();
  analytics?.forEach(a => {
    const existing = channelMap.get(a.channel) || {
      channel: a.channel as AnnouncementChannel,
      total_sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      delivery_rate: 0,
      open_rate: 0,
      click_rate: 0,
      failure_rate: 0,
    };

    existing.total_sent += a.total_sent;
    channelMap.set(a.channel, existing);
  });

  // Calculate rates
  const by_channel: ChannelPerformance[] = Array.from(channelMap.values()).map(ch => {
    const chAnalytics = analytics?.filter(a => a.channel === ch.channel) || [];
    const total = chAnalytics.reduce((sum, a) => sum + a.total_sent, 0);
    const delivered = chAnalytics.reduce((sum, a) => sum + a.delivered, 0);
    const opened = chAnalytics.reduce((sum, a) => sum + a.opened, 0);
    const clicked = chAnalytics.reduce((sum, a) => sum + a.clicked, 0);
    const failed = chAnalytics.reduce((sum, a) => sum + a.failed, 0);

    return {
      channel: ch.channel,
      total_sent: total,
      delivered,
      opened,
      clicked,
      failed,
      delivery_rate: total > 0 ? (delivered / total) * 100 : 0,
      open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
      click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
      failure_rate: total > 0 ? (failed / total) * 100 : 0,
    };
  });

  // Get top performing announcements
  const announcementsWithEngagement = await Promise.all(
    (announcements || []).slice(0, 10).map(async a => {
      const aAnalytics = analytics?.filter(an => an.announcement_id === a.id) || [];
      const avgEngagement = aAnalytics.length
        ? aAnalytics.reduce((sum, an) => sum + (an.engagement_rate || 0), 0) / aAnalytics.length
        : 0;

      return {
        ...a,
        engagement_rate: avgEngagement,
      };
    })
  );

  const top_performing = announcementsWithEngagement
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
    .slice(0, 5)
    .map(a => ({
      id: a.id,
      title: a.title,
      content: a.content || '',
      status: a.status as any,
      channels: [] as AnnouncementChannel[],
      sent_at: a.sent_at,
      created_by: '',
      created_at: a.sent_at || '',
    }));

  return {
    overview: {
      total_announcements: total_announcements || 0,
      total_sent,
      average_engagement_rate,
      average_click_through_rate,
    },
    by_channel,
    trends: [], // TODO: Implement trends calculation
    top_performing,
  };
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get segment member preview
 */
export async function getSegmentMemberPreview(
  segmentId: string,
  limit: number = 10
): Promise<SegmentMember[]> {
  const supabase = await createClient();

  // For MVP, get all active members
  // In production, this should apply the segment filter_rules
  const { data } = await supabase
    .from('members')
    .select(`
      id,
      city,
      profiles!inner (
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('is_active', true)
    .limit(limit);

  return (data || []).map(m => ({
    id: m.id,
    first_name: (m.profiles as any).first_name,
    last_name: (m.profiles as any).last_name,
    email: (m.profiles as any).email,
    phone: (m.profiles as any).phone,
    city: m.city,
  }));
}

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export {
  // Announcements
  // getAnnouncements, getAnnouncementById, getDraftAnnouncements, getScheduledAnnouncements,
  // Templates
  // getTemplates, getTemplateById, getTemplatesByType,
  // Notifications
  // getNotifications, getUnreadNotificationsCount, getNotificationSummary,
  // Newsletters
  // getNewsletters, getNewsletterById, getLatestNewsletter,
  // Segments
  // getSegments, getSegmentById,
  // Automation
  // getAutomationRules, getAutomationRuleById, getActiveAutomationRules,
  // Analytics
  // getCommunicationAnalytics,
};
