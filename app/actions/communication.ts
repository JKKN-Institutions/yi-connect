// ============================================================================
// Module 7: Communication Hub - Server Actions
// ============================================================================
// Description: Server Actions for all Communication Hub CRUD operations
//              using Next.js 16 Server Actions with Zod validation
// Version: 1.0
// Created: 2025-11-17
// ============================================================================

'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, getCurrentChapterId } from '@/lib/auth';
import { sendAnnouncementPush } from '@/lib/push-notification';
import { sendEmail, sendBatchEmails } from '@/lib/email';
import { announcementEmail } from '@/lib/email/templates';
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  sendAnnouncementSchema,
  scheduleAnnouncementSchema,
  cancelAnnouncementSchema,
  deleteAnnouncementSchema,
  duplicateAnnouncementSchema,
  createTemplateSchema,
  updateTemplateSchema,
  deleteTemplateSchema,
  duplicateTemplateSchema,
  createNotificationSchema,
  markNotificationReadSchema,
  markAllNotificationsReadSchema,
  deleteNotificationSchema,
  createNewsletterSchema,
  updateNewsletterSchema,
  publishNewsletterSchema,
  deleteNewsletterSchema,
  createSegmentSchema,
  updateSegmentSchema,
  deleteSegmentSchema,
  calculateSegmentSizeSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  toggleAutomationRuleSchema,
  deleteAutomationRuleSchema,
  runAutomationRuleSchema,
} from '@/lib/validations/communication';
import { getSegmentPreviewCount as getSegmentPreviewCountData } from '@/lib/data/communication';
import type { AudienceFilter } from '@/types/communication';

// ============================================================================
// TYPES FOR SERVER ACTION RESPONSES
// ============================================================================

type ActionResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
};

// ============================================================================
// AUDIENCE FILTERING HELPER
// ============================================================================

/**
 * Get member IDs that match the given audience filter
 */
