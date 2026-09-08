"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { YiZone } from "@/lib/yip/hierarchy";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import {
  normaliseRoundLevels,
  roundLevelScopeKey,
  type RoundLevel,
} from "@/lib/yip/round-level";
import { committeeCatalogueForLevel } from "@/lib/yip/committee-topics";

// ROUND LEVEL (2026-08)
// A topic may be scoped to chapter / regional / national rounds via `levels`.
// NULL = every level, which is what all 90 pre-existing rows mean, so nothing
// changes for a chapter round until a scope is set. Because the regional
// committee set reuses twelve ministry NAMES already in the catalogue (eight
// byte-identical), a (category, zone, title) pair is no longer unique — the
// identity of a row is its `id`. Every write below therefore addresses a row by
// id, and every "which bucket is this in" computation includes the level scope.
// See lib/yip/round-level.ts and lib/yip/committee-topics.ts.
//
// `levels` is newer than the generated Database types, so reads/writes go
// through an untyped client view; values are validated/coerced here.
async function topicsClient(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

/** Bucket key for topic numbering and reordering: category + zone + level scope. */
function bucketKey(
  category: TopicCategory,
  zone: YiZone | null,
  levels: RoundLevel[] | null
): string {
  return `${category}|${zone ?? ""}|${roundLevelScopeKey(levels)}`;
}

// ─── Types ──────────────────────────────────────────────────────

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// 'committee' = the 15 official YIP 2026 ministry committee topics (the single
// all-chapters catalog events pick 8–10 from). For committee rows: title = the
// ministry/committee name, description = the debate/bill topic, linked_scheme =
// the linked scheme/policy/act. Committee rows carry no zone (like central).
export type TopicCategory = "central" | "regional" | "committee";

export type AdminTopic = {
  id: string;
  category: TopicCategory;
  zone: YiZone | null;
  topic_number: number | null;
  title: string;
  description: string | null;
  sub_points: string[];
  handbook_page: number | null;
  linked_scheme: string | null;
  is_active: boolean;
  created_at: string | null;
  /** Round levels this topic applies to. null = every level. */
  levels: RoundLevel[] | null;
};

export type TopicInput = {
  category: TopicCategory;
  zone: YiZone | null;
  topic_number?: number | null;
  title: string;
  description?: string | null;
  sub_points?: string[];
  handbook_page?: number | null;
  linked_scheme?: string | null;
  /** Round levels; empty / all three / omitted all mean "every level". */
  levels?: string[] | null;
};

export type TopicFilters = {
  category?: TopicCategory;
  zone?: YiZone | null;
  q?: string;
  includeInactive?: boolean;
  /** Show only topics a round at this level can use (its own + the shared ones). */
  level?: RoundLevel;
};

export type CsvRow = {
  category: TopicCategory;
  zone: YiZone | null;
  title: string;
  description?: string | null;
  sub_points?: string[];
  handbook_page?: number | null;
  linked_scheme?: string | null;
  levels?: string[] | null;
};

// ─── Validation helpers (local, not exported) ───────────────────

function validateInput(input: TopicInput): string | null {
  if (!input.title || input.title.trim().length < 3) {
    return "Title must be at least 3 characters";
  }
  if (
    (input.category === "central" || input.category === "committee") &&
    input.zone
  ) {
    return `${input.category === "central" ? "Central" : "Committee"} topics must not have a zone`;
  }
  if (input.category === "regional" && !input.zone) {
    return "Regional topics require a zone";
  }
  if (input.sub_points) {
    for (const sp of input.sub_points) {
      if (typeof sp !== "string" || sp.trim().length === 0) {
        return "Sub-points must be non-empty strings";
      }
    }
  }
  return null;
}

function normalizeSubPoints(sp: string[] | undefined | null): string[] {
  if (!sp) return [];
  return sp.map((s) => s.trim()).filter((s) => s.length > 0);
}

function mapRow(row: {
  id: string;
  category: TopicCategory;
  zone: YiZone | null;
  topic_number: number | null;
  title: string;
  description: string | null;
  sub_points: unknown;
  handbook_page: number | null;
  linked_scheme: string | null;
  is_active: boolean | null;
  created_at: string | null;
  levels?: string[] | null;
}): AdminTopic {
  return {
    id: row.id,
    category: row.category,
    zone: row.zone,
    topic_number: row.topic_number,
    title: row.title,
    description: row.description,
    sub_points: Array.isArray(row.sub_points)
      ? (row.sub_points as string[])
      : [],
    handbook_page: row.handbook_page,
    linked_scheme: row.linked_scheme,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
    // NULL stays NULL — "every level", the meaning of every pre-levels row.
    levels: normaliseRoundLevels(row.levels),
  };
}

// Column list shared by all selects so linked_scheme is always present.
const TOPIC_COLS =
  "id, category, zone, topic_number, title, description, sub_points, handbook_page, linked_scheme, is_active, created_at, levels";

// ─── List ───────────────────────────────────────────────────────

export async function adminListTopics(
  filters?: TopicFilters
): Promise<AdminTopic[]> {
  const supabase = await topicsClient();
  let q = supabase
    .from("topics")
    .select(TOPIC_COLS)
    .order("category")
    .order("zone", { nullsFirst: true })
    .order("topic_number", { nullsFirst: false });

  if (!filters?.includeInactive) {
    q = q.eq("is_active", true);
  }
  if (filters?.category) q = q.eq("category", filters.category);
  if (filters?.zone) q = q.eq("zone", filters.zone);
  if (filters?.q) q = q.ilike("title", `%${filters.q}%`);

  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data.map(mapRow);
  // A level filter shows what a round at that level can actually use: its own
  // scoped topics PLUS the shared ones. Filtering is done here rather than in
  // SQL because "applies everywhere" is spelled NULL, not a value to match.
  if (!filters?.level) return rows;
  const level = filters.level;
  return rows.filter((t) => !t.levels?.length || t.levels.includes(level));
}

// ─── Create ─────────────────────────────────────────────────────

export async function adminCreateTopic(
  input: TopicInput
): Promise<ActionResult<AdminTopic>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const err = validateInput(input);
  if (err) return { success: false, error: err };

  const levels = normaliseRoundLevels(input.levels);
  const supabase = await topicsClient();

  // Auto-assign topic_number if not provided. The number continues past the
  // WHOLE (category, zone) bucket rather than restarting per level scope: the
  // widened unique key would permit restarting, but two committees numbered 1
  // that differ only by an invisible scope read as a data error on the admin
  // screen and in the bill/score join, where the NUMBER is the identity.
  let topicNumber = input.topic_number ?? null;
  if (topicNumber == null) {
    let q = supabase
      .from("topics")
      .select("topic_number")
      .eq("category", input.category)
      .order("topic_number", { ascending: false })
      .limit(1);
    if (input.zone) {
      q = q.eq("zone", input.zone);
    } else {
      q = q.is("zone", null);
    }
    const { data: maxRows } = await q;
    const currentMax = maxRows?.[0]?.topic_number ?? 0;
    topicNumber = currentMax + 1;
  }

  const { data, error } = await supabase
    .from("topics")
    .insert({
      category: input.category,
      zone: input.zone,
      topic_number: topicNumber,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      sub_points: normalizeSubPoints(input.sub_points),
      handbook_page: input.handbook_page ?? null,
      linked_scheme: input.linked_scheme?.trim() || null,
      is_active: true,
      levels,
    })
    .select(TOPIC_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create topic",
    };
  }

  revalidatePath("/yip/dashboard/admin/topics");
  revalidatePath("/yip/dashboard/topics");
  return { success: true, data: mapRow(data) };
}

