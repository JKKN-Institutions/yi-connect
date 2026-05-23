// ============================================================================
// Module 7: Communication Hub - Data Layer (Cached Fetching Functions)
// ============================================================================
// Description: Cached data fetching functions using React cache() for
//              request-level deduplication (not 'use cache' due to cookies)
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
  AnnouncementChannel
} from '@/types/communication';

// ============================================================================
// ANNOUNCEMENT DATA FUNCTIONS
// ============================================================================
//
// NOTE: The `announcements` and `announcement_recipients` tables are not
// provisioned in the yi_connect schema. These fetchers return empty
// shapes to avoid PGRST205 runtime errors. Restore by recreating the
// tables and reinstating the original queries.

/** Get paginated announcements with filters (feature disabled) */
export const getAnnouncements = cache(
  async (
    _chapterId?: string,
    _filters?: AnnouncementFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedAnnouncements> => {
    return {
      data: [],
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      page_count: 0
    };
  }
);

/** Get single announcement with full details (feature disabled) */
export const getAnnouncementById = cache(
  async (_id: string): Promise<AnnouncementWithDetails | null> => {
    return null;
  }
);

/** Get announcement recipients with delivery status (feature disabled) */
export const getAnnouncementRecipients = cache(
  async (_announcementId: string) => {
    return [] as Array<{
      id: string;
      channel: string;
      status: string;
      delivered_at: string | null;
      opened_at: string | null;
      clicked_at: string | null;
      failed_reason: string | null;
      member: {
        id: string;
        first_name: string;
        last_name: string;
        email?: string;
        avatar_url?: string;
      } | null;
    }>;
  }
);

/**
 * Get draft announcements for current chapter
 */
export const getDraftAnnouncements = cache(
  async (): Promise<AnnouncementListItem[]> => {
    const result = await getAnnouncements(
      undefined,
      { status: ['draft'] },
      1,
      100
    );
    return result.data;
  }
);

/**
 * Get scheduled announcements for current chapter
 */
export const getScheduledAnnouncements = cache(
  async (): Promise<AnnouncementListItem[]> => {
    const result = await getAnnouncements(
      undefined,
      { status: ['scheduled'] },
      1,
      100
    );
    return result.data;
  }
);

// ============================================================================
// TEMPLATE DATA FUNCTIONS
// ============================================================================

/**
 * Get all templates (global + chapter-specific)
 * Cache: stable data (use cache with 'hours' lifetime)
 */
export const getTemplates = cache(
  async (filters?: TemplateFilters): Promise<AnnouncementTemplate[]> => {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();

    let query = supabase
      .from('announcement_templates')
      .select(
        `
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
          full_name
        )
      )
    `
      )
      .or(`chapter_id.is.null,chapter_id.eq.${chapterId}`);

    // Apply filters
    if (filters?.type?.length) {
      query = query.in('type', filters.type);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,content_template.ilike.%${filters.search}%`
      );
    }

    query = query.order('usage_count', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return (data || []).map((template) => {
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
        created_by_name: memberData?.profiles?.full_name || undefined
      } as any;
    });
  }
);

/**
 * Get single template by ID
 */
export const getTemplateById = cache(
  async (id: string): Promise<AnnouncementTemplate | null> => {
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
  }
);

/**
 * Get templates by type
 */
export const getTemplatesByType = cache(
  async (type: string): Promise<AnnouncementTemplate[]> => {
    const templates = await getTemplates({ type: [type] as any });
    const fullTemplates = await Promise.all(
      templates.map((t) => getTemplateById(t.id))
    );
    return fullTemplates.filter(Boolean) as AnnouncementTemplate[];
  }
);

// ============================================================================
// NOTIFICATION DATA FUNCTIONS
// ============================================================================

/**
 * Get notifications for a member
 * Cache: frequently changing (use cache with 'seconds' lifetime)
 */
export const getNotifications = cache(
  async (
    memberId: string,
    filters?: NotificationFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedNotifications> => {
    const supabase = await createClient();

    let query = supabase
      .from('notifications')
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

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
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
        unread_count: 0
      };
    }

    return {
      data: (data || []) as InAppNotification[],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
      unread_count: unreadCount || 0
    };
  }
);

/**
 * Get recent notifications for dashboard
 * Cache: realtime updates for notifications
 * Note: in_app_notifications doesn't have chapter_id, so we join through members
 */
export const getRecentNotifications = cache(
  async (
    chapterId?: string,
    limit: number = 10
  ): Promise<InAppNotification[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) {
      return [];
    }

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        members!inner (chapter_id)
      `)
      .eq('members.chapter_id', cId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent notifications:', error);
      return [];
    }

    return (data || []) as InAppNotification[];
  }
);

/**
 * Get unread notification count for a member
 */
export const getUnreadNotificationsCount = cache(
  async (memberId: string): Promise<number> => {
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('read', false);

    if (error) {
      return 0;
    }

    return count || 0;
  }
);

/**
 * Get notification summary for a member
 */
export const getNotificationSummary = cache(
  async (memberId: string): Promise<NotificationSummary> => {
    const supabase = await createClient();

    // Get unread count
    const unread_count = await getUnreadNotificationsCount(memberId);

    // Get recent notifications
    const { data: recent } = await supabase
      .from('notifications')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get counts by category
    const { data: allNotifications } = await supabase
      .from('notifications')
      .select('category')
      .eq('member_id', memberId);

    const by_category: Record<string, number> = {};
    (allNotifications || []).forEach((n) => {
      by_category[n.category] = (by_category[n.category] || 0) + 1;
    });

    return {
      unread_count,
      by_category: by_category as any,
      recent: (recent || []) as InAppNotification[]
    };
  }
);

// ============================================================================
// NEWSLETTER DATA FUNCTIONS
// ============================================================================

/**
 * Get newsletters for a chapter
 */
export const getNewsletters = cache(
  async (
    chapterId?: string,
    filters?: NewsletterFilters
  ): Promise<NewsletterListItem[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    let query = supabase
      .from('newsletters')
      .select(
        `
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
          full_name
        )
      )
    `
      )
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

    query = query
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching newsletters:', error);
      return [];
    }

    return (data || []).map((newsletter) => {
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
        created_by_name: memberData?.profiles?.full_name || undefined
      };
    });
  }
);

