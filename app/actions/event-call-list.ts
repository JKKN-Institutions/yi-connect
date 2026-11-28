'use server';

/**
 * Event call list actions.
 *
 * Exports ONLY async functions (a const/enum export in a 'use server' file
 * breaks every action on the page). Shared constants live in
 * lib/event-call-list.ts.
 *
 * None of these actions sends WhatsApp, email or push. Invites are created as
 * 'pending' RSVPs; the only messaging code that reads RSVPs (event autopilot)
 * reads confirmed/attended rows only.
 *
 * Works on draft events too, so calls can start before the event is published.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/data/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { getCallListAccess } from '@/lib/data/event-call-list';
import {
  eventCallerIds,
  eventServesMeal,
  isCallResult,
  isMealChoice,
  MEAL_FIELD_ID,
  MEAL_FIELD_OPTIONS,
  type InviteeRef
} from '@/lib/event-call-list';

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string };

const MAX_BATCH = 500;

function revalidateCallPages(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/calls`);
  revalidatePath(`/events/${eventId}/my-calls`);
}

/** Make sure every invitee id really belongs to this event. */
async function inviteesBelongToEvent(eventId: string, invitees: InviteeRef[]): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const memberIds = invitees.filter((i) => i.kind === 'member').map((i) => i.id);
  const guestIds = invitees.filter((i) => i.kind === 'guest').map((i) => i.id);

  if (memberIds.length) {
    const { data } = await admin
      .schema('yi_connect')
      .from('event_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .in('id', memberIds);
    if ((data || []).length !== new Set(memberIds).size) return false;
  }
  if (guestIds.length) {
    const { data } = await admin
      .schema('yi_connect')
      .from('guest_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .in('id', guestIds);
    if ((data || []).length !== new Set(guestIds).size) return false;
  }
  return true;
}

/**
 * One-click: add a 'pending' RSVP for every active member of the event's
 * chapter who does not have one yet. Never touches existing RSVPs.
 * Demo/test accounts (@yi-demo.com) are left out.
 */
export async function inviteAllChapterMembers(
  eventId: string
): Promise<Result<{ added: number; alreadyInvited: number; skippedTestAccounts: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Please sign in again.' };

  const access = await getCallListAccess(eventId, user.id);
  if (!access.event) return { success: false, error: 'Event not found.' };
  if (!access.canManage) return { success: false, error: 'Only the chapter leaders of this event can do this.' };
  if (!access.event.chapter_id) return { success: false, error: 'This event has no chapter, so there is no member list to invite.' };

  const admin = createAdminSupabaseClient();

  const { data: members, error: membersError } = await admin
    .schema('yi_connect')
    .from('members')
    .select('id')
    .eq('chapter_id', access.event.chapter_id)
    .eq('membership_status', 'active')
    .eq('is_active', true);
  if (membersError) return { success: false, error: 'Could not read the member list.' };

  const memberIds = (members || []).map((m) => m.id);
  if (memberIds.length === 0) {
    return { success: true, data: { added: 0, alreadyInvited: 0, skippedTestAccounts: 0 } };
  }

  const { data: profiles } = await admin
    .schema('yi_connect')
    .from('profiles')
    .select('id, email')
    .in('id', memberIds);
  const testIds = new Set(
    (profiles || [])
      .filter((p) => (p.email || '').toLowerCase().endsWith('@yi-demo.com'))
      .map((p) => p.id)
  );

  const { data: existing } = await admin
    .schema('yi_connect')
    .from('event_rsvps')
    .select('member_id')
    .eq('event_id', eventId);
  const already = new Set((existing || []).map((r) => r.member_id as string));

  const toAdd = memberIds.filter((id) => !already.has(id) && !testIds.has(id));

  if (toAdd.length > 0) {
    const { error } = await admin
      .schema('yi_connect')
      .from('event_rsvps')
      .upsert(
        toAdd.map((member_id) => ({ event_id: eventId, member_id, status: 'pending' })),
        { onConflict: 'event_id,member_id', ignoreDuplicates: true }
      );
    if (error) {
      console.error('[inviteAllChapterMembers]', error);
      return { success: false, error: 'Could not add the invites. Nothing was sent to anyone.' };
    }
  }

  revalidateCallPages(eventId);
  return {
    success: true,
    data: {
      added: toAdd.length,
      alreadyInvited: memberIds.filter((id) => already.has(id)).length,
      skippedTestAccounts: memberIds.filter((id) => testIds.has(id) && !already.has(id)).length
    }
  };
}

/** Give a batch of invitees to one caller (or clear the caller with null). */
export async function assignCaller(
  eventId: string,
  invitees: InviteeRef[],
  callerMemberId: string | null
): Promise<Result<{ updated: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Please sign in again.' };
  if (!Array.isArray(invitees) || invitees.length === 0) return { success: false, error: 'Pick at least one name.' };
  if (invitees.length > MAX_BATCH) return { success: false, error: `At most ${MAX_BATCH} names at a time.` };

  const access = await getCallListAccess(eventId, user.id);
  if (!access.event) return { success: false, error: 'Event not found.' };
  if (!access.canManage) return { success: false, error: 'Only the chapter leaders of this event can assign callers.' };

  const clean = invitees.filter(
    (i) => (i.kind === 'member' || i.kind === 'guest') && typeof i.id === 'string'
  );
  if (clean.length !== invitees.length || !(await inviteesBelongToEvent(eventId, clean))) {
    return { success: false, error: 'Some names are not on this event.' };
  }

  const admin = createAdminSupabaseClient();

  if (callerMemberId) {
    const { data: caller } = await admin
      .schema('yi_connect')
      .from('members')
      .select('id')
      .eq('id', callerMemberId)
      .maybeSingle();
    if (!caller) return { success: false, error: 'That caller is not a Yi Connect member.' };
  }

  const now = new Date().toISOString();
  const memberRows = clean
    .filter((i) => i.kind === 'member')
    .map((i) => ({ event_id: eventId, rsvp_id: i.id, assigned_caller_member_id: callerMemberId, created_by: user.id, updated_at: now }));
  const guestRows = clean
    .filter((i) => i.kind === 'guest')
    .map((i) => ({ event_id: eventId, guest_rsvp_id: i.id, assigned_caller_member_id: callerMemberId, created_by: user.id, updated_at: now }));

  // Upsert only writes the caller column on rows that already exist;
  // the result, note and called_by are kept.
  if (memberRows.length) {
    const { error } = await admin
      .schema('yi_connect')
      .from('event_call_list')
      .upsert(memberRows, { onConflict: 'rsvp_id' });
    if (error) {
      console.error('[assignCaller] members', error);
      return { success: false, error: 'Could not save the caller.' };
    }
  }
  if (guestRows.length) {
    const { error } = await admin
      .schema('yi_connect')
      .from('event_call_list')
      .upsert(guestRows, { onConflict: 'guest_rsvp_id' });
    if (error) {
      console.error('[assignCaller] guests', error);
      return { success: false, error: 'Could not save the caller.' };
    }
  }

  revalidateCallPages(eventId);
  return { success: true, data: { updated: clean.length } };
}

/**
 * Record what happened on a call. Leaders, members ticked as callers for the
 * event (any name), or the caller the name was given to. The person who
 * pressed the button is stamped as called_by.
 */
export async function recordCallResult(
  eventId: string,
  invitee: InviteeRef,
  result: string,
  note?: string | null,
  meal?: { choice?: string | null; heads?: number | null }
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Please sign in again.' };
  if (!isCallResult(result)) return { success: false, error: 'Unknown call result.' };
  if (!invitee || (invitee.kind !== 'member' && invitee.kind !== 'guest') || typeof invitee.id !== 'string') {
    return { success: false, error: 'Unknown name.' };
  }
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 500) : null;

  const access = await getCallListAccess(eventId, user.id);
  if (!access.event) return { success: false, error: 'Event not found.' };
  if (!(await inviteesBelongToEvent(eventId, [invitee]))) return { success: false, error: 'That name is not on this event.' };

  const admin = createAdminSupabaseClient();
  const keyColumn = invitee.kind === 'member' ? 'rsvp_id' : 'guest_rsvp_id';

  const { data: existing } = await admin
    .schema('yi_connect')
    .from('event_call_list')
    .select('id, assigned_caller_member_id')
    .eq(keyColumn, invitee.id)
    .maybeSingle();

  const isAssignedCaller = existing?.assigned_caller_member_id === user.id;
  if (!access.canCall && !isAssignedCaller) {
    return { success: false, error: 'This call list is for the EC callers. Ask your Chair.' };
  }

  // Meal + head count only mean something when the event serves a meal and
  // the person is coming; otherwise they are cleared.
  const askMeal = result === 'coming' && eventServesMeal(access.event.custom_fields);
  const mealChoice = askMeal && isMealChoice(meal?.choice) ? meal!.choice : null;
  let heads: number | null = null;
  if (askMeal) {
    const n = Number(meal?.heads ?? 1);
    if (!Number.isInteger(n) || n < 1 || n > 20) return { success: false, error: 'Head count must be 1 to 20.' };
    heads = n;
  }

  const now = new Date().toISOString();
  const fields = {
    call_result: result,
    meal_choice: mealChoice,
    head_count: heads,
    call_note: cleanNote || null,
    called_by_member_id: result === 'not_called' ? null : access.isMember ? user.id : null,
    called_at: result === 'not_called' ? null : now,
    updated_at: now
  };

  const { error } = existing
    ? await admin.schema('yi_connect').from('event_call_list').update(fields).eq('id', existing.id)
    : await admin
        .schema('yi_connect')
        .from('event_call_list')
        .insert({ event_id: eventId, [keyColumn]: invitee.id, created_by: user.id, ...fields });

  if (error) {
    console.error('[recordCallResult]', error);
    return { success: false, error: 'Could not save the call result.' };
  }

  revalidateCallPages(eventId);
  return { success: true };
}

