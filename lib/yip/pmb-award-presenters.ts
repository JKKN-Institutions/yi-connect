// Best Private Member's Bill — who may win it at the National Finals.
//
// At the 2026 regional round the computed winner had never presented his bill
// (the chair had to pin someone else). At the Finals only Swapnil's shortlisted
// bills are presented, so the award is limited to the students who move (or
// present) a private member's bill entered on the Bills page.
//
// Students can self-file a private member's bill draft from /yip/me, so only
// bills an organiser entered or approved count (approved / presented / passed,
// or rejected ON THE FLOOR — a rejected bill with no votes was turned down at
// approval). Student drafts (drafting / submitted) never count.
//
// Used by BOTH the results engine and the chair's pin, so they can't disagree.
// Only read at the National Finals. No qualifying bills → no limit (the award
// must never silently go empty).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundLevel } from "@/lib/yip/round-level";

export const PMB_AWARD_KEY = "best_private_members_bill";

export function pmbPresenterRuleApplies(
  awardKey: string | null | undefined,
  roundLevel: RoundLevel | null,
  presenters: Set<string>
): boolean {
  return (
    awardKey === PMB_AWARD_KEY &&
    roundLevel === "national" &&
    presenters.size > 0
  );
}

/** Participant ids that move or present a private member's bill in this event.
 *  Throws on a read error, so a failed read never quietly drops the limit. */
export async function fetchPmbPresenterIds(
  supabase: SupabaseClient,
  eventId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("bills")
    .select(
      "mover_participant_id, presenter_1, presenter_2, status, votes_for, votes_against, votes_abstain"
    )
    .eq("event_id", eventId)
    .eq("source", "private_member");
  if (error) throw new Error(`Couldn't read private member's bills: ${error.message}`);
  const ids = new Set<string>();
  for (const b of (data ?? []) as {
    mover_participant_id: string | null;
    presenter_1: string | null;
    presenter_2: string | null;
    status: string | null;
    votes_for: number | null;
    votes_against: number | null;
    votes_abstain: number | null;
  }[]) {
    const votes =
      (b.votes_for ?? 0) + (b.votes_against ?? 0) + (b.votes_abstain ?? 0);
    const counts =
      b.status === "approved" ||
      b.status === "presented" ||
      b.status === "passed" ||
      (b.status === "rejected" && votes > 0);
    if (!counts) continue;
    for (const id of [b.mover_participant_id, b.presenter_1, b.presenter_2]) {
      if (id) ids.add(id);
    }
  }
  return ids;
}