/**
 * Get single newsletter by ID
 */
export const getNewsletterById = cache(
  async (id: string): Promise<Newsletter | null> => {
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
  }
);

/**
 * Get latest newsletter for a chapter
 */
export const getLatestNewsletter = cache(
  async (chapterId?: string): Promise<Newsletter | null> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

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
  }
);

// ============================================================================
// SEGMENT DATA FUNCTIONS
// ============================================================================

/**
 * Get all segments for a chapter
 */
export const getSegments = cache(
  async (chapterId?: string): Promise<CommunicationSegment[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

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
  }
);

/**
 * Get single segment by ID
 */
export const getSegmentById = cache(
  async (id: string): Promise<SegmentWithMembers | null> => {
    const supabase = await createClient();

    const { data: segment, error } = await supabase
      .from('communication_segments')
      .select(
        `
      *,
      members (
        profiles!inner (
          full_name
        )
      )
    `
      )
      .eq('id', id)
      .single();

    if (error || !segment) {
      return null;
    }

    const memberData = segment.members as any;

    return {
      ...segment,
      created_by_name: memberData?.profiles?.full_name || undefined
    } as SegmentWithMembers;
  }
);

/**
 * Get preview count of members matching segment filters
 * This is a simplified version that returns a count estimate
 */
export const getSegmentPreviewCount = cache(
  async (segmentId?: string, audienceFilter?: any): Promise<number> => {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();

    if (!chapterId) {
      return 0;
    }

    // Base query for members in chapter
    const query = supabase
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
  }
);

// ============================================================================
// AUTOMATION RULE DATA FUNCTIONS
// ============================================================================

/**
 * Get all automation rules for a chapter
 */
export const getAutomationRules = cache(
  async (chapterId?: string): Promise<AutomationRuleWithTemplate[]> => {
    const supabase = await createClient();
    const cId = chapterId || (await getCurrentChapterId());

    if (!cId) return [];

    const { data, error } = await supabase
      .from('communication_automation_rules')
      .select(
        `
      *,
      announcement_templates (*),
      members (
        profiles!inner (
          full_name
        )
      )
    `
      )
      .eq('chapter_id', cId)
      .order('name');

    if (error) {
      console.error('Error fetching automation rules:', error);
      return [];
    }

    return (data || []).map((rule) => {
      const memberData = rule.members as any;
      return {
        ...rule,
        template: rule.announcement_templates as any,
        created_by_name: memberData?.profiles?.full_name || undefined
      } as AutomationRuleWithTemplate;
    });
  }
);

/**
 * Get single automation rule by ID
 */
export const getAutomationRuleById = cache(
  async (id: string): Promise<AutomationRuleWithTemplate | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('communication_automation_rules')
      .select(
        `
      *,
      announcement_templates (*)
    `
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      template: data.announcement_templates as any
    } as AutomationRuleWithTemplate;
  }
);

/**
 * Get active automation rules for a chapter
 */
export const getActiveAutomationRules = cache(
  async (chapterId?: string): Promise<AutomationRuleWithTemplate[]> => {
    const rules = await getAutomationRules(chapterId);
    return rules.filter((rule) => rule.enabled);
  }
);

// ============================================================================
// ANALYTICS DATA FUNCTIONS
// ============================================================================

/**
 * Get communication analytics for a chapter (announcements feature disabled)
 * Depends on `announcements` + `announcement_recipients` tables which are not
 * present in yi_connect schema. Returns empty analytics until restored.
 */
export const getCommunicationAnalytics = cache(
  async (
    _chapterId?: string,
    _dateRange?: { start_date: string; end_date: string }
  ): Promise<CommunicationDashboardAnalytics> => {
    return {
      overview: {
        total_announcements: 0,
        total_sent: 0,
        average_engagement_rate: 0,
        average_click_through_rate: 0
      },
      by_channel: [],
      trends: [],
      top_performing: []
    };
  }
);

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
    .select(
      `
      id,
      city,
      profiles!inner (
        full_name,
        email,
        phone
      )
    `
    )
    .eq('is_active', true)
    .limit(limit);

  return (data || []).map((m) => {
    const fullName = (m.profiles as any)?.full_name || '';
    const [firstName = '', ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    return {
      id: m.id,
      first_name: firstName,
      last_name: lastName,
      email: (m.profiles as any).email,
      phone: (m.profiles as any).phone,
      city: m.city
    };
  });
}

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export // Announcements
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
 {};
