"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";
import {
  HANDBOOK_CHECKLIST_TEMPLATE,
  validateChecklistInput,
} from "@/lib/yip/admin-checklist";

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AdminChecklistItem = {
  id: string;
  category: string;
  sequence_order: number;
  title: string;
  description: string | null;
  handbook_page: number | null;
  is_active: boolean;
  created_at: string | null;
  /** Convenience: does any organizer_checklist row reference this title? */
  in_use_count?: number;
};

export type AdminChecklistItemInput = {
  category: string;
  title: string;
  description?: string | null;
  handbook_page?: number | null;
  sequence_order?: number | null;
  is_active?: boolean;
};

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

const REVAL_PATH = "/dashboard/admin/checklist";

function sanitizeUpdate(
  input: Partial<AdminChecklistItemInput>
): Partial<{
  category: string;
  title: string;
  description: string | null;
  handbook_page: number | null;
  sequence_order: number;
  is_active: boolean;
}> {
  const patch: ReturnType<typeof sanitizeUpdate> = {};
  if (typeof input.category === "string") patch.category = input.category.trim();
  if (typeof input.title === "string") patch.title = input.title.trim();
  if ("description" in input) {
    const d = input.description;
    patch.description = typeof d === "string" ? (d.trim() || null) : null;
  }
  if ("handbook_page" in input) {
    const p = input.handbook_page;
    patch.handbook_page =
      typeof p === "number" && Number.isFinite(p) && p > 0 ? Math.trunc(p) : null;
  }
  if (
    typeof input.sequence_order === "number" &&
    Number.isFinite(input.sequence_order) &&
    input.sequence_order >= 1
  ) {
    patch.sequence_order = Math.trunc(input.sequence_order);
  }
  if (typeof input.is_active === "boolean") patch.is_active = input.is_active;
  return patch;
}

// ───────────────────────────────────────────────────────────────
// LIST
// ───────────────────────────────────────────────────────────────

export async function adminListChecklistTemplate(opts?: {
  includeInactive?: boolean;
}): Promise<AdminChecklistItem[]> {
  const includeInactive = opts?.includeInactive ?? true;
  const supabase = await createServiceClient();

  let query = supabase
    .from("default_checklist_items")
    .select("id, category, sequence_order, title, description, handbook_page, is_active, created_at")
    .order("category", { ascending: true })
    .order("sequence_order", { ascending: true });

  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error || !data) return [];

  // Gather per-title in-use counts so the client can surface the
  // "active but not used by any event" informational banner.
  const titles = Array.from(new Set(data.map((d) => d.title)));
  const usage = new Map<string, number>();

  if (titles.length > 0) {
    const { data: usageRows } = await supabase
      .from("organizer_checklist")
      .select("title")
      .in("title", titles);

    for (const r of usageRows ?? []) {
      usage.set(r.title, (usage.get(r.title) ?? 0) + 1);
    }
  }

  return data.map((r) => ({
    id: r.id,
    category: r.category,
    sequence_order: r.sequence_order,
    title: r.title,
    description: r.description,
    handbook_page: r.handbook_page,
    is_active: r.is_active ?? true,
    created_at: r.created_at,
    in_use_count: usage.get(r.title) ?? 0,
  }));
}

// ───────────────────────────────────────────────────────────────
// CREATE
// ───────────────────────────────────────────────────────────────

export async function adminCreateChecklistItem(
  input: AdminChecklistItemInput
): Promise<ActionResult<AdminChecklistItem>> {
  const validation = validateChecklistInput(input);
  if (validation) return { success: false, error: validation.message };

  const supabase = await createServiceClient();
  const category = input.category.trim();

  // Auto-assign sequence_order to max(existing)+1 when not provided.
  let seq = input.sequence_order ?? 0;
  if (!seq || seq < 1) {
    const { data: maxRow } = await supabase
      .from("default_checklist_items")
      .select("sequence_order")
      .eq("category", category)
      .order("sequence_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    seq = (maxRow?.sequence_order ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("default_checklist_items")
    .insert({
      category,
      sequence_order: seq,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      handbook_page:
        typeof input.handbook_page === "number" && input.handbook_page > 0
          ? Math.trunc(input.handbook_page)
          : null,
      is_active: input.is_active ?? true,
    })
    .select("id, category, sequence_order, title, description, handbook_page, is_active, created_at")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create item" };
  }

  revalidatePath(REVAL_PATH);
  return {
    success: true,
    data: {
      id: data.id,
      category: data.category,
      sequence_order: data.sequence_order,
      title: data.title,
      description: data.description,
      handbook_page: data.handbook_page,
      is_active: data.is_active ?? true,
      created_at: data.created_at,
      in_use_count: 0,
    },
  };
}

// ───────────────────────────────────────────────────────────────
// UPDATE
// ───────────────────────────────────────────────────────────────

export async function adminUpdateChecklistItem(
  id: string,
  input: Partial<AdminChecklistItemInput>
): Promise<ActionResult<null>> {
  const patch = sanitizeUpdate(input);

  // Validate only the fields present in the patch.
  const toCheck = {
    title: "title" in patch ? patch.title : undefined,
    category: "category" in patch ? patch.category : undefined,
    sequence_order: "sequence_order" in patch ? patch.sequence_order : undefined,
  };
  if (toCheck.title !== undefined || toCheck.category !== undefined || toCheck.sequence_order !== undefined) {
    // Only validate fields we're touching. Supply safe defaults for the rest.
    const validation = validateChecklistInput({
      title: toCheck.title ?? "placeholder title",
      category: toCheck.category ?? "placeholder category",
      sequence_order: toCheck.sequence_order ?? 1,
    });
    if (validation && (
      (validation.field === "title" && toCheck.title !== undefined) ||
      (validation.field === "category" && toCheck.category !== undefined) ||
      (validation.field === "sequence_order" && toCheck.sequence_order !== undefined)
    )) {
      return { success: false, error: validation.message };
    }
  }

  if (Object.keys(patch).length === 0) {
    return { success: false, error: "No changes to apply" };
  }

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("default_checklist_items")
    .update(patch)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath(REVAL_PATH);
  return { success: true, data: null };
}

// ───────────────────────────────────────────────────────────────
// SOFT-DELETE / REACTIVATE
// ───────────────────────────────────────────────────────────────

export async function adminDeactivateChecklistItem(
  id: string
): Promise<ActionResult<null>> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("default_checklist_items")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(REVAL_PATH);
  return { success: true, data: null };
}

