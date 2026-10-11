import "server-only";

import { tpService } from "../supabase";
import {
  CARD_CLAIM_BATCH,
  CARD_DAILY_LIMIT,
  CARD_EXPIRE_HOURS,
  CARD_RESPONSE_BUDGET,
  CARD_STALE_MINUTES,
  istDayStartIso,
  type CardContactFields,
} from "./schemas";

/*
 * Business-card scans (tp_card_scans) and the contacts read off them
 * (tp_card_contacts). Callers MUST pass a gate first: a delegate's pass
 * token resolved to a delegate id on the server, or the routine's
 * X-Cron-Secret. Every function here trusts the delegate id it is given,
 * and every delegate read or write is filtered by that id.
 *
 * Privacy: the photo is deleted (image_jpeg_b64 = NULL) as soon as the
 * routine has read it, when the read fails, and when nobody read it within
 * CARD_EXPIRE_HOURS. Contacts are private to the delegate who scanned them.
 */

export type ScanStatus = "pending" | "generating" | "ready" | "failed";

export type CardScan = {
  id: string;
  status: ScanStatus;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CardContact = CardContactFields & {
  id: string;
  scan_id: string | null;
  created_at: string;
};

const SCAN_COLS = "id, status, error, created_at, completed_at";
const CONTACT_COLS = "id, scan_id, full_name, title, company, phone, email, website, city, note, created_at";
const GENERIC = "Something went wrong. Please try again.";
export const CARD_LIMIT_MESSAGE = `You can scan ${CARD_DAILY_LIMIT} cards a day. Try again tomorrow.`;

// --------------------------------------------------------- delegate ----

export type EnqueueScanResult = { ok: true; scanId: string } | { ok: false; error: string };

/**
 * Store one photo as a pending scan. Counts every scan started today (IST),
 * whatever its status. Two uploads at once can both pass the first count, so
 * the count runs again after the insert, ordered by arrival: rows past the
 * limit take themselves back. Every check fails CLOSED.
 */
export async function enqueueScan(delegateId: string, b64: string): Promise<EnqueueScanResult> {
  const db = tpService();
  const since = istDayStartIso();
  const { count, error } = await db
    .from("tp_card_scans")
    .select("id", { count: "exact", head: true })
    .eq("delegate_id", delegateId)
    .gte("created_at", since);
  if (error || count === null) return { ok: false, error: GENERIC };
  if (count >= CARD_DAILY_LIMIT) return { ok: false, error: CARD_LIMIT_MESSAGE };

  const { data, error: iErr } = await db
    .from("tp_card_scans")
    .insert({ delegate_id: delegateId, image_jpeg_b64: b64, status: "pending" })
    .select("id")
    .single();
  if (iErr || !data) return { ok: false, error: GENERIC };
  const id = (data as { id: string }).id;

  const { data: first, error: fErr } = await db
    .from("tp_card_scans")
    .select("id")
    .eq("delegate_id", delegateId)
    .gte("created_at", since)
    .order("created_at")
    .order("id")
    .limit(CARD_DAILY_LIMIT);
  if (fErr || !first || !(first as { id: string }[]).some((r) => r.id === id)) {
    await db.from("tp_card_scans").delete().eq("id", id);
    return { ok: false, error: fErr || !first ? GENERIC : CARD_LIMIT_MESSAGE };
  }
  return { ok: true, scanId: id };
}

export async function scansUsedToday(delegateId: string): Promise<number | null> {
  const { count, error } = await tpService()
    .from("tp_card_scans")
    .select("id", { count: "exact", head: true })
    .eq("delegate_id", delegateId)
    .gte("created_at", istDayStartIso());
  // A missing count is unreadable too (a HEAD request can fail without an error object).
  return error || count === null ? null : count;
}

/**
 * Scans still waiting, plus scans that FAILED in the last day (by completed_at, so a scan
 * expired after 24h unread still shows as "Could not be read"). Never the photo.
 * A read error is an empty list.
 */
export async function listOpenScans(delegateId: string): Promise<CardScan[]> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await tpService()
    .from("tp_card_scans")
    .select(SCAN_COLS)
    .eq("delegate_id", delegateId)
    .or(`status.in.(pending,generating),and(status.eq.failed,completed_at.gte."${dayAgo}")`)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return [];
  return (data ?? []) as CardScan[];
}

/** My contacts, newest first. A read error is an empty list. */
export async function listCardContacts(delegateId: string, limit = 200): Promise<CardContact[]> {
  const { data, error } = await tpService()
    .from("tp_card_contacts")
    .select(CONTACT_COLS)
    .eq("delegate_id", delegateId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CardContact[];
}

export async function getCardContact(delegateId: string, contactId: string): Promise<CardContact | null> {
  const { data, error } = await tpService()
    .from("tp_card_contacts")
    .select(CONTACT_COLS)
    .eq("id", contactId)
    .eq("delegate_id", delegateId)
    .maybeSingle();
  if (error) return null;
  return (data as CardContact | null) ?? null;
}

/** True only when exactly my row was changed. */
export async function updateCardContact(delegateId: string, contactId: string, fields: CardContactFields): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_card_contacts")
    .update(fields)
    .eq("id", contactId)
    .eq("delegate_id", delegateId)
    .select("id");
  return !error && (data ?? []).length === 1;
}

export async function deleteCardContact(delegateId: string, contactId: string): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_card_contacts")
    .delete()
    .eq("id", contactId)
    .eq("delegate_id", delegateId)
    .select("id");
  return !error && (data ?? []).length === 1;
}

// ---------------------------------------------------------- routine ----

