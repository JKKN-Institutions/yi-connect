"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import {
  normaliseRoundLevels,
  roundLevelScopeKey,
  scopesOverlap,
  describeRoundLevels,
  pickByLevel,
  type RoundLevel,
} from "@/lib/yip/round-level";

// yip.scoring_buckets is newer than the generated Database types, so use an
// untyped client view for it (rows are coerced via rowToBucket; inputs are
// validated above each write). Regenerate types to drop this when convenient.
async function bucketsClient(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

// Configurable scoring buckets — the editable container for the YIP final
// scoring model (the Scoring Framework admin tab). Super-admin controlled,
// backwired: the results engine reads these (wired in a follow-up).
//
// ROUND LEVEL (2026-08)
// A bucket may now be scoped to chapter / regional / national rounds via
// `levels`. NULL = every round, which is what every pre-existing bucket means,
// so nothing changes until a scope is set. Because two rounds may want the same
// component at different weights, two buckets may now share a bucket_key as
// long as their level scopes do not overlap — the identity of a row is
// therefore its `id`, not its bucket_key. See lib/yip/round-level.ts.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ScoringBucket = {
  id: string;
  bucket_key: string;
  label: string;
  weightage: number;
  merit_max: number;
  jury_max: number;
  day_group: number | null;
  display_order: number;
  session_keys: string[];
  is_active: boolean;
  /** Round levels this bucket applies to. null = every round. */
  levels: RoundLevel[] | null;
};

const PATH = "/dashboard/admin/scoring-framework";
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function rowToBucket(row: Record<string, unknown>): ScoringBucket {
  return {
    id: String(row.id),
    bucket_key: String(row.bucket_key),
    label: String(row.label),
    weightage: Number(row.weightage) || 0,
    merit_max: Number(row.merit_max) || 0,
    jury_max: Number(row.jury_max) || 0,
    day_group: row.day_group == null ? null : Number(row.day_group),
    display_order: Number(row.display_order) || 0,
    session_keys: Array.isArray(row.session_keys)
      ? (row.session_keys as string[])
      : [],
    is_active: row.is_active !== false,
    // NULL stays NULL — "every round", the meaning of every pre-levels row.
    levels: normaliseRoundLevels(row.levels),
  };
}

/** Every bucket, whatever its scope — the admin catalogue. */
export async function listAllScoringBuckets(): Promise<ScoringBucket[]> {
  const supabase = await bucketsClient();
  const { data } = await supabase
    .from("scoring_buckets")
    .select("*")
    .order("display_order", { ascending: true });
  return (data ?? []).map(rowToBucket);
}

/**
 * The set of buckets that SCORES a round at `level`.
 *
 * The two tiers are never mixed: if any bucket is scoped to this level, that
 * scoped set is the whole model for the round and the global set is ignored;
 * otherwise the global set is used. Mixing them would silently double-count a
 * component that exists in both, and the weightages would no longer total 100.
 *
 * Omitting `level` — which is what every existing caller does — returns the
 * GLOBAL set only. That is deliberate and fail-safe in both directions: today
 * every bucket is global, so the answer is byte-identical to the old
 * listScoringBuckets(); and once someone scopes a bucket, a caller that has not
 * yet been taught about levels keeps using the global model it was written
 * against rather than silently absorbing another level's buckets.
 */
export async function listScoringBuckets(
  level?: RoundLevel | null
): Promise<ScoringBucket[]> {
  const all = await listAllScoringBuckets();
  const { scoped, global } = pickByLevel(all, level);
  return scoped.length > 0 ? scoped : global;
}

export type ScoringBucketInput = {
  /**
   * The row being edited. Absent = creating. Identity is the id, not the
   * bucket_key, because two buckets may share a key at different levels.
   */
  id?: string;
  bucket_key: string;
  label: string;
  weightage: number;
  merit_max?: number;
  jury_max?: number;
  day_group?: number | null;
  display_order?: number;
  session_keys?: string[];
  is_active?: boolean;
  /** Round levels; empty / all three / omitted all mean "every round". */
  levels?: string[] | null;
};

