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
  | "ministry_verdict" // future
  // ── Projector moments (director-triggered, ALWAYS pending_review) ──
  | "projector_quotes" // subject_id = null — SELECTION-ONLY: routine picks question ids; server copies verbatim text
  | "projector_bill_summary" // subject_id = bills.id — 3-bullet big-screen distillation of ONE bill
  | "projector_house_mind" // subject_id = null — the 3 themes the whole House kept returning to
  | "projector_framing" // subject_id = agenda.id — 2-line big-screen intro for one agenda item
  | "projector_qh_themes"; // subject_id = null — "the House is asking about…" Question-Hour synthesis

/**
 * The projector-moment kinds. Every one is DIRECTOR-TRIGGERED from the control
 * panel (never auto-queued), lands as pending_review (never auto-shows), and
 * reaches the big screen only after the director's explicit "Project" tap
 * copies it into yip.projector_moments.
 */
export const PROJECTOR_AI_KINDS = [
  "projector_quotes",
  "projector_bill_summary",
  "projector_house_mind",
  "projector_framing",
  "projector_qh_themes",
] as const;

export type ProjectorAiKind = (typeof PROJECTOR_AI_KINDS)[number];

export function isProjectorAiKind(kind: string): kind is ProjectorAiKind {
  return (PROJECTOR_AI_KINDS as readonly string[]).includes(kind);
}

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

// ─── Projector-moment groundings (director-triggered, review-gated) ─────────
//
// Same content-safety doctrine as everything above: NO scores, NO ranks. These
// payloads carry the House's OWN words (questions, bill fields, agenda facts)
// so the routine synthesizes/curates rather than invents. Every projector kind
// lands as pending_review — the director reads the exact output on the control
// panel and taps "Project" before anything reaches the venue screen.

/**
 * Grounding for kind='projector_quotes' — "Voices of the House".
 *
 * SELECTION-ONLY CONTRACT: the routine must NOT write display prose. It reads
 * the House's own submitted questions and returns, via sourceRefs, the ids of
 * the most striking 4–8 (type:"question"). At Project time the SERVER copies
 * the verbatim question text + asker from the DB — quotes are verbatim BY
 * CONSTRUCTION, immune to rewording. draft_text carries only a short internal
 * framing line for the director's review card.
 *
 * Note: includes 'submitted' (not yet organiser-approved) questions and
 * excludes only 'rejected' — the director's Project-tap review is the vet.
 */
export type ProjectorQuotesGrounding = {
  kind: "projector_quotes";
  event: { id: string; name: string; chapterName: string | null };
  /** The House's own words. Curate from THESE ONLY; echo chosen ids. */
  questions: {
    id: string;
    text: string;
    ministryLabel: string | null;
    /** 'submitted' | 'approved' | 'answered' — never 'rejected'. */
    status: string;
  }[];
  sourceRefs: AiSourceRef[];
};

/**
 * Grounding for kind='projector_bill_summary' — one bill distilled for the big
 * screen: exactly 3 short bullets + a one-line essence, from the bill's OWN
 * fields (same content-safe shape as bill_feedback; no drafting people).
 */
export type ProjectorBillSummaryGrounding = {
  kind: "projector_bill_summary";
  bill: {
    id: string;
    title: string | null;
    committeeName: string | null;
    partySide: string | null;
    problemStatement: string | null;
    objective: string | null;
    provisions: unknown;
    expectedImpact: string | null;
    implementation: string | null;
  };
  ministry: { topic: string | null; scheme: string | null } | null;
  event: { id: string; name: string; chapterName: string | null };
  sourceRefs: AiSourceRef[];
};

/**
 * Grounding for kind='projector_house_mind' — the 3 concerns this House kept
 * returning to, synthesized from its own questions + bills. No names, no
 * counts, no digits in the output.
 */
export type ProjectorHouseMindGrounding = {
  kind: "projector_house_mind";
  event: { id: string; name: string; chapterName: string | null };
  questions: { text: string; ministryLabel: string | null }[];
  bills: { title: string | null; problemStatement: string | null }[];
  nationalTopics: { title: string; scheme: string | null }[];
  sourceRefs: AiSourceRef[];
};

/** Grounding for kind='projector_framing' — a 2-line intro for ONE agenda item. */
export type ProjectorFramingGrounding = {
  kind: "projector_framing";
  agendaItem: {
    id: string;
    title: string;
    agendaType: string | null;
    day: number | null;
  };
  nationalTopics: { title: string; scheme: string | null }[];
  event: { id: string; name: string; chapterName: string | null };
  sourceRefs: AiSourceRef[];
};

/**
 * Grounding for kind='projector_qh_themes' — "the House is asking about…":
 * a 3-line synthesis of Question Hour so far, grouped by ministry. No names,
 * no counts, no digits in the output.
 */
export type ProjectorQhThemesGrounding = {
  kind: "projector_qh_themes";
  event: { id: string; name: string; chapterName: string | null };
  byMinistry: { ministryLabel: string; questions: string[] }[];
  sourceRefs: AiSourceRef[];
};

/**
 * The payload the projector kiosk renders (yip.projector_moments.payload).
 * Built SERVER-SIDE at Project time — for quotes the text is copied verbatim
 * from yip.questions by the server, never taken from model output.
 */
export type ProjectorMomentPayload = {
  title: string;
  subtitle?: string | null;
  /** Text scenes: one entry per display line/bullet/theme. */
  lines?: string[] | null;
  /** Quote scene: verbatim House voices (server-copied). */
  quotes?:
    | {
        text: string;
        name: string;
        constituency: string | null;
        ministry: string | null;
      }[]
    | null;
};

/** A yip.projector_moments row (hand-typed; table not in generated types). */
export type ProjectorMomentRow = {
  id: string;
  event_id: string;
  kind: ProjectorAiKind;
  payload: ProjectorMomentPayload;
  status: "projected" | "retired";
  source_draft_id: string | null;
  is_mock: boolean;
  created_at: string;
  updated_at: string;
};

export type AiGrounding =
  | ParticipantStoryGrounding
  | RoundNarrativeGrounding
  | SessionFeedbackGrounding
  | BillFeedbackGrounding
  | ProjectorQuotesGrounding
  | ProjectorBillSummaryGrounding
  | ProjectorHouseMindGrounding
  | ProjectorFramingGrounding
  | ProjectorQhThemesGrounding;

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
