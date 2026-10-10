import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { tpService } from "./supabase";
import { isToken } from "./auth";
import { BADGE_SECRET_ALPHABET, BADGE_SECRET_LENGTH, fullBadgeCode, type ParsedBadge } from "./badge";

/*
 * Badge secrets, scan limits, scan-to-connect and "My people".
 *
 * Every function that takes a pass token resolves "me" from it here, on the
 * server. The browser only ever names the OTHER person.
 *
 * Privacy: a delegate's phone and email are fetched ONLY for people who are
 * mutually connected with me (a scan, or an accepted delegate meeting) AND
 * when both of us have share_contact = true. They are never selected for
 * anyone else, so they cannot leak through a page's props. Each side's note
 * and follow-up date are private to that side.
 */

export const SCAN_LIMIT_PER_HOUR = 60;
export const PEOPLE_NOTE_MAX = 500;
/** One message for a wrong secret and an unknown number, so a guess learns nothing. */
export const BADGE_UNREADABLE = "That badge could not be read. Scan the QR on the badge, or type the full code under it, like TP26-1234-K7QXM.";
/**
 * When only the number was typed ("TP26-1234"). The browser already knows the
 * secret is missing, so saying so leaks nothing, and it tells a partner who
 * read the big number off a pass what to type instead.
 */
export const BADGE_NEEDS_SECRET =
  "That is only the badge number. Scan the QR on the badge, or type the full code shown under it, like TP26-1234-K7QXM (the 5 letters at the end are needed).";

export function newBadgeSecret(): string {
  let s = "";
  for (let i = 0; i < BADGE_SECRET_LENGTH; i++) s += BADGE_SECRET_ALPHABET[randomInt(BADGE_SECRET_ALPHABET.length)];
  return s;
}

/** Timing-safe: both sides are hashed to equal-length buffers first. A missing stored secret never matches. */
export function secretMatches(stored: string | null | undefined, given: string | null | undefined): boolean {
  const a = createHash("sha256").update((stored ?? "").toUpperCase()).digest();
  const b = createHash("sha256").update((given ?? "").toUpperCase()).digest();
  const same = timingSafeEqual(a, b);
  return same && !!stored && !!given;
}

export type BadgeHolder = {
  id: string;
  full_name: string;
  chapter: string;
  business_name: string | null;
  role_title: string | null;
};

/** The delegate behind a scanned badge, ONLY when its secret is right. */
export async function findDelegateByVerifiedBadge(b: ParsedBadge | null): Promise<BadgeHolder | null> {
  if (!b) return null;
  const { data } = await tpService()
    .from("tp_delegates")
    .select("id, full_name, chapter, business_name, role_title, badge_secret")
    .eq("badge_code", b.code)
    .maybeSingle();
  const row = data as (BadgeHolder & { badge_secret: string | null }) | null;
  // Compare even when no row was found, so a miss takes the same time as a wrong secret.
  const ok = secretMatches(row?.badge_secret ?? "unused-placeholder", b.secret);
  if (!row || !ok) return null;
  return { id: row.id, full_name: row.full_name, chapter: row.chapter, business_name: row.business_name, role_title: row.role_title };
}

export type ScanActor = { partnerId: string } | { delegateId: string };

/**
 * Records one scan attempt (right or wrong) and says whether the actor is
 * still under SCAN_LIMIT_PER_HOUR, counting this attempt. Insert first, then
 * count, so parallel scans cannot slip past the cap. FAILS CLOSED: if either
 * call errors, the scan is refused.
 */
export type ScanGate =
  | { allowed: true; attemptId: string }
  /** "limit": the hourly cap is reached. "error": the database failed, so a retry may work. */
  | { allowed: false; reason: "limit" | "error"; attemptId: string | null };

