/**
 * Connections Server Actions (Stutzee Feature 4A)
 *
 * Handles member-to-member scan-to-connect mutations.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import {
  createConnectionSchema,
  updateConnectionNoteSchema,
  deleteConnectionSchema,
  toggleNetworkingOptOutSchema,
  type CreateConnectionInput,
  type UpdateConnectionNoteInput,
} from '@/lib/validations/connection';

type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================================================
// createConnection
// ============================================================================

/**
 * Create a one-way connection from the current user to the member identified
 * by `targetQrToken`. Respects privacy opt-out and self-scan.
 *
 * Idempotent: if a connection with the same (from, to, event) already exists,
 * we return success without changing anything.
 */
export async function createConnection(
  input: CreateConnectionInput
): Promise<ActionResponse<{ connectionId: string; targetMemberId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in to connect.' };
    }

    const parsed = createConnectionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid input',
      };
    }
    const { targetQrToken, eventId, note } = parsed.data;

    // Resolve target member via service-role (cross-chapter scans need to work).
    const admin = createAdminSupabaseClient();
    const { data: target, error: targetErr } = await admin
      .from('members')
      .select('id, allow_networking_qr')
      .eq('profile_qr_token', targetQrToken)
      .maybeSingle();

    if (targetErr || !target) {
      return { success: false, error: 'QR code not recognised.' };
    }

    if (!(target as any).allow_networking_qr) {
      return {
        success: false,
        error: 'This member is not accepting networking connections.',
      };
    }

    if ((target as any).id === user.id) {
      return {
        success: false,
        error: 'That is your own profile QR.',
      };
    }

    // Insert via the RLS-aware server client so we enforce
    // `from_member_id = auth.uid()` at the DB layer.
    const supabase = await createServerSupabaseClient();
    const insertRow: Record<string, any> = {
      from_member_id: user.id,
      to_member_id: (target as any).id,
      event_id: eventId ?? null,
      note: note && note.trim().length > 0 ? note.trim() : null,
    };

    const { data: created, error: insertErr } = await supabase
      .from('member_connections')
      .insert(insertRow)
      .select('id')
      .single();

    if (insertErr) {
      // Unique violation = already connected for this event scope
      if ((insertErr as any).code === '23505') {
        // Look it up so caller can still navigate to the record
        const { data: existing } = await supabase
          .from('member_connections')
          .select('id')
          .eq('from_member_id', user.id)
          .eq('to_member_id', (target as any).id)
          .eq('event_id', eventId ?? null)
          .maybeSingle();
        revalidatePath('/connections');
        return {
          success: true,
          data: {
            connectionId: (existing as any)?.id ?? '',
            targetMemberId: (target as any).id,
          },
        };
      }
      console.error('[createConnection] insert error:', insertErr);
      return { success: false, error: 'Could not save connection.' };
    }

    revalidatePath('/connections');
    revalidatePath(`/members/${(target as any).id}`);

    return {
      success: true,
      data: {
        connectionId: (created as any).id,
        targetMemberId: (target as any).id,
      },
    };
  } catch (err) {
    console.error('[createConnection] unexpected error:', err);
    return { success: false, error: 'Something went wrong.' };
  }
}

// ============================================================================
// updateConnectionNote
// ============================================================================

export async function updateConnectionNote(
  input: UpdateConnectionNoteInput
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = updateConnectionNoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid input',
      };
    }
    const { connectionId, note } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('member_connections')
      .update({ note: note && note.trim().length > 0 ? note.trim() : null })
      .eq('id', connectionId)
      .eq('from_member_id', user.id);

    if (error) {
      console.error('[updateConnectionNote] error:', error);
      return { success: false, error: 'Could not update note.' };
    }

    revalidatePath('/connections');
    return { success: true };
  } catch (err) {
    console.error('[updateConnectionNote] unexpected:', err);
    return { success: false, error: 'Something went wrong.' };
  }
}

// ============================================================================
// deleteConnection
// ============================================================================

export async function deleteConnection(
  connectionId: string
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = deleteConnectionSchema.safeParse({ connectionId });
    if (!parsed.success) {
      return { success: false, error: 'Invalid connection id' };
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('member_connections')
      .delete()
      .eq('id', connectionId)
      .eq('from_member_id', user.id);

    if (error) {
      console.error('[deleteConnection] error:', error);
      return { success: false, error: 'Could not delete connection.' };
    }

    revalidatePath('/connections');
    return { success: true };
  } catch (err) {
    console.error('[deleteConnection] unexpected:', err);
    return { success: false, error: 'Something went wrong.' };
  }
}

// ============================================================================
// resetMyProfileQrToken
// ============================================================================

/**
 * Rotate the member's profile_qr_token. Old printed QR codes stop working.
 * Implemented via the service-role client because profile_qr_token is
 * normally not selectable/updatable by the member under RLS (members table
 * policies restrict UPDATE). Authorisation is enforced by looking up
 * auth.uid() first.
 */
export async function resetMyProfileQrToken(): Promise<
  ActionResponse<{ token: string }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const newToken = randomBytes(16).toString('hex');
    const admin = createAdminSupabaseClient();

    const { error } = await admin
      .from('members')
      .update({ profile_qr_token: newToken })
      .eq('id', user.id);

    if (error) {
      console.error('[resetMyProfileQrToken] error:', error);
      return { success: false, error: 'Could not rotate token.' };
    }

    revalidatePath('/settings/profile');
    return { success: true, data: { token: newToken } };
  } catch (err) {
    console.error('[resetMyProfileQrToken] unexpected:', err);
    return { success: false, error: 'Something went wrong.' };
  }
}

// ============================================================================
// toggleNetworkingOptOut
// ============================================================================

/**
 * Set `allow_networking_qr`. When false, the /connect landing refuses to
 * resolve the member's profile.
 */
export async function toggleNetworkingOptOut(
  enabled: boolean
): Promise<ActionResponse<{ enabled: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = toggleNetworkingOptOutSchema.safeParse({ enabled });
    if (!parsed.success) {
      return { success: false, error: 'Invalid value' };
    }

    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from('members')
      .update({ allow_networking_qr: parsed.data.enabled })
      .eq('id', user.id);

    if (error) {
      console.error('[toggleNetworkingOptOut] error:', error);
      return { success: false, error: 'Could not update preference.' };
    }

    revalidatePath('/settings/profile');
    return { success: true, data: { enabled: parsed.data.enabled } };
  } catch (err) {
    console.error('[toggleNetworkingOptOut] unexpected:', err);
    return { success: false, error: 'Something went wrong.' };
  }
}
