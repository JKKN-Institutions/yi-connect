import "server-only";

import { tpService } from "./supabase";
import type { TpAgendaItem } from "./types";

/*
 * Meeting times and tables. A networking block on the agenda (tp_agenda rows
 * of kind 'meetings') is cut into 15-minute slots; each accepted meeting can
 * hold one slot and one table in the Partner lounge.
 *
 * Two kinds of meeting share the same slots and tables:
 *   tp_meetings           a Catalyst Partner and a delegate
 *   tp_delegate_meetings  two delegates
 * A person is busy in a slot if ANY accepted meeting of theirs (either kind)
 * holds it. A table is taken in a slot if ANY accepted meeting (either kind)
 * holds it. The database only stops a table being booked twice within ONE
 * kind, so bookMeetingSlot re-checks everything after it writes and takes its
 * own change back on a clash.
 *
 * Nothing here decides who may book: callers resolve "me" from a secret link
 * token first and pass the meeting they already proved is theirs.
 */

export const SLOT_MINUTES = 15;
/** A meetings block lasts this long unless the next agenda item starts sooner. */
export const MEETING_BLOCK_MINUTES = 60;
export const TABLE_COUNT = 40;
export const MEETING_PLACE = "Partner lounge";

export const DAY_LABEL: Record<number, string> = { 1: "Day 1 · 18 Dec", 2: "Day 2 · 19 Dec" };

export type TpSlot = {
  /** e.g. "d1-13:15". Sorts by day then time. */
  key: string;
  day: number;
  start: string;
  end: string;
  hall: string;
  /** e.g. "Day 1 · 13:15–13:30" */
  label: string;
};

const toMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function tableLabel(n: number): string {
  return `Table ${n}, ${MEETING_PLACE}`;
}

/** Pure. Slots for every 'meetings' block in the agenda, in time order. */
export function computeSlots(agenda: Pick<TpAgendaItem, "day" | "starts_at" | "kind" | "hall">[]): TpSlot[] {
  const out: TpSlot[] = [];
  const days = [...new Set(agenda.map((a) => a.day))].sort((a, b) => a - b);
  for (const day of days) {
    const items = agenda
      .filter((a) => a.day === day)
      .map((a) => ({ ...a, min: toMin(a.starts_at) }))
      .filter((a): a is typeof a & { min: number } => a.min !== null)
      .sort((a, b) => a.min - b.min);
    items.forEach((a, i) => {
      if (a.kind !== "meetings") return;
      const next = items.slice(i + 1).find((b) => b.min > a.min);
      const length = Math.min(MEETING_BLOCK_MINUTES, next ? next.min - a.min : MEETING_BLOCK_MINUTES);
      for (let t = a.min; t + SLOT_MINUTES <= a.min + length; t += SLOT_MINUTES) {
        const start = toHHMM(t);
        const end = toHHMM(t + SLOT_MINUTES);
        out.push({
          key: `d${day}-${start}`,
          day,
          start,
          end,
          hall: a.hall,
          label: `Day ${day} · ${start}–${end}`,
        });
      }
    });
  }
  return out;
}

export async function getSlots(): Promise<TpSlot[]> {
  const { data, error } = await tpService().from("tp_agenda").select("day, starts_at, kind, hall");
  if (error) throw new Error(error.message);
  return computeSlots((data ?? []) as Pick<TpAgendaItem, "day" | "starts_at" | "kind" | "hall">[]);
}

// ------------------------------------------------------------- bookings ----

export type MeetingKind = "partner" | "delegate";

/** "p:<partner id>" or "d:<delegate id>": one namespace for busy checks. */
export type PersonKey = string;
export const pKey = (partnerId: string): PersonKey => `p:${partnerId}`;
export const dKey = (delegateId: string): PersonKey => `d:${delegateId}`;

export type Booking = {
  kind: MeetingKind;
  id: string;
  people: [PersonKey, PersonKey];
  slot_key: string;
  table_no: number;
};

const TABLE_OF: Record<MeetingKind, "tp_meetings" | "tp_delegate_meetings"> = {
  partner: "tp_meetings",
  delegate: "tp_delegate_meetings",
};

/**
 * Every accepted meeting that holds a slot, both kinds. Bounded by the unique
 * indexes to (slots x tables) per kind, a few hundred rows at most.
 */