export async function recordScan(actor: ScanActor): Promise<ScanGate> {
  const db = tpService();
  const col = "partnerId" in actor ? "partner_id" : "delegate_id";
  const id = "partnerId" in actor ? actor.partnerId : actor.delegateId;
  const { data: made, error } = await db.from("tp_scan_attempts").insert({ [col]: id }).select("id").single();
  if (error || !made) return { allowed: false, reason: "error", attemptId: null };
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: cErr } = await db
    .from("tp_scan_attempts")
    .select("id", { count: "exact", head: true })
    .eq(col, id)
    .gte("created_at", since);
  if (cErr || count === null) return { allowed: false, reason: "error", attemptId: made.id };
  if (count > SCAN_LIMIT_PER_HOUR) return { allowed: false, reason: "limit", attemptId: made.id };
  return { allowed: true, attemptId: made.id };
}

export async function markScanOk(attemptId: string | null): Promise<void> {
  if (!attemptId) return;
  await tpService().from("tp_scan_attempts").update({ ok: true }).eq("id", attemptId);
}

export const SCAN_LIMIT_MESSAGE = `You have scanned ${SCAN_LIMIT_PER_HOUR} badges in the last hour. Wait a little, then scan again.`;

// ------------------------------------------------------------- "me" ----

export type ConnectMe = {
  id: string;
  token: string;
  full_name: string;
  chapter: string;
  badge_code: string;
  badge_secret: string | null;
  share_contact: boolean;
  is_sample: boolean;
};

export async function getConnectMe(token: string): Promise<ConnectMe | null> {
  if (!isToken(token)) return null;
  const { data } = await tpService()
    .from("tp_delegates")
    .select("id, token, full_name, chapter, badge_code, badge_secret, share_contact, is_sample")
    .eq("token", token)
    .maybeSingle();
  return (data as ConnectMe | null) ?? null;
}

/** Whether the desk has a phone or email on file for ME (my own page only). */
export async function iHaveContact(meId: string): Promise<boolean> {
  const { data } = await tpService().from("tp_delegates").select("phone, email").eq("id", meId).maybeSingle();
  const r = data as { phone: string | null; email: string | null } | null;
  return !!(r?.phone || r?.email);
}

/** The code printed on my badge and in my QR, e.g. "TP26-1234-K7QXM". */
export function myFullBadge(me: Pick<ConnectMe, "badge_code" | "badge_secret">): string {
  return fullBadgeCode(me.badge_code, me.badge_secret);
}

// ---------------------------------------------------------- connect ----

export type ConnectOutcome =
  | { kind: "connected"; person: BadgeHolder }
  | { kind: "already"; person: BadgeHolder }
  | { kind: "self" }
  | { kind: "error" };

/** What the scanner sees after a scan: who they just connected with. */
export type ConnectResult = {
  already: boolean;
  name: string;
  chapter: string;
  business: string | null;
  role: string | null;
};

/** Both orderings of one pair, for a PostgREST .or() filter. */
function pairFilter(x: string, y: string): string {
  return `and(a_delegate_id.eq.${x},b_delegate_id.eq.${y}),and(a_delegate_id.eq.${y},b_delegate_id.eq.${x})`;
}

/**
 * Mutual connection: one row per pair, whoever scanned first. If the pair's
 * row already exists only to hold a meeting note (scanned = false), this
 * first real scan marks it scanned.
 */
export async function connectTo(me: ConnectMe, other: BadgeHolder): Promise<ConnectOutcome> {
  if (other.id === me.id) return { kind: "self" };
  const db = tpService();
  const { error } = await db.from("tp_connections").insert({ a_delegate_id: me.id, b_delegate_id: other.id });
  if (!error) return { kind: "connected", person: other };
  if (error.code !== "23505") return { kind: "error" };
  // Find the pair's row first: PostgREST rejects an or() filter on an UPDATE here.
  const { data: row, error: fErr } = await db
    .from("tp_connections")
    .select("id, scanned")
    .or(pairFilter(me.id, other.id))
    .maybeSingle();
  if (fErr || !row) return { kind: "error" };
  if ((row as { scanned: boolean }).scanned) return { kind: "already", person: other };
  const { data, error: uErr } = await db
    .from("tp_connections")
    .update({ scanned: true })
    .eq("id", (row as { id: string }).id)
    .eq("scanned", false)
    .select("id");
  if (uErr) return { kind: "error" };
  return { kind: data?.length ? "connected" : "already", person: other };
}

// -------------------------------------------------------- My people ----