// Create or update a bucket. Super-admin only.
//
// Identity is the row `id`. A bucket_key alone is no longer unique: the same
// component may have one bucket for chapter rounds and another for regional
// ones. When no id is supplied we look for the row holding the SAME key at the
// SAME scope and update it — which is exactly what the previous
// upsert(onConflict: bucket_key) did while every bucket was global.
export async function upsertScoringBucket(
  input: ScoringBucketInput
): Promise<ActionResult<ScoringBucket>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const bucket_key = (input.bucket_key ?? "").trim();
  if (!KEY_PATTERN.test(bucket_key)) {
    return { success: false, error: "Bucket key must be lowercase_snake_case" };
  }
  const label = (input.label ?? "").trim();
  if (label.length < 2) {
    return { success: false, error: "Name must be at least 2 characters" };
  }
  const weightage = Math.round(Number(input.weightage));
  if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
    return { success: false, error: "Weightage must be a whole number between 0 and 100" };
  }
  const merit_max = Math.max(0, Math.round(Number(input.merit_max ?? 0)) || 0);
  const jury_max = Math.max(0, Math.round(Number(input.jury_max ?? weightage)) || 0);
  if (merit_max + jury_max > 0 && merit_max + jury_max !== weightage) {
    return {
      success: false,
      error: `Merit (${merit_max}) + jury (${jury_max}) must equal the weightage (${weightage})`,
    };
  }

  const dg = input.day_group;
  const day_group = dg === null || dg === undefined ? null : Math.round(Number(dg));
  if (day_group !== null && day_group !== 1 && day_group !== 2) {
    return { success: false, error: "Day group must be 1, 2, or none" };
  }

  const levels = normaliseRoundLevels(input.levels);

  const supabase = await bucketsClient();

  // Every row already holding this key, so we can tell "edit this one" from
  // "add a second bucket for another level" from "two buckets fighting over the
  // same level".
  const { data: siblings } = await supabase
    .from("scoring_buckets")
    .select("id, levels")
    .eq("bucket_key", bucket_key);

  const sameKeyRows = (siblings ?? []) as { id: string; levels?: string[] | null }[];

  // The row we are writing: the one named by id, else the one at this exact
  // scope (the old overwrite-on-same-key behaviour), else a brand new row.
  const scope = roundLevelScopeKey(levels);
  const targetId =
    input.id ??
    sameKeyRows.find((r) => roundLevelScopeKey(r.levels) === scope)?.id ??
    null;

  // Two SCOPED buckets must not both claim a level — resolution would be
  // ambiguous. A global bucket never conflicts: it is the documented fallback
  // that a level-scoped bucket overrides.
  const clash = sameKeyRows.find(
    (r) => r.id !== targetId && scopesOverlap(normaliseRoundLevels(r.levels), levels)
  );
  if (clash) {
    return {
      success: false,
      error: `Another component with the key "${bucket_key}" already covers ${describeRoundLevels(
        levels
      )}. Change the rounds it applies to, or edit that component instead.`,
    };
  }

  const values = {
    bucket_key,
    label,
    weightage,
    merit_max,
    jury_max,
    day_group,
    display_order: Math.round(Number(input.display_order ?? 0)) || 0,
    session_keys: input.session_keys ?? [],
    is_active: input.is_active !== false,
    levels,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = targetId
    ? await supabase
        .from("scoring_buckets")
        .update(values)
        .eq("id", targetId)
        .select()
        .single()
    : await supabase.from("scoring_buckets").insert(values).select().single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save bucket" };
  }
  revalidatePath(PATH);
  return { success: true, data: rowToBucket(data) };
}

// Update just the weightage (+ optional merit/jury split) of one bucket — the
// common edit from the framework table. Keeps merit+jury consistent with the
// new weightage when a split is present.
//
// Takes the row id, not the bucket_key: a key may be held by a chapter bucket
// and a regional bucket, and keying on it would reweight whichever the database
// happened to return first.
export async function setBucketWeightage(input: {
  id: string;
  weightage: number;
  merit_max?: number;
  jury_max?: number;
}): Promise<ActionResult<ScoringBucket>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };

  const weightage = Math.round(Number(input.weightage));
  if (!Number.isFinite(weightage) || weightage < 0 || weightage > 100) {
    return { success: false, error: "Weightage must be a whole number between 0 and 100" };
  }

  if (!input.id) return { success: false, error: "No component was specified" };

  const supabase = await bucketsClient();
  const { data: existing } = await supabase
    .from("scoring_buckets")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) return { success: false, error: "Bucket not found" };

  const cur = rowToBucket(existing);
  // If this bucket carries a merit/jury split, keep it proportional or use the
  // supplied split; otherwise jury_max tracks the whole weightage.
  let merit_max = input.merit_max ?? cur.merit_max;
  let jury_max = input.jury_max ?? cur.jury_max;
  if (merit_max + jury_max !== weightage) {
    if (cur.merit_max > 0 && cur.weightage > 0) {
      // preserve the merit share ratio
      merit_max = Math.min(weightage, Math.round((cur.merit_max / cur.weightage) * weightage));
      jury_max = weightage - merit_max;
    } else {
      merit_max = 0;
      jury_max = weightage;
    }
  }

  const { data, error } = await supabase
    .from("scoring_buckets")
    .update({
      weightage,
      merit_max,
      jury_max,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to update weightage" };
  }
  revalidatePath(PATH);
  return { success: true, data: rowToBucket(data) };
}

// Delete ONE bucket, by row id rather than bucket_key: a key may be held by a
// chapter bucket and a regional bucket, and deleting by key would take both.
export async function deleteScoringBucket(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (!id) return { success: false, error: "No component was specified" };
  const supabase = await bucketsClient();
  const { error } = await supabase
    .from("scoring_buckets")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, data: null };
}
