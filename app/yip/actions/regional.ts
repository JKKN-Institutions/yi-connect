"use server";

/**
 * Phase 19 / G — Regional cross-chapter leaderboard.
 *
 * Aggregates participant performance across all completed/published
 * CHAPTER-level events in a Yi zone (region) for a given Yi year.
 *
 * Cricket-style "career stats" view: events_played, total_score,
 * awards_won, speaker_count, best_event_score — joined via the Phase 12
 * `people` table so that the same student showing up in multiple chapter
 * events rolls into a single row keyed by person_id.
 *
 * Participants WITHOUT a person_id (mock seeded rows that never went
 * through Phase 12 identity stitching) are still aggregated under a
 * synthetic key (participant_id) so the leaderboard isn't empty in dev,
 * but the public route only counts real cross-event identity when
 * person_id is set.
 */

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { YI_ZONES, type YiZone } from "@/lib/yip/hierarchy";

const LEADERSHIP_ROLES = new Set<string>([
  "speaker",
  "deputy_speaker",
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
  "party_leader",
  "cabinet_minister",
  "shadow_minister",
]);

export type RegionalLeaderboardRow = {
  person_id: string; // person_id if linked, else `pid:<participant_id>` fallback
  full_name: string;
  chapter_name: string;
  school_name: string;
  events_played: number;
  total_score: number;
  awards_won: number;
  speaker_count: number;
  best_event_score: number;
};

export type RegionalLeaderboardData = {
  zone: { code: YiZone; label: string };
  year: { id: string; display_name: string; year: number } | null;
  eventsCount: number;
  rows: RegionalLeaderboardRow[];
};

/**
 * Build the leaderboard for a region.
 *
 * @param zoneCode  one of YI_ZONES codes (case-insensitive). e.g. "SRTN", "WR".
 * @param yearId    optional yip.years.id — if omitted, picks the active year.
 */
export async function getRegionalLeaderboard(
  zoneCode: string,
  yearId?: string
): Promise<RegionalLeaderboardData | null> {
  // Named minor-student scores/ranks — scores are a super-admin-tier surface
  // (2026-06-13 product decision: canViewScores = chair + super-admin). This
  // page is reachable at a public URL with no auth layer, so the gate lives in
  // the action.
  const gate = await requireSuperAdmin();
  if (!gate.ok) return null;

  const upperCode = zoneCode.toUpperCase();
  const zone = YI_ZONES.find((z) => z.code.toUpperCase() === upperCode);
  if (!zone) return null;

  const supabase = await createServiceClient();

  // Resolve year: explicit yearId wins; else pick is_active=true; else most recent.
  let resolvedYear: {
    id: string;
    display_name: string;
    year: number;
  } | null = null;

  if (yearId) {
    const { data } = await supabase
      .schema("yi")
      .from("years")
      .select("id, display_name, year")
      .eq("id", yearId)
      .maybeSingle();
    if (data) resolvedYear = data;
  } else {
    const { data: active } = await supabase
      .schema("yi")
      .from("years")
      .select("id, display_name, year")
      .eq("is_active", true)
      .maybeSingle();
    if (active) {
      resolvedYear = active;
    } else {
      const { data: latest } = await supabase
        .schema("yi")
        .from("years")
        .select("id, display_name, year")
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) resolvedYear = latest;
    }
  }

  // Pull all completed/published CHAPTER events in this zone for the year.
  let eventsQuery = supabase
    .from("events")
    .select("id, chapter_name, name, status")
    .eq("yi_zone_code", zone.code)
    .eq("level", "chapter")
    .in("status", ["completed", "results_published"]);

  if (resolvedYear) {
    eventsQuery = eventsQuery.eq("yi_year_id", resolvedYear.id);
  }

  const { data: events, error: evErr } = await eventsQuery;
  if (evErr || !events || events.length === 0) {
    return {
      zone: { code: zone.code, label: zone.label },
      year: resolvedYear,
      eventsCount: 0,
      rows: [],
    };
  }

  const eventIds = events.map((e) => e.id);
  const eventChapterById = new Map<string, string>();
  for (const e of events) {
    eventChapterById.set(e.id, e.chapter_name ?? e.name ?? "");
  }

  // Pull every result for those events, joined with participant identity.
  const { data: results, error: rErr } = await supabase
    .from("results")
    .select(
      `
      event_id,
      avg_score,
      award_category,
      participant:participants (
        id,
        full_name,
        school_name,
        person_id,
        parliament_role
      )
    `
    )
    .in("event_id", eventIds);

  if (rErr || !results) {
    return {
      zone: { code: zone.code, label: zone.label },
      year: resolvedYear,
      eventsCount: events.length,
      rows: [],
    };
  }

  // Aggregate in-memory keyed by person_id (or fallback to participant_id).
  type Agg = {
    person_id: string;
    full_name: string;
    chapter_name: string;
    school_name: string;
    events_played: Set<string>;
    total_score: number;
    awards_won: number;
    speaker_count: number;
    best_event_score: number;
  };

  const agg = new Map<string, Agg>();

  for (const row of results) {
    // Supabase typings give us participant as object | null for !inner-less joins.
    const p = (row as unknown as {
      event_id: string;
      avg_score: number | null;
      award_category: string | null;
      participant: {
        id: string;
        full_name: string;
        school_name: string;
        person_id: string | null;
        parliament_role: string | null;
      } | null;
    }).participant;

    if (!p) continue;
    const eventId = (row as { event_id: string }).event_id;
    const score = (row as { avg_score: number | null }).avg_score ?? 0;
    const award = (row as { award_category: string | null }).award_category;

    const key = p.person_id ?? `pid:${p.id}`;
    const chapterName = eventChapterById.get(eventId) ?? "";

    let entry = agg.get(key);
    if (!entry) {
      entry = {
        person_id: key,
        full_name: p.full_name,
        chapter_name: chapterName,
        school_name: p.school_name,
        events_played: new Set<string>(),
        total_score: 0,
        awards_won: 0,
        speaker_count: 0,
        best_event_score: 0,
      };
      agg.set(key, entry);
    }

    entry.events_played.add(eventId);
    entry.total_score += score;
    if (award) entry.awards_won += 1;
    if (p.parliament_role && LEADERSHIP_ROLES.has(p.parliament_role)) {
      entry.speaker_count += 1;
    }
    if (score > entry.best_event_score) entry.best_event_score = score;
  }

  const rows: RegionalLeaderboardRow[] = Array.from(agg.values())
    .map((e) => ({
      person_id: e.person_id,
      full_name: e.full_name,
      chapter_name: e.chapter_name,
      school_name: e.school_name,
      events_played: e.events_played.size,
      total_score: Math.round(e.total_score * 100) / 100,
      awards_won: e.awards_won,
      speaker_count: e.speaker_count,
      best_event_score: Math.round(e.best_event_score * 100) / 100,
    }))
    // Primary sort: total_score desc; tiebreak: events_played desc, then best_event_score desc.
    .sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      if (b.events_played !== a.events_played)
        return b.events_played - a.events_played;
      return b.best_event_score - a.best_event_score;
    });

  return {
    zone: { code: zone.code, label: zone.label },
    year: resolvedYear,
    eventsCount: events.length,
    rows,
  };
}

