import "server-only";

import type { tpService } from "@/lib/take-pride/supabase";

type SupabaseClient = ReturnType<typeof tpService>;

/*
 * Gate check-in BY NAME, for a delegate who has no badge with them
 * (Director, 10 Oct: volunteers may search by name). NOT a "use server" file
 * and NOT gated: the caller (./actions.ts) passes requireTpDesk() first and
 * says which rows it may touch:
 *   sample: false -> real delegates only (a real organiser)
 *   sample: true  -> sample delegates only (review mode)
 * The is_sample filter is in every query, read and write, so a review
 * session can never see or change a real delegate. No phone or email is read.
 */

export const NAME_SEARCH_MIN = 2;
export const NAME_SEARCH_MAX_RESULTS = 10;

export type GateNameHit = {
  id: string;
  full_name: string;
  chapter: string;
  business_name: string | null;
  checked_in_at: string | null;
};

export type GateNameCheckIn = { name: string; chapter: string; already: boolean; at: string };

/** Letters, digits, spaces, dots, hyphens and apostrophes only: no LIKE wildcards reach the query. */
export function cleanNameQuery(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .replace(/[^\p{L}\p{N} .'-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60)
    : "";
}

export async function searchByName(db: SupabaseClient, q: string, opts: { sample: boolean }): Promise<GateNameHit[]> {
  // "priya ram" matches "Priya Raman" and "Priya S Ramesh": words in order, anything between.
  const pattern = `%${q.split(" ").join("%")}%`;
  const { data, error } = await db
    .from("tp_delegates")
    .select("id, full_name, chapter, business_name, checked_in_at")
    .eq("is_sample", opts.sample)
    .ilike("full_name", pattern)
    .order("full_name")
    .order("id")
    .limit(NAME_SEARCH_MAX_RESULTS);
  if (error) throw new Error(error.message);
  return (data ?? []) as GateNameHit[];
}

/**
 * Stamps the check-in once (first one wins) and records it was done by name.
 * A second tap reports "already in" with the first time.
 */
export async function checkInByName(
  db: SupabaseClient,
  id: string,
  opts: { sample: boolean; by: string | null }
): Promise<{ ok: true; data: GateNameCheckIn } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const { data: first, error } = await db
    .from("tp_delegates")
    .update({ checked_in_at: now, checked_in_by: opts.by, checked_in_method: "name" })
    .eq("id", id)
    .eq("is_sample", opts.sample)
    .is("checked_in_at", null)
    .select("full_name, chapter, checked_in_at");
  if (error) return { ok: false, error: "Could not check in. Please try again." };
  if (first?.length) {
    return { ok: true, data: { name: first[0].full_name, chapter: first[0].chapter, already: false, at: first[0].checked_in_at } };
  }
  const { data: d, error: readErr } = await db
    .from("tp_delegates")
    .select("full_name, chapter, checked_in_at")
    .eq("id", id)
    .eq("is_sample", opts.sample)
    .maybeSingle();
  if (readErr) return { ok: false, error: "Could not check in. Please try again." };
  if (!d) return { ok: false, error: opts.sample ? "Review mode checks in sample delegates only." : "That delegate is not on the list." };
  return { ok: true, data: { name: d.full_name, chapter: d.chapter, already: true, at: d.checked_in_at } };
}