/**
 * Add a guest (e.g. a past chair who is not a member) straight onto the
 * call list. Works on draft events. Email is optional; when blank an empty
 * string is stored because guest_rsvps.email is NOT NULL.
 */
export async function addCallListGuest(
  eventId: string,
  input: { full_name: string; phone?: string | null; email?: string | null; designation?: string | null }
): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Please sign in again.' };

  const fullName = (input?.full_name || '').trim();
  if (fullName.length < 2 || fullName.length > 120) return { success: false, error: 'Please enter the full name.' };
  const phone = (input?.phone || '').trim().slice(0, 20) || null;
  const email = (input?.email || '').trim().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'That email does not look right.' };
  const designation = (input?.designation || '').trim().slice(0, 120) || null;

  const access = await getCallListAccess(eventId, user.id);
  if (!access.event) return { success: false, error: 'Event not found.' };
  if (!access.canManage) return { success: false, error: 'Only the chapter leaders of this event can add guests.' };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .schema('yi_connect')
    .from('guest_rsvps')
    .insert({
      event_id: eventId,
      full_name: fullName,
      phone,
      email,
      designation,
      status: 'pending',
      invited_by_member_id: access.isMember ? user.id : null
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[addCallListGuest]', error);
    return { success: false, error: 'Could not add the guest.' };
  }

  revalidateCallPages(eventId);
  return { success: true, data: { id: data.id } };
}

