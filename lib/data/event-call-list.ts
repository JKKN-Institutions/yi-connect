/**
 * Event call list: server-side data and access checks.
 *
 * Reads go through the admin client because guest_rsvps RLS only lets the
 * event organizer read guests, and chapter events often have no organizer.
 * Every caller of these helpers must check access first (getCallListAccess).
 */

import 'server-only';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  isCallResult,
  isMealChoice,
  MEAL_FIELD_ID,
  type CallListRow,
  type CallerOption,
  type CallResult
} from '@/lib/event-call-list';

export interface CallListEvent {
  id: string;
  title: string;
  start_date: string;
  status: string;
  chapter_id: string | null;
  organizer_id: string | null;
  co_organizers: string[] | null;
  custom_fields: Record<string, unknown> | null;
  registration_form_fields: unknown;
}

export interface CallListAccess {
  event: CallListEvent | null;
  /** Organizer, co-organizer, Co-Chair+ of the event's chapter, or National Admin+ */
  canManage: boolean;
  /** The user has a yi_connect.members row (needed for caller / called_by links) */
  isMember: boolean;
}

export async function getCallListAccess(
  eventId: string,
  userId: string
): Promise<CallListAccess> {
  const admin = createAdminSupabaseClient();

  const { data: event } = await admin
    .schema('yi_connect')
    .from('events')
    .select('id, title, start_date, status, chapter_id, organizer_id, co_organizers, custom_fields, registration_form_fields')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return { event: null, canManage: false, isMember: false };

  const [{ data: member }, { data: level }] = await Promise.all([
    admin
      .schema('yi_connect')
      .from('members')
      .select('id, chapter_id')
      .eq('id', userId)
      .maybeSingle(),
    admin.schema('yi_connect').rpc('get_user_hierarchy_level', { p_user_id: userId })
  ]);

  const hierarchy = typeof level === 'number' ? level : 0;
  const ev = event as CallListEvent;
  const isOrganizer =
    ev.organizer_id === userId || (ev.co_organizers || []).includes(userId);
  const sameChapter = !!member?.chapter_id && member.chapter_id === ev.chapter_id;

  const canManage =
    isOrganizer || hierarchy >= 6 || (hierarchy >= 3 && sameChapter);

  return { event: ev, canManage, isMember: !!member };
}

interface CallLogRecord {
  rsvp_id: string | null;
  guest_rsvp_id: string | null;
  assigned_caller_member_id: string | null;
  call_result: string;
  called_by_member_id: string | null;
  called_at: string | null;
  call_note: string | null;
  meal_choice: string | null;
  head_count: number | null;
}

function formMealAnswer(responses: unknown): string | null {
  if (!responses || typeof responses !== 'object') return null;
  const v = (responses as Record<string, unknown>)[MEAL_FIELD_ID];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function memberNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .schema('yi_connect')
    .from('profiles')
    .select('id, full_name, email')
    .in('id', unique);
  for (const p of data || []) {
    map.set(p.id, p.full_name || p.email || 'Member');
  }
  return map;
}

/** Every invitee of the event (member RSVPs + guests) with call status. */
export async function getCallList(eventId: string): Promise<CallListRow[]> {
  const admin = createAdminSupabaseClient();

  const [{ data: rsvps }, { data: guests }, { data: logs }] = await Promise.all([
    admin
      .schema('yi_connect')
      .from('event_rsvps')
      .select('id, member_id, status, custom_field_responses')
      .eq('event_id', eventId),
    admin
      .schema('yi_connect')
      .from('guest_rsvps')
      .select('id, full_name, phone, status, custom_field_responses')
      .eq('event_id', eventId),
    admin
      .schema('yi_connect')
      .from('event_call_list')
      .select(
        'rsvp_id, guest_rsvp_id, assigned_caller_member_id, call_result, called_by_member_id, called_at, call_note, meal_choice, head_count'
      )
      .eq('event_id', eventId)
  ]);

  const memberIds = (rsvps || []).map((r) => r.member_id as string);
  const { data: profiles } = memberIds.length
    ? await admin
        .schema('yi_connect')
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', memberIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; phone: string | null }[] };
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  const logByRsvp = new Map<string, CallLogRecord>();
  const logByGuest = new Map<string, CallLogRecord>();
  for (const log of (logs || []) as CallLogRecord[]) {
    if (log.rsvp_id) logByRsvp.set(log.rsvp_id, log);
    if (log.guest_rsvp_id) logByGuest.set(log.guest_rsvp_id, log);
  }

  const peopleIds: string[] = [];
  for (const log of (logs || []) as CallLogRecord[]) {
    if (log.assigned_caller_member_id) peopleIds.push(log.assigned_caller_member_id);
    if (log.called_by_member_id) peopleIds.push(log.called_by_member_id);
  }
  const names = await memberNames(peopleIds);

  const toRow = (
    kind: 'member' | 'guest',
    id: string,
    name: string,
    phone: string | null,
    rsvpStatus: string,
    log: CallLogRecord | undefined,
    formMeal: string | null
  ): CallListRow => {
    const result: CallResult = log && isCallResult(log.call_result) ? log.call_result : 'not_called';
    return {
      kind,
      id,
      name,
      phone,
      rsvpStatus,
      callerId: log?.assigned_caller_member_id ?? null,
      callerName: log?.assigned_caller_member_id
        ? names.get(log.assigned_caller_member_id) ?? 'Member'
        : null,
      result,
      note: log?.call_note ?? null,
      calledByName: log?.called_by_member_id ? names.get(log.called_by_member_id) ?? 'Member' : null,
      calledAt: log?.called_at ?? null,
      meal: log && isMealChoice(log.meal_choice) ? log.meal_choice : null,
      heads: log?.head_count ?? null,
      formMeal
    };
  };

  const rows: CallListRow[] = [
    ...(rsvps || []).map((r) => {
      const p = profileById.get(r.member_id as string);
      return toRow(
        'member',
        r.id,
        p?.full_name || p?.email || 'Member',
        p?.phone || null,
        r.status,
        logByRsvp.get(r.id),
        formMealAnswer(r.custom_field_responses)
      );
    }),
    ...(guests || []).map((g) =>
      toRow('guest', g.id, g.full_name, g.phone || null, g.status, logByGuest.get(g.id), formMealAnswer(g.custom_field_responses))
    )
  ];

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

/** People a leader can hand names to: active chapter members + the event's organizers. */
export async function getCallerOptions(
  event: CallListEvent,
  currentUserId: string
): Promise<CallerOption[]> {
  const admin = createAdminSupabaseClient();
  const ids = new Set<string>();

  if (event.chapter_id) {
    const { data: members } = await admin
      .schema('yi_connect')
      .from('members')
      .select('id')
      .eq('chapter_id', event.chapter_id)
      .eq('membership_status', 'active')
      .eq('is_active', true);
    for (const m of members || []) ids.add(m.id);
  }
  if (event.organizer_id) ids.add(event.organizer_id);
  for (const id of event.co_organizers || []) ids.add(id);
  ids.add(currentUserId);

  // Only people with a members row can be stored as a caller (foreign key).
  const { data: existing } = await admin
    .schema('yi_connect')
    .from('members')
    .select('id')
    .in('id', [...ids]);
  const names = await memberNames((existing || []).map((m) => m.id));

  return [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
