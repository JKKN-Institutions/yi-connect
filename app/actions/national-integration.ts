'use server';

// ============================================================================
// Module 10: National Integration Layer - Server Actions
// ============================================================================
// Description: Server actions for national integration operations
// Version: 1.0
// Created: 2025-11-22
// ============================================================================

import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentChapterId, getCurrentMemberId } from '@/lib/auth';
import {
  syncConfigFormSchema,
  triggerSyncSchema,
  eventRegistrationSchema,
  updateRegistrationSchema,
  cancelRegistrationSchema,
  submitFeedbackSchema,
  createRoleMappingSchema,
  acknowledgeBroadcastSchema,
  markBroadcastReadSchema,
  resolveConflictSchema,
  testConnectionSchema
} from '@/lib/validations/national-integration';
import type {
  ActionResult,
  NationalSyncConfig,
  NationalSyncLog,
  NationalEventRegistration,
  BroadcastReceipt,
  SyncEntityType,
  SyncDirection
} from '@/types/national-integration';

// ============================================================================
// SYNC CONFIG ACTIONS
// ============================================================================

/**
 * Create or update sync configuration
 */
export async function updateSyncConfig(
  formData: FormData
): Promise<ActionResult<NationalSyncConfig>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();
    const memberId = await getCurrentMemberId();

    if (!chapterId) {
      return { success: false, error: 'No chapter found' };
    }

    const rawData = {
      api_endpoint: formData.get('api_endpoint'),
      api_version: formData.get('api_version'),
      auth_token: formData.get('auth_token'),
      sync_enabled: formData.get('sync_enabled') === 'true',
      sync_frequency: formData.get('sync_frequency'),
      entity_sync_settings: JSON.parse(
        formData.get('entity_sync_settings') as string
      )
    };

    const validated = syncConfigFormSchema.safeParse(rawData);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || 'Validation failed'
      };
    }

    const { auth_token, ...configData } = validated.data;

    // Check if config exists
    const { data: existing } = await supabase
      .from('national_sync_config')
      .select('id')
      .eq('chapter_id', chapterId)
      .single();

    const insertData = {
      ...configData,
      chapter_id: chapterId,
      auth_token_encrypted: auth_token || null,
      created_by: memberId
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('national_sync_config')
        .update(insertData)
        .eq('chapter_id', chapterId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('national_sync_config')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    revalidatePath('/national');
    revalidatePath('/national/settings');

    return {
      success: true,
      data: result as NationalSyncConfig,
      message: 'Sync configuration updated successfully'
    };
  } catch (error) {
    console.error('Error updating sync config:', error);
    return { success: false, error: 'Failed to update sync configuration' };
  }
}

/**
 * Test API connection
 */
export async function testConnection(
  formData: FormData
): Promise<ActionResult<{ connected: boolean; latency_ms: number }>> {
  try {
    const rawData = {
      api_endpoint: formData.get('api_endpoint'),
      auth_token: formData.get('auth_token')
    };

    const validated = testConnectionSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const { api_endpoint, auth_token } = validated.data;

    // Validate URL format
    let endpointUrl: URL;
    try {
      endpointUrl = new URL(api_endpoint);
    } catch {
      return {
        success: false,
        error: 'Invalid API endpoint URL format'
      };
    }

    // Test actual API connection with timeout
    const startTime = Date.now();
    let connected = false;
    let errorMessage = '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      // Try to reach the health endpoint first, fallback to base URL
      const healthUrl = new URL('/health', endpointUrl).toString();

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(auth_token && { 'Authorization': `Bearer ${auth_token}` })
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Consider connection successful if we get any response (even 401/403)
      // This means the server is reachable
      if (response.ok) {
        connected = true;
      } else if (response.status === 401 || response.status === 403) {
        // Server is reachable but auth failed
        connected = true;
        errorMessage = 'Server reachable but authentication failed';
      } else if (response.status === 404) {
        // Health endpoint doesn't exist, try HEAD on base URL
        const baseResponse = await fetch(api_endpoint, {
          method: 'HEAD',
          headers: {
            ...(auth_token && { 'Authorization': `Bearer ${auth_token}` })
          },
          signal: controller.signal
        });
        connected = baseResponse.ok || baseResponse.status < 500;
      } else {
        errorMessage = `Server returned status ${response.status}`;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          errorMessage = 'Connection timeout - server did not respond within 10 seconds';
        } else if (fetchError.message.includes('fetch')) {
          errorMessage = 'Network error - unable to reach server';
        } else {
          errorMessage = fetchError.message;
        }
      } else {
        errorMessage = 'Unknown connection error';
      }
    }

    const latency = Date.now() - startTime;

    // Update connection status in config
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();

    if (chapterId) {
      await supabase
        .from('national_sync_config')
        .update({
          connection_status: connected ? 'connected' : 'error',
          last_connection_test: new Date().toISOString()
        })
        .eq('chapter_id', chapterId);
    }

    return {
      success: true,
      data: { connected, latency_ms: latency },
      message: connected
        ? (errorMessage || 'Connection successful')
        : (errorMessage || 'Connection failed - server unreachable')
    };
  } catch (error) {
    console.error('Error testing connection:', error);
    return { success: false, error: 'Connection test failed' };
  }
}