// ─── Update ─────────────────────────────────────────────────────

export async function adminUpdateTopic(
  id: string,
  input: TopicInput
): Promise<ActionResult<AdminTopic>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const err = validateInput(input);
  if (err) return { success: false, error: err };

  const supabase = await topicsClient();

  const { data, error } = await supabase
    .from("topics")
    // BY ID, never by (category, zone, title): a ministry name may now be held
    // by both a shared row and a level-scoped one, and updating by name would
    // write BOTH.
    .update({
      category: input.category,
      zone: input.zone,
      topic_number: input.topic_number ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      sub_points: normalizeSubPoints(input.sub_points),
      handbook_page: input.handbook_page ?? null,
      linked_scheme: input.linked_scheme?.trim() || null,
      levels: normaliseRoundLevels(input.levels),
    })
    .eq("id", id)
    .select(TOPIC_COLS)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update topic",
    };
  }

  revalidatePath("/yip/dashboard/admin/topics");
  revalidatePath("/yip/dashboard/topics");
  return { success: true, data: mapRow(data) };
}

// ─── Deactivate (soft delete) ───────────────────────────────────

export async function adminDeactivateTopic(
  id: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await topicsClient();
  const { error } = await supabase
    .from("topics")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/yip/dashboard/admin/topics");
  revalidatePath("/yip/dashboard/topics");
  return { success: true, data: null };
}

