// Online House Formation (pre-Regional-Round) — pure module, NO "use server".
//
// Every type/constant the formation server actions ("use server" files may
// export ONLY async functions) and the organiser UI share lives here. The
// step engine itself is app/yip/actions/formation.ts; appointments are
// app/yip/actions/formation-appointments.ts.
//
// The three officials roles (deputy_minister, parliamentary_administrator,
// parliamentary_journalist) exist here ONLY as runtime strings — they are NOT
// members of the generated ParliamentRole type on master (the DB enum values
// arrive via a separate user-run RR-catalogue script). Writes cast with
// `as never`; a Postgres invalid-enum error is surfaced via
// FORMATION_ENUM_NOT_ENABLED_ERROR, never silently.

// ─── Step catalogue ─────────────────────────────────────────────────

export type FormationStepKey =
  | "allocation"
  | "speaker_ballot"
  | "party_leader_ballots"
  | "pm_ballot"
  | "lop_ballot"
  | "appointments"
  | "lock";

export type FormationStepStatus = "pending" | "open" | "closed" | "locked";

export type FormationStepMode = "organiser" | "election";

export type FormationStepDef = {
  key: FormationStepKey;
  order: number;
  label: string;
  mode: FormationStepMode;
  /** Election steps only: the vote_sessions.vote_type they open. */
  voteType?: string;
};

/**
 * The fixed 7-step formation sequence, in order. Election steps open real
 * vote_sessions (via openVote) anchored on the hidden day-0 agenda item;
 * organiser steps are checklist gates the organiser completes in the app.
 */
export const FORMATION_STEPS: FormationStepDef[] = [
  { key: "allocation", order: 1, label: "Allocation & Parties", mode: "organiser" },
  {
    key: "speaker_ballot",
    order: 2,
    label: "Speaker Election",
    mode: "election",
    voteType: "speaker_election",
  },
  {
    key: "party_leader_ballots",
    order: 3,
    label: "Party Leader Elections",
    mode: "election",
    voteType: "party_leader",
  },
  {
    key: "pm_ballot",
    order: 4,
    label: "Prime Minister Election",
    mode: "election",
    voteType: "prime_minister",
  },
  {
    key: "lop_ballot",
    order: 5,
    label: "Leader of Opposition Election",
    mode: "election",
    voteType: "leader_of_opposition",
  },
  { key: "appointments", order: 6, label: "Appointments", mode: "organiser" },
  { key: "lock", order: 7, label: "Lock & Announce", mode: "organiser" },
];

export function formationStepDef(key: string): FormationStepDef | null {
  return FORMATION_STEPS.find((s) => s.key === key) ?? null;
}

/**
 * vote_sessions.agenda_item_id is NOT NULL, so formation anchors every ballot
 * to ONE idempotently-created, never-made-live day-0 agenda item carrying this
 * session_key. Day-0 also buys the pre-event check-in bypass (2026-06-28 rule
 * in assertCheckedInForVote).
 */
export const FORMATION_ANCHOR_SESSION_KEY = "online_formation";

// ─── Appointed roles (step 6) ───────────────────────────────────────

export type FormationAppointedRole = {
  /** participants.parliament_role value — RUNTIME string (see header note). */
  key: string;
  label: string;
  needsMinistry: boolean;
  /** Bench the role must sit on; null = either bench. Enforced fail-closed. */
  side: "ruling" | "opposition" | null;
};

export const FORMATION_APPOINTED_ROLES: FormationAppointedRole[] = [
  { key: "cabinet_minister", label: "Cabinet Minister", needsMinistry: true, side: "ruling" },
  { key: "shadow_minister", label: "Shadow Minister", needsMinistry: true, side: "opposition" },
  { key: "deputy_minister", label: "Deputy Minister", needsMinistry: false, side: "ruling" },
  {
    key: "parliamentary_administrator",
    label: "Parliamentary Administrator",
    needsMinistry: false,
    side: null,
  },
  {
    key: "parliamentary_journalist",
    label: "Parliamentary Journalist",
    needsMinistry: false,
    side: null,
  },
];

