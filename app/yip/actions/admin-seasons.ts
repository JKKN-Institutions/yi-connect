"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────────────────

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type AdminSeason = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type SeasonInput = {
  name: string;
  year: number;
  is_active?: boolean;
};

export type SeasonStats = {
  events_count: number;
  chapters_count: number;
  participants_count: number;
  results_published_count: number;
};

const SEASONS_PATH = "/dashboard/admin/seasons";
const ADMIN_PATH = "/dashboard/admin";

// ─── Helpers ────────────────────────────────────────────────────

function validateInput(
  input: SeasonInput
):
  | { ok: true; clean: { name: string; year: number; is_active: boolean } }
  | { ok: false; error: string } {
  const name = (input.name ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Name must be at least 3 characters" };
  }

  const year = Number(input.year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return {
      ok: false,
      error: "Year must be a 4-digit number between 2000 and 2100",
    };
  }

  return {
    ok: true,
    clean: {
      name,
      year: Math.round(year),
      is_active: !!input.is_active,
    },
  };
}

function mapRow(row: {
  id: string;
  name: string;
  year: number;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}): AdminSeason {
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function clearActiveOnAll(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  exceptId?: string
): Promise<void> {
  let q = supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

// ─── List ───────────────────────────────────────────────────────

export async function adminListSeasons(): Promise<AdminSeason[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("id, name:display_name, year, is_active, created_at, updated_at")
    .order("is_active", { ascending: false })
    .order("year", { ascending: false })
    .order("display_name", { ascending: true });

  if (error || !data) return [];
  return data.map(mapRow);
}

// ─── Create ─────────────────────────────────────────────────────

export async function adminCreateSeason(
  input: SeasonInput
): Promise<ActionResult<AdminSeason>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  // Active-exclusivity: only one active season at a time.
  if (clean.is_active) {
    await clearActiveOnAll(supabase);
  }

  const { data, error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .insert({
      display_name: clean.name,
      year: clean.year,
      is_active: clean.is_active,
    })
    .select("id, name:display_name, year, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create season",
    };
  }

  revalidatePath(SEASONS_PATH);
  revalidatePath(ADMIN_PATH);
  return { success: true, data: mapRow(data) };
}

// ─── Update ─────────────────────────────────────────────────────

export async function adminUpdateSeason(
  id: string,
  input: SeasonInput
): Promise<ActionResult<AdminSeason>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const validated = validateInput(input);
  if (!validated.ok) return { success: false, error: validated.error };
  const clean = validated.clean;

  const supabase = await createServiceClient();

  // Active-exclusivity: if this season is being set active, unset others.
  if (clean.is_active) {
    await clearActiveOnAll(supabase, id);
  }

  const { data, error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .update({
      display_name: clean.name,
      year: clean.year,
      is_active: clean.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name:display_name, year, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to update season",
    };
  }

  revalidatePath(SEASONS_PATH);
  revalidatePath(ADMIN_PATH);
  return { success: true, data: mapRow(data) };
}

// ─── Archive (soft) ─────────────────────────────────────────────
// Blocks if any events still reference this season AND status is not
// 'completed' or 'results_published' — prevents orphaning live events.

export async function adminArchiveSeason(
  id: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  const { data: allEvents, error: fetchErr } = await supabase
    .from("events")
    .select("id, status")
    .eq("season_id", id);

  if (fetchErr) return { success: false, error: fetchErr.message };

  const DONE_STATUSES = new Set(["completed", "results_published"]);
  const liveEvents = (allEvents ?? []).filter(
    (e) => !DONE_STATUSES.has(e.status as string)
  );

  if (liveEvents.length > 0) {
    return {
      success: false,
      error: `Cannot archive: ${liveEvents.length} event${
        liveEvents.length === 1 ? "" : "s"
      } in this season ${
        liveEvents.length === 1 ? "is" : "are"
      } not yet completed. Finish or delete them first.`,
    };
  }

  const { error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(SEASONS_PATH);
  revalidatePath(ADMIN_PATH);
  return { success: true, data: null };
}

// ─── Reactivate ─────────────────────────────────────────────────
// Enforces active-exclusivity — reactivating this season unsets all others.

export async function adminReactivateSeason(
  id: string
): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();

  await clearActiveOnAll(supabase, id);

  const { error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath(SEASONS_PATH);
  revalidatePath(ADMIN_PATH);
  return { success: true, data: null };
}

// ─── Clone ──────────────────────────────────────────────────────
// Duplicates name template with new year. Does NOT auto-activate (caller can
// promote with adminReactivateSeason). Keeps old seasons intact.

export async function adminCloneSeason(
  id: string,
  newYear: number
): Promise<ActionResult<AdminSeason>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const year = Number(newYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return {
      success: false,
      error: "Year must be a 4-digit number between 2000 and 2100",
    };
  }

  const supabase = await createServiceClient();
  const { data: source, error: srcErr } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("name:display_name, year")
    .eq("id", id)
    .single();

  if (srcErr || !source) {
    return { success: false, error: "Source season not found" };
  }

  // Replace old year token in the name with the new one, else append it.
  const srcYearStr = String(source.year);
  let newName: string;
  if (source.name.includes(srcYearStr)) {
    newName = source.name.split(srcYearStr).join(String(year));
  } else {
    newName = `${source.name} (${year})`;
  }

  // Pre-check collision on (name, year) — not enforced by DB but nicer UX.
  const { data: collision } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .select("id")
    .eq("display_name", newName)
    .eq("year", year)
    .maybeSingle();

  if (collision) {
    return {
      success: false,
      error: `A season "${newName}" for year ${year} already exists`,
    };
  }

  const { data, error } = await supabase
    .schema("yi").from("years") /* TODO yip-absorption: seasons table dropped — verify yi.years shape + filter on events.yi_year_id */
    .insert({
      display_name: newName,
      year,
      is_active: false,
    })
    .select("id, name:display_name, year, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to clone season",
    };
  }

  revalidatePath(SEASONS_PATH);
  revalidatePath(ADMIN_PATH);
  return { success: true, data: mapRow(data) };
}

// ─── Stats ──────────────────────────────────────────────────────

export async function adminGetSeasonStats(
  id: string
): Promise<SeasonStats> {
  const supabase = await createServiceClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, chapter_name, status")
    .eq("season_id", id);

  const rows = events ?? [];
  const eventIds = rows.map((e) => e.id);

  const chapterSet = new Set<string>();
  for (const e of rows) {
    if (e.chapter_name) chapterSet.add(e.chapter_name);
  }

  const results_published_count = rows.filter(
    (e) => e.status === "results_published"
  ).length;

  let participants_count = 0;
  if (eventIds.length > 0) {
    const { count } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);
    participants_count = count ?? 0;
  }

  return {
    events_count: rows.length,
    chapters_count: chapterSet.size,
    participants_count,
    results_published_count,
  };
}