// ─── Reactivate ─────────────────────────────────────────────────

export async function adminReactivateTopic(
  id: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await topicsClient();
  const { error } = await supabase
    .from("topics")
    .update({ is_active: true })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/yip/dashboard/admin/topics");
  revalidatePath("/yip/dashboard/topics");
  return { success: true, data: null };
}

// ─── Reorder within a (category, zone) bucket ───────────────────
// Two-phase update to avoid tripping the UNIQUE(category, zone, topic_number)
// constraint while numbers temporarily collide.

export async function adminReorderTopics(
  category: TopicCategory,
  zone: YiZone | null,
  orderedIds: string[],
  // The bucket is (category, zone, LEVEL SCOPE) since the unique key widened.
  // Callers must pass the ids of ONE scope: mixing a shared row and a
  // level-scoped one into a single 1..N run renumbers rows the caller never
  // meant to touch. Ids are still applied individually, by id.
  levels: string[] | null = null
): Promise<ActionResult<{ reordered: number }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (category === "regional" && !zone) {
    return { success: false, error: "Regional reorder requires a zone" };
  }
  if ((category === "central" || category === "committee") && zone) {
    return { success: false, error: `${category} reorder must not have a zone` };
  }
  if (orderedIds.length === 0) {
    return { success: true, data: { reordered: 0 } };
  }

  const supabase = await topicsClient();

  // Guard the bucket: every id must actually be in the scope named, or the
  // renumber silently walks into another level's rows.
  const scope = roundLevelScopeKey(normaliseRoundLevels(levels));
  const { data: scopeRows } = await supabase
    .from("topics")
    .select("id, category, zone, levels")
    .in("id", orderedIds);
  const stray = ((scopeRows ?? []) as Array<{
    id: string;
    category: TopicCategory;
    zone: YiZone | null;
    levels?: string[] | null;
  }>).find(
    (r) =>
      bucketKey(r.category, r.zone, normaliseRoundLevels(r.levels)) !==
      bucketKey(category, zone, normaliseRoundLevels(levels))
  );
  if (stray) {
    return {
      success: false,
      error: `Topic ${stray.id} is not in the ${category}/${zone ?? "no zone"}/${scope} group being reordered.`,
    };
  }

  // Phase 1: push all affected rows into a high negative space to free slots.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("topics")
      .update({ topic_number: -(i + 1) - 100000 })
      .eq("id", orderedIds[i]);
    if (error) return { success: false, error: error.message };
  }

  // Phase 2: write the intended 1..N sequence.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("topics")
      .update({ topic_number: i + 1 })
      .eq("id", orderedIds[i]);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/yip/dashboard/admin/topics");
  revalidatePath("/yip/dashboard/topics");
  return { success: true, data: { reordered: orderedIds.length } };
}

// ─── Bulk Import (CSV) ──────────────────────────────────────────
// Dedupes by (category, zone, title). Existing rows are skipped (not updated).