async function getFilteredMemberIds(
  supabase: SupabaseClient,
  chapterId: string,
  audienceFilter?: AudienceFilter | null,
  segmentId?: string | null
): Promise<string[]> {
  // If segment is provided, fetch its filter rules
  let filter = audienceFilter;
  if (segmentId && !filter) {
    const { data: segment } = await supabase
      .from('communication_segments')
      .select('filter_rules')
      .eq('id', segmentId)
      .single();
    filter = segment?.filter_rules as AudienceFilter | undefined;
  }

  // Start with base query for active members in chapter
  let query = supabase
    .from('members')
    .select(`
      id,
      is_active,
      membership_type,
      city,
      state,
      joined_at,
      engagement_score,
      leadership_readiness_score,
      profile:profiles!members_id_fkey(email),
      roles:user_roles(role:roles(name)),
      skills:member_skills(skill_id),
      verticals:vertical_members(vertical_id)
    `)
    .eq('chapter_id', chapterId);

  // If no filter, return all active members
  if (!filter) {
    query = query.eq('is_active', true);
    const { data: members } = await query;
    return members?.map((m: { id: string }) => m.id) || [];
  }

  // Apply member status filter
  if (filter.member_status && filter.member_status.length > 0) {
    const isActiveStatuses = filter.member_status.map(s => s === 'active');
    if (isActiveStatuses.includes(true) && !isActiveStatuses.includes(false)) {
      query = query.eq('is_active', true);
    } else if (!isActiveStatuses.includes(true) && isActiveStatuses.includes(false)) {
      query = query.eq('is_active', false);
    }
    // If both active and inactive, no filter needed
  } else {
    // Default to active members only
    query = query.eq('is_active', true);
  }

  // Apply membership type filter
  if (filter.membership_type && filter.membership_type.length > 0) {
    query = query.in('membership_type', filter.membership_type);
  }

  // Apply engagement score filter
  if (filter.engagement) {
    if (filter.engagement.min !== undefined) {
      query = query.gte('engagement_score', filter.engagement.min);
    }
    if (filter.engagement.max !== undefined) {
      query = query.lte('engagement_score', filter.engagement.max);
    }
  }

  // Apply leadership readiness filter
  if (filter.leadership_readiness) {
    if (filter.leadership_readiness.min !== undefined) {
      query = query.gte('leadership_readiness_score', filter.leadership_readiness.min);
    }
    if (filter.leadership_readiness.max !== undefined) {
      query = query.lte('leadership_readiness_score', filter.leadership_readiness.max);
    }
  }

  // Apply location filters
  if (filter.cities && filter.cities.length > 0) {
    query = query.in('city', filter.cities);
  }
  if (filter.states && filter.states.length > 0) {
    query = query.in('state', filter.states);
  }

  // Apply join date filters
  if (filter.joined_after) {
    query = query.gte('joined_at', filter.joined_after);
  }
  if (filter.joined_before) {
    query = query.lte('joined_at', filter.joined_before);
  }

  // Fetch all matching members
  const { data: members, error } = await query;

  if (error || !members) {
    return [];
  }

  // Apply client-side filters for complex conditions
  let filteredMembers = members;

  // Filter by roles
  if (filter.roles && filter.roles.length > 0) {
    filteredMembers = filteredMembers.filter((m) => {
      const roles = m.roles as { role: { name: string }[] }[] | undefined;
      const memberRoles = roles?.flatMap((r) => r.role?.map((role) => role.name) || []) || [];
      return filter.roles!.some(role => memberRoles.includes(role));
    });
  }

  // Filter by skills
  if (filter.has_skills && filter.has_skills.length > 0) {
    filteredMembers = filteredMembers.filter((m) => {
      const skills = m.skills as { skill_id?: string }[] | undefined;
      const memberSkills = skills?.map((s) => s.skill_id) || [];
      return filter.has_skills!.some(skillId => memberSkills.includes(skillId));
    });
  }

  // Filter by vertical interests
  if (filter.vertical_interests && filter.vertical_interests.length > 0) {
    filteredMembers = filteredMembers.filter((m) => {
      const verticals = m.verticals as { vertical_id?: string }[] | undefined;
      const memberVerticals = verticals?.map((v) => v.vertical_id) || [];
      return filter.vertical_interests!.some(vid => memberVerticals.includes(vid));
    });
  }

  // Apply explicit includes/excludes
  let memberIds = filteredMembers.map((m) => m.id);

  if (filter.include_members && filter.include_members.length > 0) {
    // Add included members that aren't already in the list
    const additionalIds = filter.include_members.filter((id: string) => !memberIds.includes(id));
    memberIds = [...memberIds, ...additionalIds];
  }

  if (filter.exclude_members && filter.exclude_members.length > 0) {
    memberIds = memberIds.filter((id: string) => !filter.exclude_members!.includes(id));
  }

  return memberIds;
}

// ============================================================================
// ANNOUNCEMENT ACTIONS
// ============================================================================

/**
 * Create a new announcement
 */
