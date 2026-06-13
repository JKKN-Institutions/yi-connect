"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { revalidatePath } from "next/cache";
import {
  deriveCommitteeLevels,
  type CommitteeDimensions,
} from "@/lib/yip/committee-score";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CommitteeRow = CommitteeDimensions & {
  committee_name: string;
  member_count: number;
  scored: boolean;
  judge_notes: string | null;
  scored_by: string | null;
  // derived (display only)
  cmte_level: number;
  bill_level: number;
  total60: number;
};

const ZERO: CommitteeDimensions = {
  bill_draft_quality: 0,
  policy_relevance: 0,
  innovation: 0,
  feasibility: 0,
  team_collaboration: 0,
  presentation_defence: 0,
};

/**
 * List every committee in the event (derived from participants.committee_name)
 * with its once-per-committee score (if entered) + member count. View-gated.
 */
export async function getCommitteeScoring(
  eventId: string
): Promise<ActionResult<CommitteeRow[]>> {
  // Committee scoring metrics are national/super-admin-only (2026-06-13) —
  // same gate as the scoring leaderboard / results. Organisers may RUN
  // committee scoring (upsert, canManage) but NOT read the metrics.
  const access = await getYipEventAccess(eventId);
  if (!access.canViewScores) {
    return { success: false, error: "Not authorized to view scores" };
  }
  const supabase = await createServiceClient();

  const { data: parts, error: pErr } = await supabase
    .from("participants")
    .select("committee_name")
    .eq("event_id", eventId)
    .not("committee_name", "is", null);
  if (pErr) return { success: false, error: pErr.message };

  const counts = new Map<string, number>();
  for (const p of parts ?? []) {
    const name = (p.committee_name ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const { data: scores, error: sErr } = await supabase
    .from("committee_scores")
    .select("*")
    .eq("event_id", eventId);
  if (sErr) return { success: false, error: sErr.message };

  const scoreByName = new Map(
    (scores ?? []).map((s) => [s.committee_name, s])
  );

  const rows: CommitteeRow[] = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([committee_name, member_count]) => {
      const s = scoreByName.get(committee_name);
      const dims: CommitteeDimensions = s
        ? {
            bill_draft_quality: s.bill_draft_quality,
            policy_relevance: s.policy_relevance,
            innovation: s.innovation,
            feasibility: s.feasibility,
            team_collaboration: s.team_collaboration,
            presentation_defence: s.presentation_defence,
          }
        : ZERO;
      const { cmteLevel, billLevel, total60 } = deriveCommitteeLevels(dims);
      return {
        ...dims,
        committee_name,
        member_count,
        scored: !!s,
        judge_notes: s?.judge_notes ?? null,
        scored_by: s?.scored_by ?? null,
        cmte_level: cmteLevel,
        bill_level: billLevel,
        total60,
      };
    });

  return { success: true, data: rows };
}

/** Upsert one committee's /60 score. Manage-gated. */
export async function upsertCommitteeScore(input: {
  eventId: string;
  committeeName: string;
  dimensions: CommitteeDimensions;
  judgeNotes?: string | null;
  scoredBy?: string | null;
}): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to score this event" };
  }

  // Clamp each dimension to 0–10 (defence-in-depth alongside the DB CHECK).
  const clamp = (n: number) =>
    Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  const d = input.dimensions;
  const row = {
    event_id: input.eventId,
    committee_name: input.committeeName.trim(),
    bill_draft_quality: clamp(d.bill_draft_quality),
    policy_relevance: clamp(d.policy_relevance),
    innovation: clamp(d.innovation),
    feasibility: clamp(d.feasibility),
    team_collaboration: clamp(d.team_collaboration),
    presentation_defence: clamp(d.presentation_defence),
    judge_notes: input.judgeNotes ?? null,
    scored_by: input.scoredBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("committee_scores")
    .upsert(row, { onConflict: "event_id,committee_name" });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/committee-scoring`);
  return { success: true, data: null };
}
