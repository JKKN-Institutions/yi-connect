"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";
import { revalidatePath } from "next/cache";

// Post-absorption note: YIP's old `schools` table was migrated into the
// shared yi.institutions taxonomy (school + higher_secondary + college).
// This module now wraps yi.institutions queries with the legacy School
// public type so existing callers (admin/schools page, CSV importer) keep
// compiling. Contact fields (contact_person/phone/email) and notes are
// not part of yi.institutions and surface as null.

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type School = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_thalir: boolean;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
};

type InstitutionRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_thalir: boolean | null;
  created_at: string | null;
};

function rowToSchool(r: InstitutionRow): School {
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    state: r.state,
    is_thalir: r.is_thalir ?? false,
    contact_person: null,
    contact_phone: null,
    contact_email: null,
    notes: null,
    created_at: r.created_at ?? new Date().toISOString(),
  };
}

export async function listSchools(filters?: {
  state?: string;
  thalirOnly?: boolean;
  q?: string;
}): Promise<School[]> {
  const supabase = await createServiceClient();
  let q = supabase
    .schema("yi")
    .from("institutions")
    .select("id, name, city, state, is_thalir, created_at")
    .in("type", ["school", "higher_secondary"])
    .order("name");

  if (filters?.state) q = q.eq("state", filters.state);
  if (filters?.thalirOnly) q = q.eq("is_thalir", true);
  if (filters?.q) q = q.ilike("name", `%${filters.q}%`);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as InstitutionRow[]).map(rowToSchool);
}

export async function getSchoolParticipationStats(): Promise<
  Array<{
    school_id: string;
    school_name: string;
    is_thalir: boolean;
    total_participations: number;
    events_count: number;
  }>
> {
  const supabase = await createServiceClient();

  // yi.institutions does not have an inline participants relation; pull
  // institutions + participants separately and aggregate in-memory.
  const { data: insts } = await supabase
    .schema("yi")
    .from("institutions")
    .select("id, name, is_thalir")
    .in("type", ["school", "higher_secondary"]);
  if (!insts) return [];

  const { data: parts } = await supabase
    .from("participants")
    .select("yi_institution_id, event_id");
  const partsByInst = new Map<string, Array<{ event_id: string }>>();
  for (const p of (parts ?? []) as Array<{
    yi_institution_id: string | null;
    event_id: string;
  }>) {
    if (!p.yi_institution_id) continue;
    const arr = partsByInst.get(p.yi_institution_id) ?? [];
    arr.push({ event_id: p.event_id });
    partsByInst.set(p.yi_institution_id, arr);
  }

  return (insts as Array<{ id: string; name: string; is_thalir: boolean | null }>).map(
    (row) => {
      const participations = partsByInst.get(row.id) ?? [];
      const uniqueEvents = new Set(participations.map((p) => p.event_id));
      return {
        school_id: row.id,
        school_name: row.name,
        is_thalir: row.is_thalir ?? false,
        total_participations: participations.length,
        events_count: uniqueEvents.size,
      };
    }
  );
}

export async function createSchool(
  input: Omit<School, "id" | "created_at">
): Promise<ActionResult<School>> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .schema("yi")
    .from("institutions")
    .insert({
      name: input.name,
      type: "school",
      city: input.city,
      state: input.state,
      is_thalir: input.is_thalir,
    })
    .select("id, name, city, state, is_thalir, created_at")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Insert failed" };
  revalidatePath("/yip/dashboard/schools");
  return { success: true, data: rowToSchool(data as InstitutionRow) };
}

export async function updateSchool(
  id: string,
  input: Partial<Omit<School, "id" | "created_at">>
): Promise<ActionResult<School>> {
  const supabase = await createServiceClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.state !== undefined) patch.state = input.state;
  if (input.is_thalir !== undefined) patch.is_thalir = input.is_thalir;

  const { data, error } = await supabase
    .schema("yi")
    .from("institutions")
    .update(patch)
    .eq("id", id)
    .select("id, name, city, state, is_thalir, created_at")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Update failed" };
  revalidatePath("/yip/dashboard/schools");
  return { success: true, data: rowToSchool(data as InstitutionRow) };
}

export async function deleteSchool(id: string): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .schema("yi")
    .from("institutions")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  await logAuditAction({
    action_type: "delete",
    target_table: "schools",
    target_id: id,
  });
  revalidatePath("/yip/dashboard/schools");
  return { success: true, data: null };
}

export async function findOrCreateSchool(
  name: string,
  city: string | null,
  state: string | null
): Promise<string | null> {
  if (!name?.trim()) return null;
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .schema("yi")
    .from("institutions")
    .select("id")
    .eq("name", name.trim())
    .eq("city", city ?? "")
    .in("type", ["school", "higher_secondary"])
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: created, error } = await supabase
    .schema("yi")
    .from("institutions")
    .insert({ name: name.trim(), type: "school", city, state })
    .select("id")
    .single();

  if (error || !created) return null;
  return (created as { id: string }).id;
}