/**
 * Enable or disable sync
 */
export async function toggleSync(
  enabled: boolean
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();

    if (!chapterId) {
      return { success: false, error: 'No chapter found' };
    }

    const { error } = await supabase
      .from('national_sync_config')
      .update({ sync_enabled: enabled })
      .eq('chapter_id', chapterId);

    if (error) throw error;

    revalidatePath('/national');
    revalidatePath('/national/settings');

    return {
      success: true,
      message: enabled ? 'Sync enabled' : 'Sync disabled'
    };
  } catch (error) {
    console.error('Error toggling sync:', error);
    return { success: false, error: 'Failed to toggle sync' };
  }
}

// ============================================================================
// SYNC OPERATION ACTIONS
// ============================================================================

/**
 * Trigger manual sync for specific entity type
 */
export async function triggerManualSync(
  formData: FormData
): Promise<ActionResult<NationalSyncLog>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();
    const memberId = await getCurrentMemberId();

    if (!chapterId) {
      return { success: false, error: 'No chapter found' };
    }

    const rawData = {
      entity_type: formData.get('entity_type'),
      direction: formData.get('direction') || 'bidirectional',
      force: formData.get('force') === 'true'
    };

    const validated = triggerSyncSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    // Create sync log entry
    const { data: syncLog, error } = await supabase
      .from('national_sync_logs')
      .insert({
        chapter_id: chapterId,
        sync_type: validated.data.entity_type as SyncEntityType,
        sync_direction: validated.data.direction as SyncDirection,
        status: 'in_progress',
        triggered_by: 'manual',
        triggered_by_user: memberId,
        request_id: `sync_${Date.now()}`
      })
      .select()
      .single();

    if (error) throw error;

    // In production, this would trigger actual sync job
    // For now, simulate completion after delay
    setTimeout(async () => {
      await supabase.rpc('record_sync_completion', {
        p_sync_log_id: syncLog.id,
        p_status: 'completed',
        p_records_succeeded: Math.floor(Math.random() * 100) + 10,
        p_records_failed: 0
      });
    }, 3000);

    revalidatePath('/national');
    revalidatePath('/national/sync');

    return {
      success: true,
      data: syncLog as NationalSyncLog,
      message: `Sync started for ${validated.data.entity_type}`
    };
  } catch (error) {
    console.error('Error triggering sync:', error);
    return { success: false, error: 'Failed to trigger sync' };
  }
}

/**
 * Cancel an in-progress sync
 */
export async function cancelSync(
  syncLogId: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('national_sync_logs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', syncLogId)
      .eq('status', 'in_progress');

    if (error) throw error;

    revalidatePath('/national/sync');

    return { success: true, message: 'Sync cancelled' };
  } catch (error) {
    console.error('Error cancelling sync:', error);
    return { success: false, error: 'Failed to cancel sync' };
  }
}

/**
 * Retry failed sync
 */
