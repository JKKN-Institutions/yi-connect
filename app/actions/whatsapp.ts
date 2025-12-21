'use server';

/**
 * WhatsApp Server Actions for Yi Connect
 */

import {
  initializeWhatsApp,
  disconnectWhatsApp,
  getConnectionStatus,
  sendTextMessage,
  sendBulkMessages,
  sendGroupMessage,
  formatEventCreated,
  formatRsvpConfirmation,
  formatEventReminder3Days,
  formatEventReminder1Day,
  formatEventReminderToday,
  formatEventCancellation,
  formatPostEventThankYou,
  formatAnnouncement,
  type EventDetails,
  type MemberDetails,
  type SendMessageResult,
  type BulkSendResult
} from '@/lib/whatsapp';

// ============================================================
// Connection Management
// ============================================================

export async function connectWhatsApp(): Promise<{
  success: boolean;
  status: string;
  error?: string;
}> {
  try {
    const result = await initializeWhatsApp();
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, status: 'disconnected', error: errorMsg };
  }
}

export async function disconnectWhatsAppAction(): Promise<{ success: boolean }> {
  try {
    await disconnectWhatsApp();
    return { success: true };
  } catch (error) {
    console.error('[WhatsApp Action] Disconnect error:', error);
    return { success: false };
  }
}

export async function getWhatsAppStatus(): Promise<{
  status: string;
  qrCode: string | null;
  error: string | null;
  isReady: boolean;
}> {
  return getConnectionStatus();
}

// ============================================================
// Message Sending
// ============================================================

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<SendMessageResult> {
  return sendTextMessage(phoneNumber, message);
}

export async function sendBulkWhatsAppMessages(
  recipients: Array<{ phoneNumber: string; message: string }>,
  delayMs: number = 1000
): Promise<BulkSendResult> {
  return sendBulkMessages(recipients, delayMs);
}

export async function sendWhatsAppGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  return sendGroupMessage(groupId, message);
}

// ============================================================
// Event Notifications
// ============================================================

export async function notifyEventCreated(
  event: EventDetails,
  recipientPhones: string[],
  chapterName: string = 'Yi Erode'
): Promise<BulkSendResult> {
  const message = formatEventCreated(event, chapterName);
  const recipients = recipientPhones.map(phone => ({
    phoneNumber: phone,
    message
  }));
  return sendBulkMessages(recipients, 1500); // Slightly longer delay for bulk
}

export async function notifyRsvpConfirmation(
  member: MemberDetails,
  event: EventDetails,
  rsvpStatus: 'attending' | 'not_attending' | 'maybe'
): Promise<SendMessageResult> {
  const message = formatRsvpConfirmation(member, event, rsvpStatus);
  return sendTextMessage(member.phoneNumber, message);
}

export async function notifyEventReminder(
  event: EventDetails,
  memberName: string,
  memberPhone: string,
  daysUntil: 0 | 1 | 3
): Promise<SendMessageResult> {
  let message: string;

  switch (daysUntil) {
    case 0:
      message = formatEventReminderToday(event, memberName);
      break;
    case 1:
      message = formatEventReminder1Day(event, memberName);
      break;
    case 3:
      message = formatEventReminder3Days(event, memberName);
      break;
  }

  return sendTextMessage(memberPhone, message);
}

export async function notifyEventCancellation(
  event: EventDetails,
  recipientPhones: string[],
  reason?: string
): Promise<BulkSendResult> {
  const message = formatEventCancellation(event, reason);
  const recipients = recipientPhones.map(phone => ({
    phoneNumber: phone,
    message
  }));
  return sendBulkMessages(recipients, 1500);
}

export async function notifyPostEventThankYou(
  event: EventDetails,
  attendees: Array<{ name: string; phone: string }>
): Promise<BulkSendResult> {
  const recipients = attendees.map(attendee => ({
    phoneNumber: attendee.phone,
    message: formatPostEventThankYou(event, attendee.name)
  }));
  return sendBulkMessages(recipients, 1500);
}

// ============================================================
// Announcements
// ============================================================

