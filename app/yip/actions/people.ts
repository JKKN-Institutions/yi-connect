"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { revalidatePath } from "next/cache";
import {
  sanitizePersonInput as sanitize,
  type PersonInput,
} from "@/lib/yip/people/find-or-create";

// PersonInput and findOrCreatePerson now live in lib/yip/people/find-or-create.
// Every other export in this file is gated with requireSuperAdmin();
// findOrCreatePerson never was, and in a "use server" file an ungated export is
// a callable endpoint — which, once it became the identity spine, would let a
// caller pre-create a contestant matching a student's name+school and capture
// that student's career on the next import. It is reachable from server code
// only now. Re-exported here as a TYPE (erased at runtime) for existing callers.
export type { PersonInput };

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type Person = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  parent_phone: string | null;
  class: number | null;
  section: string | null;
  school_id: string | null;
  school_name: string | null;
  home_state: string | null;
  city: string | null;
  photo_url: string | null;
  bio: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

/** Journey: every participation in every event for a given person. */
export type JourneyStep = {
  participant_id: string;
  event_id: string;
  event_name: string;
  event_level: string;
  event_year: number | null;
  event_zone: string | null;
  day1_date: string;
  parliament_role: string | null;
  party_side: string | null;
  serial_no: number | null;
  party_number: number | null;
  committee_number: number | null;
  committee_name: string | null;
  constituency_name: string | null;
  awards: string | null;
  rank: number | null;
  avg_score: number | null;
  results_published_at: string | null;
  qualified_for_next: boolean;
};

// Normalization (normPhone / sanitizePersonInput) lives alongside the matcher
// in lib/yip/people/find-or-create so both use exactly one definition.

// ─── CRUD ───────────────────────────────────────────────────────

export async function listPeople(filters?: {
  q?: string;
  schoolId?: string;
  state?: string;
  includeInactive?: boolean;
  limit?: number;
}): Promise<Person[]> {
  const supabase = await createServiceClient();
  let q = supabase.from("contestants").select("*").order("full_name");
  if (!filters?.includeInactive) q = q.eq("is_active", true);
  if (filters?.schoolId) q = q.eq("school_id", filters.schoolId);
  if (filters?.state) q = q.eq("home_state", filters.state);
  if (filters?.q) q = q.ilike("full_name", `%${filters.q}%`);
  if (filters?.limit) q = q.limit(filters.limit);

  const { data } = await q;
  return (data ?? []).map((r) => ({
    ...r,
    is_active: r.is_active ?? true,
  })) as Person[];
}

export async function getPerson(id: string): Promise<Person | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("contestants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { ...data, is_active: data.is_active ?? true } as Person;
}

export async function createPerson(
  input: PersonInput
): Promise<ActionResult<Person>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const clean = sanitize(input);
  if (!clean.full_name || clean.full_name.length < 2) {
    return { success: false, error: "Name required (min 2 chars)" };
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("contestants")
    .insert(clean)
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/dashboard/admin/people");
  return {
    success: true,
    data: { ...data, is_active: data.is_active ?? true } as Person,
  };
}

export async function updatePerson(
  id: string,
  input: Partial<PersonInput>
): Promise<ActionResult<Person>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const clean = sanitize({ full_name: "placeholder", ...input } as PersonInput);
  // Restore partiality — only keys the caller passed
  const patch: Record<string, string | number | null> = {};
  for (const key of Object.keys(input) as Array<keyof PersonInput>) {
    const v = (clean as Record<string, string | number | null>)[key];
    patch[key] = v ?? null;
  }
  if (!input.full_name) delete patch.full_name;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("contestants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/dashboard/admin/people");
  revalidatePath(`/yip/dashboard/admin/people/${id}`);
  return {
    success: true,
    data: { ...data, is_active: data.is_active ?? true } as Person,
  };
}

export async function archivePerson(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("contestants")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/dashboard/admin/people");
  return { success: true, data: null };
}

export async function restorePerson(id: string): Promise<ActionResult> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("contestants")
    .update({ is_active: true })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/yip/dashboard/admin/people");
  return { success: true, data: null };
}

// findOrCreatePerson moved to lib/yip/people/find-or-create (see the
// import note at the top of this file — it was the one ungated export here).

// ─── Journey ─────────────────────────────────────────────────────