/**
 * Lightweight zone summary for the index page — counts qualifying chapter
 * events per zone for the active year.
 */
export type ZoneSummary = {
  code: YiZone;
  label: string;
  eventsCount: number;
  participantsCount: number;
};

export async function listZoneSummaries(): Promise<ZoneSummary[]> {
  const supabase = await createServiceClient();

  // Active year (or latest fallback) for the count.
  const { data: activeYear } = await supabase
    .schema("yi")
    .from("years")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  let yearId: string | null = activeYear?.id ?? null;
  if (!yearId) {
    const { data: latest } = await supabase
      .schema("yi")
      .from("years")
      .select("id")
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();
    yearId = latest?.id ?? null;
  }

  let eventsQuery = supabase
    .from("events")
    .select("id, yi_zone_code")
    .eq("level", "chapter")
    .in("status", ["completed", "results_published"]);
  if (yearId) eventsQuery = eventsQuery.eq("yi_year_id", yearId);

  const { data: events } = await eventsQuery;

  const eventsByZone = new Map<string, string[]>();
  for (const e of events ?? []) {
    if (!e.yi_zone_code) continue;
    const arr = eventsByZone.get(e.yi_zone_code) ?? [];
    arr.push(e.id);
    eventsByZone.set(e.yi_zone_code, arr);
  }

  // Participants per zone — single round-trip.
  const allEventIds = (events ?? []).map((e) => e.id);
  const participantsByEvent = new Map<string, number>();
  if (allEventIds.length > 0) {
    const { data: parts } = await supabase
      .from("participants")
      .select("event_id")
      .in("event_id", allEventIds);
    for (const p of parts ?? []) {
      participantsByEvent.set(
        p.event_id,
        (participantsByEvent.get(p.event_id) ?? 0) + 1
      );
    }
  }

  return YI_ZONES.map((z) => {
    const eventIds = eventsByZone.get(z.code) ?? [];
    let participantsCount = 0;
    for (const eid of eventIds) {
      participantsCount += participantsByEvent.get(eid) ?? 0;
    }
    return {
      code: z.code,
      label: z.label,
      eventsCount: eventIds.length,
      participantsCount,
    };
  });
}