export async function loadBookings(slotKey?: string): Promise<Booking[]> {
  const db = tpService();
  let pq = db
    .from("tp_meetings")
    .select("id, partner_id, delegate_id, slot_key, table_no")
    .eq("status", "accepted")
    .not("slot_key", "is", null)
    .limit(5000);
  let dq = db
    .from("tp_delegate_meetings")
    .select("id, from_delegate_id, to_delegate_id, slot_key, table_no")
    .eq("status", "accepted")
    .not("slot_key", "is", null)
    .limit(5000);
  if (slotKey) {
    pq = pq.eq("slot_key", slotKey);
    dq = dq.eq("slot_key", slotKey);
  }
  const [p, d] = await Promise.all([pq, dq]);
  if (p.error) throw new Error(p.error.message);
  if (d.error) throw new Error(d.error.message);
  const out: Booking[] = [];
  for (const r of (p.data ?? []) as { id: string; partner_id: string; delegate_id: string; slot_key: string; table_no: number }[]) {
    out.push({ kind: "partner", id: r.id, people: [pKey(r.partner_id), dKey(r.delegate_id)], slot_key: r.slot_key, table_no: r.table_no });
  }
  for (const r of (d.data ?? []) as { id: string; from_delegate_id: string; to_delegate_id: string; slot_key: string; table_no: number }[]) {
    out.push({ kind: "delegate", id: r.id, people: [dKey(r.from_delegate_id), dKey(r.to_delegate_id)], slot_key: r.slot_key, table_no: r.table_no });
  }
  return out;
}

const isSelf = (b: Booking, kind: MeetingKind, id: string) => b.kind === kind && b.id === id;

/**
 * Pure. Slots where neither person has another meeting and at least one
 * table is free. The meeting being (re)timed is ignored, so moving it never
 * clashes with itself.
 */
export function freeSlotsFor(
  slots: TpSlot[],
  bookings: Booking[],
  people: PersonKey[],
  self: { kind: MeetingKind; id: string }
): TpSlot[] {
  const others = bookings.filter((b) => !isSelf(b, self.kind, self.id));
  const busy = new Set(others.filter((b) => b.people.some((p) => people.includes(p))).map((b) => b.slot_key));
  return slots.filter((s) => !busy.has(s.key) && lowestFreeTable(others, s.key) !== null);
}

/** Pure. Lowest table number not held in this slot, or null when all are taken. */
export function lowestFreeTable(bookings: Booking[], slotKey: string): number | null {
  const taken = new Set(bookings.filter((b) => b.slot_key === slotKey).map((b) => b.table_no));
  for (let t = 1; t <= TABLE_COUNT; t++) if (!taken.has(t)) return t;
  return null;
}

export type BookResult = { success: true; data: { slot: TpSlot; table_no: number } } | { success: false; error: string };

/**
 * Give an ACCEPTED meeting a slot and the lowest free table. The caller has
 * already proved the meeting is the caller's own and named both people.
 */
export async function bookMeetingSlot(input: {
  kind: MeetingKind;
  meetingId: string;
  people: [PersonKey, PersonKey];
  slotKey: string;
  /** Plain names for messages, e.g. "Asha" and "you". */
  otherName: string;
}): Promise<BookResult> {
  const { kind, meetingId, people, slotKey, otherName } = input;
  const slots = await getSlots();
  const slot = slots.find((s) => s.key === slotKey);
  if (!slot) return { success: false, error: "That time is not one of the meeting slots" };

  const db = tpService();
  const table = TABLE_OF[kind];
  const { data: cur, error: curErr } = await db
    .from(table)
    .select("id, status, slot_key, table_no")
    .eq("id", meetingId)
    .maybeSingle();
  if (curErr || !cur) return { success: false, error: "Meeting not found" };
  if (cur.status !== "accepted") return { success: false, error: "Only an accepted meeting can be given a time" };
  if (cur.slot_key === slotKey && cur.table_no) {
    return { success: true, data: { slot, table_no: cur.table_no } };
  }

  const bookings = await loadBookings(slotKey);
  const others = bookings.filter((b) => !isSelf(b, kind, meetingId));
  const clash = others.find((b) => b.people.some((p) => people.includes(p)));
  if (clash) {
    const mine = clash.people.includes(people[0]);
    return {
      success: false,
      error: mine
        ? `You already have a meeting at ${slot.label}. Pick another time.`
        : `${otherName} already has a meeting at ${slot.label}. Pick another time.`,
    };
  }
  const tableNo = lowestFreeTable(others, slotKey);
  if (tableNo === null) return { success: false, error: `All ${TABLE_COUNT} tables are taken at ${slot.label}. Pick another time.` };

  const prev = { slot_key: cur.slot_key as string | null, table_no: cur.table_no as number | null };
  const { data: upd, error: updErr } = await db
    .from(table)
    .update({ slot_key: slotKey, table_no: tableNo })
    .eq("id", meetingId)
    .eq("status", "accepted")
    .select("id");
  if (updErr) {
    if (updErr.code === "23505") return { success: false, error: "Someone took that table a moment ago. Please pick the time again." };
    return { success: false, error: "Could not save the time. Please try again." };
  }
  if (!upd?.length) return { success: false, error: "This meeting is no longer accepted" };

  // The checks above and the write are separate calls, so two people booking
  // at once can both pass them. Re-read now that mine is saved; on any clash,
  // put my meeting back the way it was.
  let after: Booking[];
  try {
    after = await loadBookings(slotKey);
  } catch {
    after = [];
  }
  const atTable = after.filter((b) => b.table_no === tableNo).length;
  const forPerson = (p: PersonKey) => after.filter((b) => b.people.includes(p)).length;
  const stillMine = after.some((b) => isSelf(b, kind, meetingId) && b.table_no === tableNo);
  if (!stillMine || atTable !== 1 || forPerson(people[0]) !== 1 || forPerson(people[1]) !== 1) {
    const back = await db
      .from(table)
      .update(prev)
      .eq("id", meetingId)
      .eq("slot_key", slotKey)
      .eq("table_no", tableNo);
    // The old table may have been taken meanwhile: then leave it untimed.
    if (back.error) {
      await db
        .from(table)
        .update({ slot_key: null, table_no: null })
        .eq("id", meetingId)
        .eq("slot_key", slotKey)
        .eq("table_no", tableNo);
    }
    return { success: false, error: "That time was just taken by another booking. Please pick again." };
  }
  return { success: true, data: { slot, table_no: tableNo } };
}

