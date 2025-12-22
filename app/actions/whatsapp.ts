'use server';

/**
 * WhatsApp Server Actions for Yi Connect
 *
 * Automatically uses Railway API service in production (Vercel)
 * Falls back to local client in development.
 *
 * IMPORTANT: Local client imports are DYNAMIC to avoid loading
 * whatsapp-web.js at module load time (fails on Vercel serverless).
 */

// Format functions - SAFE: no whatsapp-web.js dependency
import {
  formatEventCreated,
  formatRsvpConfirmation,
  formatEventReminder3Days,
  formatEventReminder1Day,
  formatEventReminderToday,
  formatEventCancellation,
  formatPostEventThankYou,
  formatAnnouncement,
  type EventDetails,
  type MemberDetails
} from '@/lib/whatsapp/format-message';

// API client imports (for production) - SAFE: no whatsapp-web.js dependency
import {
  isServiceConfigured,
  connectWhatsAppAPI,
  disconnectWhatsAppAPI,
  getWhatsAppStatusAPI,
  sendMessageAPI,
  sendBulkMessagesAPI,
  sendGroupMessageAPI
} from '@/lib/whatsapp/api-client';

// Types defined locally to avoid importing from send-message.ts
// (which imports from client.ts, triggering whatsapp-web.js load)
export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkSendResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    phoneNumber: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

// Dynamic import helper for local client (only loads when needed in dev)
async function getLocalClient() {
  const {
    initializeWhatsApp,
    disconnectWhatsApp,
    getConnectionStatus,
    sendTextMessage,
    sendBulkMessages,
    sendGroupMessage
  } = await import('@/lib/whatsapp');

  return {
    initializeWhatsApp,
    disconnectWhatsApp,
    getConnectionStatus,
    sendTextMessage,
    sendBulkMessages,
    sendGroupMessage
  };
}

// ============================================================
// Helper: Determine which backend to use
// ============================================================

/**
 * Check if we're running on Vercel (serverless environment)
 * Uses multiple detection methods for reliability
 */
function isServerless(): boolean {
  // Check Vercel environment variables
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
    return true;
  }
  // Check AWS Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  // If not explicitly in development and no local client configured, assume serverless
  if (process.env.NODE_ENV === 'production' && !isServiceConfigured()) {
    return true;
  }
  return false;
}

function useApiClient(): boolean {
  return isServiceConfigured();
}

// ============================================================
// Connection Management
// ============================================================

export async function connectWhatsApp(): Promise<{
  success: boolean;
  status: string;
  qrCode?: string | null;
  error?: string;
}> {
  // Debug: Check environment state
  const debugState = {
    hasUrl: !!process.env.WHATSAPP_SERVICE_URL,
    hasKey: !!process.env.WHATSAPP_API_KEY,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    useApiClientResult: useApiClient(),
    isServerlessResult: isServerless()
  };
  console.log('[WhatsApp Connect] Debug state:', JSON.stringify(debugState));

  try {
    if (useApiClient()) {
      console.log('[WhatsApp] Using Railway API service');
      const result = await connectWhatsAppAPI();
      return result;
    } else if (isServerless()) {
      // Serverless without Railway service configured
      console.log('[WhatsApp] Serverless without service configured. Debug:', JSON.stringify(debugState));
      return {
        success: false,
        status: 'not_configured',
        error: `WhatsApp service not configured. Debug: hasUrl=${debugState.hasUrl}, hasKey=${debugState.hasKey}`
      };
    } else {
      console.log('[WhatsApp] Using local client');
      const { initializeWhatsApp } = await getLocalClient();
      const result = await initializeWhatsApp();
      return result;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, status: 'disconnected', error: errorMsg };
  }
}

export async function disconnectWhatsAppAction(): Promise<{ success: boolean }> {
  try {
    if (useApiClient()) {
      await disconnectWhatsAppAPI();
    } else if (isServerless()) {
      // Nothing to disconnect on serverless without service
      return { success: true };
    } else {
      const { disconnectWhatsApp } = await getLocalClient();
      await disconnectWhatsApp();
    }
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
  if (useApiClient()) {
    return getWhatsAppStatusAPI();
  } else if (isServerless()) {
    // Serverless without Railway service - return helpful error
    return {
      status: 'not_configured',
      qrCode: null,
      error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.',
      isReady: false
    };
  }
  const { getConnectionStatus } = await getLocalClient();
  return getConnectionStatus();
}

// ============================================================
// Message Sending
// ============================================================

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<SendMessageResult> {
  if (useApiClient()) {
    return sendMessageAPI(phoneNumber, message);
  } else if (isServerless()) {
    return { success: false, error: 'WhatsApp service not configured' };
  }
  const { sendTextMessage } = await getLocalClient();
  return sendTextMessage(phoneNumber, message);
}

export async function sendBulkWhatsAppMessages(
  recipients: Array<{ phoneNumber: string; message: string }>,
  delayMs: number = 1000
): Promise<BulkSendResult> {
  if (useApiClient()) {
    return sendBulkMessagesAPI(recipients, delayMs);
  } else if (isServerless()) {
    return { total: recipients.length, sent: 0, failed: recipients.length, results: [] };
  }
  const { sendBulkMessages } = await getLocalClient();
  return sendBulkMessages(recipients, delayMs);
}

export async function sendWhatsAppGroupMessage(
  groupId: string,
  message: string
): Promise<SendMessageResult> {
  if (useApiClient()) {
    return sendGroupMessageAPI(groupId, message);
  } else if (isServerless()) {
    return { success: false, error: 'WhatsApp service not configured' };
  }
  const { sendGroupMessage } = await getLocalClient();
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
  return sendBulkWhatsAppMessages(recipients, 1500);
}

export async function notifyRsvpConfirmation(
  member: MemberDetails,
  event: EventDetails,
  rsvpStatus: 'attending' | 'not_attending' | 'maybe'
): Promise<SendMessageResult> {
  const message = formatRsvpConfirmation(member, event, rsvpStatus);
  return sendWhatsAppMessage(member.phoneNumber, message);
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

  return sendWhatsAppMessage(memberPhone, message);
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
  return sendBulkWhatsAppMessages(recipients, 1500);
}

export async function notifyPostEventThankYou(
  event: EventDetails,
  attendees: Array<{ name: string; phone: string }>
): Promise<BulkSendResult> {
  const recipients = attendees.map(attendee => ({
    phoneNumber: attendee.phone,
    message: formatPostEventThankYou(event, attendee.name)
  }));
  return sendBulkWhatsAppMessages(recipients, 1500);
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
  return sendBulkWhatsAppMessages(recipients, 1500);
}

// ============================================================
// Test Message
// ============================================================

export async function sendTestMessage(phoneNumber: string): Promise<SendMessageResult> {
  const testMessage = `*Yi Connect Test Message*

This is a test message from Yi Connect.
If you received this, WhatsApp integration is working correctly!

_Yi Erode - Together We Can. We Will._`;

  return sendWhatsAppMessage(phoneNumber, testMessage);
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
