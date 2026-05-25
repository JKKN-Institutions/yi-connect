"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Generate Access Code ───────────────────────────────────────

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Get Event Level and Qualified IDs ──────────────────────────

export async function getEventQualificationData(
  eventId: string
): Promise<{ level: string; qualifiedIds: string[] }> {
  const supabase = await createServiceClient();

  // Get event level
  const { data: event } = await supabase
    .from("events")
    .select("level")
    .eq("id", eventId)
    .single();

  // Get qualified participant IDs
  const { data: qualified } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", eventId)
    .eq("qualified_for_next", true);

  return {
    level: event?.level ?? "chapter",
    qualifiedIds: (qualified ?? []).map((p) => p.id),
  };
}

// ─── Mark Qualified ─────────────────────────────────────────────

export async function markQualified(
  participantIds: string[],
  eventId: string
): Promise<ActionResult> {
  if (participantIds.length === 0) {
    return { success: false, error: "No participants selected" };
  }

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("participants")
    .update({ qualified_for_next: true })
    .in("id", participantIds)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/events/${eventId}/results`);
  revalidatePath(`/dashboard/admin`);
  revalidatePath(`/dashboard/admin/pipeline`);
  return { success: true, data: null };
}

// ─── Unmark Qualified ───────────────────────────────────────────

export async function unmarkQualified(
  participantIds: string[],
  eventId: string
): Promise<ActionResult> {
  if (participantIds.length === 0) {
    return { success: false, error: "No participants selected" };
  }

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("participants")
    .update({ qualified_for_next: false })
    .in("id", participantIds)
    .eq("event_id", eventId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/events/${eventId}/results`);
  revalidatePath(`/dashboard/admin`);
  revalidatePath(`/dashboard/admin/pipeline`);
  return { success: true, data: null };
}

// ─── Get Qualified Students ─────────────────────────────────────

export type QualifiedStudent = {
  id: string;
  full_name: string;
  school_name: string;
  class: number;
  city: string | null;
  home_state: string | null;
  phone: string | null;
  email: string | null;
  parliament_role: string | null;
  party_side: string | null;
  avg_score: number | null;
  rank: number | null;
};

export async function getQualifiedStudents(
  eventId: string
): Promise<QualifiedStudent[]> {
  const supabase = await createServiceClient();

  const { data: participants, error: pError } = await supabase
    .from("participants")
    .select("id, full_name, school_name, class, city, home_state, phone, email, parliament_role, party_side")
    .eq("event_id", eventId)
    .eq("qualified_for_next", true);

  if (pError || !participants) return [];

  // Get results for scores
  const { data: results } = await supabase
    .from("results")
    .select("participant_id, avg_score, rank")
    .eq("event_id", eventId);

  const resultMap = new Map(
    (results ?? []).map((r) => [r.participant_id, r])
  );

  return participants.map((p) => {
    const result = resultMap.get(p.id);
    return {
      ...p,
      avg_score: result?.avg_score ?? null,
      rank: result?.rank ?? null,
    };
  });
}

// ─── Promote to Event ───────────────────────────────────────────

