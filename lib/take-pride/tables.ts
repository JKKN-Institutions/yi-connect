import "server-only";

import { tpService } from "./supabase";
import type { TpResult } from "./types";

/*
 * Topic tables ("circles"): small tables around one topic at the agenda's
 * networking times. Delegates join, leave or host (via their pass token);
 * organisers create and cancel (via requireTpOrganiser). Callers MUST pass a
 * gate first: every function here trusts the delegate id / input it is given.
 *
 * Rules, all enforced here (the browser only names a table or sends a form):
 * - a table holds at most `seats` members; a host holds one of those seats
 * - a delegate is at one open table per time slot (day + starts_at)
 * - a delegate hosts at most HOST_CAP open tables
 * Each rule is checked before the insert for a friendly message, and again
 * AFTER it, because two taps at once can both pass the first check. The
 * re-check ranks rows by arrival (time, then id): rows within the limit
 * stay, any row past it is taken back by its own caller. So when three
 * people tap the last two seats at once, the first two keep them instead of
 * everyone being bounced.
 * Known gap: arrival is the insert's start time, not its commit time, so a
 * join whose insert commits late (a full round trip after another join that
 * already passed the re-check) can still rank itself in. Worst case one
 * extra seat. Closing it needs a row lock in a DB function (follow-up).
 * Sample and real never mix: a sample pass only sees and joins sample
 * tables, a real pass only real ones, so deleting sample delegates (and the
 * tables they host, by FK cascade) can never take a real delegate's seat.
 *
 * Privacy: members are shown by name and chapter only. No contact details.
 */

export const TP_TABLE_PLACES = [
  "Lounge table A",
  "Lounge table B",
  "Lounge table C",
  "Lounge table D",
  "Lounge table E",
  "Lounge table F",
  "Lounge table G",
  "Lounge table H",
] as const;

export const TABLE_TITLE_MAX = 60;
export const TABLE_ABOUT_MAX = 200;
export const DELEGATE_SEATS = { min: 4, max: 12 } as const;
export const ORGANISER_SEATS = { min: 2, max: 30 } as const;
export const HOST_CAP = 2;

export type TpSlot = { key: string; day: number; starts_at: string; label: string };

export type TpCircle = {
  id: string;
  title: string;
  about: string | null;
  host_delegate_id: string | null;
  created_by_organiser: boolean;
  day: number;
  starts_at: string;
  place: string;
  seats: number;
  status: "open" | "cancelled";
  is_sample: boolean;
  created_at: string;
};

export type TpCircleMember = { delegate_id: string; full_name: string; chapter: string; badge_code: string };

export type TpCircleView = TpCircle & {
  host: { full_name: string; chapter: string } | null;
  members: TpCircleMember[];
};

export type TableInput = { title: string; about: string; slot: string; place: string; seats: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TRY_AGAIN = "Something went wrong. Please try again.";
const CIRCLE_COLS =
  "id, title, about, host_delegate_id, created_by_organiser, day, starts_at, place, seats, status, is_sample, created_at";

export const slotKey = (day: number, startsAt: string) => `${day}|${startsAt}`;
export const slotLabel = (day: number, startsAt: string) => `Day ${day} · ${startsAt}`;

/** Networking times = the agenda's "meetings" rows (lunch, morning brief). */
export async function getNetworkingSlots(): Promise<TpSlot[]> {
  const { data, error } = await tpService()
    .from("tp_agenda")
    .select("day, starts_at, title, sort_order")
    .eq("kind", "meetings")
    .order("day")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const out: TpSlot[] = [];
  for (const a of (data ?? []) as { day: number; starts_at: string; title: string }[]) {
    const key = slotKey(a.day, a.starts_at);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, day: a.day, starts_at: a.starts_at, label: `${slotLabel(a.day, a.starts_at)} · ${a.title}` });
  }
  return out;
}