export async function sendAnnouncement(
  title: string,
  body: string,
  recipientPhones: string[],
  chapterName: string = 'Yi Erode'
): Promise<BulkSendResult> {
  const message = formatAnnouncement(title, body, chapterName);
  const recipients = recipientPhones.map(phone => ({
    phoneNumber: phone,
    message
  }));
  return sendBulkMessages(recipients, 1500);
}

// ============================================================
// Test Message
// ============================================================

export async function sendTestMessage(phoneNumber: string): Promise<SendMessageResult> {
  const testMessage = `*Yi Connect Test Message*

This is a test message from Yi Connect.
If you received this, WhatsApp integration is working correctly!

_Yi Erode - Together We Can. We Will._`;

  return sendTextMessage(phoneNumber, testMessage);
}

// ============================================================
// CRUD Operations for WhatsApp Groups
// ============================================================

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getCurrentChapterId } from '@/lib/auth';
import {
  createWhatsAppGroupSchema,
  updateWhatsAppGroupSchema,
  createWhatsAppTemplateSchema,
  updateWhatsAppTemplateSchema,
  logMessageSchema,
  type CreateWhatsAppGroupInput,
  type UpdateWhatsAppGroupInput,
  type CreateWhatsAppTemplateInput,
  type UpdateWhatsAppTemplateInput,
  type LogMessageInput,
} from '@/lib/validations/whatsapp';

export type WhatsAppActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

/**
 * Create a new WhatsApp group
 */
export async function createWhatsAppGroup(
  prevState: WhatsAppActionState,
  formData: FormData
): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();
  const chapterId = await getCurrentChapterId();

  if (!chapterId) {
    return { success: false, message: 'No chapter context found' };
  }

  // Parse and validate form data
  const rawData: CreateWhatsAppGroupInput = {
    chapter_id: chapterId,
    jid: formData.get('jid') as string,
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || undefined,
    group_type: (formData.get('group_type') as CreateWhatsAppGroupInput['group_type']) || undefined,
    is_default: formData.get('is_default') === 'true',
    member_count: formData.get('member_count') ? parseInt(formData.get('member_count') as string) : undefined,
  };

  const validated = createWhatsAppGroupSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // Insert the group
  const { error } = await supabase.from('whatsapp_groups').insert(validated.data);

  if (error) {
    console.error('Error creating WhatsApp group:', error);
    if (error.code === '23505') {
      return { success: false, message: 'A group with this JID already exists' };
    }
    return { success: false, message: 'Failed to create group' };
  }

  revalidatePath('/whatsapp/groups');
  return { success: true, message: 'Group created successfully' };
}

/**
 * Update an existing WhatsApp group
 */
export async function updateWhatsAppGroup(
  id: string,
  prevState: WhatsAppActionState,
  formData: FormData
): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();

  // Parse and validate form data
  const rawData: UpdateWhatsAppGroupInput = {
    id,
    name: (formData.get('name') as string) || undefined,
    description: (formData.get('description') as string) || undefined,
    group_type: (formData.get('group_type') as UpdateWhatsAppGroupInput['group_type']) || undefined,
    is_default: formData.has('is_default') ? formData.get('is_default') === 'true' : undefined,
    member_count: formData.get('member_count') ? parseInt(formData.get('member_count') as string) : undefined,
    is_active: formData.has('is_active') ? formData.get('is_active') === 'true' : undefined,
  };

  const validated = updateWhatsAppGroupSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // Remove id from update data
  const { id: _, ...updateData } = validated.data;

  const { error } = await supabase
    .from('whatsapp_groups')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating WhatsApp group:', error);
    return { success: false, message: 'Failed to update group' };
  }

  revalidatePath('/whatsapp/groups');
  revalidatePath(`/whatsapp/groups/${id}`);
  return { success: true, message: 'Group updated successfully' };
}

/**
 * Delete a WhatsApp group
 */
export async function deleteWhatsAppGroup(id: string): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('whatsapp_groups')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting WhatsApp group:', error);
    return { success: false, message: 'Failed to delete group' };
  }

  revalidatePath('/whatsapp/groups');
  return { success: true, message: 'Group deleted successfully' };
}