export async function promoteToEvent(
  fromEventId: string,
  toEventId: string
): Promise<ActionResult<{ promoted: number }>> {
  const supabase = await createServiceClient();

  // Get source event info
  const { data: fromEvent, error: fromError } = await supabase
    .from("events")
    .select("id, name, level, chapter_name, city")
    .eq("id", fromEventId)
    .single();

  if (fromError || !fromEvent) {
    return { success: false, error: "Source event not found" };
  }

  // Verify destination event exists
  const { data: toEvent, error: toError } = await supabase
    .from("events")
    .select("id, name, level")
    .eq("id", toEventId)
    .single();

  if (toError || !toEvent) {
    return { success: false, error: "Destination event not found" };
  }

  // Get qualified participants from source event
  const { data: qualified, error: qError } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", fromEventId)
    .eq("qualified_for_next", true);

  if (qError || !qualified) {
    return { success: false, error: "Failed to fetch qualified participants" };
  }

  if (qualified.length === 0) {
    return { success: false, error: "No qualified participants to promote" };
  }

  // Existing promotions (by source_participant_id) — audit-aware dedup
  const qualifiedIds = qualified.map((p) => p.id);
  const { data: existingPromotions } = await supabase
    .from("promotions")
    .select("source_participant_id, target_participant_id")
    .eq("source_event_id", fromEventId)
    .eq("target_event_id", toEventId)
    .in("source_participant_id", qualifiedIds);

  const alreadyPromotedSourceIds = new Set(
    (existingPromotions ?? []).map((p) => p.source_participant_id)
  );

  const toPromote = qualified.filter((p) => !alreadyPromotedSourceIds.has(p.id));

  if (toPromote.length === 0) {
    return {
      success: false,
      error: "All qualified participants have already been promoted to this event",
    };
  }

  // Pull source results for rank/score snapshot
  const toPromoteIds = toPromote.map((p) => p.id);
  const { data: results } = await supabase
    .from("results")
    .select("participant_id, rank, avg_score, award_category")
    .eq("event_id", fromEventId)
    .in("participant_id", toPromoteIds);

  const resultByParticipant = new Map(
    (results ?? []).map((r) => [r.participant_id, r])
  );

  // Source season for audit
  const { data: seasonRow } = await supabase
    .from("events")
    .select("season_id")
    .eq("id", fromEventId)
    .single();

  // Current user for promoted_by
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Create participant rows in target + capture their new IDs.
  // IMPORTANT: person_id carries forward so the student's journey
  // stays stitched across chapter → regional → national rounds.
  const newParticipants = toPromote.map((p) => ({
    event_id: toEventId,
    person_id: (p as { person_id?: string | null }).person_id ?? null,
    full_name: p.full_name,
    school_name: p.school_name,
    school_id: p.school_id ?? null,
    class: p.class,
    city: p.city,
    home_state: p.home_state,
    phone: p.phone,
    email: p.email,
    parent_phone: p.parent_phone,
    section: p.section,
    access_code: generateAccessCode(),
    checked_in: false,
    qualified_for_next: false,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("participants")
    .insert(newParticipants)
    .select("id, full_name, school_name");

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? "Insert failed" };
  }

  // Match target_participant_id back by (full_name, school_name) — unique enough within one event
  const targetByKey = new Map(
    inserted.map((r) => [`${r.full_name}|${r.school_name}`, r.id])
  );

  // Write promotions audit rows
  const auditRows = toPromote.map((p) => {
    const key = `${p.full_name}|${p.school_name}`;
    const targetId = targetByKey.get(key) ?? null;
    const res = resultByParticipant.get(p.id);
    return {
      season_id: seasonRow?.season_id ?? null,
      source_event_id: fromEventId,
      target_event_id: toEventId,
      source_participant_id: p.id,
      target_participant_id: targetId,
      full_name: p.full_name,
      school_name: p.school_name,
      source_rank: res?.rank ?? null,
      source_avg_score: res?.avg_score ?? null,
      source_awards: res?.award_category ?? null,
      promoted_by: user?.id ?? null,
      reason: `Promoted ${fromEvent.name} → ${toEvent.name}`,
    };
  });

  const { error: auditError } = await supabase.from("promotions").insert(auditRows);
  if (auditError) {
    // Soft-fail on audit write — participants already created; don't roll back.
    console.error("Promotion audit write failed:", auditError.message);
  }

  revalidatePath(`/dashboard/events/${toEventId}`);
  revalidatePath(`/dashboard/admin`);
  revalidatePath(`/dashboard/admin/pipeline`);

  return { success: true, data: { promoted: toPromote.length } };
}

// ─── Promote Top N (convenience — marks + promotes in one step) ─
// Typical flow: at chapter results, mark top 10 as qualified and promote to
// regional. Handbook page 5 leaves N up to the national team per year.

export async function promoteTopN(
  fromEventId: string,
  toEventId: string,
  topN: number
): Promise<ActionResult<{ marked: number; promoted: number }>> {
  if (topN < 1) return { success: false, error: "Top N must be >= 1" };

  const supabase = await createServiceClient();

  // Find top-N participants by rank
  const { data: topResults, error: rErr } = await supabase
    .from("results")
    .select("participant_id, rank")
    .eq("event_id", fromEventId)
    .order("rank", { ascending: true })
    .limit(topN);

  if (rErr || !topResults || topResults.length === 0) {
    return { success: false, error: "No ranked results in source event" };
  }

  const ids = topResults.map((r) => r.participant_id);

  // Mark as qualified
  const markResult = await markQualified(ids, fromEventId);
  if (!markResult.success) return { success: false, error: markResult.error };

  // Promote
  const promoteResult = await promoteToEvent(fromEventId, toEventId);
  if (!promoteResult.success)
    return { success: false, error: promoteResult.error };

  return {
    success: true,
    data: { marked: ids.length, promoted: promoteResult.data.promoted },
  };
}

// ─── Get promotion history for an event ────────────────────────
export type PromotionRecord = {
  id: string;
  source_event_id: string;
  target_event_id: string;
  full_name: string;
  school_name: string | null;
  source_rank: number | null;
  source_avg_score: number | null;
  source_awards: string | null;
  promoted_at: string;
  direction: "incoming" | "outgoing";
};

export async function getPromotionHistory(
  eventId: string
): Promise<PromotionRecord[]> {
  const supabase = await createServiceClient();

  const { data: incoming } = await supabase
    .from("promotions")
    .select("*")
    .eq("target_event_id", eventId)
    .order("promoted_at", { ascending: false });

  const { data: outgoing } = await supabase
    .from("promotions")
    .select("*")
    .eq("source_event_id", eventId)
    .order("promoted_at", { ascending: false });

  const ins: PromotionRecord[] = (incoming ?? []).map((r) => ({
    id: r.id,
    source_event_id: r.source_event_id,
    target_event_id: r.target_event_id,
    full_name: r.full_name,
    school_name: r.school_name,
    source_rank: r.source_rank,
    source_avg_score: r.source_avg_score,
    source_awards: r.source_awards,
    promoted_at: r.promoted_at ?? "",
    direction: "incoming" as const,
  }));

  const outs: PromotionRecord[] = (outgoing ?? []).map((r) => ({
    id: r.id,
    source_event_id: r.source_event_id,
    target_event_id: r.target_event_id,
    full_name: r.full_name,
    school_name: r.school_name,
    source_rank: r.source_rank,
    source_avg_score: r.source_avg_score,
    source_awards: r.source_awards,
    promoted_at: r.promoted_at ?? "",
    direction: "outgoing" as const,
  }));

  return [...ins, ...outs].sort((a, b) =>
    b.promoted_at.localeCompare(a.promoted_at)
  );
}

// ─── Get Season Events ──────────────────────────────────────────

export type SeasonEvent = {
  id: string;
  name: string;
  level: string;
  status: string;
  chapter_name: string | null;
  city: string | null;
  state: string | null;
  day1_date: string;
  day2_date: string;
  participant_count: number;
  qualified_count: number;
};

export async function getSeasonEvents(
  seasonId: string
): Promise<{ chapter: SeasonEvent[]; regional: SeasonEvent[]; national: SeasonEvent[] }> {
  const supabase = await createServiceClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, level, status, chapter_name, city, state, day1_date, day2_date")
    .eq("season_id", seasonId)
    .order("level")
    .order("day1_date", { ascending: true });

  if (error || !events) {
    return { chapter: [], regional: [], national: [] };
  }

  // Get participant counts and qualified counts for all events
  const eventIds = events.map((e) => e.id);

  let participantData: { event_id: string; qualified_for_next: boolean | null }[] = [];
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from("participants")
      .select("event_id, qualified_for_next")
      .in("event_id", eventIds);
    participantData = data ?? [];
  }

  // Build count maps
  const countMap: Record<string, number> = {};
  const qualifiedMap: Record<string, number> = {};
  for (const p of participantData) {
    countMap[p.event_id] = (countMap[p.event_id] ?? 0) + 1;
    if (p.qualified_for_next) {
      qualifiedMap[p.event_id] = (qualifiedMap[p.event_id] ?? 0) + 1;
    }
  }

  const enriched: SeasonEvent[] = events.map((e) => ({
    ...e,
    participant_count: countMap[e.id] ?? 0,
    qualified_count: qualifiedMap[e.id] ?? 0,
  }));

  return {
    chapter: enriched.filter((e) => e.level === "chapter"),
    regional: enriched.filter((e) => e.level === "regional"),
    national: enriched.filter((e) => e.level === "national"),
  };
}

