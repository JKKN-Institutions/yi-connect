"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

// yip.scoring_buckets is newer than the generated Database types, so use an
// untyped client view for it (rows are coerced via rowToBucket; inputs are
// validated above each write). Regenerate types to drop this when convenient.
async function bucketsClient(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

// Configurable scoring buckets — the editable container for the YIP final
// scoring model (the Scoring Framework admin tab). Super-admin controlled,
// global, backwired: the results engine reads these (wired in a follow-up).

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
  };
}

export async function listScoringBuckets(): Promise<ScoringBucket[]> {
  const supabase = await bucketsClient();
  const { data } = await supabase
    .from("scoring_buckets")
    .select("*")
    .order("display_order", { ascending: true });
  return (data ?? []).map(rowToBucket);
}

export type ScoringBucketInput = {
  bucket_key: string;
  label: string;
  weightage: number;
  merit_max?: number;
  jury_max?: number;
  day_group?: number | null;
  display_order?: number;
  session_keys?: string[];
  is_active?: boolean;
};

// Create or update a bucket (unique on bucket_key). Super-admin only.
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

  const supabase = await bucketsClient();
  const { data, error } = await supabase
    .from("scoring_buckets")
    .upsert(
      {
        bucket_key,
        label,
        weightage,
        merit_max,
        jury_max,
        day_group,
        display_order: Math.round(Number(input.display_order ?? 0)) || 0,
        session_keys: input.session_keys ?? [],
        is_active: input.is_active !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bucket_key" }
    )
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to save bucket" };
  }
  revalidatePath(PATH);
  return { success: true, data: rowToBucket(data) };
}

// Update just the weightage (+ optional merit/jury split) of one bucket — the
// common edit from the framework table. Keeps merit+jury consistent with the
// new weightage when a split is present.
export async function setBucketWeightage(input: {
  bucket_key: string;
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

  const supabase = await bucketsClient();
  const { data: existing } = await supabase
    .from("scoring_buckets")
    .select("*")
    .eq("bucket_key", input.bucket_key)
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
    .eq("bucket_key", input.bucket_key)
    .select()
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to update weightage" };
  }
  revalidatePath(PATH);
  return { success: true, data: rowToBucket(data) };
}

export async function deleteScoringBucket(
  bucketKey: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await bucketsClient();
  const { error } = await supabase
    .from("scoring_buckets")
    .delete()
    .eq("bucket_key", bucketKey);
  if (error) return { success: false, error: error.message };
  revalidatePath(PATH);
  return { success: true, data: null };
}