export type MyPerson = {
  id: string;
  full_name: string;
  chapter: string;
  business_name: string | null;
  role_title: string | null;
  scanned: boolean;
  meeting: boolean;
  since: string;
  /** MY note and follow-up only. Theirs is never read. */
  note: string | null;
  follow_up: string | null;
  /** Filled only when both of us share. */
  phone: string | null;
  email: string | null;
  /** Shown only when I share too (so a non-sharer learns nothing about who shares). */
  they_share: boolean | null;
};

type ConnRow = {
  id: string;
  a_delegate_id: string;
  b_delegate_id: string;
  created_at: string;
  scanned: boolean;
  note_a: string | null;
  note_b: string | null;
  follow_up_a: string | null;
  follow_up_b: string | null;
};

type MeetRow = { from_delegate_id: string; to_delegate_id: string; responded_at: string | null; created_at: string };

const CONN_COLS = "id, a_delegate_id, b_delegate_id, created_at, scanned, note_a, note_b, follow_up_a, follow_up_b";

async function myLinks(meId: string): Promise<{ conns: ConnRow[]; meets: MeetRow[] }> {
  const db = tpService();
  const [c, m] = await Promise.all([
    db.from("tp_connections").select(CONN_COLS).or(`a_delegate_id.eq.${meId},b_delegate_id.eq.${meId}`),
    db
      .from("tp_delegate_meetings")
      .select("from_delegate_id, to_delegate_id, responded_at, created_at")
      .eq("status", "accepted")
      .or(`from_delegate_id.eq.${meId},to_delegate_id.eq.${meId}`),
  ]);
  if (c.error) throw new Error(c.error.message);
  if (m.error) throw new Error(m.error.message);
  const meets = (m.data ?? []) as MeetRow[];
  const met = new Set(meets.map((x) => (x.from_delegate_id === meId ? x.to_delegate_id : x.from_delegate_id)));
  // A note-only row (scanned = false) counts only while its meeting is accepted.
  const conns = ((c.data ?? []) as ConnRow[]).filter(
    (x) => x.scanned || met.has(x.a_delegate_id === meId ? x.b_delegate_id : x.a_delegate_id)
  );
  return { conns, meets };
}

/** My connections (scanned either way) plus delegates I have an accepted meeting with. */
export async function getMyPeople(me: Pick<ConnectMe, "id" | "share_contact">): Promise<MyPerson[]> {
  const { conns, meets } = await myLinks(me.id);
  type Acc = { scanned: boolean; meeting: boolean; since: string; note: string | null; follow_up: string | null };
  const acc = new Map<string, Acc>();
  for (const c of conns) {
    const mine = c.a_delegate_id === me.id;
    const other = mine ? c.b_delegate_id : c.a_delegate_id;
    acc.set(other, {
      scanned: c.scanned,
      meeting: false,
      since: c.created_at,
      note: mine ? c.note_a : c.note_b,
      follow_up: mine ? c.follow_up_a : c.follow_up_b,
    });
  }
  for (const m of meets) {
    const other = m.from_delegate_id === me.id ? m.to_delegate_id : m.from_delegate_id;
    const prev = acc.get(other);
    if (prev) {
      prev.meeting = true;
      // A note-only row's created_at is when the note was written, not when we met.
      if (!prev.scanned) prev.since = m.responded_at ?? m.created_at;
    } else acc.set(other, { scanned: false, meeting: true, since: m.responded_at ?? m.created_at, note: null, follow_up: null });
  }
  if (acc.size === 0) return [];

  const db = tpService();
  const ids = [...acc.keys()];
  const { data, error } = await db
    .from("tp_delegates")
    .select("id, full_name, chapter, business_name, role_title, share_contact")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const people = (data ?? []) as (Omit<BadgeHolder, never> & { share_contact: boolean })[];

  // Contact details: only both-share, only these mutual ids.
  const contacts = new Map<string, { phone: string | null; email: string | null }>();
  const sharing = me.share_contact ? people.filter((p) => p.share_contact).map((p) => p.id) : [];
  if (sharing.length) {
    const { data: cd, error: cErr } = await db.from("tp_delegates").select("id, phone, email").in("id", sharing);
    if (cErr) throw new Error(cErr.message);
    for (const r of (cd ?? []) as { id: string; phone: string | null; email: string | null }[]) contacts.set(r.id, r);
  }

  return people
    .map((p) => {
      const a = acc.get(p.id)!;
      const c = contacts.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        chapter: p.chapter,
        business_name: p.business_name,
        role_title: p.role_title,
        scanned: a.scanned,
        meeting: a.meeting,
        since: a.since,
        note: a.note,
        follow_up: a.follow_up,
        phone: c?.phone ?? null,
        email: c?.email ?? null,
        they_share: me.share_contact ? p.share_contact : null,
      };
    })
    .sort((x, y) => (y.since > x.since ? 1 : y.since < x.since ? -1 : x.full_name.localeCompare(y.full_name)));
}

