"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireJurySession } from "@/lib/yip/auth/yip-session";
import { isJurorAssignedToSession } from "./jury-sessions";
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

// ─── Session scoring parameters ───────────────────────────────────
// Per-session scoring: the criteria a juror sees come from the SESSION's
// configured parameters (yip.session_parameters), resolved from the agenda item
// via its session_key (preferred) or agenda_type. Returns null when the session
// has no configured parameters (caller falls back to the role rubric).
export type SessionScoringParams = {
  criteria: {
    key: string;
    label: string;
    max_score: number;
    kind: "evaluation" | "participation";
  }[];
  total_max: number;
};

export async function getSessionScoringParams(
  agendaItemId: string
): Promise<SessionScoringParams | null> {
  const supabase = await createServiceClient();
  const { data: item } = await supabase
    .from("agenda")
    .select("session_key, agenda_type")
    .eq("id", agendaItemId)
    .maybeSingle();
  if (!item) return null;

  let cfgQuery = supabase
    .from("session_parameters")
    .select("parameters, total_max")
    .eq("is_active", true);
  if (item.session_key) {
    cfgQuery = cfgQuery.eq("session_key", item.session_key);
  } else if (item.agenda_type) {
    cfgQuery = cfgQuery
      .eq("agenda_type", item.agenda_type)
      .order("display_order", { ascending: true });
  } else {
    return null;
  }
  const { data: cfgs } = await cfgQuery.limit(1);
  const cfg = cfgs?.[0];
  if (!cfg || !Array.isArray(cfg.parameters)) return null;

  const params = cfg.parameters as {
    key: string;
    label: string;
    max_score: number;
    kind?: "evaluation" | "participation";
  }[];
  const criteria = params.map((p) => ({
    key: p.key,
    label: p.label,
    max_score: Number(p.max_score),
    kind: p.kind === "participation" ? "participation" : "evaluation",
  })) as {
    key: string;
    label: string;
    max_score: number;
    kind: "evaluation" | "participation";
  }[];
  if (criteria.length === 0) return null;
  return { criteria, total_max: Number(cfg.total_max) };
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
  // Special Remarks (Phase 18 / F4). All optional — existing callers (offline
  // sync, history client) keep working unchanged. Each flag defaults to false
  // on the row; the per-flag point delta is applied at result-computation
  // time using yip.scoring_flags_config.
  flags?: {
    no_confidence_brought?: boolean;
    walkout?: boolean;
    ruckus?: boolean;
    suspension?: boolean;
  };
  // Set ONLY by the offline-sync flush. A stale buffered DRAFT replayed after
  // reconnect must never downgrade/overwrite a score the juror has since
  // SUBMITTED — the flush is a background replay, not a live edit.
  fromOfflineSync?: boolean;
}