export async function adminBulkImport(
  rows: CsvRow[]
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (rows.length === 0) {
    return { success: false, error: "No rows to import" };
  }

  const supabase = await topicsClient();

  // Dedupe on (category, zone, LEVEL SCOPE, title). The scope belongs in the
  // key: twelve regional committees reuse a ministry name that a shared row
  // already holds, so a title-only key would silently SKIP every one of them
  // as an already-present duplicate.
  const { data: existing } = await supabase
    .from("topics")
    .select("category, zone, title, topic_number, levels");

  const existingRows = (existing ?? []) as Array<{
    category: TopicCategory;
    zone: YiZone | null;
    title: string | null;
    topic_number?: number | null;
    levels?: string[] | null;
  }>;

  const existingKeys = new Set(
    existingRows.map(
      (r) =>
        `${bucketKey(r.category, r.zone, normaliseRoundLevels(r.levels))}|${(r.title ?? "").trim().toLowerCase()}`
    )
  );

  // Highest topic_number per (category, zone) so we can auto-increment. This
  // deliberately ignores the level scope: numbering continues across the whole
  // bucket so two topics never share a number and differ only by scope.
  const maxByBucket = new Map<string, number>();
  for (const r of existingRows) {
    const key = `${r.category}|${r.zone ?? ""}`;
    const n = r.topic_number ?? 0;
    if (n > (maxByBucket.get(key) ?? 0)) maxByBucket.set(key, n);
  }

  const toInsert: Array<{
    category: TopicCategory;
    zone: YiZone | null;
    topic_number: number;
    title: string;
    description: string | null;
    sub_points: string[];
    handbook_page: number | null;
    linked_scheme: string | null;
    is_active: boolean;
    levels: RoundLevel[] | null;
  }> = [];
  let skipped = 0;

  for (const row of rows) {
    const title = (row.title ?? "").trim();
    if (title.length < 3) {
      skipped++;
      continue;
    }
    if (row.category === "regional" && !row.zone) {
      skipped++;
      continue;
    }
    if (
      (row.category === "central" || row.category === "committee") &&
      row.zone
    ) {
      skipped++;
      continue;
    }
    const rowLevels = normaliseRoundLevels(row.levels);
    const key = `${bucketKey(row.category, row.zone, rowLevels)}|${title.toLowerCase()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    existingKeys.add(key);

    const bucket = `${row.category}|${row.zone ?? ""}`;
    const nextNum = (maxByBucket.get(bucket) ?? 0) + 1;
    maxByBucket.set(bucket, nextNum);

    toInsert.push({
      category: row.category,
      zone: row.zone,
      topic_number: nextNum,
      title,
      description: row.description?.trim() || null,
      sub_points: normalizeSubPoints(row.sub_points),
      handbook_page: row.handbook_page ?? null,
      linked_scheme: row.linked_scheme?.trim() || null,
      is_active: true,
      levels: rowLevels,
    });
  }

  if (toInsert.length === 0) {
    return { success: true, data: { inserted: 0, skipped } };
  }

  const { error } = await supabase.from("topics").insert(toInsert);
  if (error) return { success: false, error: error.message };

  revalidatePath("/yip/dashboard/admin/topics");
  revalidatePath("/yip/dashboard/topics");
  return { success: true, data: { inserted: toInsert.length, skipped } };
}

// ─── Shared helper: attach central topics to a single event ──────────
// Used by both pushCentralTopicsToAllChapterEvents (F7 batch re-sync) and
// createEvent (auto-inherit on chapter event creation).
//
// Idempotent: relies on the (event_id, topic_id) unique constraint via
// onConflict upsert. Topics are NOT year-scoped, so yearId is unused
// for filtering topics — kept in the signature only as documentation.
//
// Returns the number of rows upserted, or 0 if no active central topics
// exist (which is a legitimate no-op, not an error).

// Internal helper — auth enforced at createEvent boundary; not directly super-admin-gated.
export async function attachCentralTopicsToEvent(
  eventId: string,
  _yearId: string | null = null
): Promise<ActionResult<{ rows_upserted: number }>> {
  const supabase = await createServiceClient();

  // Read all active central topic IDs.
  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id")
    .eq("category", "central")
    .eq("is_active", true);

  if (topicsError) return { success: false, error: topicsError.message };
  if (!topics || topics.length === 0) {
    return { success: true, data: { rows_upserted: 0 } };
  }

  const rows = topics.map((t) => ({
    event_id: eventId,
    topic_id: t.id,
    is_central: true,
  }));

  const { error } = await supabase
    .from("event_topics")
    .upsert(rows, { onConflict: "event_id,topic_id" });

  if (error) return { success: false, error: error.message };

  return { success: true, data: { rows_upserted: rows.length } };
}

// ─── Attach the committee catalogue for ONE round level ──────────────
//
// The regional counterpart of attachCentralTopicsToEvent. A regional event
// inherits the committees scoped to the regional round; a level with no
// committees of its own inherits the shared ones, which is the same fallback
// rule the rest of the level feature uses (lib/yip/round-level.ts).
//
// The Director's rule: FIFTEEN are proposed and the host picks TEN. So this
// attaches the whole set and the host trims — exactly the "attach, host trims"
// pattern createEvent already uses for chapter events. It deliberately does NOT
// pick ten, because which ten is the host's call.
//
// Idempotent via the (event_id, topic_id) unique constraint. Returns 0 rows as
// a legitimate no-op when the catalogue has nothing for this level.
//
// Internal helper — auth enforced at the createEvent boundary, like its sibling.
export async function attachCommitteeTopicsToEvent(
  eventId: string,
  level: RoundLevel
): Promise<ActionResult<{ rows_upserted: number }>> {
  const supabase = await topicsClient();

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, title, levels")
    .eq("category", "committee")
    .eq("is_active", true)
    .order("topic_number", { nullsFirst: false });

  if (topicsError) return { success: false, error: topicsError.message };

  const resolved = committeeCatalogueForLevel(
    ((topics ?? []) as Array<{ id: string; title: string; levels?: string[] | null }>).map(
      (t) => ({ ...t, title: t.title ?? "" })
    ),
    level
  );
  if (resolved.length === 0) {
    return { success: true, data: { rows_upserted: 0 } };
  }

  const rows = resolved.map((t) => ({
    event_id: eventId,
    topic_id: t.id,
    // Committee topics are not the central agenda.
    is_central: false,
  }));

  const { error } = await supabase
    .from("event_topics")
    .upsert(rows, { onConflict: "event_id,topic_id" });

  if (error) return { success: false, error: error.message };

  return { success: true, data: { rows_upserted: rows.length } };
}

// ─── F7: Batch push central topics to all chapter events ─────────────

export async function pushCentralTopicsToAllChapterEvents(
  yearId: string | null,
  topicIds: string[]
): Promise<ActionResult<{ events_updated: number; rows_upserted: number }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (topicIds.length === 0) {
    return { success: false, error: "No topic IDs provided" };
  }

  const supabase = await createServiceClient();

  // Find all chapter events. If a yearId is provided, scope to that year;
  // otherwise scope to all chapter events.
  let q = supabase.from("events").select("id").eq("level", "chapter");
  if (yearId) q = q.eq("yi_year_id", yearId);

  const { data: events, error: eventsError } = await q;
  if (eventsError) return { success: false, error: eventsError.message };
  if (!events || events.length === 0) {
    return { success: true, data: { events_updated: 0, rows_upserted: 0 } };
  }

  // NOTE: F7 still uses the caller-supplied topicIds (not all active
  // centrals) so admins can selectively re-sync a subset. Behavior is
  // preserved exactly — we do not route F7 through the new helper.
  const rows: Array<{
    event_id: string;
    topic_id: string;
    is_central: boolean;
  }> = [];
  for (const ev of events) {
    for (const tid of topicIds) {
      rows.push({ event_id: ev.id, topic_id: tid, is_central: true });
    }
  }

  const { error } = await supabase
    .from("event_topics")
    .upsert(rows, { onConflict: "event_id,topic_id" });

  if (error) return { success: false, error: error.message };

  for (const ev of events) {
    revalidatePath(`/yip/dashboard/events/${ev.id}/topics`);
  }
  revalidatePath("/yip/dashboard/admin/topics");

  return {
    success: true,
    data: { events_updated: events.length, rows_upserted: rows.length },
  };
}

/**
 * Get the yi.years id for a given calendar year (e.g. 2026). Used by the
 * batch-push UI to scope to the active season's chapter events.
 */
export async function getYiYearIdForYear(year: number): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .schema("yi")
    .from("years")
    .select("id")
    .eq("year", year)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
