"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import type { YiZone } from "@/lib/yip/hierarchy";

// ─── Types ──────────────────────────────────────────────────────

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AdminTopic = {
  id: string;
  category: "central" | "regional";
  zone: YiZone | null;
  topic_number: number | null;
  title: string;
  description: string | null;
  sub_points: string[];
  handbook_page: number | null;
  is_active: boolean;
  created_at: string | null;
};

export type TopicInput = {
  category: "central" | "regional";
  zone: YiZone | null;
  topic_number?: number | null;
  title: string;
  description?: string | null;
  sub_points?: string[];
  handbook_page?: number | null;
};

export type TopicFilters = {
  category?: "central" | "regional";
  zone?: YiZone | null;
  q?: string;
  includeInactive?: boolean;
};

export type CsvRow = {
  category: "central" | "regional";
  zone: YiZone | null;
  title: string;
  description?: string | null;
  sub_points?: string[];
  handbook_page?: number | null;
};

// ─── Validation helpers (local, not exported) ───────────────────

function validateInput(input: TopicInput): string | null {
  if (!input.title || input.title.trim().length < 3) {
    return "Title must be at least 3 characters";
  }
  if (input.category === "central" && input.zone !== null) {
    return "Central topics must not have a zone";
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
  category: "central" | "regional";
  zone: YiZone | null;
  topic_number: number | null;
  title: string;
  description: string | null;
  sub_points: unknown;
  handbook_page: number | null;
  is_active: boolean | null;
  created_at: string | null;
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
    is_active: row.is_active ?? true,
    created_at: row.created_at,
  };
}

// ─── List ───────────────────────────────────────────────────────

export async function adminListTopics(
  filters?: TopicFilters
): Promise<AdminTopic[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .from("topics")
    .select(
      "id, category, zone, topic_number, title, description, sub_points, handbook_page, is_active, created_at"
    )
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
  return data.map(mapRow);
}

// ─── Create ─────────────────────────────────────────────────────

export async function adminCreateTopic(
  input: TopicInput
): Promise<ActionResult<AdminTopic>> {
  const err = validateInput(input);
  if (err) return { success: false, error: err };

  const supabase = await createServiceClient();

  // Auto-assign topic_number if not provided
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
      is_active: true,
    })
    .select(
      "id, category, zone, topic_number, title, description, sub_points, handbook_page, is_active, created_at"
    )
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create topic",
    };
  }

  revalidatePath("/dashboard/admin/topics");
  revalidatePath("/dashboard/topics");
  return { success: true, data: mapRow(data) };
}

// ─── Update ─────────────────────────────────────────────────────

export async function adminUpdateTopic(
  id: string,
  input: TopicInput
): Promise<ActionResult<AdminTopic>> {
  const err = validateInput(input);
  if (err) return { success: false, error: err };

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("topics")
    .update({
      category: input.category,
      zone: input.zone,
      topic_number: input.topic_number ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      sub_points: normalizeSubPoints(input.sub_points),
      handbook_page: input.handbook_page ?? null,
    })
    .eq("id", id)
    .select(
      "id, category, zone, topic_number, title, description, sub_points, handbook_page, is_active, created_at"
    )
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update topic",
    };
  }

  revalidatePath("/dashboard/admin/topics");
  revalidatePath("/dashboard/topics");
  return { success: true, data: mapRow(data) };
}

// ─── Deactivate (soft delete) ───────────────────────────────────

export async function adminDeactivateTopic(
  id: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("topics")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/topics");
  revalidatePath("/dashboard/topics");
  return { success: true, data: null };
}

// ─── Reactivate ─────────────────────────────────────────────────

export async function adminReactivateTopic(
  id: string
): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("topics")
    .update({ is_active: true })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/topics");
  revalidatePath("/dashboard/topics");
  return { success: true, data: null };
}

// ─── Reorder within a (category, zone) bucket ───────────────────
// Two-phase update to avoid tripping the UNIQUE(category, zone, topic_number)
// constraint while numbers temporarily collide.

export async function adminReorderTopics(
  category: "central" | "regional",
  zone: YiZone | null,
  orderedIds: string[]
): Promise<ActionResult<{ reordered: number }>> {
  if (category === "regional" && !zone) {
    return { success: false, error: "Regional reorder requires a zone" };
  }
  if (category === "central" && zone) {
    return { success: false, error: "Central reorder must not have a zone" };
  }
  if (orderedIds.length === 0) {
    return { success: true, data: { reordered: 0 } };
  }

  const supabase = await createServiceClient();

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

  revalidatePath("/dashboard/admin/topics");
  revalidatePath("/dashboard/topics");
  return { success: true, data: { reordered: orderedIds.length } };
}

// ─── Bulk Import (CSV) ──────────────────────────────────────────
// Dedupes by (category, zone, title). Existing rows are skipped (not updated).

export async function adminBulkImport(
  rows: CsvRow[]
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  if (rows.length === 0) {
    return { success: false, error: "No rows to import" };
  }

  const supabase = await createServiceClient();

  // Fetch existing (category, zone, title) combos for dedupe.
  const { data: existing } = await supabase
    .from("topics")
    .select("category, zone, title");

  const existingKeys = new Set(
    (existing ?? []).map(
      (r) =>
        `${r.category}|${r.zone ?? ""}|${(r.title ?? "").trim().toLowerCase()}`
    )
  );

  // Track the highest topic_number per bucket so we can auto-increment.
  const maxByBucket = new Map<string, number>();
  for (const r of existing ?? []) {
    const key = `${r.category}|${(r as { zone: string | null }).zone ?? ""}`;
    const n = (r as { topic_number?: number | null }).topic_number ?? 0;
    if (n > (maxByBucket.get(key) ?? 0)) maxByBucket.set(key, n);
  }

  // Also consider topic_number from DB directly.
  const { data: numbered } = await supabase
    .from("topics")
    .select("category, zone, topic_number");
  for (const r of numbered ?? []) {
    const key = `${r.category}|${r.zone ?? ""}`;
    const n = r.topic_number ?? 0;
    if (n > (maxByBucket.get(key) ?? 0)) maxByBucket.set(key, n);
  }

  const toInsert: Array<{
    category: "central" | "regional";
    zone: YiZone | null;
    topic_number: number;
    title: string;
    description: string | null;
    sub_points: string[];
    handbook_page: number | null;
    is_active: boolean;
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
    if (row.category === "central" && row.zone) {
      skipped++;
      continue;
    }
    const key = `${row.category}|${row.zone ?? ""}|${title.toLowerCase()}`;
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
      is_active: true,
    });
  }

  if (toInsert.length === 0) {
    return { success: true, data: { inserted: 0, skipped } };
  }

  const { error } = await supabase.from("topics").insert(toInsert);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/admin/topics");
  revalidatePath("/dashboard/topics");
  return { success: true, data: { inserted: toInsert.length, skipped } };
}