// ------------------------------------------------------- per-delegate ----

export type MyMeeting = {
  kind: MeetingKind;
  id: string;
  /** Who I am meeting: a delegate's name, or a partner's business. */
  title: string;
  /** Business + chapter (delegate) or member + chapter (partner). */
  detail: string;
  slot_key: string | null;
  table_no: number | null;
  /** The other person, for busy checks. */
  other: PersonKey;
};

/**
 * Every ACCEPTED meeting of one delegate, both kinds, with the other side's
 * name. Partner meetings only count when the partner is confirmed (the same
 * rule as getDelegateMeetings). No phone or email is selected.
 */
export async function getMyAcceptedMeetings(delegateId: string): Promise<MyMeeting[]> {
  const db = tpService();
  const [p, d] = await Promise.all([
    db
      .from("tp_meetings")
      .select("id, partner_id, slot_key, table_no, partner:tp_partners(business_name, member_name, chapter, status)")
      .eq("delegate_id", delegateId)
      .eq("status", "accepted"),
    db
      .from("tp_delegate_meetings")
      .select("id, from_delegate_id, to_delegate_id, slot_key, table_no")
      .or(`from_delegate_id.eq.${delegateId},to_delegate_id.eq.${delegateId}`)
      .eq("status", "accepted"),
  ]);
  if (p.error) throw new Error(p.error.message);
  if (d.error) throw new Error(d.error.message);

  type PRow = {
    id: string;
    partner_id: string;
    slot_key: string | null;
    table_no: number | null;
    partner: { business_name: string; member_name: string; chapter: string; status: string } | null;
  };
  type DRow = { id: string; from_delegate_id: string; to_delegate_id: string; slot_key: string | null; table_no: number | null };

  const out: MyMeeting[] = [];
  for (const r of (p.data ?? []) as unknown as PRow[]) {
    if (r.partner?.status !== "confirmed") continue;
    out.push({
      kind: "partner",
      id: r.id,
      title: r.partner.business_name,
      detail: `Catalyst Partner · ${r.partner.member_name} · ${r.partner.chapter}`,
      slot_key: r.slot_key,
      table_no: r.table_no,
      other: pKey(r.partner_id),
    });
  }
  const drows = (d.data ?? []) as DRow[];
  const otherIds = drows.map((r) => (r.from_delegate_id === delegateId ? r.to_delegate_id : r.from_delegate_id));
  const names = new Map<string, { full_name: string; business_name: string | null; chapter: string }>();
  if (otherIds.length) {
    const { data, error } = await db.from("tp_delegates").select("id, full_name, business_name, chapter").in("id", otherIds);
    if (error) throw new Error(error.message);
    for (const x of (data ?? []) as { id: string; full_name: string; business_name: string | null; chapter: string }[]) names.set(x.id, x);
  }
  for (const r of drows) {
    const otherId = r.from_delegate_id === delegateId ? r.to_delegate_id : r.from_delegate_id;
    const o = names.get(otherId);
    out.push({
      kind: "delegate",
      id: r.id,
      title: o?.full_name ?? "A delegate",
      detail: ["Delegate", o?.business_name, o?.chapter].filter(Boolean).join(" · "),
      slot_key: r.slot_key,
      table_no: r.table_no,
      other: dKey(otherId),
    });
  }
  return out;
}

/** What a "Pick a time" control needs, computed on the server. */
export type SlotChoice = { key: string; label: string };

export function choicesFor(
  slots: TpSlot[],
  bookings: Booking[],
  people: PersonKey[],
  self: { kind: MeetingKind; id: string }
): SlotChoice[] {
  return freeSlotsFor(slots, bookings, people, self).map((s) => ({ key: s.key, label: s.label }));
}

/** "Day 1 · 13:15–13:30 · Table 3, Partner lounge", or null when untimed / off the agenda. */
export function whenWhere(slots: TpSlot[], slotKey: string | null, tableNo: number | null): string | null {
  if (!slotKey || !tableNo) return null;
  const s = slots.find((x) => x.key === slotKey);
  if (!s) return `Time no longer on the agenda · ${tableLabel(tableNo)}`;
  return `${s.label} · ${tableLabel(tableNo)}`;
}
