"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { requireJurySession } from "@/lib/yip/auth/yip-session";
import { revalidatePath } from "next/cache";
import {
  deriveCommitteeLevels,
  averageDimensions,
  ZERO_COMMITTEE_DIMENSIONS,
  type CommitteeDimensions,
} from "@/lib/yip/committee-score";
import { getCommitteeDimensionsConfig } from "@/app/yip/actions/committee-dimensions";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

/** One judge's /60 marks for a committee. */
export type CommitteeJudgeScore = CommitteeDimensions & {
  jury_assignment_id: string;
  jury_name: string;
  total60: number;
  judge_notes: string | null;
  scored_by: string | null;
};

export type CommitteeRow = {
  committee_name: string;
  committee_number: number | null;
  member_count: number;
  chair_lead: string | null;
  // Judges assigned to this committee (may be more than have scored yet).
  assigned: { jury_assignment_id: string; jury_name: string }[];
  // Judges who have entered marks.
  scores: CommitteeJudgeScore[];
  scored_count: number;
  // Averaged across the judges who scored (the agreed committee mark).
  avg: CommitteeDimensions;
  cmte_level: number;
  bill_level: number;
  total60: number;
};

export type CommitteeAssignmentRoster = {
  committees: { committee_name: string; committee_number: number | null; member_count: number }[];
  jurors: { id: string; jury_name: string }[];
  assignments: { jury_assignment_id: string; committee_name: string }[];
};

async function scoresLocked(eventId: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("scores_locked")
    .eq("id", eventId)
    .maybeSingle();
  return Boolean(data?.scores_locked);
}

function dimsOf(s: CommitteeDimensions): CommitteeDimensions {
  return {
    bill_draft_quality: s.bill_draft_quality,
    policy_relevance: s.policy_relevance,
    innovation: s.innovation,
    feasibility: s.feasibility,
    team_collaboration: s.team_collaboration,
    presentation_defence: s.presentation_defence,
  };
}

/**
 * Build the per-committee scoring view for the organiser screen: every
 * non-empty committee with its members count, chair/lead, assigned judges,
 * each judge's /60, and the averaged committee total. Manage-gated — this is
 * the scoring WORKSPACE (organisers may enter on a judge's behalf), distinct
 * from the national-only results leaderboard.
 */
