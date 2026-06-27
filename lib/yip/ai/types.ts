/**
 * Shared types for the YIP AI layer.
 *
 * Plain types module (NOT a "use server" file and NOT server-only) so it can be
 * imported from server data helpers, server actions, the bearer route handler,
 * AND client review components. The `ai_drafts` table is NOT in the generated
 * types/yip/database.ts, so every DB access loose-casts the row — these types
 * are the hand-written contract for that shape.
 */

/** What an AI draft is about. */
export type AiDraftKind =
  | "participant_story" // subject_id = participants.id — dispute-proof, NO scores
  | "round_narrative" // subject_id = null — event-level chair report narrative
  | "ministry_verdict"; // future

/**
 * Lifecycle:
 *   requested  — app enqueued it; the routine has not picked it up.
 *   generating — the routine claimed it (optional intermediate; the routine may
 *                POST straight to a terminal status).
 *   ready      — participant_story is complete and auto-shows (no review gate).
 *   pending_review — round_narrative draft is ready and AWAITS chair approval.
 *   approved   — chair approved; approved_text is the canonical text.
 *   rejected   — chair discarded the draft.
 */
export type AiDraftStatus =
  | "requested"
  | "generating"
  | "ready"
  | "pending_review"
  | "approved"
  | "rejected";

/** One anti-hallucination citation: a row the draft was grounded on. */
export type AiSourceRef = {
  /** e.g. "participant", "party", "committee_topic", "central_topic", "event". */
  type: string;
  /** The source row id when applicable (participant id, topic id, …). */
  id?: string | null;
  /** A short human-readable label for the reviewer chip, e.g. the topic title. */
  label: string;
};

/** A persisted ai_drafts row (hand-typed; table not in generated types). */
export type AiDraftRow = {
  id: string;
  event_id: string;
  kind: AiDraftKind;
  subject_id: string | null;
  status: AiDraftStatus;
  draft_text: string | null;
  source_refs: AiSourceRef[];
  model_note: string | null;
  generated_at: string | null;
  reviewed_by: string | null;
  approved_text: string | null;
  reviewed_at: string | null;
  is_mock: boolean;
  created_at: string;
  updated_at: string;
};

// ─── Grounding payloads (sent to the out-of-band routine) ───────────────────
//
// CRITICAL (Director rule, non-negotiable): the participant_story grounding
// payload MUST NOT contain any numeric score, rank, average, or comparison to
// other participants. Exact scores cause disputes. The payload carries ONLY the
// participant's own factual participation.

/** Grounding for kind='participant_story'. NO SCORES. NO RANK. NO COMPARISON. */
export type ParticipantStoryGrounding = {
  kind: "participant_story";
  participant: {
    id: string;
    fullName: string;
    /** Pretty role label, e.g. "Prime Minister", "Member of Parliament". */
    roleLabel: string | null;
    /** Raw role slug for the routine's role-based "what's next" logic. */
    roleSlug: string | null;
    partyName: string | null;
    partySide: string | null; // "ruling" | "opposition" | null
    constituencyName: string | null;
    constituencyNumber: number | null;
    committeeName: string | null;
    committeeNumber: number | null;
  };
  /** Committee → ministry topic + linked scheme (from yip.topics). */
  ministry: {
    /** The committee/ministry topic description (the brief they worked on). */
    topic: string | null;
    /** The government scheme the committee was linked to. */
    scheme: string | null;
  } | null;
  /** The event's national/central debate topic(s). */
  nationalTopics: { title: string; scheme: string | null }[];
  event: {
    id: string;
    name: string;
    chapterName: string | null;
    level: string;
  };
  sourceRefs: AiSourceRef[];
};

/** Grounding for kind='round_narrative' (event-level, chair narrative). NO SCORES. */
export type RoundNarrativeGrounding = {
  kind: "round_narrative";
  event: {
    id: string;
    name: string;
    chapterName: string | null;
    city: string | null;
    state: string | null;
    level: string;
    day1Date: string | null;
    day2Date: string | null;
  };
  participantCount: number;
  partyCount: number;
  /** National/central debate topic(s) for the round. */
  nationalTopics: { title: string; scheme: string | null }[];
  /** Distinct committees that sat (ministry + scheme). */
  committees: { name: string; topic: string | null; scheme: string | null }[];
  /** Zero Hour summary if the organiser already saved one (factual grounding). */
  zeroHourSummary: string | null;
  sourceRefs: AiSourceRef[];
};

export type AiGrounding = ParticipantStoryGrounding | RoundNarrativeGrounding;

/** A pending request handed to the routine: the row + its grounding payload. */
export type PendingAiRequest = {
  id: string;
  eventId: string;
  kind: AiDraftKind;
  subjectId: string | null;
  status: AiDraftStatus;
  grounding: AiGrounding | null;
};
