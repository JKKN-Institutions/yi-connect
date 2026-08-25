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
  /**
   * Who was ON this ballot, from the session's own config — NOT who drew a
   * vote. The tally seeds from this so a nominee on zero votes still appears;
   * standing and getting nothing is a result, not an absence.
   */
  candidateIds: string[];
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
  /**
   * Who each election step actually seated, so a closed step can say so.
   *
   * Before this the console reported only "155/196 voted" and never named the
   * winner. The result WAS recorded correctly — roles are written at reveal —
   * but an organiser had to leave the page for Positions or the Oath
   * Announcement to find out who had won the election they had just run, which
   * reads as "nothing happened".
   *
   * Read from the CURRENT holders of the roles a step seats, not from a stored
   * tally, so a later hand-correction on Positions shows here too instead of
   * leaving two screens disagreeing about who the Speaker is.
   */
  winners: Partial<Record<FormationStepKey, FormationWinner[]>>;
  /**
   * Every closed ballot's ranked vote counts, for the organiser to read.
   *
   * Closing a step reveals the result and then IMMEDIATELY archives the session
   * (clearVoteResults), because a revealed ballot otherwise stays pinned to the
   * participants' screens. 'archived' is a terminal, non-displayed status — so
   * before this the counts vanished from the app the instant a step closed, and
   * the only function that could return them (getVoteResults) had never been
   * wired to a screen.
   *
   * Organiser-only, and totals only: who voted for whom is never assembled here.
   */
  tallies: Partial<Record<FormationStepKey, FormationBallotTally[]>>;
};

/** One seat filled by an election step. */
export type FormationWinner = {
  /** The post, e.g. "Speaker", "Deputy Speaker", "Party C". */
  label: string;
  name: string;
};

/** One candidate's line in a closed ballot's tally. */
export type FormationTallyEntry = {
  name: string;
  constituencyNumber: number | null;
  partyName: string | null;
  votes: number;
  /** Level with the highest count in this ballot — plural on a tie. */
  isTop: boolean;
};

/**
 * One closed ballot's result, ranked highest first.
 *
 * A party-leader step opens one of these PER PARTY, so `label` carries the party
 * name; House-wide (Speaker) and bench (PM / LoP) ballots leave it null.
 *
 * `isTop` marks whoever is level on the highest count. It does NOT decide the
 * seat — who actually won is `FormationState.winners`, read from the roles
 * written at reveal. Keeping the two separate means this view never
 * re-implements computeElectionOutcome and so can never quietly disagree with
 * it: a runoff, a tie-break or a hand-correction shows up in `winners` while the
 * raw counts here stay exactly what was cast.
 */
export type FormationBallotTally = {
  sessionId: string;
  label: string | null;
  totalVotes: number;
  entries: FormationTallyEntry[];
};

/**
 * The tallies as a CSV an organiser can keep or hand on.
 *
 * One row per candidate per ballot. Ballots that produced no votes are still
 * listed, with a zero row, so an empty ballot cannot be mistaken for a missing
 * one. Rank restarts within each ballot; ties share a rank.
 */
export function buildFormationTalliesCsv(
  eventName: string,
  tallies: Partial<Record<FormationStepKey, FormationBallotTally[]>>
): string {
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [
    ["Event", "Election", "Ballot", "Rank", "Candidate", "Constituency", "Party", "Votes", "Share %"]
      .map(esc)
      .join(","),
  ];

  for (const def of FORMATION_STEPS) {
    for (const ballot of tallies[def.key] ?? []) {
      if (ballot.entries.length === 0) {
        lines.push(
          [eventName, def.label, ballot.label ?? "All members", "", "(no votes cast)", "", "", 0, ""]
            .map(esc)
            .join(",")
        );
        continue;
      }
      let rank = 0;
      let lastVotes: number | null = null;
      ballot.entries.forEach((e, i) => {
        // Ties share a rank; the next distinct count skips ahead (1,2,2,4).
        if (lastVotes === null || e.votes !== lastVotes) rank = i + 1;
        lastVotes = e.votes;
        const share =
          ballot.totalVotes > 0
            ? Math.round((e.votes / ballot.totalVotes) * 1000) / 10
            : 0;
        lines.push(
          [
            eventName,
            def.label,
            ballot.label ?? "All members",
            rank,
            e.name,
            e.constituencyNumber ?? "",
            e.partyName ?? "",
            e.votes,
            share,
          ]
            .map(esc)
            .join(",")
        );
      });
    }
  }

  return lines.join("\n");
}

/**
 * The parliament_role values each election step seats.
 *
 * The Speaker ballot's runner-up becomes Deputy Speaker (see the ballot
 * subtitle in app/yip/actions/voting.ts), so both belong to step 2.
 * party_leader_ballots is deliberately absent: its winners hang off
 * parties.party_leader_id rather than a parliament_role, and are resolved
 * separately.
 *
 * A role listed here that nobody holds is simply not shown — these are the
 * seats a step CAN fill, not seats it must have filled.
 */
export const FORMATION_STEP_ROLES: Partial<
  Record<FormationStepKey, { role: string; label: string }[]>
> = {
  speaker_ballot: [
    { role: "speaker", label: "Speaker" },
    { role: "deputy_speaker", label: "Deputy Speaker" },
  ],
  pm_ballot: [
    { role: "prime_minister", label: "Prime Minister" },
    { role: "deputy_prime_minister", label: "Deputy Prime Minister" },
  ],
  lop_ballot: [
    { role: "leader_of_opposition", label: "Leader of Opposition" },
    { role: "coalition_leader", label: "Coalition Leader" },
  ],
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
  /**
   * Winners this close revealed who are NOT actually holding their role
   * afterwards, by name.
   *
   * Revealing marks a session revealed BEFORE it works out who won; seating
   * happens after, and only when the outcome resolved cleanly. When that second
   * half does not happen the reveal still succeeds, so a bulk close would
   * archive the tallies and report "winners recorded" over an empty bench. That
   * has already happened twice, and both times it was found by hand days later.
   *
   * Non-empty means the step was left OPEN and nothing was archived — same
   * treatment as a tie, for the same reason: the outcome is not safe to put
   * away yet.
   */
  unseatedWinners: string[];
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