export async function getCommitteeScoring(
  eventId: string
): Promise<ActionResult<CommitteeRow[]>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to score this event" };
  }
  const supabase = await createServiceClient();

  const [partsRes, scoresRes, assignRes, jurorsRes, metaRes] = await Promise.all([
    supabase
      .from("participants")
      .select("committee_name, committee_number")
      .eq("event_id", eventId)
      .not("committee_name", "is", null),
    supabase.from("committee_scores").select("*").eq("event_id", eventId),
    supabase
      .from("jury_committee_assignments")
      .select("jury_assignment_id, committee_name")
      .eq("event_id", eventId),
    supabase
      .from("jury_assignments")
      .select("id, jury_name")
      .eq("event_id", eventId)
      .eq("is_active", true),
    supabase.from("committee_meta").select("committee_name, chair_lead").eq("event_id", eventId),
  ]);

  if (partsRes.error) return { success: false, error: partsRes.error.message };

  // Admin-configurable committee-level divisors (default 10 / 2).
  const cmteCfg = await getCommitteeDimensionsConfig();
  const cmteDivisors = {
    draftingDivisor: cmteCfg.draftingDivisor,
    presentationDivisor: cmteCfg.presentationDivisor,
  };

  // committee → member count + number (number is shared across a committee).
  const counts = new Map<string, number>();
  const numberByName = new Map<string, number | null>();
  for (const p of partsRes.data ?? []) {
    const name = (p.committee_name ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!numberByName.has(name)) numberByName.set(name, p.committee_number ?? null);
  }

  const jurorName = new Map<string, string>(
    (jurorsRes.data ?? []).map((j) => [j.id, j.jury_name as string])
  );
  const chairByName = new Map<string, string | null>(
    (metaRes.data ?? []).map((m) => [m.committee_name, m.chair_lead ?? null])
  );

  // committee → assigned judges
  const assignedByCommittee = new Map<string, { jury_assignment_id: string; jury_name: string }[]>();
  for (const a of assignRes.data ?? []) {
    const arr = assignedByCommittee.get(a.committee_name) ?? [];
    arr.push({
      jury_assignment_id: a.jury_assignment_id,
      jury_name: jurorName.get(a.jury_assignment_id) ?? "—",
    });
    assignedByCommittee.set(a.committee_name, arr);
  }

  // committee → entered scores
  const scoresByCommittee = new Map<string, CommitteeJudgeScore[]>();
  for (const s of scoresRes.data ?? []) {
    const dims = dimsOf(s);
    const { total60 } = deriveCommitteeLevels(dims);
    const arr = scoresByCommittee.get(s.committee_name) ?? [];
    arr.push({
      ...dims,
      jury_assignment_id: s.jury_assignment_id,
      jury_name: jurorName.get(s.jury_assignment_id) ?? "(removed judge)",
      total60,
      judge_notes: s.judge_notes ?? null,
      scored_by: s.scored_by ?? null,
    });
    scoresByCommittee.set(s.committee_name, arr);
  }

  const rows: CommitteeRow[] = [...counts.entries()]
    .sort((a, b) => (numberByName.get(a[0]) ?? 999) - (numberByName.get(b[0]) ?? 999))
    .map(([committee_name, member_count]) => {
      const scores = scoresByCommittee.get(committee_name) ?? [];
      const avg = scores.length
        ? averageDimensions(scores.map(dimsOf))
        : { ...ZERO_COMMITTEE_DIMENSIONS };
      const { cmteLevel, billLevel, total60 } = deriveCommitteeLevels(avg, cmteDivisors);
      // Assigned judges, plus any judge who scored but isn't formally assigned.
      const assigned = assignedByCommittee.get(committee_name) ?? [];
      return {
        committee_name,
        committee_number: numberByName.get(committee_name) ?? null,
        member_count,
        chair_lead: chairByName.get(committee_name) ?? null,
        assigned,
        scores,
        scored_count: scores.length,
        avg,
        cmte_level: cmteLevel,
        bill_level: billLevel,
        total60,
      };
    });

  return { success: true, data: rows };
}

/** Upsert ONE judge's /60 score for a committee. Manage-gated. */
export async function upsertCommitteeScore(input: {
  eventId: string;
  committeeName: string;
  juryAssignmentId: string;
  dimensions: CommitteeDimensions;
  judgeNotes?: string | null;
  scoredBy?: string | null;
}): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to score this event" };
  }
  if (!input.juryAssignmentId) {
    return { success: false, error: "Pick a judge for this score" };
  }
  if (await scoresLocked(input.eventId)) {
    return { success: false, error: "Scores are locked for this event." };
  }

  const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  const d = input.dimensions;
  const row = {
    event_id: input.eventId,
    committee_name: input.committeeName.trim(),
    jury_assignment_id: input.juryAssignmentId,
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
    .upsert(row, { onConflict: "event_id,committee_name,jury_assignment_id" });
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/committee-scoring`);
  return { success: true, data: null };
}

/** Remove ONE judge's score for a committee. Manage-gated. */
export async function deleteCommitteeScore(input: {
  eventId: string;
  committeeName: string;
  juryAssignmentId: string;
}): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to score this event" };
  }
  if (await scoresLocked(input.eventId)) {
    return { success: false, error: "Scores are locked for this event." };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("committee_scores")
    .delete()
    .eq("event_id", input.eventId)
    .eq("committee_name", input.committeeName.trim())
    .eq("jury_assignment_id", input.juryAssignmentId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/committee-scoring`);
  return { success: true, data: null };
}