export async function submitScore(
  input: SubmitScoreInput
): Promise<ActionResult<{ id: string }>> {
  // Jury self-service: the score is written under the caller's jury identity.
  // Verify the yip_session cookie owns input.juryAssignmentId for this event —
  // yip.scores has INSERT/UPDATE-to-public RLS, so without this anyone could
  // write or overwrite any participant's score by passing a foreign id.
  const sess = await requireJurySession(input.juryAssignmentId, input.eventId);
  if (!sess.ok) return { success: false, error: sess.error };

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

  // Per-session scoring (BUG-385): every score belongs to a specific session,
  // and a juror may only score sessions they're assigned to.
  if (!input.agendaItemId) {
    return {
      success: false,
      error: "No session selected — pick the session you're scoring.",
    };
  }
  const assigned = await isJurorAssignedToSession(
    input.juryAssignmentId,
    input.agendaItemId
  );
  if (!assigned) {
    return { success: false, error: "You're not assigned to score this session." };
  }

  // One score per (juror, participant, SESSION) — so the same delegate scored
  // in a later session creates a new row instead of overwriting the earlier one.
  const { data: existing } = await supabase
    .from("scores")
    .select("id, criteria_scores, total_score, status")
    .eq("jury_assignment_id", input.juryAssignmentId)
    .eq("participant_id", input.participantId)
    .eq("event_id", input.eventId)
    .eq("agenda_item_id", input.agendaItemId)
    .maybeSingle();

  // If existing score is locked, prevent edit
  if (existing?.status === "locked") {
    return { success: false, error: "This score has been locked and cannot be edited" };
  }

  // Offline-sync replay guard: a buffered DRAFT must never overwrite a row the
  // juror has since SUBMITTED (e.g. a stale phone buffer flushing after the
  // juror re-scored online). Report success so the flush clears the stale
  // entry — the submitted row is the newer truth and stays untouched.
  if (
    input.fromOfflineSync &&
    existing?.status === "submitted" &&
    input.status !== "submitted"
  ) {
    return { success: true, data: { id: existing.id } };
  }

  // Offline-replay rubric guard: a score buffered on a phone is replayed
  // verbatim — if the session's scoring parameters changed in between, its
  // criteria keys / total no longer fit and would corrupt results. Reject with
  // the STALE_OFFLINE_SCORE marker; the flush drops the entry (it can never
  // succeed) and the juror re-scores against the live parameters.
  if (input.fromOfflineSync && input.agendaItemId) {
    const params = await getSessionScoringParams(input.agendaItemId);
    if (params && params.criteria.length > 0) {
      const expected = new Set(params.criteria.map((c) => c.key));
      const hasForeignKey = Object.keys(input.criteriaScores).some(
        (k) => !expected.has(k)
      );
      if (hasForeignKey || input.totalScore > params.total_max) {
        return {
          success: false,
          error:
            "STALE_OFFLINE_SCORE: the scoring sheet changed since this was saved offline — please re-score this participant",
        };
      }
    }
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
    // Special Remarks flags — default false to keep backward-compat with
    // existing callers (offline sync, history client) that don't pass them.
    flag_no_confidence_brought: input.flags?.no_confidence_brought ?? false,
    flag_walkout: input.flags?.walkout ?? false,
    flag_ruckus: input.flags?.ruckus ?? false,
    flag_suspension: input.flags?.suspension ?? false,
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
    // Juror identifies a participant by name + serial # + constituency.
    // School is never sent to jurors (school-blind scoring, enforced at the
    // data layer — not just hidden in the UI).
    constituency_name: string | null;
    serial_no: number | null;
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
        constituency_name,
        serial_no
      ),
      rubric:rubrics(total_max)
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
  eventId: string,
  agendaItemId?: string | null
): Promise<Score | null> {
  const supabase = await createServiceClient();

  let query = supabase
    .from("scores")
    .select("*")
    .eq("jury_assignment_id", juryAssignmentId)
    .eq("participant_id", participantId)
    .eq("event_id", eventId);

  // Per-session: when a session is given, load that session's score exactly.
  // Without one (legacy callers), fall back to the most recent row.
  if (agendaItemId) {
    query = query.eq("agenda_item_id", agendaItemId);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
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
    // School is never sent to jurors (school-blind scoring, data-layer enforced).
    ministry: string | null;
    constituency_name: string | null;
    // Shown to jurors as the unique participant number alongside the name.
    serial_no: number | null;
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
        ministry,
        constituency_name,
        serial_no
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

export type ScoreableParticipant = {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  // School is never sent to jurors (school-blind scoring, data-layer enforced).
  ministry: string | null;
  constituency_name: string | null;
  serial_no: number | null;
};

export async function getScoreableParticipants(
  eventId: string
): Promise<ScoreableParticipant[]> {
  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, party_side, ministry, constituency_name, serial_no")
    .eq("event_id", eventId)
    .not("parliament_role", "is", null)
    .order("serial_no", { nullsFirst: false })
    .order("full_name");

  if (error || !data) return [];
  return data as ScoreableParticipant[];
}

// Compact rubric shape consumed by the jury screen + the bootstrap action.
// The full row is wider; the screen only reads id/criteria/total_max.
export type ScoringRubricData = {
  id: string;
  criteria: unknown;
  total_max: number;
};