export async function createAnnouncement(
  formData: unknown
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const chapterId = await getCurrentChapterId();
    if (!chapterId) {
      return { success: false, message: 'Chapter not found', error: 'No chapter associated with user' };
    }

    // Validate input
    const validation = createAnnouncementSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    // Create announcement
    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        chapter_id: chapterId,
        title: data.title,
        content: data.content,
        channels: data.channels,
        priority: data.priority || 'normal',
        audience_filter: data.audience_filter || null,
        segment_id: data.segment_id || null,
        template_id: data.template_id || null,
        scheduled_at: data.scheduled_at || null,
        status: data.scheduled_at ? 'scheduled' : 'draft',
        created_by: user.id,
        metadata: data.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: 'Failed to create announcement', error: error.message };
    }

    // Invalidate cache
    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');

    return {
      success: true,
      message: 'Announcement created successfully',
      data: { id: announcement.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Update an existing announcement
 */
export async function updateAnnouncement(
  id: string,
  formData: unknown
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    // Validate input
    const validation = updateAnnouncementSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    // Update announcement
    const { error } = await supabase
      .from('announcements')
      .update({
        title: data.title,
        content: data.content,
        channels: data.channels,
        priority: data.priority,
        audience_filter: data.audience_filter,
        segment_id: data.segment_id,
        scheduled_at: data.scheduled_at,
        metadata: data.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating announcement:', error);
      return { success: false, message: 'Failed to update announcement', error: error.message };
    }

    // Invalidate cache
    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');
    revalidateTag(`announcement-${id}`, 'default');

    return { success: true, message: 'Announcement updated successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Send announcement immediately
 */
export async function sendAnnouncement(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    // Get announcement details
    const { data: announcement, error: fetchError } = await supabase
      .from('announcements')
      .select('*, communication_segments(*)')
      .eq('id', id)
      .single();

    if (fetchError || !announcement) {
      return { success: false, message: 'Announcement not found', error: fetchError?.message };
    }

    // Check if announcement can be sent
    if (announcement.status === 'sent') {
      return { success: false, message: 'Announcement already sent', error: 'Cannot resend' };
    }

    // Update status to sending
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        status: 'sending',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return { success: false, message: 'Failed to send announcement', error: updateError.message };
    }

    // Get filtered member IDs based on audience_filter or segment
    const memberIds = await getFilteredMemberIds(
      supabase,
      announcement.chapter_id,
      announcement.audience_filter,
      announcement.segment_id
    );

    // Create announcement_recipients records
    if (memberIds.length > 0) {
      const recipients = memberIds.flatMap(memberId =>
        announcement.channels.map((channel: string) => ({
          announcement_id: id,
          member_id: memberId,
          channel,
          status: 'queued',
        }))
      );

      await supabase.from('announcement_recipients').insert(recipients);

      // If in_app channel is included, create notifications
      if (announcement.channels.includes('in_app')) {
        const notifications = memberIds.map(memberId => ({
          member_id: memberId,
          title: announcement.title,
          message: announcement.content.substring(0, 200),
          category: 'announcements',
          announcement_id: id,
        }));

        await supabase.from('in_app_notifications').insert(notifications);
      }

      // Send email notifications
      if (announcement.channels.includes('email')) {
        try {
          // Fetch member emails
          const { data: members } = await supabase
            .from('members')
            .select('id, profile:profiles!members_id_fkey(full_name, email)')
            .in('id', memberIds);

          // Get chapter name
          const { data: chapter } = await supabase
            .from('chapters')
            .select('name')
            .eq('id', announcement.chapter_id)
            .single();

          const chapterName = chapter?.name || 'Yi Chapter';
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app';

          if (members && members.length > 0) {
            const emailMessages = members
              .filter((m) => {
                const profile = m.profile as { email?: string }[] | undefined;
                return profile?.[0]?.email;
              })
              .map((member) => {
                const profile = member.profile as { email: string; full_name?: string }[];
                const template = announcementEmail({
                  memberName: profile[0]?.full_name || 'Member',
                  title: announcement.title,
                  content: announcement.content,
                  priority: announcement.priority || 'normal',
                  chapterName,
                  viewLink: `${APP_URL}/communications/announcements/${announcement.id}`,
                });
                return {
                  to: profile[0].email,
                  subject: template.subject,
                  html: template.html,
                };
              });

            const emailResult = await sendBatchEmails(emailMessages);

            // Update recipient statuses for email channel
            await supabase
              .from('announcement_recipients')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('announcement_id', id)
              .eq('channel', 'email');
          }
        } catch (emailError) {
          // Don't fail the entire operation if email fails
        }
      }

      // Send push notifications (if configured)
      if (announcement.channels.includes('push') || announcement.channels.includes('in_app')) {
        try {
          await sendAnnouncementPush(
            announcement.chapter_id,
            {
              id: announcement.id,
              title: announcement.title,
              content: announcement.content
            }
          );
        } catch (pushError) {
          // Don't fail the entire operation if push fails
        }
      }
    }

    // Update status to sent
    await supabase
      .from('announcements')
      .update({ status: 'sent' })
      .eq('id', id);

    // Invalidate cache
    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');
    revalidateTag(`announcement-${id}`, 'default');

    return {
      success: true,
      message: `Announcement sent successfully to ${memberIds.length} members`,
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Schedule announcement for later
 */
export async function scheduleAnnouncement(
  id: string,
  scheduledAt: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    // Validate scheduled time is in future
    if (new Date(scheduledAt) <= new Date()) {
      return { success: false, message: 'Invalid schedule time', error: 'Must be in the future' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('announcements')
      .update({
        scheduled_at: scheduledAt,
        status: 'scheduled',
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to schedule announcement', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');
    revalidateTag(`announcement-${id}`, 'default');

    return { success: true, message: 'Announcement scheduled successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Cancel scheduled announcement
 */
export async function cancelAnnouncement(id: string, reason?: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('announcements')
      .update({
        status: 'cancelled',
        metadata: { cancelled_reason: reason, cancelled_at: new Date().toISOString() },
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to cancel announcement', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');
    revalidateTag(`announcement-${id}`, 'default');

    return { success: true, message: 'Announcement cancelled successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Delete announcement (only drafts)
 */
export async function deleteAnnouncement(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    // Check if announcement is draft
    const { data: announcement } = await supabase
      .from('announcements')
      .select('status')
      .eq('id', id)
      .single();

    if (announcement?.status !== 'draft') {
      return {
        success: false,
        message: 'Cannot delete',
        error: 'Only draft announcements can be deleted',
      };
    }

    const { error } = await supabase.from('announcements').delete().eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to delete announcement', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');

    return { success: true, message: 'Announcement deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Duplicate announcement
 */
export async function duplicateAnnouncement(
  id: string,
  newTitle?: string
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    // Get original announcement
    const { data: original, error: fetchError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return { success: false, message: 'Announcement not found', error: fetchError?.message };
    }

    // Create duplicate
    const { data: duplicate, error: createError } = await supabase
      .from('announcements')
      .insert({
        chapter_id: original.chapter_id,
        title: newTitle || `${original.title} (Copy)`,
        content: original.content,
        channels: original.channels,
        audience_filter: original.audience_filter,
        segment_id: original.segment_id,
        template_id: original.template_id,
        status: 'draft',
        created_by: user.id,
        metadata: original.metadata,
      })
      .select('id')
      .single();

    if (createError) {
      return { success: false, message: 'Failed to duplicate announcement', error: createError.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('announcements', 'default');

    return {
      success: true,
      message: 'Announcement duplicated successfully',
      data: { id: duplicate.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// TEMPLATE ACTIONS
// ============================================================================

/**
 * Create announcement template
 */
export async function createTemplate(formData: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const chapterId = await getCurrentChapterId();

    const validation = createTemplateSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { data: template, error } = await supabase
      .from('announcement_templates')
      .insert({
        chapter_id: chapterId,
        name: data.name,
        type: data.type,
        content_template: data.content_template,
        default_channels: data.default_channels,
        category: data.category,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: 'Failed to create template', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('templates', 'default');

    return {
      success: true,
      message: 'Template created successfully',
      data: { id: template.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Update template
 */
export async function updateTemplate(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const validation = updateTemplateSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { error } = await supabase
      .from('announcement_templates')
      .update({
        name: data.name,
        type: data.type,
        content_template: data.content_template,
        default_channels: data.default_channels,
        category: data.category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to update template', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('templates', 'default');
    revalidateTag(`template-${id}`, 'default');

    return { success: true, message: 'Template updated successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Delete template
 */
export async function deleteTemplate(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase.from('announcement_templates').delete().eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to delete template', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('templates', 'default');

    return { success: true, message: 'Template deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Duplicate template
 */
export async function duplicateTemplate(
  id: string,
  newName: string
): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { data: original, error: fetchError } = await supabase
      .from('announcement_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return { success: false, message: 'Template not found', error: fetchError?.message };
    }

    const { data: duplicate, error: createError } = await supabase
      .from('announcement_templates')
      .insert({
        chapter_id: original.chapter_id,
        name: newName,
        type: original.type,
        content_template: original.content_template,
        default_channels: original.default_channels,
        category: original.category,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (createError) {
      return { success: false, message: 'Failed to duplicate template', error: createError.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('templates', 'default');

    return {
      success: true,
      message: 'Template duplicated successfully',
      data: { id: duplicate.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// NOTIFICATION ACTIONS
// ============================================================================

/**
 * Create manual notification
 */
export async function createNotification(formData: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const validation = createNotificationSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { data: notification, error } = await supabase
      .from('in_app_notifications')
      .insert({
        member_id: data.member_id,
        title: data.title,
        message: data.message,
        category: data.category,
        action_url: data.action_url || null,
        metadata: data.metadata || {},
        expires_at: data.expires_at || null,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: 'Failed to create notification', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag(`notifications-${data.member_id}`, 'default');

    return {
      success: true,
      message: 'Notification created successfully',
      data: { id: notification.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('member_id', user.id); // Ensure user can only mark their own notifications

    if (error) {
      return { success: false, message: 'Failed to mark notification as read', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag(`notifications-${user.id}`, 'default');

    return { success: true, message: 'Notification marked as read' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(
  memberId?: string,
  category?: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const targetMemberId = memberId || user.id;
    const supabase = await createClient();

    let query = supabase
      .from('in_app_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('member_id', targetMemberId)
      .eq('read', false);

    if (category) {
      query = query.eq('category', category);
    }

    const { error } = await query;

    if (error) {
      return { success: false, message: 'Failed to mark all notifications as read', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag(`notifications-${targetMemberId}`, 'default');

    return { success: true, message: 'All notifications marked as read' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('in_app_notifications')
      .delete()
      .eq('id', id)
      .eq('member_id', user.id); // Ensure user can only delete their own notifications

    if (error) {
      return { success: false, message: 'Failed to delete notification', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag(`notifications-${user.id}`, 'default');

    return { success: true, message: 'Notification deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// NEWSLETTER ACTIONS
// ============================================================================

/**
 * Create newsletter
 */
export async function createNewsletter(formData: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const chapterId = await getCurrentChapterId();
    if (!chapterId) {
      return { success: false, message: 'Chapter not found', error: 'No chapter associated with user' };
    }

    const validation = createNewsletterSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { data: newsletter, error } = await supabase
      .from('newsletters')
      .insert({
        chapter_id: chapterId,
        title: data.title,
        edition_number: data.edition_number,
        month: data.month,
        year: data.year,
        content: data.content,
        chair_message: data.chair_message,
        chair_image_url: data.chair_image_url,
        status: 'draft',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: 'Failed to create newsletter', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('newsletters', 'default');

    return {
      success: true,
      message: 'Newsletter created successfully',
      data: { id: newsletter.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Update newsletter
 */
export async function updateNewsletter(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const validation = updateNewsletterSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { error } = await supabase
      .from('newsletters')
      .update({
        title: data.title,
        content: data.content,
        chair_message: data.chair_message,
        chair_image_url: data.chair_image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to update newsletter', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('newsletters', 'default');
    revalidateTag(`newsletter-${id}`, 'default');

    return { success: true, message: 'Newsletter updated successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Publish newsletter
 */
export async function publishNewsletter(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('newsletters')
      .update({
        status: 'published',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to publish newsletter', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('newsletters', 'default');
    revalidateTag(`newsletter-${id}`, 'default');

    return { success: true, message: 'Newsletter published successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Delete newsletter
 */
export async function deleteNewsletter(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    // Only allow deleting drafts
    const { data: newsletter } = await supabase
      .from('newsletters')
      .select('status')
      .eq('id', id)
      .single();

    if (newsletter?.status !== 'draft') {
      return {
        success: false,
        message: 'Cannot delete',
        error: 'Only draft newsletters can be deleted',
      };
    }

    const { error } = await supabase.from('newsletters').delete().eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to delete newsletter', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('newsletters', 'default');

    return { success: true, message: 'Newsletter deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// SEGMENT ACTIONS
// ============================================================================

/**
 * Create audience segment
 */
export async function createSegment(formData: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const chapterId = await getCurrentChapterId();
    if (!chapterId) {
      return { success: false, message: 'Chapter not found', error: 'No chapter associated with user' };
    }

    const validation = createSegmentSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { data: segment, error } = await supabase
      .from('communication_segments')
      .insert({
        chapter_id: chapterId,
        name: data.name,
        description: data.description,
        filter_rules: data.filter_rules,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: 'Failed to create segment', error: error.message };
    }

    // Calculate initial member count
    await supabase.rpc('calculate_segment_size', { p_segment_id: segment.id });

    revalidateTag('communications', 'default');
    revalidateTag('segments', 'default');

    return {
      success: true,
      message: 'Segment created successfully',
      data: { id: segment.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Update segment
 */
export async function updateSegment(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const validation = updateSegmentSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { error } = await supabase
      .from('communication_segments')
      .update({
        name: data.name,
        description: data.description,
        filter_rules: data.filter_rules,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to update segment', error: error.message };
    }

    // Recalculate member count
    if (data.filter_rules) {
      await supabase.rpc('calculate_segment_size', { p_segment_id: id });
    }

    revalidateTag('communications', 'default');
    revalidateTag('segments', 'default');
    revalidateTag(`segment-${id}`, 'default');

    return { success: true, message: 'Segment updated successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Delete segment
 */
export async function deleteSegment(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase.from('communication_segments').delete().eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to delete segment', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('segments', 'default');

    return { success: true, message: 'Segment deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// AUTOMATION RULE ACTIONS
// ============================================================================

/**
 * Create automation rule
 */
export async function createAutomationRule(formData: unknown): Promise<ActionResponse<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const chapterId = await getCurrentChapterId();
    if (!chapterId) {
      return { success: false, message: 'Chapter not found', error: 'No chapter associated with user' };
    }

    const validation = createAutomationRuleSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { data: rule, error } = await supabase
      .from('communication_automation_rules')
      .insert({
        chapter_id: chapterId,
        name: data.name,
        trigger_type: data.trigger_type,
        conditions: data.conditions,
        template_id: data.template_id,
        channels: data.channels,
        enabled: data.enabled ?? true,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: 'Failed to create automation rule', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('automation-rules', 'default');

    return {
      success: true,
      message: 'Automation rule created successfully',
      data: { id: rule.id },
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Update automation rule
 */
export async function updateAutomationRule(id: string, formData: unknown): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const validation = updateAutomationRuleSchema.safeParse(formData);
    if (!validation.success) {
      return {
        success: false,
        message: 'Validation failed',
        error: validation.error.issues[0].message,
      };
    }

    const data = validation.data;
    const supabase = await createClient();

    const { error } = await supabase
      .from('communication_automation_rules')
      .update({
        name: data.name,
        conditions: data.conditions,
        template_id: data.template_id,
        channels: data.channels,
        enabled: data.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to update automation rule', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('automation-rules', 'default');
    revalidateTag(`automation-rule-${id}`, 'default');

    return { success: true, message: 'Automation rule updated successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Toggle automation rule
 */
export async function toggleAutomationRule(id: string, enabled: boolean): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('communication_automation_rules')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to toggle automation rule', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('automation-rules', 'default');
    revalidateTag(`automation-rule-${id}`, 'default');

    return {
      success: true,
      message: `Automation rule ${enabled ? 'enabled' : 'disabled'} successfully`,
    };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

/**
 * Delete automation rule
 */
export async function deleteAutomationRule(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, message: 'Unauthorized', error: 'Please log in' };
    }

    const supabase = await createClient();

    const { error } = await supabase.from('communication_automation_rules').delete().eq('id', id);

    if (error) {
      return { success: false, message: 'Failed to delete automation rule', error: error.message };
    }

    revalidateTag('communications', 'default');
    revalidateTag('automation-rules', 'default');

    return { success: true, message: 'Automation rule deleted successfully' };
  } catch (error) {
    return { success: false, message: 'An unexpected error occurred', error: String(error) };
  }
}

// ============================================================================
// UTILITY ACTIONS
// ============================================================================

/**
 * Get preview count for a segment or audience filter
 * Used by client components to show audience size estimates
 */
export async function getAudiencePreviewCount(
  segmentId?: string,
  audienceFilter?: AudienceFilter
): Promise<{ success: boolean; count?: number; message?: string }> {
  'use server';

  try {
    const count = await getSegmentPreviewCountData(segmentId, audienceFilter);
    return { success: true, count };
  } catch (error) {
    return { success: false, message: 'Failed to get audience preview count' };
  }
}

// ============================================================================
// EXPORT ALL ACTIONS
// ============================================================================

export type { ActionResponse };
