"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireJurySession } from "@/lib/yip/auth/yip-session";
import { isJurorAssignedToSession } from "./jury-sessions";

// S2-6: batch-score a bill research team. During Bill Presentation scoring a
// juror scores one presenter, then copies that score to the rest of the same
// committee as per-person DRAFTS — each stays individually editable and must
// still be submitted per person by the juror. Authorized by the jury SESSION
// cookie (requireJurySession), same gate as submitScore — jurors are not event
// managers, so getYipEventAccess does not apply here.

// Jury surfaces are name-blind: a teammate option carries ONLY what the jury
// UI may see (number + role). full_name must never appear in this file.
export type TeammateOption = {
  id: string;
  constituency_number: number | null;
  parliament_role: string | null;
};

export type ListTeammatesResult =
  | { success: true; committeeName: string | null; teammates: TeammateOption[] }
  | { success: false; error: string };

/**
 * Team-mates of a participant = other participants in the SAME event with the
 * SAME committee_name (source excluded). Returns committeeName: null (and no
 * teammates) when the participant has no committee — the panel self-hides.
 */
export async function listTeammates(
  juryAssignmentId: string,
  eventId: string,
  participantId: string
): Promise<ListTeammatesResult> {
  const sess = await requireJurySession(juryAssignmentId, eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const supabase = await createServiceClient();

  // The source must belong to THIS event (fail closed on a foreign id).
  const { data: source } = await supabase
    .from("participants")
    .select("id, committee_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!source) {
    return { success: false, error: "Participant not found for this event" };
  }

  const committeeName = (source.committee_name ?? "").trim();
  if (!committeeName) {
    return { success: true, committeeName: null, teammates: [] };
  }

  const { data: mates, error } = await supabase
    .from("participants")
    .select("id, constituency_number, parliament_role")
    .eq("event_id", eventId)
    .eq("committee_name", source.committee_name as string)
    .neq("id", participantId)
    .order("constituency_number", { nullsFirst: false });
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    committeeName,
    teammates: (mates ?? []) as TeammateOption[],
  };
}

export type CopyScoreResult =
  | { success: true; copied: number; skipped: number }
  | { success: false; error: string };

/**
 * Copy the juror's own score for the source participant (latest turn, draft or
 * submitted) onto selected same-committee team-mates as per-person DRAFT rows
 * (turn 1). A target whose turn-1 row is already 'submitted' or 'locked' is
 * NEVER overwritten — it is skipped and counted. Special Remarks flags are
 * per-person observations and are never copied.
 */