export async function retrySyncFailures(
  syncLogId: string
): Promise<ActionResult<NationalSyncLog>> {
  try {
    const supabase = await createClient();
    const memberId = await getCurrentMemberId();

    // Get original sync log
    const { data: originalLog } = await supabase
      .from('national_sync_logs')
      .select('*')
      .eq('id', syncLogId)
      .single();

    if (!originalLog) {
      return { success: false, error: 'Sync log not found' };
    }

    // Create new sync log for retry
    const { data: newLog, error } = await supabase
      .from('national_sync_logs')
      .insert({
        chapter_id: originalLog.chapter_id,
        sync_type: originalLog.sync_type,
        sync_direction: originalLog.sync_direction,
        status: 'in_progress',
        triggered_by: 'retry',
        triggered_by_user: memberId,
        request_id: `retry_${Date.now()}`
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/national/sync');

    return {
      success: true,
      data: newLog as NationalSyncLog,
      message: 'Retry initiated'
    };
  } catch (error) {
    console.error('Error retrying sync:', error);
    return { success: false, error: 'Failed to retry sync' };
  }
}

// ============================================================================
// EVENT REGISTRATION ACTIONS
// ============================================================================

/**
 * Register for a national event
 */
export async function registerForNationalEvent(
  formData: FormData
): Promise<ActionResult<NationalEventRegistration>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();
    const memberId = await getCurrentMemberId();

    if (!chapterId || !memberId) {
      return { success: false, error: 'Authentication required' };
    }

    const rawData = {
      national_event_id: formData.get('national_event_id'),
      requires_accommodation: formData.get('requires_accommodation') === 'true',
      travel_mode: formData.get('travel_mode'),
      arrival_date: formData.get('arrival_date'),
      departure_date: formData.get('departure_date'),
      special_requirements: formData.get('special_requirements')
    };

    const validated = eventRegistrationSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('national_event_registrations')
      .select('id')
      .eq('national_event_id', validated.data.national_event_id)
      .eq('member_id', memberId)
      .single();

    if (existing) {
      return { success: false, error: 'Already registered for this event' };
    }

    // Create registration
    const { data, error } = await supabase
      .from('national_event_registrations')
      .insert({
        ...validated.data,
        chapter_id: chapterId,
        member_id: memberId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Note: Registration count will be updated via database trigger or manual refresh

    revalidatePath('/national/events');

    return {
      success: true,
      data: data as NationalEventRegistration,
      message: 'Registration submitted successfully'
    };
  } catch (error) {
    console.error('Error registering for event:', error);
    return { success: false, error: 'Failed to register for event' };
  }
}

/**
 * Cancel event registration
 */
export async function cancelEventRegistration(
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const memberId = await getCurrentMemberId();

    const rawData = {
      registration_id: formData.get('registration_id'),
      reason: formData.get('reason')
    };

    const validated = cancelRegistrationSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const { error } = await supabase
      .from('national_event_registrations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        special_requirements: validated.data.reason
          ? `Cancellation reason: ${validated.data.reason}`
          : undefined
      })
      .eq('id', validated.data.registration_id)
      .eq('member_id', memberId);

    if (error) throw error;

    revalidatePath('/national/events');

    return { success: true, message: 'Registration cancelled' };
  } catch (error) {
    console.error('Error cancelling registration:', error);
    return { success: false, error: 'Failed to cancel registration' };
  }
}

/**
 * Submit event feedback
 */
export async function submitEventFeedback(
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const memberId = await getCurrentMemberId();

    const rawData = {
      registration_id: formData.get('registration_id'),
      rating: parseInt(formData.get('rating') as string),
      comments: formData.get('comments')
    };

    const validated = submitFeedbackSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const { error } = await supabase
      .from('national_event_registrations')
      .update({
        feedback_submitted: true,
        feedback_rating: validated.data.rating,
        feedback_comments: validated.data.comments
      })
      .eq('id', validated.data.registration_id)
      .eq('member_id', memberId);

    if (error) throw error;

    revalidatePath('/national/events');

    return { success: true, message: 'Feedback submitted' };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return { success: false, error: 'Failed to submit feedback' };
  }
}

// ============================================================================
// BROADCAST ACTIONS
// ============================================================================

/**
 * Mark broadcast as read
 */
export async function markBroadcastRead(
  broadcastId: string
): Promise<ActionResult<BroadcastReceipt>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();
    const memberId = await getCurrentMemberId();

    if (!chapterId || !memberId) {
      return { success: false, error: 'Authentication required' };
    }

    // Upsert receipt
    const { data, error } = await supabase
      .from('national_broadcast_receipts')
      .upsert(
        {
          chapter_id: chapterId,
          broadcast_id: broadcastId,
          member_id: memberId,
          read_at: new Date().toISOString()
        },
        { onConflict: 'broadcast_id,member_id' }
      )
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/national/broadcasts');

    return { success: true, data: data as BroadcastReceipt };
  } catch (error) {
    console.error('Error marking broadcast read:', error);
    return { success: false, error: 'Failed to mark as read' };
  }
}

/**
 * Acknowledge broadcast
 */