// ============================================================
// CRUD Operations for WhatsApp Templates
// ============================================================

/**
 * Create a new WhatsApp template
 */
export async function createWhatsAppTemplate(
  prevState: WhatsAppActionState,
  formData: FormData
): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();
  const chapterId = await getCurrentChapterId();

  // Parse variables from form (comma-separated or JSON)
  let variables: string[] = [];
  const variablesRaw = formData.get('variables') as string;
  if (variablesRaw) {
    try {
      variables = JSON.parse(variablesRaw);
    } catch {
      variables = variablesRaw.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }

  // Determine if this is a national template
  const isNational = formData.get('is_national') === 'true';

  const rawData: CreateWhatsAppTemplateInput = {
    chapter_id: isNational ? null : chapterId,
    name: formData.get('name') as string,
    category: formData.get('category') as CreateWhatsAppTemplateInput['category'],
    content: formData.get('content') as string,
    variables,
  };

  const validated = createWhatsAppTemplateSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // Get current user for created_by
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('whatsapp_templates').insert({
    ...validated.data,
    created_by: user?.id,
  });

  if (error) {
    console.error('Error creating WhatsApp template:', error);
    return { success: false, message: 'Failed to create template' };
  }

  revalidatePath('/whatsapp/templates');
  return { success: true, message: 'Template created successfully' };
}

/**
 * Update an existing WhatsApp template
 */
export async function updateWhatsAppTemplate(
  id: string,
  prevState: WhatsAppActionState,
  formData: FormData
): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();

  // Parse variables
  let variables: string[] | undefined;
  const variablesRaw = formData.get('variables') as string | null;
  if (variablesRaw) {
    try {
      variables = JSON.parse(variablesRaw);
    } catch {
      variables = variablesRaw.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }

  const rawData: UpdateWhatsAppTemplateInput = {
    id,
    name: (formData.get('name') as string) || undefined,
    category: (formData.get('category') as UpdateWhatsAppTemplateInput['category']) || undefined,
    content: (formData.get('content') as string) || undefined,
    variables,
    is_active: formData.has('is_active') ? formData.get('is_active') === 'true' : undefined,
  };

  const validated = updateWhatsAppTemplateSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // Remove id from update data
  const { id: _, ...updateData } = validated.data;

  const { error } = await supabase
    .from('whatsapp_templates')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating WhatsApp template:', error);
    return { success: false, message: 'Failed to update template' };
  }

  revalidatePath('/whatsapp/templates');
  revalidatePath(`/whatsapp/templates/${id}`);
  return { success: true, message: 'Template updated successfully' };
}

/**
 * Delete a WhatsApp template
 */
export async function deleteWhatsAppTemplate(id: string): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('whatsapp_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting WhatsApp template:', error);
    return { success: false, message: 'Failed to delete template' };
  }

  revalidatePath('/whatsapp/templates');
  return { success: true, message: 'Template deleted successfully' };
}

// ============================================================
// Message Logging
// ============================================================

/**
 * Log a sent message for tracking
 */
export async function logWhatsAppMessage(
  data: LogMessageInput
): Promise<WhatsAppActionState> {
  const supabase = await createServerSupabaseClient();

  const validated = logMessageSchema.safeParse(data);
  if (!validated.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('whatsapp_message_logs').insert({
    ...validated.data,
    sent_by: user?.id,
  });

  if (error) {
    console.error('Error logging WhatsApp message:', error);
    return { success: false, message: 'Failed to log message' };
  }

  return { success: true, message: 'Message logged successfully' };
}

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('whatsapp_templates')
    .update({ usage_count: supabase.rpc('increment', { row_id: templateId }) as unknown as number })
    .eq('id', templateId);

  // Alternative: Use raw SQL increment
  if (error) {
    // Fallback: fetch current count and increment
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('usage_count')
      .eq('id', templateId)
      .single();

    if (template) {
      await supabase
        .from('whatsapp_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', templateId);
    }
  }
}
