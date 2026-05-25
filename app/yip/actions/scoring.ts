"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import type { Tables } from "@/types/yip/database";

type Score = Tables<{ schema: "yip" }, "scores">;
type ScoringRubric = Tables<{ schema: "yip" }, "rubrics">;

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Role-to-rubric mapping ──────────────────────────────────────
// Speaker and deputy_speaker have their own rubrics.
// All other roles (pm, lop, cabinet_minister, shadow_minister,
// bill_committee, mp) fall back to the "mp" rubric.

const RUBRIC_ROLE_MAP: Record<string, string> = {
  speaker: "speaker",
  deputy_speaker: "deputy_speaker",
  prime_minister: "mp",
  leader_of_opposition: "mp",
  cabinet_minister: "mp",
  shadow_minister: "mp",
  bill_committee: "mp",
  mp: "mp",
};

// ─── Get Rubric For Role ──────────────────────────────────────────

export async function getRubricForRole(
  role: string
): Promise<ActionResult<ScoringRubric>> {
  const supabase = await createServiceClient();

  const targetRole = (RUBRIC_ROLE_MAP[role] ?? "mp") as "speaker" | "deputy_speaker" | "prime_minister" | "leader_of_opposition" | "cabinet_minister" | "shadow_minister" | "bill_committee" | "mp";

  const { data: rubric, error } = await supabase
    .from("rubrics")
    .select("*")
    .eq("target_role", targetRole)
    .eq("is_default", true)
    .single();

  if (error || !rubric) {
    return {
      success: false,
      error: `No rubric found for role "${role}" (mapped to "${targetRole}")`,
    };
  }

  return { success: true, data: rubric };
}

// ─── Submit Score (upsert + audit log) ────────────────────────────

interface SubmitScoreInput {
  juryAssignmentId: string;
  participantId: string;
  eventId: string;
  rubricId: string;
  agendaItemId: string | null;
  criteriaScores: Record<string, number>;
  totalScore: number;
  comments: string;
  status: "draft" | "submitted";
}