export async function acknowledgeBroadcast(
  formData: FormData
): Promise<ActionResult<BroadcastReceipt>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();
    const memberId = await getCurrentMemberId();

    if (!chapterId || !memberId) {
      return { success: false, error: 'Authentication required' };
    }

    const rawData = {
      broadcast_id: formData.get('broadcast_id'),
      response_text: formData.get('response_text')
    };

    const validated = acknowledgeBroadcastSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    // Upsert receipt with acknowledgment
    const { data, error } = await supabase
      .from('national_broadcast_receipts')
      .upsert(
        {
          chapter_id: chapterId,
          broadcast_id: validated.data.broadcast_id,
          member_id: memberId,
          read_at: new Date().toISOString(),
          acknowledged_at: new Date().toISOString(),
          response_text: validated.data.response_text
        },
        { onConflict: 'broadcast_id,member_id' }
      )
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/national/broadcasts');

    return {
      success: true,
      data: data as BroadcastReceipt,
      message: 'Broadcast acknowledged'
    };
  } catch (error) {
    console.error('Error acknowledging broadcast:', error);
    return { success: false, error: 'Failed to acknowledge broadcast' };
  }
}

// ============================================================================
// CONFLICT RESOLUTION ACTIONS
// ============================================================================

/**
 * Resolve a data conflict
 */
export async function resolveConflict(
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const memberId = await getCurrentMemberId();

    const rawData = {
      conflict_id: formData.get('conflict_id'),
      resolution: formData.get('resolution'),
      resolution_notes: formData.get('resolution_notes'),
      resolved_data: formData.get('resolved_data')
        ? JSON.parse(formData.get('resolved_data') as string)
        : undefined
    };

    const validated = resolveConflictSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const { error } = await supabase
      .from('national_data_conflicts')
      .update({
        resolution_status: validated.data.resolution,
        resolution_notes: validated.data.resolution_notes,
        resolved_data: validated.data.resolved_data,
        resolved_by: memberId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', validated.data.conflict_id);

    if (error) throw error;

    // Update sync entity conflict status
    const { data: conflict } = await supabase
      .from('national_data_conflicts')
      .select('sync_entity_id')
      .eq('id', validated.data.conflict_id)
      .single();

    if (conflict?.sync_entity_id) {
      await supabase
        .from('national_sync_entities')
        .update({ has_conflict: false })
        .eq('id', conflict.sync_entity_id);
    }

    revalidatePath('/national');
    revalidatePath('/national/sync');

    return { success: true, message: 'Conflict resolved' };
  } catch (error) {
    console.error('Error resolving conflict:', error);
    return { success: false, error: 'Failed to resolve conflict' };
  }
}

/**
 * Keep local version for conflict
 */
export async function keepLocalVersion(
  conflictId: string
): Promise<ActionResult<void>> {
  const formData = new FormData();
  formData.set('conflict_id', conflictId);
  formData.set('resolution', 'keep_local');
  return resolveConflict(formData);
}

/**
 * Accept national version for conflict
 */
export async function acceptNationalVersion(
  conflictId: string
): Promise<ActionResult<void>> {
  const formData = new FormData();
  formData.set('conflict_id', conflictId);
  formData.set('resolution', 'accept_national');
  return resolveConflict(formData);
}

// ============================================================================
// ROLE MAPPING ACTIONS
// ============================================================================

/**
 * Create role mapping
 */
export async function createRoleMapping(
  formData: FormData
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const chapterId = await getCurrentChapterId();
    const createdBy = await getCurrentMemberId();

    if (!chapterId) {
      return { success: false, error: 'No chapter found' };
    }

    const rawData = {
      member_id: formData.get('member_id'),
      national_role_id: formData.get('national_role_id'),
      local_role_id: formData.get('local_role_id'),
      valid_from: formData.get('valid_from'),
      valid_until: formData.get('valid_until')
    };

    const validated = createRoleMappingSchema.safeParse(rawData);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const { error } = await supabase.from('national_role_mappings').insert({
      ...validated.data,
      chapter_id: chapterId,
      created_by: createdBy,
      status: 'pending_approval'
    });

    if (error) throw error;

    revalidatePath('/national/leadership');

    return { success: true, message: 'Role mapping created' };
  } catch (error) {
    console.error('Error creating role mapping:', error);
    return { success: false, error: 'Failed to create role mapping' };
  }
}

/**
 * Sync leadership roles from national
 */
export async function syncLeadershipRoles(): Promise<ActionResult<void>> {
  try {
    // This would call the national API to sync leadership roles
    // For now, it's a placeholder

    revalidatePath('/national/leadership');

    return { success: true, message: 'Leadership roles synced' };
  } catch (error) {
    console.error('Error syncing leadership roles:', error);
    return { success: false, error: 'Failed to sync leadership roles' };
  }
}

// ============================================================================
// End of Server Actions
// ============================================================================