/**
 * Per-event switch: "This event serves a meal (ask veg / non-veg)".
 * Stored as events.custom_fields.meal_choice (other keys there are kept).
 * Turning it on also adds an optional "Meal preference" question (Veg /
 * Non-veg) to the event's registration form, so members who RSVP themselves
 * are asked too; turning it off removes that question again. The question is
 * optional so the one-tap public RSVP is never blocked.
 */
export async function setEventMealChoice(eventId: string, on: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Please sign in again.' };
  if (typeof on !== 'boolean') return { success: false, error: 'Invalid value.' };

  const access = await getCallListAccess(eventId, user.id);
  if (!access.event) return { success: false, error: 'Event not found.' };
  if (!access.canManage) return { success: false, error: 'Only the chapter leaders of this event can change this.' };

  const customFields = { ...(access.event.custom_fields ?? {}), meal_choice: on };

  const existing = Array.isArray(access.event.registration_form_fields)
    ? (access.event.registration_form_fields as Array<Record<string, unknown>>)
    : [];
  const withoutMeal = existing.filter((f) => f && f.id !== MEAL_FIELD_ID);
  const formFields = on
    ? [
        ...withoutMeal,
        {
          id: MEAL_FIELD_ID,
          type: 'select',
          label: 'Meal preference',
          help_text: 'So the caterer knows how many plates of each.',
          required: false,
          options: [...MEAL_FIELD_OPTIONS],
          sort_order: withoutMeal.length
        }
      ]
    : withoutMeal;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .schema('yi_connect')
    .from('events')
    .update({ custom_fields: customFields, registration_form_fields: formFields })
    .eq('id', eventId);
  if (error) {
    console.error('[setEventMealChoice]', error);
    return { success: false, error: 'Could not save the meal setting.' };
  }

  revalidateCallPages(eventId);
  return { success: true };
}

/**
 * Tick or untick a member as a caller for this event. Callers (plus leaders)
 * open My calls, see every invitee with phone numbers and record results.
 * Stored in events.custom_fields.callers, like the meal switch.
 */
export async function setEventCaller(eventId: string, memberId: string, on: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Please sign in again.' };
  if (typeof memberId !== 'string' || typeof on !== 'boolean') return { success: false, error: 'Invalid value.' };

  const access = await getCallListAccess(eventId, user.id);
  if (!access.event) return { success: false, error: 'Event not found.' };
  if (!access.canManage) return { success: false, error: 'Only the chapter leaders of this event can change this.' };

  const admin = createAdminSupabaseClient();
  if (on) {
    const { data: member } = await admin
      .schema('yi_connect')
      .from('members')
      .select('id, chapter_id')
      .eq('id', memberId)
      .maybeSingle();
    if (!member || member.chapter_id !== access.event.chapter_id) {
      return { success: false, error: 'Only members of this event\'s chapter can be callers.' };
    }
  }

  const current = eventCallerIds(access.event.custom_fields);
  const callers = on ? [...new Set([...current, memberId])] : current.filter((id) => id !== memberId);
  const customFields = { ...(access.event.custom_fields ?? {}), callers };

  const { error } = await admin.schema('yi_connect').from('events').update({ custom_fields: customFields }).eq('id', eventId);
  if (error) {
    console.error('[setEventCaller]', error);
    return { success: false, error: 'Could not save the callers list.' };
  }

  revalidateCallPages(eventId);
  return { success: true };
}