export async function submitScore(
  input: SubmitScoreInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServiceClient();

  // Check if scores are locked for this event
  const { data: event } = await supabase
    .from("events")
    .select("scores_locked")
    .eq("id", input.eventId)
    .single();

  if (event?.scores_locked) {
    return { success: false, error: "Scoring is locked for this event" };
  }

  // Check if an existing score exists for this jury + participant
  const { data: existing } = await supabase
    .from("scores")
    .select("id, criteria_scores, total_score, status")
    .eq("jury_assignment_id", input.juryAssignmentId)
    .eq("participant_id", input.participantId)
    .eq("event_id", input.eventId)
    .maybeSingle();

  // If existing score is locked, prevent edit
  if (existing?.status === "locked") {
    return { success: false, error: "This score has been locked and cannot be edited" };
  }

  const scoreData = {
    jury_assignment_id: input.juryAssignmentId,
    participant_id: input.participantId,
    event_id: input.eventId,
    rubric_id: input.rubricId,
    agenda_item_id: input.agendaItemId,
    criteria_scores: input.criteriaScores,
    total_score: input.totalScore,
    comments: input.comments || null,
    status: input.status,
    submitted_at: input.status === "submitted" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  let scoreId: string;

  if (existing) {
    // Update existing score
    const { error: updateError } = await supabase
      .from("scores")
      .update(scoreData)
      .eq("id", existing.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    scoreId = existing.id;

    // Create audit log entry
    await supabase.from("score_audit").insert({
      score_id: existing.id,
      previous_scores: existing.criteria_scores,
      previous_total: existing.total_score,
      new_scores: input.criteriaScores,
      new_total: input.totalScore,
      changed_by: input.juryAssignmentId,
      reason: input.status === "submitted" ? "Score submitted" : "Draft updated",
    });
  } else {
    // Insert new score
    const { data: newScore, error: insertError } = await supabase
      .from("scores")
      .insert(scoreData)
      .select("id")
      .single();

    if (insertError || !newScore) {
      return { success: false, error: insertError?.message ?? "Failed to save score" };
    }

    scoreId = newScore.id;

    // Create audit log for new score
    await supabase.from("score_audit").insert({
      score_id: newScore.id,
      previous_scores: null,
      previous_total: null,
      new_scores: input.criteriaScores,
      new_total: input.totalScore,
      changed_by: input.juryAssignmentId,
      reason: "New score created",
    });
  }

  return { success: true, data: { id: scoreId } };
}

// ─── Get All Scores For a Jury ────────────────────────────────────

export type ScoreWithParticipant = Score & {
  participant: {
    id: string;
    full_name: string;
    parliament_role: string | null;
    party_side: string | null;
    school_name: string;
  };
  rubric: {
    total_max: number;
  } | null;
};

export async function getScoresForJury(
  juryAssignmentId: string,
  eventId: string
): Promise<ScoreWithParticipant[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("scores")
    .select(
      `
      *,
      participant:participants(
        id,
        full_name,
        parliament_role,
        party_side,
        school_name
      ),
      rubric:scoring_rubrics(total_max)
    `
    )
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return data as unknown as ScoreWithParticipant[];
}

// ─── Get Score For a Specific Participant ─────────────────────────

export async function getScoreForParticipant(
  juryAssignmentId: string,
  participantId: string,
  eventId: string
): Promise<Score | null> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("participant_id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// ─── Get Current Speaker Info ─────────────────────────────────────
// Returns the participant who is currently speaking based on agenda_speakers

export type CurrentSpeakerInfo = {
  agendaSpeakerId: string;
  agendaItemId: string;
  agendaItemTitle: string;
  participant: {
    id: string;
    full_name: string;
    parliament_role: string | null;
    party_side: string | null;
    school_name: string;
    ministry: string | null;
    constituency_name: string | null;
  };
};

export async function getCurrentSpeaker(
  eventId: string
): Promise<ActionResult<CurrentSpeakerInfo | null>> {
  const supabase = await createServiceClient();

  // Get current agenda item from event
  const { data: event } = await supabase
    .from("events")
    .select("current_agenda_item_id")
    .eq("id", eventId)
    .single();

  if (!event?.current_agenda_item_id) {
    return { success: true, data: null };
  }

  // Get the agenda item title
  const { data: agendaItem } = await supabase
    .from("agenda")
    .select("id, title")
    .eq("id", event.current_agenda_item_id)
    .single();

  if (!agendaItem) {
    return { success: true, data: null };
  }

  // Find the currently speaking speaker in that agenda item
  const { data: speaker } = await supabase
    .from("agenda_speakers")
    .select(
      `
      id,
      participant:participants(
        id,
        full_name,
        parliament_role,
        party_side,
        school_name,
        ministry,
        constituency_name
      )
    `
    )
    .eq("agenda_item_id", event.current_agenda_item_id)
    .eq("status", "speaking")
    .single();

  if (!speaker?.participant) {
    return { success: true, data: null };
  }

  // Supabase returns the joined participant as an object
  const participant = speaker.participant as unknown as CurrentSpeakerInfo["participant"];

  return {
    success: true,
    data: {
      agendaSpeakerId: speaker.id,
      agendaItemId: agendaItem.id,
      agendaItemTitle: agendaItem.title,
      participant,
    },
  };
}

// ─── Get All Scoreable Participants ───────────────────────────────
// Returns all participants with roles (for scoring outside speaker queue)

export async function getScoreableParticipants(eventId: string) {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, school_name, ministry, constituency_name")
    .eq("event_id", eventId)
    .not("parliament_role", "is", null)
    .order("party_side")
    .order("parliament_role")
    .order("full_name");

  if (error || !data) return [];
  return data;
}