/**
 * Surfaced when a role write trips the Postgres enum (the officials values are
 * added by a separate user-run script — see C3 in the formation plan).
 */
export const FORMATION_ENUM_NOT_ENABLED_ERROR =
  "role not yet enabled in the database — apply the RR catalogue enum first";

/**
 * Postgres rejects an unknown enum value with 22P02 ("invalid input value for
 * enum …"). Detect it so the officials-role writes can surface the C3 message
 * instead of a raw driver error.
 */
export function isEnumNotEnabledPgError(err: {
  code?: string;
  message?: string;
}): boolean {
  return (
    err.code === "22P02" ||
    (err.message ?? "").toLowerCase().includes("invalid input value for enum")
  );
}

// ─── Step rows ──────────────────────────────────────────────────────

export type FormationStepRow = {
  id: string;
  event_id: string;
  step_key: FormationStepKey;
  step_order: number;
  status: FormationStepStatus;
  opens_at: string | null;
  closes_at: string | null;
  session_ids: string[];
  config: Record<string, unknown>;
};

/**
 * Has an OPEN step's voting window elapsed? Pending/closed/locked steps never
 * read as "deadline passed" (there is nothing left to sweep), and an open step
 * with no closes_at has no deadline. Malformed closes_at fails closed (false)
 * — the castVote deadline guard is the hard enforcement either way.
 */
export function stepDeadlinePassed(
  step: Pick<FormationStepRow, "closes_at" | "status">,
  now?: Date
): boolean {
  if (step.status !== "open") return false;
  if (!step.closes_at) return false;
  const deadline = Date.parse(step.closes_at);
  if (Number.isNaN(deadline)) return false;
  return (now ?? new Date()).getTime() > deadline;
}

/**
 * The next step awaiting action: the lowest-order step still 'pending'.
 * Null when every step has been opened/closed/locked.
 */
export function nextPendingStep(
  steps: FormationStepRow[]
): FormationStepRow | null {
  const pending = steps
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.step_order - b.step_order);
  return pending[0] ?? null;
}

// ─── Email masking (turnout pending list) ───────────────────────────

/**
 * Mask to "ma****@domain" so turnout/pending lists confirm the right address
 * without exposing it in full (mirrors app/yip/actions/email-codes.ts).
 * Null when there's no usable email.
 */
export function maskEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) return null;
  const [local, domain] = e.split("@");
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

// ─── Action return shapes (types must live outside "use server" files) ──

export type FormationSessionLite = {
  id: string;
  vote_type: string;
  status: string;
  /** party_leader ballots: the party this session belongs to. */
  partyId: string | null;
  side: "ruling" | "opposition" | null;
  closesAt: string | null;
};

export type FormationState = {
  steps: FormationStepRow[];
  event: {
    allocation_locked: boolean;
    scores_locked: boolean;
    results_published_at: string | null;
    day1_date: string | null;
    level: string | null;
  };
  /** Sessions referenced by any step, keyed by session id. */
  sessions: Record<string, FormationSessionLite>;
  /** Ballots cast per session id (live turnout, never the ballots themselves). */
  voteCounts: Record<string, number>;
  /**
   * Per-step turnout summary for election steps (plan §3.2): eligible voters
   * across the step's ballots vs how many of them have cast. Party ballots
   * partition the electorate, so per-session sums are step totals.
   */
  turnout: Partial<Record<FormationStepKey, { eligible: number; voted: number }>>;
};

export type FormationPendingParticipant = {
  id: string;
  full_name: string;
  emailMasked: string | null;
};

export type FormationTurnoutSession = {
  sessionId: string;
  voteType: string;
  partyId: string | null;
  side: "ruling" | "opposition" | null;
  eligible: number;
  voted: number;
  pendingParticipants: FormationPendingParticipant[];
};