export async function copyScoreToTeammates(args: {
  juryAssignmentId: string;
  eventId: string;
  agendaItemId: string;
  sourceParticipantId: string;
  targetParticipantIds: string[];
}): Promise<CopyScoreResult> {
  const sess = await requireJurySession(args.juryAssignmentId, args.eventId);
  if (!sess.ok) return { success: false, error: sess.error };

  const targetIds = [...new Set(args.targetParticipantIds)].filter(
    (id) => Boolean(id) && id !== args.sourceParticipantId
  );
  if (targetIds.length === 0) {
    return { success: false, error: "Pick at least one team-mate to copy to." };
  }

  const supabase = await createServiceClient();

  // Mirrors submitScore's entry rules: no writes once the event is locked, and
  // only into a session this juror is assigned to.
  const { data: event } = await supabase
    .from("events")
    .select("scores_locked")
    .eq("id", args.eventId)
    .maybeSingle();
  if (event?.scores_locked) {
    return { success: false, error: "Scoring is locked for this event" };
  }
  const assigned = await isJurorAssignedToSession(
    args.juryAssignmentId,
    args.agendaItemId
  );
  if (!assigned) {
    return { success: false, error: "You're not assigned to score this session." };
  }

  // Source must belong to this event and sit in a committee.
  const { data: source } = await supabase
    .from("participants")
    .select("id, committee_name")
    .eq("id", args.sourceParticipantId)
    .eq("event_id", args.eventId)
    .maybeSingle();
  if (!source) {
    return { success: false, error: "Participant not found for this event" };
  }
  if (!(source.committee_name ?? "").trim()) {
    return {
      success: false,
      error: "This participant is not part of a committee.",
    };
  }

  // EVERY target must be a same-committee team-mate in this event. Reject the
  // whole call otherwise — never write a draft onto a foreign participant.
  const { data: targetRows } = await supabase
    .from("participants")
    .select("id")
    .in("id", targetIds)
    .eq("event_id", args.eventId)
    .eq("committee_name", source.committee_name as string);
  const validIds = new Set((targetRows ?? []).map((t) => t.id));
  if (targetIds.some((id) => !validIds.has(id))) {
    return {
      success: false,
      error: "Some selected participants are not team-mates of this participant.",
    };
  }

  // The juror's OWN score for the source — latest turn, draft or submitted.
  const { data: srcScore } = await supabase
    .from("scores")
    .select("rubric_id, criteria_scores, total_score, comments")
    .eq("jury_assignment_id", args.juryAssignmentId)
    .eq("participant_id", args.sourceParticipantId)
    .eq("event_id", args.eventId)
    .eq("agenda_item_id", args.agendaItemId)
    .order("occurrence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!srcScore) {
    return {
      success: false,
      error: "Score this participant first — there is nothing to copy yet.",
    };
  }

  // Targets' existing turn-1 rows (the primary score a juror edits/submits).
  const { data: existingRows } = await supabase
    .from("scores")
    .select("id, participant_id, status")
    .eq("jury_assignment_id", args.juryAssignmentId)
    .eq("event_id", args.eventId)
    .eq("agenda_item_id", args.agendaItemId)
    .eq("occurrence", 1)
    .in("participant_id", targetIds);
  const existingByParticipant = new Map(
    (existingRows ?? []).map((r) => [r.participant_id, r])
  );

  let copied = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const targetId of targetIds) {
    const existing = existingByParticipant.get(targetId);
    if (
      existing &&
      (existing.status === "submitted" || existing.status === "locked")
    ) {
      skipped++;
      continue;
    }

    const draft = {
      jury_assignment_id: args.juryAssignmentId,
      participant_id: targetId,
      event_id: args.eventId,
      rubric_id: srcScore.rubric_id,
      agenda_item_id: args.agendaItemId,
      occurrence: 1,
      criteria_scores: srcScore.criteria_scores,
      total_score: srcScore.total_score,
      comments: srcScore.comments,
      // Always a DRAFT — the juror fine-tunes and submits each person.
      status: "draft" as const,
      submitted_at: null,
      updated_at: now,
      // flag_* columns intentionally untouched: DB defaults (false) on insert,
      // preserved as-is on an existing draft.
    };

    let savedId: string | null = null;
    if (existing) {
      // Guarded update — if the row flipped to submitted/locked between the
      // read above and now, the .eq("status","draft") matches 0 rows and the
      // target is counted skipped instead of overwritten (fail closed).
      const { data: updated, error } = await supabase
        .from("scores")
        .update(draft)
        .eq("id", existing.id)
        .eq("status", "draft")
        .select("id");
      if (error || !updated || updated.length === 0) {
        skipped++;
        continue;
      }
      savedId = updated[0].id;
    } else {
      // Strict INSERT — a concurrent write to the same (juror, participant,
      // session, turn) makes this fail with a conflict rather than silently
      // overwriting it; the target is counted skipped.
      const { data: inserted, error } = await supabase
        .from("scores")
        .insert(draft)
        .select("id")
        .single();
      if (error || !inserted) {
        skipped++;
        continue;
      }
      savedId = inserted.id;
    }

    await supabase.from("score_audit").insert({
      score_id: savedId,
      previous_scores: null,
      previous_total: null,
      new_scores: srcScore.criteria_scores,
      new_total: srcScore.total_score,
      changed_by: args.juryAssignmentId,
      reason: "Draft copied from team-mate's bill-presentation score",
    });
    copied++;
  }

  return { success: true, copied, skipped };
}
