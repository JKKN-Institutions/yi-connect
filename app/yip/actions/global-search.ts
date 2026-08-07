"use server";

/**
 * Global dashboard search — one box that finds participants, events and
 * ministries across everything THIS USER may see.
 *
 * Scoping mirrors app/yip/dashboard/page.tsx exactly (the two-role-per-chapter
 * model, 2026-06-01):
 *   - Super-admin (national)     → ALL events
 *   - Regional admin             → events in their assigned zone(s)
 *   - Chapter admin / organiser  → CHAPTER-level events for their chapter(s)
 *   - Plus everyone: events they created
 * Fail CLOSED: no session → error; no scopes and not super admin → the .or()
 * collapses to created_by only, so a scope-less user sees nothing beyond their
 * own events — never all-events.
 */
import { createClient } from "@/lib/yip/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  getRegionalAdminZones,
  getYipChapterScopes,
} from "@/lib/yi/auth/yi-directory-roles";
import { effectiveMinistries } from "@/lib/yip/cabinet";

type ParticipantHit = {
  id: string;
  name: string;
  constituencyName: string | null;
  eventId: string;
  eventName: string;
};

type EventHit = {
  id: string;
  name: string;
  chapterName: string | null;
  status: string;
};

type MinistryHit = {
  key: string;
  label: string;
  eventId: string;
  eventName: string;
};

type SearchResults = {
  participants: ParticipantHit[];
  events: EventHit[];
  ministries: MinistryHit[];
};

type SearchResponse =
  | { success: true; results: SearchResults }
  | { success: false; error: string };

const EMPTY: SearchResults = { participants: [], events: [], ministries: [] };

export async function searchEverything(query: string): Promise<SearchResponse> {
  const q = (query ?? "").trim();
  if (q.length < 2) return { success: true, results: EMPTY };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // ── Resolve the caller's allowed event set FIRST (authorization boundary,
  // same query shape as the dashboard events grid) ─────────────────────────
  const isSuper = await isCurrentUserSuperAdmin();
  const regionalZones = isSuper ? [] : await getRegionalAdminZones("yip");
  const myChapters = isSuper ? [] : await getYipChapterScopes("yip");

  let eventsQuery = supabase
    .from("events")
    .select("id, name, chapter_name, status, cabinet_ministries");
  if (!isSuper) {
    const ors = [`created_by.eq.${user.id}`];
    if (regionalZones.length > 0) {
      ors.push(`yi_zone_code.in.(${regionalZones.map((z) => `"${z}"`).join(",")})`);
    }
    if (myChapters.length > 0) {
      // Chapter chairs / organisers are scoped to CHAPTER-level events only
      // (regional/national events belong to RM / national roles).
      ors.push(
        `and(chapter_name.in.(${myChapters
          .map((c) => `"${c}"`)
          .join(",")}),level.eq.chapter)`
      );
    }
    eventsQuery = eventsQuery.or(ors.join(","));
  }
  const { data: allowedEvents, error: eventsError } = await eventsQuery;
  if (eventsError) return { success: false, error: eventsError.message };

  const allowed = allowedEvents ?? [];
  if (allowed.length === 0) return { success: true, results: EMPTY };

  const eventNameById = new Map(allowed.map((e) => [e.id, e.name]));
  const allowedIds = allowed.map((e) => e.id);
  const qLower = q.toLowerCase();

  // ── Events: name / chapter substring within the allowed set ──────────────
  const events: EventHit[] = allowed
    .filter(
      (e) =>
        e.name.toLowerCase().includes(qLower) ||
        (e.chapter_name ?? "").toLowerCase().includes(qLower)
    )
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      name: e.name,
      chapterName: e.chapter_name,
      status: e.status,
    }));

  // ── Ministries: effective cabinet labels of the allowed events ───────────
  const ministries: MinistryHit[] = [];
  for (const e of allowed) {
    if (ministries.length >= 10) break;
    for (const m of effectiveMinistries(e.cabinet_ministries)) {
      if (ministries.length >= 10) break;
      if (
        m.label.toLowerCase().includes(qLower) ||
        m.key.toLowerCase().includes(qLower)
      ) {
        ministries.push({
          key: m.key,
          label: m.label,
          eventId: e.id,
          eventName: e.name,
        });
      }
    }
  }

  // ── Participants: ILIKE within allowed events only ───────────────────────
  // Strip characters that would break the PostgREST .or() grammar or inject
  // LIKE wildcards; if nothing searchable survives, skip the DB roundtrip.
  const safe = q.replace(/[%_,()"\\]/g, " ").trim();
  let participants: ParticipantHit[] = [];
  if (safe.length >= 2) {
    const like = `%${safe}%`;
    const { data: pRows, error: pError } = await supabase
      .from("participants")
      .select("id, full_name, constituency_name, event_id")
      .in("event_id", allowedIds)
      .or(`full_name.ilike.${like},constituency_name.ilike.${like}`)
      .limit(15);
    if (pError) return { success: false, error: pError.message };
    participants = (pRows ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      constituencyName: p.constituency_name,
      eventId: p.event_id,
      eventName: eventNameById.get(p.event_id) ?? "",
    }));
  }

  return { success: true, results: { participants, events, ministries } };
}