export async function adminReactivateChecklistItem(
  id: string
): Promise<ActionResult<null>> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("default_checklist_items")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(REVAL_PATH);
  return { success: true, data: null };
}

// ───────────────────────────────────────────────────────────────
// REORDER WITHIN CATEGORY
// ───────────────────────────────────────────────────────────────

export async function adminReorderChecklistCategory(
  category: string,
  orderedIds: string[]
): Promise<ActionResult<null>> {
  if (!category || category.trim().length < 2) {
    return { success: false, error: "Category is required" };
  }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: false, error: "Order list is empty" };
  }

  const supabase = await createServiceClient();

  // Two-phase renumber to dodge a hypothetical unique (category, sequence_order)
  // index: bump everything high first, then write the final positions.
  const BUMP = 10_000;

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const { error } = await supabase
      .from("default_checklist_items")
      .update({ sequence_order: BUMP + i + 1 })
      .eq("id", id)
      .eq("category", category.trim());
    if (error) return { success: false, error: error.message };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const { error } = await supabase
      .from("default_checklist_items")
      .update({ sequence_order: i + 1 })
      .eq("id", id)
      .eq("category", category.trim());
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(REVAL_PATH);
  return { success: true, data: null };
}

// ───────────────────────────────────────────────────────────────
// RENAME CATEGORY
// ───────────────────────────────────────────────────────────────

export async function adminRenameCategory(
  oldName: string,
  newName: string
): Promise<ActionResult<{ updated: number }>> {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();
  if (trimmedOld.length < 2) {
    return { success: false, error: "Existing category name is invalid" };
  }
  if (trimmedNew.length < 2) {
    return { success: false, error: "New category name must be at least 2 characters" };
  }
  if (trimmedOld === trimmedNew) {
    return { success: false, error: "New name is identical to the current name" };
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("default_checklist_items")
    .update({ category: trimmedNew })
    .eq("category", trimmedOld)
    .select("id");

  if (error) return { success: false, error: error.message };
  revalidatePath(REVAL_PATH);
  return { success: true, data: { updated: data?.length ?? 0 } };
}

// ───────────────────────────────────────────────────────────────
// RESEED FROM HANDBOOK (diff by title — skip duplicates)
// ───────────────────────────────────────────────────────────────

export async function adminReseedFromHandbook(): Promise<
  ActionResult<{ inserted: number; skipped: number }>
> {
  const supabase = await createServiceClient();

  const { data: existing, error: readErr } = await supabase
    .from("default_checklist_items")
    .select("title");

  if (readErr) return { success: false, error: readErr.message };

  const existingTitles = new Set((existing ?? []).map((r) => r.title));
  const missing = HANDBOOK_CHECKLIST_TEMPLATE.filter(
    (t) => !existingTitles.has(t.title)
  );

  if (missing.length === 0) {
    return { success: true, data: { inserted: 0, skipped: HANDBOOK_CHECKLIST_TEMPLATE.length } };
  }

  const rows = missing.map((t) => ({
    category: t.category,
    sequence_order: t.sequence_order,
    title: t.title,
    description: t.description,
    handbook_page: t.handbook_page,
    is_active: true,
  }));

  const { error: insertErr } = await supabase
    .from("default_checklist_items")
    .insert(rows);

  if (insertErr) return { success: false, error: insertErr.message };

  revalidatePath(REVAL_PATH);
  return {
    success: true,
    data: {
      inserted: missing.length,
      skipped: HANDBOOK_CHECKLIST_TEMPLATE.length - missing.length,
    },
  };
}