/**
 * Saves MY note and follow-up for one person in My people. The person must
 * be mutual (a scan or an accepted delegate meeting). For a meeting-only
 * person a note-only connection row (scanned = false) is created here,
 * holding my side only; it does not show either of us as "Connected".
 */
export async function saveMyNote(
  me: Pick<ConnectMe, "id">,
  otherId: string,
  note: string | null,
  followUp: string | null
): Promise<"ok" | "not_mutual" | "error"> {
  const db = tpService();
  const { conns, meets } = await myLinks(me.id);
  const conn = conns.find((c) => c.a_delegate_id === otherId || c.b_delegate_id === otherId);
  const meeting = meets.some((m) => m.from_delegate_id === otherId || m.to_delegate_id === otherId);
  if (!conn && !meeting) return "not_mutual";

  const update = async (c: Pick<ConnRow, "id" | "a_delegate_id">) => {
    const mine = c.a_delegate_id === me.id;
    const patch = mine ? { note_a: note, follow_up_a: followUp } : { note_b: note, follow_up_b: followUp };
    const { data, error } = await db.from("tp_connections").update(patch).eq("id", c.id).select("id");
    return !error && !!data?.length;
  };

  if (conn) return (await update(conn)) ? "ok" : "error";
  const { error } = await db
    .from("tp_connections")
    .insert({ a_delegate_id: me.id, b_delegate_id: otherId, scanned: false, note_a: note, follow_up_a: followUp });
  if (!error) return "ok";
  if (error.code !== "23505") return "error";
  // They scanned me a moment ago: their row exists now, so write my side of it.
  const again = await myLinks(me.id);
  const row = again.conns.find((c) => c.a_delegate_id === otherId || c.b_delegate_id === otherId);
  return row && (await update(row)) ? "ok" : "error";
}

// ------------------------------------------------------------ vCard ----

/** vCard 3.0 text value: backslash, comma, semicolon and newlines escaped. */
export function vcardEscape(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Folds a content line at 75 octets (RFC 2425), never splitting a UTF-8 character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** One vCard per person. Phone/email are already null unless both share. */
export function buildVcards(people: MyPerson[], eventName: string): string {
  const cards = people.map((p) => {
    const parts = p.full_name.trim().split(/\s+/);
    const family = parts.length > 1 ? parts[parts.length - 1] : "";
    const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "";
    const noteBits = [`Met at ${eventName}`, `Yi ${p.chapter} chapter`];
    if (p.note) noteBits.push(`My note: ${p.note}`);
    if (p.follow_up) noteBits.push(`Follow up by ${p.follow_up}`);
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${vcardEscape(family)};${vcardEscape(given)};;;`,
      `FN:${vcardEscape(p.full_name)}`,
    ];
    if (p.business_name) lines.push(`ORG:${vcardEscape(p.business_name)}`);
    if (p.role_title) lines.push(`TITLE:${vcardEscape(p.role_title)}`);
    if (p.phone) lines.push(`TEL;TYPE=CELL:${vcardEscape(p.phone)}`);
    if (p.email) lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(p.email)}`);
    lines.push(`NOTE:${vcardEscape(noteBits.join(". "))}`);
    lines.push("END:VCARD");
    return lines.map(fold).join("\r\n");
  });
  return cards.join("\r\n") + (cards.length ? "\r\n" : "");
}
