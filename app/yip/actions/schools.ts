"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function listSchools(filters?: {
  state?: string;
  thalirOnly?: boolean;
  q?: string;
}): Promise<School[]> {
  const supabase = await createServiceClient();
  let q = supabase.from("schools").select("*").order("name");

  if (filters?.state) q = q.eq("state", filters.state);
  if (filters?.thalirOnly) q = q.eq("is_thalir", true);
  if (filters?.q) q = q.ilike("name", `%${filters.q}%`);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as School[];
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
  const { data } = await supabase
    .from("schools")
    .select("id, name, is_thalir, participants:participants(event_id)");

  if (!data) return [];

  return data.map((row) => {
    const participations = (row.participants as Array<{ event_id: string }>) ?? [];
    const uniqueEvents = new Set(participations.map((p) => p.event_id));
    return {
      school_id: row.id,
      school_name: row.name,
      is_thalir: row.is_thalir ?? false,
      total_participations: participations.length,
      events_count: uniqueEvents.size,
    };
  });
}

export async function createSchool(
  input: Omit<School, "id" | "created_at">
): Promise<ActionResult<School>> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("schools")
    .insert(input)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/schools");
  return { success: true, data: data as School };
}

export async function updateSchool(
  id: string,
  input: Partial<Omit<School, "id" | "created_at">>
): Promise<ActionResult<School>> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("schools")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/schools");
  return { success: true, data: data as School };
}

export async function deleteSchool(id: string): Promise<ActionResult> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/schools");
  return { success: true, data: null };
}

/**
 * Find-or-create by (name, city) — used by CSV import.
 * Prevents duplicate rows when the same school is nominated across events.
 */
export async function findOrCreateSchool(
  name: string,
  city: string | null,
  state: string | null
): Promise<string | null> {
  if (!name?.trim()) return null;
  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("schools")
    .select("id")
    .eq("name", name.trim())
    .eq("city", city ?? "")
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("schools")
    .insert({ name: name.trim(), city, state })
    .select("id")
    .single();

  if (error || !created) return null;
  return created.id;
}