export async function getPersonJourney(personId: string): Promise<JourneyStep[]> {
  const supabase = await createServiceClient();

  // `yi_year_id`, NOT `season_id`. yip.events.season_id does not exist — it was
  // renamed — and PostgREST answers an unknown embedded column with a hard 400
  // (`42703: column events_1.season_id does not exist`), not a partial row. The
  // error used to be discarded here, so every journey silently came back empty
  // and both career pages ("The Record" at /yip/me/journey and the admin person
  // page) rendered blank for EVERY student, including the linked ones. That read
  // as "not set up yet" rather than "broken", which is why it survived.
  //
  // results_published_at is selected here rather than re-queried per step; the
  // old per-step lookup was an N+1 over the same rows this join already returns.
  const { data: parts, error } = await supabase
    .from("participants")
    .select(
      `
      id,
      event_id,
      parliament_role,
      party_side,
      serial_no,
      party_number,
      committee_number,
      committee_name,
      constituency_name,
      qualified_for_next,
      event:events(id, name, level, day1_date, zone, yi_year_id, results_published_at),
      result:results!results_participant_id_fkey(avg_score, rank, award_category)
    `
    )
    .eq("person_id", personId)
    .order("created_at", { ascending: true });

  // Never swallow this again: an empty journey and a failed query look identical
  // to the caller, and that is exactly how the bug above stayed invisible.
  if (error) {
    console.error("getPersonJourney query failed", {
      personId,
      code: error.code,
      message: error.message,
    });
    return [];
  }

  if (!parts) return [];

  // Second pass: event season year (optional enrichment)
  const steps: JourneyStep[] = [];
  for (const p of parts as Array<Record<string, unknown>>) {
    const ev = p.event as {
      id: string;
      name: string;
      level: string;
      day1_date: string;
      zone: string | null;
      yi_year_id: string | null;
      results_published_at: string | null;
    } | null;
    const resArr = (p.result as Array<{
      avg_score: number | null;
      rank: number | null;
      award_category: string | null;
    }>) ?? [];
    const res = resArr[0];

    // Publish status — comes from the join above, no per-step round trip.
    const publishedAt = ev?.results_published_at ?? null;

    // Year
    let year: number | null = null;
    if (ev?.day1_date) {
      year = parseInt(ev.day1_date.slice(0, 4), 10);
    }

    steps.push({
      participant_id: p.id as string,
      event_id: ev?.id ?? (p.event_id as string),
      event_name: ev?.name ?? "(unknown event)",
      event_level: ev?.level ?? "chapter",
      event_year: year,
      event_zone: ev?.zone ?? null,
      day1_date: ev?.day1_date ?? "",
      parliament_role: (p.parliament_role as string | null) ?? null,
      party_side: (p.party_side as string | null) ?? null,
      serial_no: (p.serial_no as number | null) ?? null,
      party_number: (p.party_number as number | null) ?? null,
      committee_number: (p.committee_number as number | null) ?? null,
      committee_name: (p.committee_name as string | null) ?? null,
      constituency_name: (p.constituency_name as string | null) ?? null,
      // The "Not ranked — absent Day N" status lives in award_category but is
      // NOT an award (Director ruling 2026-06-25) — keep it out of the career
      // awards rollup. rank is already null for these rows.
      awards:
        res?.award_category &&
        !res.award_category.startsWith("Not ranked")
          ? res.award_category
          : null,
      rank: res?.rank ?? null,
      avg_score: res?.avg_score ?? null,
      results_published_at: publishedAt,
      qualified_for_next: (p.qualified_for_next as boolean | null) ?? false,
    });
  }

  return steps.sort((a, b) => (a.day1_date ?? "").localeCompare(b.day1_date ?? ""));
}

// ─── Merge (dedup tool) ─────────────────────────────────────────

export async function mergePeople(
  keepId: string,
  mergeId: string
): Promise<ActionResult<{ moved_participants: number }>> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return { success: false, error: gate.error };
  if (keepId === mergeId) {
    return { success: false, error: "Cannot merge a person into itself" };
  }
  const supabase = await createServiceClient();

  // Reassign participants
  const { data: moved, error: mvErr } = await supabase
    .from("participants")
    .update({ person_id: keepId })
    .eq("person_id", mergeId)
    .select("id");
  if (mvErr) return { success: false, error: mvErr.message };

  // Soft-delete the merged person
  await supabase.from("contestants").update({ is_active: false, notes: `Merged into ${keepId}` }).eq("id", mergeId);

  revalidatePath("/yip/dashboard/admin/people");
  return {
    success: true,
    data: { moved_participants: moved?.length ?? 0 },
  };
}

// ─── Access: get my person from my participant session ────────────

/**
 * Given a participant_id (from student's session cookie), return the
 * person_id. Used by /me/journey to look up all their events.
 */
export async function getPersonIdForParticipant(
  participantId: string
): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("participants")
    .select("person_id")
    .eq("id", participantId)
    .maybeSingle();
  return data?.person_id ?? null;
}
