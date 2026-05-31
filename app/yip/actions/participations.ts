"use server";

// FOUNDATION — fields are a starting point; domain review needed before production use.
//
// Layer 2b demo — YIP delegate participation (yi-directory consolidation plan,
// 2026-05-31, §4/§6 Ph6 + §7 walkthrough).
//
// This is the find-or-create + relationship pattern in miniature:
//   1. resolvePerson(...) → a SHARED yi_directory.people identity (deduped).
//   2. INSERT a yip.participations row → YIP's OWN relationship with that human.
//
// Adding the same delegate twice yields ONE identity and (only if the caller
// asks) more participation rows — never a duplicated human. Kept intentionally
// minimal; team/score/attendance management lands with the real delegate UI.

import { createServiceClient } from "@/lib/yip/supabase/server";
import { resolvePerson } from "@/lib/yi/directory/resolve-person";
import { can } from "@/lib/yi/auth/can";

export type ParticipationRow = {
  id: string;
  person_id: string;
  edition_id: string | null;
  event_id: string | null;
  team: string | null;
  status: string | null;
  score: number | null;
};

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

// yip.participations is not in the generated Database types yet, so we shape
// the rows we touch ourselves (same casting approach the codebase uses for
// un-typed tables). The service client is already pinned to the yip schema.
function participations(svc: Svc) {
  return (
    svc as unknown as {
      from: (table: "participations") => {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: ParticipationRow | null;
              error: { message: string } | null;
            }>;
          };
        };
        select: (cols: string) => {
          eq: (
            col: string,
            val: string
          ) => Promise<{ data: ParticipationRow[] | null; error: { message: string } | null }>;
          order: (
            col: string,
            opts: { ascending: boolean }
          ) => Promise<{ data: ParticipationRow[] | null; error: { message: string } | null }>;
        };
      };
    }
  ).from("participations");
}

/**
 * Add a participant: dedupe their identity at the source, then create THIS
 * app's relationship row. Returns the new participation id.
 */
export async function addParticipant(input: {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  edition_id?: string;
  event_id?: string;
  team?: string;
}): Promise<{ ok: true; participationId: string; personId: string } | { ok: false; error: string }> {
  const fullName = input.full_name.trim();
  if (fullName.length < 2) {
    return { ok: false, error: "Enter the participant's full name." };
  }

  let personId: string;
  try {
    personId = await resolvePerson({
      full_name: fullName,
      email: input.email ?? null,
      phone: input.phone ?? null,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to resolve identity." };
  }

  const svc = await createServiceClient();
  const { data, error } = await participations(svc)
    .insert({
      person_id: personId,
      edition_id: input.edition_id ?? null,
      event_id: input.event_id ?? null,
      team: input.team ?? null,
    })
    .select("id, person_id, edition_id, event_id, team, status, score")
    .single();

  if (error || !data) {
    return { ok: false, error: `Failed to add participant: ${error?.message ?? "unknown"}` };
  }
  return { ok: true, participationId: data.id, personId };
}

/**
 * List participations, optionally filtered to one event.
 */
export async function listParticipants(filter?: {
  event_id?: string;
}): Promise<{ ok: true; data: ParticipationRow[] } | { ok: false; error: string }> {
  const svc = await createServiceClient();
  const cols = "id, person_id, edition_id, event_id, team, status, score";

  const { data, error } = filter?.event_id
    ? await participations(svc).select(cols).eq("event_id", filter.event_id)
    : await participations(svc).select(cols).order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