/** Set a committee's Chair/Lead (one per committee). Manage-gated. */
export async function setCommitteeChairLead(input: {
  eventId: string;
  committeeName: string;
  chairLead: string | null;
}): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();
  const { error } = await supabase.from("committee_meta").upsert(
    {
      event_id: input.eventId,
      committee_name: input.committeeName.trim(),
      chair_lead: input.chairLead?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,committee_name" }
  );
  if (error) return { success: false, error: error.message };

  revalidatePath(`/yip/dashboard/events/${input.eventId}/committee-scoring`);
  return { success: true, data: null };
}

/** Roster for assigning judges to committees (all or select). Manage-gated. */
export async function getCommitteeAssignmentRoster(
  eventId: string
): Promise<ActionResult<CommitteeAssignmentRoster>> {
  const access = await getYipEventAccess(eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  const [partsRes, jurorsRes, assignRes] = await Promise.all([
    supabase
      .from("participants")
      .select("committee_name, committee_number")
      .eq("event_id", eventId)
      .not("committee_name", "is", null),
    supabase
      .from("jury_assignments")
      .select("id, jury_name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("jury_committee_assignments")
      .select("jury_assignment_id, committee_name")
      .eq("event_id", eventId),
  ]);
  if (partsRes.error) return { success: false, error: partsRes.error.message };

  const counts = new Map<string, number>();
  const numberByName = new Map<string, number | null>();
  for (const p of partsRes.data ?? []) {
    const name = (p.committee_name ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!numberByName.has(name)) numberByName.set(name, p.committee_number ?? null);
  }
  const committees = [...counts.entries()]
    .map(([committee_name, member_count]) => ({
      committee_name,
      committee_number: numberByName.get(committee_name) ?? null,
      member_count,
    }))
    .sort((a, b) => (a.committee_number ?? 999) - (b.committee_number ?? 999));

  return {
    success: true,
    data: {
      committees,
      jurors: (jurorsRes.data ?? []).map((j) => ({ id: j.id, jury_name: j.jury_name as string })),
      assignments: assignRes.data ?? [],
    },
  };
}

/**
 * Replace the full set of committees a single judge is assigned to (all or
 * select). Mirrors setJurorSessions. Manage-gated.
 */
export async function setJurorCommittees(input: {
  eventId: string;
  juryAssignmentId: string;
  committeeNames: string[];
}): Promise<ActionResult<null>> {
  const access = await getYipEventAccess(input.eventId);
  if (!access.canManage) {
    return { success: false, error: "Not authorized to manage this event" };
  }
  const supabase = await createServiceClient();

  // Confirm the juror belongs to this event (defence-in-depth).
  const { data: juror } = await supabase
    .from("jury_assignments")
    .select("id")
    .eq("id", input.juryAssignmentId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (!juror) return { success: false, error: "Judge not found for this event" };

  const { error: delErr } = await supabase
    .from("jury_committee_assignments")
    .delete()
    .eq("event_id", input.eventId)
    .eq("jury_assignment_id", input.juryAssignmentId);
  if (delErr) return { success: false, error: delErr.message };

  const names = [...new Set(input.committeeNames.map((c) => c.trim()).filter(Boolean))];
  if (names.length > 0) {
    const { error: insErr } = await supabase.from("jury_committee_assignments").insert(
      names.map((committee_name) => ({
        event_id: input.eventId,
        jury_assignment_id: input.juryAssignmentId,
        committee_name,
      }))
    );
    if (insErr) return { success: false, error: insErr.message };
  }

  revalidatePath(`/yip/dashboard/events/${input.eventId}/committee-scoring`);
  return { success: true, data: null };
}

// ─── Juror self-entry (the jury login screen) ─────────────────────────────
// Authorized by the jury SESSION cookie (requireJurySession), NOT by
// getYipEventAccess — judges aren't event managers.

export type JurorCommitteeRow = {
  committee_name: string;
  committee_number: number | null;
  member_count: number;
  my: (CommitteeDimensions & { judge_notes: string | null }) | null;
};

/** The committees THIS judge is assigned to, with their own marks (if any). */
export async function getJurorCommittees(
  juryAssignmentId: string,
  eventId: string
): Promise<ActionResult<{ locked: boolean; committees: JurorCommitteeRow[] }>> {
  const auth = await requireJurySession(juryAssignmentId, eventId);
  if (!auth.ok) return { success: false, error: auth.error };
  const supabase = await createServiceClient();

  const [assignRes, partsRes, scoresRes, evRes] = await Promise.all([
    supabase
      .from("jury_committee_assignments")
      .select("committee_name")
      .eq("event_id", eventId)
      .eq("jury_assignment_id", juryAssignmentId),
    supabase
      .from("participants")
      .select("committee_name, committee_number")
      .eq("event_id", eventId)
      .not("committee_name", "is", null),
    supabase
      .from("committee_scores")
      .select("*")
      .eq("event_id", eventId)
      .eq("jury_assignment_id", juryAssignmentId),
    supabase.from("events").select("scores_locked").eq("id", eventId).maybeSingle(),
  ]);

  const counts = new Map<string, number>();
  const numberByName = new Map<string, number | null>();
  for (const p of partsRes.data ?? []) {
    const name = (p.committee_name ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (!numberByName.has(name)) numberByName.set(name, p.committee_number ?? null);
  }
  const myByName = new Map((scoresRes.data ?? []).map((s) => [s.committee_name, s]));

  const committees: JurorCommitteeRow[] = (assignRes.data ?? [])
    .map((a) => a.committee_name)
    .filter((name) => counts.has(name)) // only non-empty committees
    .sort((a, b) => (numberByName.get(a) ?? 999) - (numberByName.get(b) ?? 999))
    .map((committee_name) => {
      const s = myByName.get(committee_name);
      return {
        committee_name,
        committee_number: numberByName.get(committee_name) ?? null,
        member_count: counts.get(committee_name) ?? 0,
        my: s
          ? { ...dimsOf(s), judge_notes: s.judge_notes ?? null }
          : null,
      };
    });

  return {
    success: true,
    data: { locked: Boolean(evRes.data?.scores_locked), committees },
  };
}

/** A judge enters/updates THEIR OWN /60 for a committee they're assigned to. */
export async function submitJurorCommitteeScore(input: {
  juryAssignmentId: string;
  eventId: string;
  committeeName: string;
  dimensions: CommitteeDimensions;
  judgeNotes?: string | null;
}): Promise<ActionResult<null>> {
  const auth = await requireJurySession(input.juryAssignmentId, input.eventId);
  if (!auth.ok) return { success: false, error: auth.error };
  if (await scoresLocked(input.eventId)) {
    return { success: false, error: "Scores are locked for this event." };
  }
  const supabase = await createServiceClient();

  // The judge may only score a committee they're assigned to.
  const { data: asg } = await supabase
    .from("jury_committee_assignments")
    .select("id")
    .eq("event_id", input.eventId)
    .eq("jury_assignment_id", input.juryAssignmentId)
    .eq("committee_name", input.committeeName.trim())
    .maybeSingle();
  if (!asg) {
    return { success: false, error: "You are not assigned to this committee." };
  }

  const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  const d = input.dimensions;
  const { error } = await supabase.from("committee_scores").upsert(
    {
      event_id: input.eventId,
      committee_name: input.committeeName.trim(),
      jury_assignment_id: input.juryAssignmentId,
      bill_draft_quality: clamp(d.bill_draft_quality),
      policy_relevance: clamp(d.policy_relevance),
      innovation: clamp(d.innovation),
      feasibility: clamp(d.feasibility),
      team_collaboration: clamp(d.team_collaboration),
      presentation_defence: clamp(d.presentation_defence),
      judge_notes: input.judgeNotes ?? null,
      scored_by: "self",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,committee_name,jury_assignment_id" }
  );
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
