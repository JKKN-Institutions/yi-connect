"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import type { ActionResult } from "./editions";
import {
  computeMentorTotal,
  MENTOR_RUBRIC,
  type MentorScores,
} from "@/lib/yi-future/rubric-mentor";

/**
 * Mentor incubation evaluation save/submit.
 * Per PRD §4.2 — mentors score teams during the 90-day journey using a 5-criterion
 * rubric (Participation/25, Submission/25, Progress/25, Engagement/15, Growth/10).
 *
 * Authorization: mentor must be assigned to the team via mentor_team_assignments
 * if any assignment row exists for the team; otherwise we fall back to checking
 * that mentor.edition_id === team.edition_id.
 *
 * Upsert key: (team_id, mentor_id, phase_event_id) — including a NULL phase_event_id
 * row that represents an "overall" / unscoped evaluation.
 */
export async function saveMentorEvaluation(input: {
  teamId: string;
  mentorId: string;
  phaseEventId: string | null;
  scores: MentorScores;
  notes: string | null;
  submit: boolean;
}): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "mentor") {
    return { ok: false, error: "Mentor session required." };
  }
  if (session.id !== input.mentorId) {
    return { ok: false, error: "Mentor session does not match mentor id." };
  }

  const svc = await createServiceClient();

  // Look up team — must share edition with mentor
  const { data: teamRow } = await svc
    .schema("future")
    .from("teams")
    .select("id, edition_id")
    .eq("id", input.teamId)
    .maybeSingle();
  const team = teamRow as { id: string; edition_id: string } | null;
  if (!team) return { ok: false, error: "Team not found." };
  if (team.edition_id !== session.edition_id) {
    return { ok: false, error: "Team is not in your edition." };
  }

  // If any mentor↔team assignments exist for this team, mentor must be in them.
  // Otherwise (no assignments yet), edition match is sufficient.
  const { data: anyAssign } = await svc
    .schema("future")
    .from("mentor_team_assignments")
    .select("mentor_id")
    .eq("team_id", input.teamId);
  const assignmentList = (anyAssign ?? []) as { mentor_id: string }[];
  if (assignmentList.length > 0) {
    const isAssigned = assignmentList.some(
      (a) => a.mentor_id === input.mentorId
    );
    if (!isAssigned) {
      return { ok: false, error: "You are not assigned to this team." };
    }
  }

  // Validate phase event if provided — must belong to team's chapter+edition
  if (input.phaseEventId) {
    const { data: peRow } = await svc
      .schema("future")
      .from("phase_events")
      .select("id, edition_id, chapter_id")
      .eq("id", input.phaseEventId)
      .maybeSingle();
    const pe = peRow as
      | { id: string; edition_id: string; chapter_id: string }
      | null;
    if (!pe) return { ok: false, error: "Phase event not found." };
    if (pe.edition_id !== team.edition_id) {
      return { ok: false, error: "Phase event is not in this edition." };
    }
  }

  // Compute total with range validation
  let total: number;
  try {
    total = computeMentorTotal(input.scores);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Find existing row by (team_id, mentor_id, phase_event_id)
  // Note: chaining .is("phase_event_id", null) for the null case.
  // Cast: regenerated types haven't picked up `mentor_evaluations` yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseQuery = (svc as any)
    .schema("future")
    .from("mentor_evaluations")
    .select("id, status")
    .eq("team_id", input.teamId)
    .eq("mentor_id", input.mentorId);
  const existingQuery = input.phaseEventId
    ? baseQuery.eq("phase_event_id", input.phaseEventId)
    : baseQuery.is("phase_event_id", null);
  const { data: existing } = await existingQuery.maybeSingle();
  const ex = existing as { id: string; status: string | null } | null;

  if (ex?.status === "submitted") {
    return {
      ok: false,
      error: "Evaluation already submitted. Ask admin to unlock if needed.",
    };
  }

  const status: "draft" | "submitted" = input.submit ? "submitted" : "draft";
  const payload = {
    edition_id: team.edition_id,
    team_id: input.teamId,
    mentor_id: input.mentorId,
    phase_event_id: input.phaseEventId,
    participation: input.scores.participation,
    submission_quality: input.scores.submission_quality,
    progress: input.scores.progress,
    engagement: input.scores.engagement,
    growth: input.scores.growth,
    total_score: total,
    notes: input.notes,
    status,
    submitted_at: input.submit ? new Date().toISOString() : null,
  } as never;

  if (ex) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc as any)
      .schema("future")
      .from("mentor_evaluations")
      .update(payload)
      .eq("id", ex.id);
    if (error) return { ok: false, error: error.message };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc as any)
      .schema("future")
      .from("mentor_evaluations")
      .insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/yi-future/mentor");
  revalidatePath(`/yi-future/mentor/scoring/${input.teamId}`);

  return {
    ok: true,
    message: input.submit
      ? `Submitted — ${total}/${MENTOR_RUBRIC.total_max}`
      : "Draft saved.",
  };
}

export type MentorEvaluationRecord = {
  id: string;
  team_id: string;
  mentor_id: string;
  phase_event_id: string | null;
  participation: number | null;
  submission_quality: number | null;
  progress: number | null;
  engagement: number | null;
  growth: number | null;
  total_score: number | null;
  notes: string | null;
  status: string | null;
  submitted_at: string | null;
  created_at: string | null;
};

/**
 * Return all submitted mentor evaluations for a team across phase events.
 * Sorted newest first.
 */
export async function getMentorEvaluations(
  teamId: string
): Promise<MentorEvaluationRecord[]> {
  const svc = await createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc as any)
    .schema("future")
    .from("mentor_evaluations")
    .select(
      "id, team_id, mentor_id, phase_event_id, participation, submission_quality, progress, engagement, growth, total_score, notes, status, submitted_at, created_at"
    )
    .eq("team_id", teamId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });
  return (data as unknown as MentorEvaluationRecord[]) ?? [];
}