/** Tables with host and members. `onlyOpen` hides cancelled ones. */
export async function listCircles(opts: { onlyOpen: boolean; ids?: string[] }): Promise<TpCircleView[]> {
  const db = tpService();
  let q = db.from("tp_circles").select(CIRCLE_COLS).order("day").order("starts_at").order("place");
  if (opts.onlyOpen) q = q.eq("status", "open");
  if (opts.ids) q = q.in("id", opts.ids.length ? opts.ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q.limit(1000);
  if (error) throw new Error(error.message);
  const circles = (data ?? []) as TpCircle[];
  if (circles.length === 0) return [];

  const { data: mem, error: mErr } = await db
    .from("tp_circle_members")
    .select("circle_id, delegate_id, joined_at, delegate:tp_delegates(full_name, chapter, badge_code)")
    .in("circle_id", circles.map((c) => c.id))
    .order("joined_at")
    .limit(10000);
  if (mErr) throw new Error(mErr.message);
  type MemRow = {
    circle_id: string;
    delegate_id: string;
    delegate: { full_name: string; chapter: string; badge_code: string } | null;
  };
  const byCircle = new Map<string, TpCircleMember[]>();
  for (const m of (mem ?? []) as unknown as MemRow[]) {
    if (!m.delegate) continue;
    const list = byCircle.get(m.circle_id) ?? [];
    list.push({ delegate_id: m.delegate_id, ...m.delegate });
    byCircle.set(m.circle_id, list);
  }

  const hostIds = [...new Set(circles.map((c) => c.host_delegate_id).filter((x): x is string => !!x))];
  const hosts = new Map<string, { full_name: string; chapter: string }>();
  if (hostIds.length) {
    const { data: hs, error: hErr } = await db.from("tp_delegates").select("id, full_name, chapter").in("id", hostIds);
    if (hErr) throw new Error(hErr.message);
    for (const h of (hs ?? []) as { id: string; full_name: string; chapter: string }[]) {
      hosts.set(h.id, { full_name: h.full_name, chapter: h.chapter });
    }
  }

  return circles.map((c) => ({
    ...c,
    host: c.host_delegate_id ? hosts.get(c.host_delegate_id) ?? null : null,
    members: byCircle.get(c.id) ?? [],
  }));
}

/** Ids of every table (open or cancelled) this delegate sits at. */
export async function getMyCircleIds(delegateId: string): Promise<string[]> {
  const { data, error } = await tpService().from("tp_circle_members").select("circle_id").eq("delegate_id", delegateId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { circle_id: string }[]).map((r) => r.circle_id);
}

async function getCircle(id: string): Promise<TpCircle | null> {
  const { data } = await tpService().from("tp_circles").select(CIRCLE_COLS).eq("id", id).maybeSingle();
  return (data as TpCircle | null) ?? null;
}

async function memberCount(circleId: string): Promise<number | null> {
  const { count, error } = await tpService()
    .from("tp_circle_members")
    .select("delegate_id", { count: "exact", head: true })
    .eq("circle_id", circleId);
  return error ? null : count ?? 0;
}

/** True when this delegate is among the first `seats` to join, by arrival. */
async function holdsSeat(circleId: string, delegateId: string, seats: number): Promise<boolean | null> {
  const { data, error } = await tpService()
    .from("tp_circle_members")
    .select("delegate_id")
    .eq("circle_id", circleId)
    .order("joined_at")
    .order("delegate_id")
    .limit(seats);
  if (error) return null;
  return ((data ?? []) as { delegate_id: string }[]).some((r) => r.delegate_id === delegateId);
}

/** Open tables this delegate sits at in one time slot. */
async function myOpenAtSlot(delegateId: string, day: number, startsAt: string) {
  const { data, error } = await tpService()
    .from("tp_circle_members")
    .select("circle_id, circle:tp_circles!inner(title, day, starts_at, status)")
    .eq("delegate_id", delegateId)
    .eq("circle.status", "open")
    .eq("circle.day", day)
    .eq("circle.starts_at", startsAt)
    .order("joined_at")
    .order("circle_id");
  if (error) return null;
  return ((data ?? []) as unknown as { circle_id: string; circle: { title: string } }[]).map((r) => ({
    id: r.circle_id,
    title: r.circle.title,
  }));
}

/** Ids of this delegate's open hosted tables, oldest first. */
async function openHostedIds(delegateId: string): Promise<string[] | null> {
  const { data, error } = await tpService()
    .from("tp_circles")
    .select("id")
    .eq("host_delegate_id", delegateId)
    .eq("status", "open")
    .order("created_at")
    .order("id");
  return error ? null : ((data ?? []) as { id: string }[]).map((r) => r.id);
}

async function openHostedCount(delegateId: string): Promise<number | null> {
  const { count, error } = await tpService()
    .from("tp_circles")
    .select("id", { count: "exact", head: true })
    .eq("host_delegate_id", delegateId)
    .eq("status", "open");
  return error ? null : count ?? 0;
}

const clashMessage = (title: string) =>
  `You are already at "${title}" at that time. Leave it first to pick another table.`;

/** Sample passes only meet sample tables, real passes only real ones. */
const sampleMismatch = (tableIsSample: boolean) =>
  tableIsSample
    ? "This is a sample table for the demo. Real delegates cannot join it."
    : "This sample pass can only join sample tables.";

export async function joinCircle(me: { id: string; is_sample: boolean }, circleId: string): Promise<TpResult> {
  if (typeof circleId !== "string" || !UUID.test(circleId)) return { success: false, error: "Table not found" };
  const c = await getCircle(circleId);
  if (!c) return { success: false, error: "Table not found" };
  if (c.is_sample !== me.is_sample) return { success: false, error: sampleMismatch(c.is_sample) };
  if (c.status !== "open") return { success: false, error: "This table was cancelled" };
  const delegateId = me.id;

  const before = await memberCount(c.id);
  if (before === null) return { success: false, error: TRY_AGAIN };
  if (before >= c.seats) return { success: false, error: "This table is full" };
  const busy = await myOpenAtSlot(delegateId, c.day, c.starts_at);
  if (busy === null) return { success: false, error: TRY_AGAIN };
  if (busy.some((b) => b.id === c.id)) return { success: false, error: "You are already at this table" };
  if (busy.length > 0) return { success: false, error: clashMessage(busy[0].title) };

  const db = tpService();
  const { error } = await db.from("tp_circle_members").insert({ circle_id: c.id, delegate_id: delegateId });
  if (error) {
    if (error.code === "23505") return { success: false, error: "You are already at this table" };
    return { success: false, error: TRY_AGAIN };
  }

  // Re-check now that my seat is saved: two taps at once can both pass above.
  const takeBack = async (msg: string): Promise<TpResult> => {
    await db.from("tp_circle_members").delete().eq("circle_id", c.id).eq("delegate_id", delegateId);
    return { success: false, error: msg };
  };
  const seated = await holdsSeat(c.id, delegateId, c.seats);
  if (seated === null) return takeBack(TRY_AGAIN);
  if (!seated) return takeBack("This table just filled up");
  // At one table per time slot: the earliest join in this slot wins.
  const busyAfter = await myOpenAtSlot(delegateId, c.day, c.starts_at);
  if (busyAfter === null) return takeBack(TRY_AGAIN);
  if (busyAfter.length > 0 && busyAfter[0].id !== c.id) return takeBack(clashMessage(busyAfter[0].title));
  return { success: true, data: null };
}

export async function leaveCircle(delegateId: string, circleId: string): Promise<TpResult> {
  if (typeof circleId !== "string" || !UUID.test(circleId)) return { success: false, error: "Table not found" };
  const c = await getCircle(circleId);
  if (!c) return { success: false, error: "Table not found" };
  if (c.host_delegate_id === delegateId) {
    return { success: false, error: "You host this table. Cancel it instead if you cannot make it." };
  }
  const { data, error } = await tpService()
    .from("tp_circle_members")
    .delete()
    .eq("circle_id", c.id)
    .eq("delegate_id", delegateId)
    .select("circle_id");
  if (error) return { success: false, error: TRY_AGAIN };
  if (!data?.length) return { success: false, error: "You are not at this table" };
  return { success: true, data: null };
}

/** Shared form checks. Returns the clean values or an error message. */
async function readInput(
  input: TableInput,
  seats: { min: number; max: number }
): Promise<{ ok: true; v: Omit<TableInput, "slot"> & { day: number; starts_at: string } } | { ok: false; error: string }> {
  if (!input || typeof input !== "object") return { ok: false, error: "Fill in the form" };
  const title = (typeof input.title === "string" ? input.title : "").trim().replace(/\s+/g, " ");
  const about = (typeof input.about === "string" ? input.about : "").trim();
  if (title.length < 3) return { ok: false, error: "Give the table a topic (at least 3 letters)" };
  if (title.length > TABLE_TITLE_MAX) return { ok: false, error: `Keep the topic under ${TABLE_TITLE_MAX} characters` };
  if (about.length > TABLE_ABOUT_MAX) return { ok: false, error: `Keep the description under ${TABLE_ABOUT_MAX} characters` };
  const place = typeof input.place === "string" ? input.place : "";
  if (!(TP_TABLE_PLACES as readonly string[]).includes(place)) return { ok: false, error: "Pick a lounge table" };
  const n = Number(input.seats);
  if (!Number.isInteger(n) || n < seats.min || n > seats.max) {
    return { ok: false, error: `Seats must be between ${seats.min} and ${seats.max}` };
  }
  const slot = (await getNetworkingSlots()).find((s) => s.key === input.slot);
  if (!slot) return { ok: false, error: "Pick one of the networking times" };
  return { ok: true, v: { title, about, place, seats: n, day: slot.day, starts_at: slot.starts_at } };
}

const placeTaken = (place: string) => `${place} is already booked at that time. Pick another lounge table.`;

export async function startCircle(
  host: { id: string; is_sample: boolean },
  input: TableInput
): Promise<TpResult<{ id: string }>> {
  const r = await readInput(input, DELEGATE_SEATS);
  if (!r.ok) return { success: false, error: r.error };
  const v = r.v;

  const hosted = await openHostedCount(host.id);
  if (hosted === null) return { success: false, error: TRY_AGAIN };
  if (hosted >= HOST_CAP) return { success: false, error: `You can host at most ${HOST_CAP} tables` };
  const busy = await myOpenAtSlot(host.id, v.day, v.starts_at);
  if (busy === null) return { success: false, error: TRY_AGAIN };
  if (busy.length > 0) return { success: false, error: clashMessage(busy[0].title) };

  const db = tpService();
  const { data: made, error } = await db
    .from("tp_circles")
    .insert({
      title: v.title,
      about: v.about || null,
      host_delegate_id: host.id,
      created_by_organiser: false,
      day: v.day,
      starts_at: v.starts_at,
      place: v.place,
      seats: v.seats,
      is_sample: host.is_sample,
    })
    .select("id")
    .single();
  if (error || !made) {
    if (error?.code === "23505") return { success: false, error: placeTaken(v.place) };
    return { success: false, error: TRY_AGAIN };
  }
  const takeBack = async (msg: string): Promise<TpResult<{ id: string }>> => {
    // My own table, made a moment ago in this call: its member row cascades.
    await db.from("tp_circles").delete().eq("id", made.id).eq("host_delegate_id", host.id);
    return { success: false, error: msg };
  };
  const { error: mErr } = await db.from("tp_circle_members").insert({ circle_id: made.id, delegate_id: host.id });
  if (mErr) return takeBack(TRY_AGAIN);

  const hostedAfter = await openHostedIds(host.id);
  if (hostedAfter === null) return takeBack(TRY_AGAIN);
  if (!hostedAfter.slice(0, HOST_CAP).includes(made.id)) return takeBack(`You can host at most ${HOST_CAP} tables`);
  const busyAfter = await myOpenAtSlot(host.id, v.day, v.starts_at);
  if (busyAfter === null) return takeBack(TRY_AGAIN);
  if (busyAfter.length > 0 && busyAfter[0].id !== made.id) return takeBack(clashMessage(busyAfter[0].title));
  return { success: true, data: { id: made.id } };
}

/** A host cancels their own table. Members are kept but the slot frees up. */
export async function cancelOwnCircle(hostId: string, circleId: string): Promise<TpResult> {
  if (typeof circleId !== "string" || !UUID.test(circleId)) return { success: false, error: "Table not found" };
  const { data, error } = await tpService()
    .from("tp_circles")
    .update({ status: "cancelled" })
    .eq("id", circleId)
    .eq("host_delegate_id", hostId)
    .eq("status", "open")
    .select("id");
  if (error) return { success: false, error: TRY_AGAIN };
  if (!data?.length) return { success: false, error: "This table is not yours or is already cancelled" };
  return { success: true, data: null };
}

export async function createOrganiserCircle(input: TableInput): Promise<TpResult<{ id: string }>> {
  const r = await readInput(input, ORGANISER_SEATS);
  if (!r.ok) return { success: false, error: r.error };
  const v = r.v;
  const { data, error } = await tpService()
    .from("tp_circles")
    .insert({
      title: v.title,
      about: v.about || null,
      host_delegate_id: null,
      created_by_organiser: true,
      day: v.day,
      starts_at: v.starts_at,
      place: v.place,
      seats: v.seats,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { success: false, error: placeTaken(v.place) };
    return { success: false, error: TRY_AGAIN };
  }
  return { success: true, data: { id: data.id } };
}

export async function cancelCircleAsOrganiser(circleId: string): Promise<TpResult> {
  if (typeof circleId !== "string" || !UUID.test(circleId)) return { success: false, error: "Table not found" };
  const { data, error } = await tpService()
    .from("tp_circles")
    .update({ status: "cancelled" })
    .eq("id", circleId)
    .eq("status", "open")
    .select("id");
  if (error) return { success: false, error: TRY_AGAIN };
  if (!data?.length) return { success: false, error: "This table is already cancelled" };
  return { success: true, data: null };
}