// ─── Get Season Pipeline ────────────────────────────────────────

export type SeasonPipelineData = {
  season: { id: string; name: string; year: number };
  events: { chapter: SeasonEvent[]; regional: SeasonEvent[]; national: SeasonEvent[] };
  stats: {
    totalChapters: number;
    totalRegionals: number;
    totalNationals: number;
    totalParticipants: number;
    totalQualified: number;
  };
};

export async function getSeasonPipeline(
  seasonId: string
): Promise<SeasonPipelineData | null> {
  const supabase = await createServiceClient();

  const { data: season, error: sError } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("id, name, year")
    .eq("id", seasonId)
    .single();

  if (sError || !season) return null;

  const events = await getSeasonEvents(seasonId);

  const allEvents = [...events.chapter, ...events.regional, ...events.national];
  const totalParticipants = allEvents.reduce((s, e) => s + e.participant_count, 0);
  const totalQualified = allEvents.reduce((s, e) => s + e.qualified_count, 0);

  return {
    season,
    events,
    stats: {
      totalChapters: events.chapter.length,
      totalRegionals: events.regional.length,
      totalNationals: events.national.length,
      totalParticipants,
      totalQualified,
    },
  };
}

// ─── Get All Seasons ────────────────────────────────────────────

export type Season = {
  id: string;
  name: string;
  year: number;
  is_active: boolean | null;
};

