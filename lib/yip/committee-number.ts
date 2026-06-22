/**
 * Global committee numbering — the single source of truth.
 *
 * Every committee has ONE permanent number, shared across all events and pages:
 * the `topic_number` of its row in `yip.topics` (category='committee'). The 15
 * official YIP 2026 ministries are 1..15. A committee name that isn't in the
 * catalogue (a legacy/custom committee) is registered on demand as an INACTIVE
 * topic with the next free number (16, 17…) so it gets a stable global number
 * too — never a per-event position that would collide with an official one.
 *
 * Lookup is case-insensitive by committee name. `committee_name` stays the join
 * key for bills/scores; only the NUMBER is standardised here.
 */

import type { createServiceClient } from "@/lib/yip/supabase/server";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface CommitteeNumbering {
  /** lowercased committee name → permanent number */
  numberByName: Map<string, number>;
  /** permanent number → canonical committee name */
  nameByNumber: Map<number, string>;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Load the committee-number catalogue (all committees, active + inactive). */
export async function getCommitteeNumbering(
  supabase: ServiceClient
): Promise<CommitteeNumbering> {
  const { data } = await supabase
    .from("topics")
    .select("title, topic_number")
    .eq("category", "committee");
  const numberByName = new Map<string, number>();
  const nameByNumber = new Map<number, string>();
  for (const r of (data ?? []) as Array<{ title: string; topic_number: number | null }>) {
    if (r.topic_number == null || !r.title) continue;
    numberByName.set(norm(r.title), r.topic_number);
    nameByNumber.set(r.topic_number, r.title);
  }
  return { numberByName, nameByNumber };
}

/**
 * Permanent number for a committee name. Returns the catalogue number if known;
 * otherwise registers the name as an inactive committee with the next free
 * number (16, 17…) and returns that. Mutates `numbering` so repeated calls in a
 * batch stay consistent. Returns null only for a blank name.
 */
export async function committeeNumberForName(
  supabase: ServiceClient,
  numbering: CommitteeNumbering,
  name: string | null | undefined
): Promise<number | null> {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  const existing = numbering.numberByName.get(norm(clean));
  if (existing != null) return existing;

  // Off-list → next free number after the current max, persisted so it's stable.
  const maxNum = Math.max(0, ...numbering.nameByNumber.keys());
  const next = maxNum + 1;
  await supabase
    .from("topics")
    .insert({ category: "committee", title: clean, topic_number: next, is_active: false });
  numbering.numberByName.set(norm(clean), next);
  numbering.nameByNumber.set(next, clean);
  return next;
}
