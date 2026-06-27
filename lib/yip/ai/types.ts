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
  | "participant_story" // subject_id = participants.id; agenda_item_id NULL — dispute-proof, NO scores
  | "round_narrative" // subject_id = null; agenda_item_id NULL — event-level chair report narrative
  | "session_feedback" // subject_id = participants.id; agenda_item_id = agenda.id — per-session growth note, NO numbers
  | "bill_feedback" // subject_id = bills.id; agenda_item_id NULL — team-level note on a BILL's craft, NO scores/people
  | "ministry_verdict"; // future

/**
 * Lifecycle:
 *   requested  — app enqueued it; the routine has not picked it up.
 *   generating — the routine claimed it (optional intermediate; the routine may
 *                POST straight to a terminal status).
 *   ready      — participant_story / session_feedback is complete and auto-shows
 *                (no review gate; still gated on events.ai_enabled).
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
  /**
   * e.g. "participant", "party", "committee_topic", "central_topic", "event",
   * "session" (a scored agenda item), "criteria_pattern" (the self-referential
   * strength/focus pattern a session_feedback note was grounded on).
   */
  type: string;
  /** The source row id when applicable (participant id, topic id, agenda id…). */
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
  /**
   * The scored agenda item a session_feedback row is about. NULL for every
   * other kind (participant_story, round_narrative, ministry_verdict).
   */
  agenda_item_id: string | null;
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
//
// session_feedback is the ONE grounding that DOES carry score-derived signal —
// but ONLY a per-criterion normalized ratio of the participant against THEIR
// OWN other criteria (self-referential), never a raw score, never a rank,
// never another participant. It flows ONLY to the routine via the bearer
// endpoint and NEVER reaches a participant surface (the card reads draft_text
// alone). See lib/yip/ai/grounding.ts getSessionFeedbackWork for the contract.

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

/**
 * One criterion's SELF-REFERENTIAL signal for a single (participant, session).
 *
 * `ratio` is the participant's averaged-across-judges score on this criterion
 * NORMALISED to its own max_score (0..1). It exists ONLY so the routine can
 * rank the participant's OWN criteria against EACH OTHER and pick the
 * relatively-stronger / relatively-weaker one. It is NEVER a comparison to
 * another participant, NEVER a rank, and NEVER shown to a participant — the
 * card reads draft_text alone and never sees this number.
 */
export type SessionCriterionPattern = {
  /** Rubric criterion key (e.g. "communication", "cmte.initiative"). */
  key: string;
  /** Human label verbatim from the rubric (e.g. "Clarity of Communication"). */
  label: string;
  /** 0..1 — own score on this criterion ÷ its max. ROUTINE-ONLY. */
  ratio: number;
  /** The criterion's declared max points (for the routine's context only). */
  max: number;
};

/**
 * One unit of session_feedback work: everything the routine needs to write a
 * warm, self-referential, NUMBER-FREE growth note for ONE (participant,
 * scored session). Cross-participant data NEVER enters this object — it is
 * assembled from a single participant's own rows for a single session.
 */
export type SessionFeedbackGrounding = {
  kind: "session_feedback";
  participant: {
    id: string;
    fullName: string;
    roleLabel: string | null;
    roleSlug: string | null;
  };
  session: {
    /** agenda.id — the scored agenda item this note is about. */
    id: string;
    title: string;
    day: number | null;
    sequenceOrder: number | null;
  };
  event: {
    id: string;
    name: string;
    chapterName: string | null;
  };
  /**
   * The participant's per-criterion pattern for THIS session, averaged across
   * judges and normalised to each criterion's own max. ROUTINE-ONLY — used to
   * pick the relatively-stronger and relatively-weaker criterion. NEVER shown.
   */
  criteria: SessionCriterionPattern[];
  /**
   * The participant's own relatively-STRONGEST criterion this session (highest
   * own ratio). null if no criteria. The routine acknowledges this by label.
   */
  strength: SessionCriterionPattern | null;
  /**
   * The participant's own relatively-WEAKEST criterion this session (lowest own
   * ratio) — the growth focus for the NEXT session. null if no criteria.
   */
  growthFocus: SessionCriterionPattern | null;
  /**
   * Short excerpts of this participant's EARLIER session_feedback notes (in
   * session order) so the routine can write continuity ("last time you focused
   * on …"). Their own prior notes only — never anyone else's.
   */
  priorNotes: { sessionTitle: string; note: string }[];
  sourceRefs: AiSourceRef[];
};

/**
 * Grounding for kind='bill_feedback' — a TEAM-LEVEL note on ONE bill's CRAFT.
 *
 * CONTENT-SAFE (Director rule, non-negotiable — enforced by construction):
 *   • Carries ONLY the bill's own fields (problem framing, provisions, expected
 *     impact, implementation, how it could answer the opposition) + factual
 *     event context. It NEVER carries a score, rank, percentage, jury comment,
 *     or any cross-bill comparison.
 *   • It NEVER carries the drafting people (lead_drafter / presenter_* /
 *     policy_researcher are intentionally OMITTED), so no individual can be
 *     named or blamed.
 *   • voteOutcome is the bill's OWN public record (passed / rejected / pending),
 *     framed by the routine as learning — never a "best/worst bill" judgement.
 *   • Built from yip.bills + yip.events only — NEVER yip.scores / yip.results.
 */
export type BillFeedbackGrounding = {
  kind: "bill_feedback";
  bill: {
    /** bills.id — the subject of this draft. */
    id: string;
    title: string | null;
    committeeName: string | null;
    /** "ruling" | "opposition" | null — which bench drafted it. */
    partySide: string | null;
    problemStatement: string | null;
    objective: string | null;
    /** The bill's clauses/provisions (free-form JSON from the drafting UI). */
    provisions: unknown;
    expectedImpact: string | null;
    implementation: string | null;
    /** The opposition's recorded response to the bill, if any. */
    oppositionResponse: string | null;
    /** The bill's own public vote outcome — factual, framed as learning. */
    voteOutcome: {
      status: string | null; // e.g. "passed" | "rejected" | "presented" | draft status
      for: number | null;
      against: number | null;
      abstain: number | null;
    };
  };
  /** The committee/ministry brief the bill was written on (from yip.topics). */
  ministry: {
    topic: string | null;
    scheme: string | null;
  } | null;
  event: {
    id: string;
    name: string;
    chapterName: string | null;
  };
  sourceRefs: AiSourceRef[];
};

export type AiGrounding =
  | ParticipantStoryGrounding
  | RoundNarrativeGrounding
  | SessionFeedbackGrounding
  | BillFeedbackGrounding;

/** A pending request handed to the routine: the row + its grounding payload. */
export type PendingAiRequest = {
  id: string;
  eventId: string;
  kind: AiDraftKind;
  subjectId: string | null;
  /** The scored agenda item for session_feedback; null otherwise. */
  agendaItemId: string | null;
  status: AiDraftStatus;
  grounding: AiGrounding | null;
};