/** Pending or generating scans older than CARD_EXPIRE_HOURS: photo deleted, scan failed. */
export async function expireOldScans(): Promise<number> {
  const cutoff = new Date(Date.now() - CARD_EXPIRE_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await tpService()
    .from("tp_card_scans")
    .update({
      status: "failed",
      image_jpeg_b64: null,
      error: `Not read within ${CARD_EXPIRE_HOURS} hours`,
      completed_at: new Date().toISOString(),
    })
    .in("status", ["pending", "generating"])
    .lt("created_at", cutoff)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

/** Any finished scan that still holds a photo loses it (belt and braces). */
export async function purgeFinishedPhotos(): Promise<number> {
  const { data, error } = await tpService()
    .from("tp_card_scans")
    .update({ image_jpeg_b64: null })
    .in("status", ["ready", "failed"])
    .not("image_jpeg_b64", "is", null)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

/** Scans stuck in 'generating' longer than CARD_STALE_MINUTES go back to 'pending', if they still have a photo. */
export async function resetStaleScans(): Promise<number> {
  const cutoff = new Date(Date.now() - CARD_STALE_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await tpService()
    .from("tp_card_scans")
    .update({ status: "pending", claimed_at: null })
    .eq("status", "generating")
    .lt("claimed_at", cutoff)
    .not("image_jpeg_b64", "is", null)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

export type ClaimedScan = { id: string; image_jpeg_b64: string; created_at: string };

/**
 * Claim up to CARD_CLAIM_BATCH pending scans with a photo, oldest first.
 * The update is guarded by status='pending', so two drains at once never
 * hand out the same row. Photos past CARD_RESPONSE_BUDGET (base64
 * characters, to stay under Vercel's response limit) are released back to
 * 'pending' for the next GET; the first photo is always kept.
 */
export async function claimScans(): Promise<{ scans: ClaimedScan[]; released: number }> {
  const db = tpService();
  const { data: ids, error } = await db
    .from("tp_card_scans")
    .select("id")
    .eq("status", "pending")
    .not("image_jpeg_b64", "is", null)
    .order("created_at")
    .limit(CARD_CLAIM_BATCH);
  if (error || !ids?.length) return { scans: [], released: 0 };
  const { data, error: uErr } = await db
    .from("tp_card_scans")
    .update({ status: "generating", claimed_at: new Date().toISOString() })
    .in(
      "id",
      (ids as { id: string }[]).map((r) => r.id)
    )
    .eq("status", "pending")
    .not("image_jpeg_b64", "is", null)
    .select("id, image_jpeg_b64, created_at");
  if (uErr || !data) return { scans: [], released: 0 };
  const claimed = (data as ClaimedScan[]).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const keep: ClaimedScan[] = [];
  const release: string[] = [];
  let used = 0;
  for (const s of claimed) {
    const n = s.image_jpeg_b64?.length ?? 0;
    if (!s.image_jpeg_b64) continue;
    if (keep.length === 0 || used + n <= CARD_RESPONSE_BUDGET) {
      keep.push(s);
      used += n;
    } else {
      release.push(s.id);
    }
  }
  if (release.length) {
    await db.from("tp_card_scans").update({ status: "pending", claimed_at: null }).in("id", release).eq("status", "generating");
  }
  return { scans: keep, released: release.length };
}

export async function getScanForRoutine(scanId: string): Promise<{ id: string; delegate_id: string; status: ScanStatus } | null> {
  const { data, error } = await tpService()
    .from("tp_card_scans")
    .select("id, delegate_id, status")
    .eq("id", scanId)
    .maybeSingle();
  if (error) return null;
  return (data as { id: string; delegate_id: string; status: ScanStatus } | null) ?? null;
}

export type CompleteResult = { ok: true; contactId: string } | { ok: false; reason: "not_claimed" | "error" };

/**
 * generating -> ready, photo deleted, in ONE guarded update, so a second
 * POST for the same scan cannot create a second contact. Then the contact
 * row is created; if that fails the scan is marked failed (the photo is
 * already gone, so the delegate is asked to scan again).
 */
export async function completeScan(scanId: string, contact: CardContactFields): Promise<CompleteResult> {
  const db = tpService();
  const { data, error } = await db
    .from("tp_card_scans")
    .update({ status: "ready", image_jpeg_b64: null, error: null, completed_at: new Date().toISOString() })
    .eq("id", scanId)
    .eq("status", "generating")
    .select("id, delegate_id");
  if (error) return { ok: false, reason: "error" };
  const row = (data ?? [])[0] as { id: string; delegate_id: string } | undefined;
  if (!row) return { ok: false, reason: "not_claimed" };

  const { data: made, error: iErr } = await db
    .from("tp_card_contacts")
    .insert({ ...contact, delegate_id: row.delegate_id, scan_id: row.id })
    .select("id")
    .single();
  if (iErr || !made) {
    await db
      .from("tp_card_scans")
      .update({ status: "failed", error: "The contact could not be saved" })
      .eq("id", scanId)
      .eq("status", "ready");
    return { ok: false, reason: "error" };
  }
  return { ok: true, contactId: (made as { id: string }).id };
}

/** generating -> failed, photo deleted. */
export async function failScan(scanId: string, reason: string): Promise<boolean> {
  const { data, error } = await tpService()
    .from("tp_card_scans")
    .update({ status: "failed", image_jpeg_b64: null, error: reason.slice(0, 500), completed_at: new Date().toISOString() })
    .eq("id", scanId)
    .eq("status", "generating")
    .select("id");
  return !error && (data ?? []).length === 1;
}
