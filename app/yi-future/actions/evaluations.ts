"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import type { Database } from "@/types/yi-future/database";
import type { ActionResult } from "./editions";
import {
  computeTotal,
  type CriteriaScores,
  type Rubric,
} from "@/lib/yi-future/rubric";
import { sendPushToSubject } from "@/app/yi-future/actions/push";

type EvaluationStatus = Database["future"]["Enums"]["evaluation_status"];

export type OtherJurorEvalRow = {
  id: string;
  jury_id: string;
  team_id: string;
  event_id: string;
  status: EvaluationStatus | null;
  total_score: number;
  comments: string | null;
  key_strengths: string | null;
  key_gaps: string | null;
  scalability_assessment: string | null;
  policy_relevance: string | null;
  recommendation:
    | "strongly_recommend"
    | "recommend"
    | "not_recommended"
    | null;
  jury_name: string | null;
  archetype: string | null;
};

/**
 * Anti-bias gate [PRD §5.2]:
 * Returns OTHER jurors' submitted evaluations for a team within an event
 * ONLY if the caller's own evaluation for that team+event has status='submitted'.
 * Until the caller submits, returns []. This prevents jurors from anchoring
 * on each other's scores before forming an independent judgement.
 */
export async function getOtherJurorEvalsForTeam(input: {
  juryId: string;
  teamId: string;
  eventId: string;
}): Promise<OtherJurorEvalRow[]> {
  const svc = await createServiceClient();

  // Gate: caller must have their own submitted eval for this team+event
  const { data: own } = await svc
    .schema("future")
    .from("evaluations")
    .select("id, status")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  const ownRow = own as { id: string; status: EvaluationStatus | null } | null;
  if (!ownRow || ownRow.status !== "submitted") {
    return [];
  }

  // Fetch other jurors' submitted evaluations for the same team+event
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select(
      "id, jury_id, team_id, event_id, status, total_score, comments, key_strengths, key_gaps, scalability_assessment, policy_relevance, recommendation, jury_assignments(jury_name, archetype)"
    )
    .eq("team_id", input.teamId)
    .eq("event_id", input.eventId)
    .eq("status", "submitted")
    .neq("jury_id", input.juryId);

  type Row = Omit<OtherJurorEvalRow, "jury_name" | "archetype"> & {
    jury_assignments: { jury_name: string; archetype: string } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];
  return rows.map((r) => ({
    id: r.id,
    jury_id: r.jury_id,
    team_id: r.team_id,
    event_id: r.event_id,
    status: r.status,
    total_score: r.total_score,
    comments: r.comments,
    key_strengths: r.key_strengths,
    key_gaps: r.key_gaps,
    scalability_assessment: r.scalability_assessment,
    policy_relevance: r.policy_relevance,
    recommendation: r.recommendation,
    jury_name: r.jury_assignments?.jury_name ?? null,
    archetype: r.jury_assignments?.archetype ?? null,
  }));
}

/**
 * Jury-side evaluation save/submit.
 * Uses the mentor/jury access-code session — no Supabase Auth required.
 * Scope must be validated by the caller (jury must be assigned to this team).
 */
export async function saveEvaluation(input: {
  juryId: string;
  teamId: string;
  eventId: string;
  rubricId: string;
  rubric: Rubric;
  scores: CriteriaScores;
  comments: string | null;
  qaNotes: string | null;
  keyStrengths?: string | null;
  keyGaps?: string | null;
  scalabilityAssessment?: string | null;
  policyRelevance?: string | null;
  recommendation?: "strongly_recommend" | "recommend" | "not_recommended" | null;
  submit: boolean;
}): Promise<ActionResult> {
  // Validate jury-team assignment (conflict check)
  const svc = await createServiceClient();
  const { data: assign } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .select("team_id")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .maybeSingle();
  if (!assign) {
    return { ok: false, error: "You are not assigned to this team." };
  }

  // Compute total with range validation (throws on out-of-range)
  let total: number;
  try {
    total = computeTotal(input.scores, input.rubric);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Upsert by unique (event_id, jury_id, team_id) — enforce one eval per jury per team per event
  // The schema doesn't declare this unique index in types here; rely on manual select-first:
  const { data: existing } = await svc
    .schema("future")
    .from("evaluations")
    .select("id, status")
    .eq("jury_id", input.juryId)
    .eq("team_id", input.teamId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  const ex = existing as { id: string; status: EvaluationStatus | null } | null;

  if (ex?.status === "submitted") {
    return {
      ok: false,
      error: "Evaluation already submitted. Ask admin to unlock if needed.",
    };
  }

  const status: EvaluationStatus = input.submit ? "submitted" : "draft";
  const payload = {
    jury_id: input.juryId,
    team_id: input.teamId,
    event_id: input.eventId,
    rubric_id: input.rubricId,
    criteria_scores: input.scores,
    total_score: total,
    comments: input.comments,
    q_and_a_notes: input.qaNotes,
    key_strengths: input.keyStrengths ?? null,
    key_gaps: input.keyGaps ?? null,
    scalability_assessment: input.scalabilityAssessment ?? null,
    policy_relevance: input.policyRelevance ?? null,
    recommendation: input.recommendation ?? null,
    status,
    submitted_at: input.submit ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  } as never;

  let evaluationId: string;
  if (ex) {
    const { error } = await svc
      .schema("future")
      .from("evaluations")
      .update(payload)
      .eq("id", ex.id);
    if (error) return { ok: false, error: error.message };
    evaluationId = ex.id;
  } else {
    const { data: ins, error } = await svc
      .schema("future")
      .from("evaluations")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    evaluationId = (ins as { id: string } | null)?.id ?? "";
  }

  // Audit trail
  if (evaluationId) {
    await svc
      .schema("future")
      .from("evaluation_audit_log")
      .insert({
        evaluation_id: evaluationId,
        new_scores: input.scores,
        new_total: total,
        reason: input.submit ? "submit" : "save_draft",
      });
  }

  revalidatePath("/jury");
  revalidatePath(`/jury/${input.teamId}`);
  revalidatePath("/chapter/scoring");

  // Fire-and-forget push to team captain on submit
  if (input.submit && evaluationId) {
    try {
      const { data: team } = await (svc as any)
        .schema("future")
        .from("teams")
        .select("captain_id")
        .eq("id", input.teamId)
        .maybeSingle();
      const captainId = (team as { captain_id: string | null } | null)
        ?.captain_id;
      if (captainId) {
        await sendPushToSubject("delegate", captainId, {
          title: "Jury evaluation submitted",
          body: "A jury has submitted scores for your team.",
          url: "/me/results",
        });
      }
    } catch (err) {
      console.error("[push] saveEvaluation notify captain failed:", err);
    }
  }

  return {
    ok: true,
    message: input.submit
      ? `Submitted — ${total}/${input.rubric.total_max}`
      : "Draft saved.",
  };
}