export type FormationTurnout = {
  stepKey: FormationStepKey;
  sessions: FormationTurnoutSession[];
  /** Step totals (sessions partition the electorate for party ballots). */
  eligible: number;
  voted: number;
  pendingParticipants: FormationPendingParticipant[];
};

export type FormationCloseResult = {
  tie: boolean;
  /** Sessions whose reveal surfaced a tie (organiser opens a runoff per one). */
  tiedSessionIds: string[];
  /**
   * The subset of tiedSessionIds that are THEMSELVES runoffs — a repeat tie.
   * Runoffs stop at one (Director, 2026-08-11: "organiser decides per case"),
   * so no further runoff is offered for these; the organiser assigns the seat
   * on the Positions page instead.
   */
  terminalTiedSessionIds: string[];
  runoffOffered: boolean;
};

/**
 * Is this tied ballot a REPEAT tie — i.e. is the session that tied itself a
 * runoff? A runoff-of-a-runoff is never offered: one runoff, then the
 * organiser decides on Positions. Reads the runoff markers openRunoff stamps
 * into vote_sessions.config (voting.ts RunoffConfig). Unknown/absent config
 * reads as "not a runoff" — a FIRST tie still gets its one runoff.
 */
export function isTerminalTieSession(
  config: { isRunoff?: unknown; runoffOf?: unknown } | null | undefined
): boolean {
  if (!config || typeof config !== "object") return false;
  if (config.isRunoff === true) return true;
  return typeof config.runoffOf === "string" && config.runoffOf.length > 0;
}

// ─── Low-turnout warning (organiser confirm, never a block) ─────────

/**
 * Turnout below HALF of the eligible electorate. Warn-only: the organiser may
 * still close (they alone know whether the missing students are reachable) —
 * this only decides whether the confirm dialog spells the numbers out.
 *
 * Exactly half is NOT low (2026-08-13 decision: "below half"). A step with no
 * eligible voters, or with unusable counts, is never flagged — there is no
 * ratio to judge and nothing to divide by.
 */
export function isLowTurnout(
  turnout: { eligible: number; voted: number } | null | undefined
): boolean {
  if (!turnout) return false;
  const { eligible, voted } = turnout;
  if (!Number.isFinite(eligible) || eligible <= 0) return false;
  if (!Number.isFinite(voted) || voted < 0) return false;
  // voted / eligible < 1/2, done without division (no divide-by-zero path).
  return voted * 2 < eligible;
}

/** Whole-number turnout percentage for organiser-facing copy; 0 when there is no electorate. */
export function turnoutPercent(
  turnout: { eligible: number; voted: number } | null | undefined
): number {
  if (!turnout) return 0;
  const { eligible, voted } = turnout;
  if (!Number.isFinite(eligible) || eligible <= 0) return 0;
  if (!Number.isFinite(voted) || voted <= 0) return 0;
  return Math.round((voted / eligible) * 100);
}

export type FormationAnnouncementPerson = {
  id: string;
  full_name: string;
  school_name: string;
  /** Primary ministry label (cabinet_portfolio), where held. */
  ministry: string | null;
};

export type FormationAnnouncement = {
  speaker: FormationAnnouncementPerson | null;
  deputySpeakers: FormationAnnouncementPerson[];
  partyLeaders: Array<{
    partyId: string;
    partyName: string;
    side: "ruling" | "opposition" | null;
    leader: FormationAnnouncementPerson | null;
  }>;
  primeMinister: FormationAnnouncementPerson | null;
  leaderOfOpposition: FormationAnnouncementPerson | null;
  cabinetMinisters: FormationAnnouncementPerson[];
  shadowMinisters: FormationAnnouncementPerson[];
  deputyMinisters: FormationAnnouncementPerson[];
  officials: Array<FormationAnnouncementPerson & { role: string }>;
};
