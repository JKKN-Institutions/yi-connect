'use server';

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { verifyMemberHMAC } from '@/lib/crypto/hmac';

interface ToggleRSVPInput {
  event_id: string;
  token: string;
  member_id: string;
  member_hmac: string; // HMAC proof that member_id was served by the server
  guests_count?: number;
}

interface AddGuestRSVPInput {
  event_id: string;
  token: string;
  full_name: string;
  phone?: string;
}

interface ActionResponse<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Toggle member RSVP (tap to confirm / tap again to undo)
 * Token validates authorization.
 */
export async function toggleMemberRSVP(
  input: ToggleRSVPInput
): Promise<ActionResponse<{ status: string }>> {
  try {
    // 0. Verify HMAC to prevent IDOR (member_id was served by the server)
    if (!verifyMemberHMAC(input.member_id, input.token, input.member_hmac)) {
      return { success: false, error: 'Invalid member verification' };
    }

    const supabase = createAdminSupabaseClient();

    // 1. Validate token matches event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, rsvp_token, status, max_capacity, current_registrations')
      .eq('id', input.event_id)
      .eq('rsvp_token', input.token)
      .in('status', ['published', 'ongoing'])
      .single();

    if (eventError || !event) {
      return { success: false, error: 'Event not found or RSVP closed' };
    }

    // 2. Validate member exists
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('id', input.member_id)
      .eq('is_active', true)
      .single();

    if (!member) {
      return { success: false, error: 'Member not found' };
    }

    // 3. Check existing RSVP
    const { data: existingRsvp } = await supabase
      .from('event_rsvps')
      .select('id, status')
      .eq('event_id', input.event_id)
      .eq('member_id', input.member_id)
      .single();

    if (existingRsvp) {
      // Toggle: if confirmed -> decline, if declined/pending -> confirm
      const newStatus = existingRsvp.status === 'confirmed' ? 'declined' : 'confirmed';

      const { error: updateError } = await supabase
        .from('event_rsvps')
        .update({
          status: newStatus,
          guests_count: newStatus === 'confirmed' ? (input.guests_count ?? 0) : 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRsvp.id);

      if (updateError) {
        console.error('Error updating RSVP:', updateError);
        return { success: false, error: 'Failed to update RSVP' };
      }

      revalidatePath(`/rsvp/${input.token}`);
      return { success: true, data: { status: newStatus } };
    }

    // 4. New RSVP - check capacity
    if (event.max_capacity && event.current_registrations >= event.max_capacity) {
      return { success: false, error: 'Event is full' };
    }

    // 5. Create new RSVP
    const { error: insertError } = await supabase
      .from('event_rsvps')
      .insert({
        event_id: input.event_id,
        member_id: input.member_id,
        status: 'confirmed',
        guests_count: input.guests_count ?? 0,
      });

    if (insertError) {
      console.error('Error creating RSVP:', insertError);
      return { success: false, error: 'Failed to create RSVP' };
    }

    revalidatePath(`/rsvp/${input.token}`);
    return { success: true, data: { status: 'confirmed' } };
  } catch (error) {
    console.error('Error in toggleMemberRSVP:', error);
    return { success: false, error: 'Something went wrong' };
  }
}

/**
 * Update guest count for an existing RSVP
 */
export async function updateGuestCount(
  input: { event_id: string; token: string; member_id: string; member_hmac: string; guests_count: number }
): Promise<ActionResponse> {
  try {
    // Verify HMAC to prevent IDOR
    if (!verifyMemberHMAC(input.member_id, input.token, input.member_hmac)) {
      return { success: false, error: 'Invalid member verification' };
    }

    const supabase = createAdminSupabaseClient();

    // Validate token
    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('id', input.event_id)
      .eq('rsvp_token', input.token)
      .single();

    if (!event) {
      return { success: false, error: 'Invalid token' };
    }

    const { error } = await supabase
      .from('event_rsvps')
      .update({
        guests_count: Math.max(0, Math.min(5, input.guests_count)),
        updated_at: new Date().toISOString()
      })
      .eq('event_id', input.event_id)
      .eq('member_id', input.member_id);

    if (error) {
      return { success: false, error: 'Failed to update guest count' };
    }

    revalidatePath(`/rsvp/${input.token}`);
    return { success: true };
  } catch {
    return { success: false, error: 'Something went wrong' };
  }
}

/**
 * Add a non-member guest RSVP
 */
export async function addGuestRSVP(
  input: AddGuestRSVPInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    // Validate guest name length
    const trimmedName = input.full_name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return { success: false, error: 'Guest name must be between 1 and 100 characters' };
    }

    const supabase = createAdminSupabaseClient();

    // Validate token and check capacity
    const { data: event } = await supabase
      .from('events')
      .select('id, status, max_capacity, current_registrations')
      .eq('id', input.event_id)
      .eq('rsvp_token', input.token)
      .in('status', ['published', 'ongoing'])
      .single();

    if (!event) {
      return { success: false, error: 'Event not found or RSVP closed' };
    }

    // Check capacity before adding guest
    if (event.max_capacity && event.current_registrations >= event.max_capacity) {
      return { success: false, error: 'Event is full' };
    }

    const { data, error } = await supabase
      .from('guest_rsvps')
      .insert({
        event_id: input.event_id,
        full_name: trimmedName,
        email: `guest-${crypto.randomUUID()}@quickrsvp.local`, // Unique placeholder per guest
        phone: input.phone?.trim() || null,
        status: 'confirmed',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating guest RSVP:', error);
      return { success: false, error: 'Failed to add guest' };
    }

    revalidatePath(`/rsvp/${input.token}`);
    return { success: true, data: { id: data.id } };
  } catch {
    return { success: false, error: 'Something went wrong' };
  }
}