export async function getAllSeasons(): Promise<Season[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("id, name, year, is_active")
    .order("year", { ascending: false });

  if (error || !data) return [];
  return data;
}

// ─── Create Regional Event ──────────────────────────────────────

export async function createRegionalEvent(
  seasonId: string,
  data: {
    name: string;
    city: string;
    state: string;
    venue_name?: string;
    venue_address?: string;
    day1_date: string;
    day2_date: string;
    max_participants?: number;
  }
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServiceClient();

  // Verify season exists
  const { data: season } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("id")
    .eq("id", seasonId)
    .single();

  if (!season) {
    return { success: false, error: "Season not found" };
  }

  // Get current user for created_by
  const { data: { user } } = await (await import("@/lib/supabase/server")).createClient().then(c => c.auth.getUser());

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name: data.name,
      level: "regional" as const,
      season_id: seasonId,
      city: data.city,
      state: data.state,
      venue_name: data.venue_name ?? null,
      venue_address: data.venue_address ?? null,
      day1_date: data.day1_date,
      day2_date: data.day2_date,
      max_participants: data.max_participants ?? null,
      status: "draft" as const,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !event) {
    return { success: false, error: error?.message ?? "Failed to create event" };
  }

  revalidatePath(`/dashboard/admin`);
  revalidatePath(`/dashboard/admin/pipeline`);
  return { success: true, data: { id: event.id } };
}

// ─── Create National Event ──────────────────────────────────────

export async function createNationalEvent(
  seasonId: string,
  data: {
    name: string;
    city: string;
    state: string;
    venue_name?: string;
    venue_address?: string;
    day1_date: string;
    day2_date: string;
    max_participants?: number;
  }
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServiceClient();

  // Verify season exists
  const { data: season } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("id")
    .eq("id", seasonId)
    .single();

  if (!season) {
    return { success: false, error: "Season not found" };
  }

  // Get current user
  const { data: { user } } = await (await import("@/lib/supabase/server")).createClient().then(c => c.auth.getUser());

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      name: data.name,
      level: "national" as const,
      season_id: seasonId,
      city: data.city,
      state: data.state,
      venue_name: data.venue_name ?? null,
      venue_address: data.venue_address ?? null,
      day1_date: data.day1_date,
      day2_date: data.day2_date,
      max_participants: data.max_participants ?? null,
      status: "draft" as const,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !event) {
    return { success: false, error: error?.message ?? "Failed to create event" };
  }

  revalidatePath(`/dashboard/admin`);
  revalidatePath(`/dashboard/admin/pipeline`);
  return { success: true, data: { id: event.id } };
}
