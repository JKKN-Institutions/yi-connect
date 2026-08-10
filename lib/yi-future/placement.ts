// ═══════════════════════════════════════════════════════════════════════
// Yi-Future — team placement SUGGESTION engine (pure, no I/O).
//
// WHY THIS EXISTS
// Measured on production 2026-08-09: 9,214 active delegates are in no team
// (Erode 96 of 200, Visakhapatnam 1,380 of 1,923, Bhopal 588 of 1,221). The
// only way to place one today is to open a team's detail page and pick the
// student from a dropdown of every delegate in the chapter — 43 teams × a
// 200-name dropdown in Erode. Nobody does that, so students stay unplaced.
//
// WHAT THIS IS NOT
// It is NOT an auto-assigner. This module only RANKS (delegate → team) pairs
// and explains each ranking. Nothing is written until a human ticks the rows
// and presses send, and even then the write is a consent-based INVITATION
// (future.team_invitations) — the existing 2026-06-20 product decision
// (Nashik report) forbids an admin dropping a student onto a team without the
// student accepting. See app/yi-future/actions/members.ts#inviteMember.
//
// WHEN THERE ARE MORE STUDENTS THAN SEATS
// `buildStrategyOptions` computes all FOUR ways out side by side — unlock locked
// teams / allow 6 per team / create new teams / leave the rest out — each with
// the real number of seats it frees and the real number of students it still
// cannot seat, for the chapter on screen. The Director's instruction was to show
// every option rather than have the platform choose (2026-08-09). Choosing one
// still writes nothing; the chapter then approves a list.
//
// RANKING SIGNALS — only columns that actually carry data were used.
// Verified live 2026-08-09 across all 9,214 unteamed delegates:
//   college_id        9,214 / 9,214  ✓ primary signal
//   course            9,214 / 9,214  ✓ secondary
//   year_of_study     9,213 / 9,214  ✓ tie-breaker
//   preferred_track_slug   15 / 9,214  ✗ effectively empty — used only as a
//                                       bonus when BOTH sides have it, never
//                                       as a primary signal.
//
// Deliberately NOT a "use server" module: it exports types and sync helpers,
// which a "use server" file may not do (that breaks the Vercel build).
// ═══════════════════════════════════════════════════════════════════════

import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";

/**
 * Most (delegate → team) pairs one approval click may send.
 *
 * Each invite runs ~5 sequential queries inside `inviteMember` (team load,
 * size re-check, already-teamed re-check, invite upsert, revalidate), so an
 * unbounded batch would walk into the serverless function timeout mid-way and
 * half-apply. 50 keeps a batch at roughly 8s, and the UI tells the reviewer to
 * run it again for the remainder rather than silently truncating.
 */
export const PLACEMENT_BATCH_MAX = 50;

/**
 * Most brand-new teams one "create teams for the leftovers" click may make.
 *
 * Creating a team is cheap but irreversible-looking to a chapter (an empty team
 * shows up on every teams list and someone has to delete it), so the click is
 * bounded. Erode needs 5; the cap only stops a mis-read plan from creating
 * dozens.
 */
export const PLACEMENT_NEW_TEAMS_MAX = 20;

// ─── Inputs ─────────────────────────────────────────────────────────────

export type PlacementDelegate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  college_id: string | null;
  college_name: string | null;
  course: string | null;
  year_of_study: number | null;
  preferred_track_slug: string | null;
};

export type PlacementTeam = {
  id: string;
  team_name: string;
  is_frozen: boolean;
  /** captain_id ?? leader_delegate_id — `inviteMember` needs one (invited_by is NOT NULL). */
  has_leader: boolean;
  problem_title: string | null;
  track_slug: string | null;
  track_label: string | null;
  member_count: number;
  member_college_ids: (string | null)[];
  member_courses: (string | null)[];
  member_years: (number | null)[];
  /** Delegates holding a pending, non-expired invite to THIS team. */
  pending_invite_delegate_ids: string[];
};

// ─── Outputs ────────────────────────────────────────────────────────────

export type PlacementSuggestion = {
  /** Stable identity for React keys and for the approve payload. */
  key: string;
  delegateId: string;
  delegateName: string;
  delegateEmail: string | null;
  collegeName: string | null;
  course: string | null;
  yearOfStudy: number | null;
  teamId: string;
  teamName: string;
  problemTitle: string | null;
  /** Team size before this suggestion, and after it (never exceeds TEAM_SIZE_MAX). */
  sizeBefore: number;
  sizeAfter: number;
  score: number;
  /** Plain-English "why this team" lines shown next to the row. */
  reasons: string[];
  /** Things the reviewer should know but that don't block the invite. */
  warnings: string[];
};

export type PlacementBlocked = {
  delegateId: string;
  delegateName: string;
  collegeName: string | null;
  reason: string;
};

export type PlacementAwaiting = {
  delegateId: string;
  delegateName: string;
  teamName: string;
};

export type PlacementStats = {
  unteamed: number;
  suggested: number;
  blocked: number;
  awaitingResponse: number;
  openTeams: number;
  /**
   * Seats an invitation can actually be sent into RIGHT NOW:
   * cap − members − unanswered invitations, over open teams.
   *
   * Unanswered invitations are subtracted because `respondInvite` re-checks the
   * team size when the student taps Accept. Erode has 149 unanswered invitations
   * against 72 physical seats — counting the seat as free would suggest a
   * placement that `approvePlacements` then refuses, which reads as a bug.
   */
  openSeats: number;
  /**
   * Physical seats in open teams (cap − members), ignoring who holds an
   * unanswered invitation. This is the number the STRATEGY comparison uses:
   * "does this chapter own enough chairs for its students?" is a different
   * question from "whom may I invite this minute?".
   */
  openSeatsPhysical: number;
  /** Unanswered invitations across every team in the chapter. */
  pendingInvites: number;
  frozenTeams: number;
  frozenSeats: number;
  leaderlessTeams: number;
  leaderlessSeats: number;
  /**
   * Students THIS PLAN could not seat — i.e. `blocked.length`.
   *
   * NOT the chapter's chair shortfall, and the two differ a lot. Erode: this is
   * 0 (only 1 student was even eligible to be suggested, because 93 are waiting
   * on an invitation) while the chapter is genuinely 23 chairs short. Use
   * `unteamed − openSeatsPhysical`, or a strategy option's `wouldRemain`, for
   * "how many students have nowhere to sit" — never this.
   */
  seatShortfall: number;
  /** New teams to absorb `seatShortfall` only. See the warning above it. */
  newTeamsNeeded: number;
  /** Cap this plan was built with — TEAM_SIZE_MAX unless overridden per call. */
  teamSizeMax: number;
};

export type PlacementPlan = {
  suggestions: PlacementSuggestion[];
  blocked: PlacementBlocked[];
  awaiting: PlacementAwaiting[];
  stats: PlacementStats;
};

// ─── The four strategies ────────────────────────────────────────────────
//
// A chapter with more students than seats has exactly four ways out, and the
// Director's instruction (2026-08-09) was "show all options on the ui" rather
// than have the platform pick one. Each is computed live for the chapter on
// screen; none of them writes anything until the chapter picks one and then
// approves the resulting list.
//
// All four are measured on the SAME basis: physical seats (cap − members) in
// teams an invitation can be sent from, against every active delegate who is on
// no team. Unanswered invitations are deliberately NOT treated as seats here —
// Erode has 149 of them for 72 seats, so counting them would hide the shortfall
// instead of showing it.

export type PlacementStrategyId =
  | "unlock_frozen"
  | "grow_to_six"
  | "new_teams"
  | "leave_unteamed";

/** One frozen team and what unlocking it would release. Named, never a count. */
export type PlacementUnlockCandidate = {
  teamId: string;
  teamName: string;
  members: number;
  seatsFreed: number;
  /** Pre-ticked because this team is part of the smallest set that closes the gap. */
  neededForGap: boolean;
};

export type PlacementStrategyOption = {
  id: PlacementStrategyId;
  title: string;
  /** Seats available if this strategy is taken, chapter-wide. */
  seats: number;
  /** Students of `unteamed` this strategy could seat. */
  wouldSeat: number;
  /** Students still with no seat afterwards. Never hidden, even when 0. */
  wouldRemain: number;
  /** Live facts, one line each. Numbers only from this chapter. */
  detail: string[];
  /** What it costs the chapter, in words a chapter chair uses. */
  cost: string;
  /** False ⇒ the platform cannot do this; `unavailableReason` says why. */
  available: boolean;
  unavailableReason: string | null;
  /** unlock_frozen only — the specific teams, so nothing is unlocked unnamed. */
  unlockCandidates: PlacementUnlockCandidate[];
  /** new_teams only. */
  newTeamCount: number;
};

/** Result rows for the two pre-steps (unlock / create). Never one lumped message. */
export type PlacementStepRow = {
  key: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

export type PlacementStepResult =
  | { ok: true; rows: PlacementStepRow[]; done: number; skipped: number; failed: number }
  | { ok: false; error: string };

/**
 * Why "6 per team" cannot be done from this screen.
 *
 * TEAM_SIZE_MAX is 5 and stays 5 — this module never edits
 * lib/yi-future/constants.ts. The cap is enforced independently in three
 * places, and only ONE of them is reachable from here, so a per-call override
 * would produce invitations that fail at the moment a student taps Accept:
 *
 *   1. future.check_team_size() — a BEFORE INSERT trigger on
 *      future.team_members with `max_size CONSTANT INT := 5`. Postgres raises
 *      on the 6th member regardless of what the app believes. Changing it needs
 *      a migration.
 *   2. app/yi-future/actions/members.ts#inviteMember — refuses at 5 and takes
 *      no override argument.
 *   3. app/yi-future/actions/team-invites.ts#respondInvite — re-checks at 5
 *      when the student accepts.
 *
 * Kept as a constant so the action and the UI give the reviewer the same
 * sentence instead of two different half-truths.
 */
export const GROW_TO_SIX_BLOCKED_REASON =
  "The 5-per-team limit is enforced by the database itself (a trigger on team membership), and again when a student taps Accept. Raising it to 6 needs a database change plus edits to the invite and accept steps — it cannot be switched on from this screen. Nothing here can make it work today.";

/**
 * Build all four strategy options for one chapter, with live numbers.
 *
 * Pure and deterministic: same roster in, same options out, so two admins
 * looking at the same chapter are shown the same consequences.
 */
export function buildStrategyOptions(input: {
  unteamed: PlacementDelegate[];
  teams: PlacementTeam[];
  /** Defaults to TEAM_SIZE_MAX. Never mutates it. */
  teamSizeMax?: number;
}): PlacementStrategyOption[] {
  const cap = input.teamSizeMax ?? TEAM_SIZE_MAX;
  const students = input.unteamed.length;
  const seatsAt = (t: PlacementTeam, c: number) =>
    Math.max(0, c - t.member_count);

  // A team an invitation can be sent FROM: not locked, and it has a
  // captain/leader (team_invitations.invited_by is NOT NULL).
  const open = input.teams.filter((t) => !t.is_frozen && t.has_leader);
  const frozen = input.teams.filter((t) => t.is_frozen);
  // A locked team with no captain stays unusable after unlocking, so it is not
  // offered — unlocking it would disturb a team for nothing.
  const frozenUsable = frozen.filter((t) => t.has_leader && seatsAt(t, cap) > 0);
  const leaderless = input.teams.filter((t) => !t.is_frozen && !t.has_leader);

  const openSeats = open.reduce((n, t) => n + seatsAt(t, cap), 0);
  const deficit = Math.max(0, students - openSeats);
  // Unanswered invitations decide whether the leftover students can be NAMED.
  // With invitations out, "which 23 miss out" depends on who answers, so the copy
  // below must not promise a list the page cannot produce.
  const pending = input.teams.reduce(
    (n, t) => n + t.pending_invite_delegate_ids.length,
    0
  );

  const mk = (
    o: Omit<PlacementStrategyOption, "wouldSeat" | "wouldRemain">
  ): PlacementStrategyOption => ({
    ...o,
    wouldSeat: Math.min(students, o.seats),
    wouldRemain: Math.max(0, students - o.seats),
  });

  // ─── 1. Unlock frozen teams ───────────────────────────────────────────
  // Biggest-first, so the fewest teams are disturbed to close the gap. Every
  // candidate is named; the ones inside the gap are pre-ticked, the rest are
  // offered but not pre-selected.
  const byRoom = [...frozenUsable].sort(
    (a, b) =>
      seatsAt(b, cap) - seatsAt(a, cap) || a.team_name.localeCompare(b.team_name)
  );
  let running = 0;
  const unlockCandidates: PlacementUnlockCandidate[] = byRoom.map((t) => {
    const seatsFreed = seatsAt(t, cap);
    const neededForGap = running < deficit;
    if (neededForGap) running += seatsFreed;
    return {
      teamId: t.id,
      teamName: t.team_name,
      members: t.member_count,
      seatsFreed,
      neededForGap,
    };
  });
  const teamsToUnlock = unlockCandidates.filter((c) => c.neededForGap);
  const seatsFromUnlockNeeded = teamsToUnlock.reduce(
    (n, c) => n + c.seatsFreed,
    0
  );
  const seatsFromUnlockAll = unlockCandidates.reduce(
    (n, c) => n + c.seatsFreed,
    0
  );

  const unlock = mk({
    id: "unlock_frozen",
    title: "Unlock locked teams",
    seats: openSeats + seatsFromUnlockNeeded,
    detail: [
      `${frozen.length} team${frozen.length === 1 ? "" : "s"} in this chapter are locked, holding ${frozen.reduce((n, t) => n + seatsAt(t, cap), 0)} empty seat${frozen.reduce((n, t) => n + seatsAt(t, cap), 0) === 1 ? "" : "s"}. ${frozenUsable.length} of them could take a member once unlocked.`,
      frozenUsable.length === 0
        ? "None of them can take a member even after unlocking (no captain, or already full), so unlocking would free nothing."
        : deficit === 0
          ? `Unlocking is not needed — every student already has a chair.`
          : `Unlocking ${teamsToUnlock.length} of them frees ${seatsFromUnlockNeeded} seat${seatsFromUnlockNeeded === 1 ? "" : "s"} — enough for the ${deficit} student${deficit === 1 ? "" : "s"} with no chair.`,
      frozenUsable.length > teamsToUnlock.length
        ? `You can unlock more: all ${frozenUsable.length} would free ${seatsFromUnlockAll} seats.`
        : "",
    ].filter(Boolean),
    cost:
      "Each of these teams locked itself on purpose — a student pressed Freeze to say the team was final. Unlocking re-opens them to new members and cancels that decision, so tell the teams first.",
    available: frozenUsable.length > 0,
    unavailableReason:
      frozenUsable.length > 0
        ? null
        : "No locked team in this chapter has both a captain and a free seat, so unlocking would not create a single usable seat.",
    unlockCandidates,
    newTeamCount: 0,
  });

  // ─── 2. Six per team instead of five ──────────────────────────────────
  // Computed anyway, so the chapter can see what the limit costs them, then
  // told plainly that the platform cannot do it (see GROW_TO_SIX_BLOCKED_REASON).
  const seatsAtSix = open.reduce((n, t) => n + seatsAt(t, 6), 0);
  const teamsThatWouldGrow = open.filter((t) => t.member_count >= cap).length;
  const six = mk({
    id: "grow_to_six",
    title: `Allow 6 per team instead of ${cap}`,
    seats: seatsAtSix,
    detail: [
      `Would give ${seatsAtSix} seats instead of ${openSeats}, across ${open.length} unlocked team${open.length === 1 ? "" : "s"}.`,
      `${teamsThatWouldGrow} team${teamsThatWouldGrow === 1 ? " is" : "s are"} already at ${cap} and would be able to take a 6th member.`,
    ],
    cost: `This chapter's teams would be bigger than every other chapter's, which the regional round may treat as an advantage. It also changes ${cap}-member teams that have already finished forming.`,
    available: false,
    unavailableReason: GROW_TO_SIX_BLOCKED_REASON,
    unlockCandidates: [],
    newTeamCount: 0,
  });

  // ─── 3. New teams for the leftovers ───────────────────────────────────
  const newTeamCount = Math.ceil(deficit / cap);
  const newTeams = mk({
    id: "new_teams",
    title: "Create new teams for the leftovers",
    seats: openSeats + newTeamCount * cap,
    detail: [
      deficit === 0
        ? "No student is left without a seat, so no new team is needed."
        : `${newTeamCount} new team${newTeamCount === 1 ? "" : "s"} would add ${newTeamCount * cap} seat${newTeamCount * cap === 1 ? "" : "s"} — enough for the ${deficit} student${deficit === 1 ? "" : "s"} who have none.`,
      "One of those students is named leader of each new team so invitations can be sent from it. They are invited like everybody else and are on no team until they accept.",
    ],
    cost:
      "Brand-new teams start with no problem statement and no shared work. Late in the programme they are behind every other team, and if nobody accepts you are left with empty teams to delete.",
    available: deficit > 0,
    unavailableReason:
      deficit > 0
        ? null
        : "Every student already has a seat in an existing team — a new team would start empty.",
    unlockCandidates: [],
    newTeamCount,
  });

  // ─── 4. Do nothing ────────────────────────────────────────────────────
  // Shown with its count so leaving students out is a decision the chapter
  // takes, not a default it slides into.
  const leave = mk({
    id: "leave_unteamed",
    title: "Leave the rest without a team",
    seats: openSeats,
    detail: [
      deficit === 0
        ? "Nothing is left over — every student fits in an existing team."
        : pending > 0
          ? `${deficit} student${deficit === 1 ? "" : "s"} would stay out of the programme. Exactly which ones depends on who answers the ${pending} invitations already out.`
          : `${deficit} student${deficit === 1 ? "" : "s"} would stay out of the programme. They are named at the bottom of this page.`,
      `${Math.min(students, openSeats)} of the ${students} have a chair. The invitations you approve below still go out as normal.`,
      leaderless.length > 0
        ? `${leaderless.length} unlocked team${leaderless.length === 1 ? "" : "s"} have no captain, so their ${leaderless.reduce((n, t) => n + seatsAt(t, cap), 0)} seat${leaderless.reduce((n, t) => n + seatsAt(t, cap), 0) === 1 ? "" : "s"} cannot be used either — an invitation has to be sent from a captain.`
        : "",
    ].filter(Boolean),
    cost:
      deficit === 0
        ? "Nothing changes beyond the invitations you approve below."
        : `${deficit} registered student${deficit === 1 ? "" : "s"} finish the edition without a team, no submission and no certificate. Nothing is written for them and nobody is told.`,
    available: true,
    unavailableReason: null,
    unlockCandidates: [],
    newTeamCount: 0,
  });

  return [unlock, six, newTeams, leave];
}

/** Per-row outcome of an approved batch. Never collapsed into one message. */
export type PlacementRowResult = {
  key: string;
  delegateName: string;
  teamName: string;
  status: "sent" | "skipped" | "failed";
  detail: string;
};

export type PlacementBatchResult =
  | { ok: true; rows: PlacementRowResult[]; sent: number; skipped: number; failed: number }
  | { ok: false; error: string };

// ─── Scoring ────────────────────────────────────────────────────────────

const norm = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Rank one (delegate → team) pair. Higher is better. Pure and deterministic:
 * the same inputs always give the same score, so two admins looking at the
 * same chapter see the same plan.
 */
function scorePair(
  d: PlacementDelegate,
  t: PlacementTeam,
  cap: number
): { score: number; reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // 1. Same college — the only signal present on every delegate, and the one
  //    that decides whether team-mates can physically meet.
  const sameCollege = d.college_id
    ? t.member_college_ids.filter((c) => c === d.college_id).length
    : 0;
  if (sameCollege > 0) {
    score += 100 + 10 * Math.min(sameCollege, 4);
    reasons.push(
      `Same college — ${sameCollege} of ${t.member_count} member${
        t.member_count === 1 ? "" : "s"
      } from ${d.college_name ?? "this college"}`
    );
  } else if (t.member_count === 0) {
    // An empty team can't clash with anyone; it's a reasonable fallback but
    // must rank below a real college match.
    score += 20;
    reasons.push("Empty team — no college mismatch");
  }

  // 2. Same course.
  if (d.course) {
    const sameCourse = t.member_courses.filter(
      (c) => norm(c) === norm(d.course)
    ).length;
    if (sameCourse > 0) {
      score += 25;
      reasons.push(`Same course — ${d.course}`);
    }
  }

  // 3. Same year of study.
  if (d.year_of_study != null) {
    const sameYear = t.member_years.filter(
      (y) => y != null && y === d.year_of_study
    ).length;
    if (sameYear > 0) {
      score += 8;
      reasons.push(`Same year — year ${d.year_of_study}`);
    }
  }

  // 4. Preferred track vs the team's allocated problem. Only 15 of 9,214
  //    unteamed delegates have a preferred track, so this is a bonus, never a
  //    requirement — a chapter must not be shown an empty screen because a
  //    column nobody fills is missing.
  if (d.preferred_track_slug && t.track_slug && d.preferred_track_slug === t.track_slug) {
    score += 40;
    reasons.push(
      `Matches their preferred track — ${t.track_label ?? t.track_slug}`
    );
  }

  // 5. Prefer emptier teams among otherwise-equal options, so one team doesn't
  //    absorb a whole cohort while others stay at one member.
  score += (cap - t.member_count) * 2;

  if (t.member_count === 0) {
    warnings.push("This team currently has no members at all");
  }
  if (!t.problem_title) {
    warnings.push("Team has not picked a problem statement yet");
  }

  return { score, reasons, warnings };
}

// ─── Planner ────────────────────────────────────────────────────────────

/**
 * Build the full suggestion plan for one chapter.
 *
 * Capacity is simulated across the WHOLE plan, not checked per row: two
 * individually-valid suggestions could otherwise both target the last free
 * seat and overfill the team past TEAM_SIZE_MAX on send. Each accepted
 * suggestion also feeds the placed student's college/course/year back into the
 * team's simulated roster, so a second student from the same college is then
 * pulled toward the same team — cohorts cluster instead of scattering.
 */
export function buildPlacementPlan(input: {
  unteamed: PlacementDelegate[];
  teams: PlacementTeam[];
  /**
   * Per-call cap override for the "6 per team" strategy.
   *
   * Deliberately a PARAMETER and not a change to TEAM_SIZE_MAX: the global rule
   * stays 5 for every other chapter and every other screen, and any override is
   * visible at the call site. `approvePlacements` refuses a value above
   * TEAM_SIZE_MAX (see GROW_TO_SIX_BLOCKED_REASON) so a plan built with a bigger
   * cap can never be sent — the parameter exists so the code path is honest
   * about where the limit actually lives, not to sneak past it.
   */
  teamSizeMax?: number;
}): PlacementPlan {
  const { unteamed, teams } = input;
  const cap = input.teamSizeMax ?? TEAM_SIZE_MAX;

  const frozenTeams = teams.filter((t) => t.is_frozen);
  const leaderless = teams.filter((t) => !t.is_frozen && !t.has_leader);
  const seatsOf = (t: PlacementTeam) => Math.max(0, cap - t.member_count);
  /**
   * Seats an invitation may actually be SENT into.
   *
   * Unanswered invitations are subtracted because `respondInvite` re-checks the
   * team size at the moment the student taps Accept, and `approvePlacements`
   * subtracts them too. Erode holds 149 unanswered invitations against 72
   * physical seats — ranking against physical seats would suggest placements the
   * approve step then refuses, which reads as a broken screen rather than as a
   * chapter that has over-invited.
   */
  const sendableSeatsOf = (t: PlacementTeam) =>
    Math.max(0, cap - t.member_count - t.pending_invite_delegate_ids.length);

  // A team is usable only if `inviteMember` would accept it: not frozen (it
  // refuses locked teams), has a captain/leader (invited_by is NOT NULL), and
  // has a seat left after members and unanswered invitations. Suggesting into a
  // team that fails any of these would produce a row that is guaranteed to fail
  // at send time.
  const usable = teams
    .filter((t) => !t.is_frozen && t.has_leader && sendableSeatsOf(t) > 0)
    .map((t) => ({
      team: t,
      capacity: sendableSeatsOf(t),
      collegeIds: [...t.member_college_ids],
      courses: [...t.member_courses],
      years: [...t.member_years],
      size: t.member_count,
    }));

  const openSeats = usable.reduce((n, u) => n + u.capacity, 0);
  const openTeamsAll = teams.filter((t) => !t.is_frozen && t.has_leader);
  const openSeatsPhysical = openTeamsAll.reduce((n, t) => n + seatsOf(t), 0);
  const pendingInvites = teams.reduce(
    (n, t) => n + t.pending_invite_delegate_ids.length,
    0
  );

  // Students mid-flight on a fresh invite are left alone — re-inviting them
  // would just be a second notification for the same decision.
  const awaiting: PlacementAwaiting[] = [];
  const pendingTeamByDelegate = new Map<string, string>();
  for (const t of teams) {
    for (const id of t.pending_invite_delegate_ids) {
      if (!pendingTeamByDelegate.has(id)) pendingTeamByDelegate.set(id, t.team_name);
    }
  }

  const toPlace: PlacementDelegate[] = [];
  for (const d of unteamed) {
    const pendingTeam = pendingTeamByDelegate.get(d.id);
    if (pendingTeam) {
      awaiting.push({
        delegateId: d.id,
        delegateName: d.full_name,
        teamName: pendingTeam,
      });
    } else {
      toPlace.push(d);
    }
  }

  // Students who CAN be matched to a team-mate from their own college go first,
  // before generic placements eat those seats. Alphabetical inside each group
  // keeps the plan stable between reloads.
  const hasCollegeOption = (d: PlacementDelegate) =>
    !!d.college_id &&
    usable.some((u) => u.collegeIds.some((c) => c === d.college_id));
  const ordered = [...toPlace].sort((a, b) => {
    const ai = hasCollegeOption(a) ? 0 : 1;
    const bi = hasCollegeOption(b) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return (
      a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id)
    );
  });

  const suggestions: PlacementSuggestion[] = [];
  const blocked: PlacementBlocked[] = [];

  for (const d of ordered) {
    const candidates = usable.filter(
      (u) =>
        u.capacity > 0 &&
        !u.team.pending_invite_delegate_ids.includes(d.id)
    );
    if (candidates.length === 0) {
      blocked.push({
        delegateId: d.id,
        delegateName: d.full_name,
        collegeName: d.college_name,
        reason:
          openSeats === 0
            ? pendingInvites > 0
              ? `No unlocked team can take another invitation — every seat is held by a member or by one of the ${pendingInvites} invitations nobody has answered yet`
              : "No unlocked team in this chapter has a free seat"
            : "Every seat this chapter can invite into is already taken by a suggestion above",
      });
      continue;
    }

    let best: (typeof candidates)[number] | null = null;
    let bestScored: { score: number; reasons: string[]; warnings: string[] } | null =
      null;
    for (const u of candidates) {
      const scored = scorePair(
        d,
        {
          ...u.team,
          member_count: u.size,
          member_college_ids: u.collegeIds,
          member_courses: u.courses,
          member_years: u.years,
        },
        cap
      );
      if (
        !bestScored ||
        scored.score > bestScored.score ||
        (scored.score === bestScored.score &&
          (u.size < best!.size ||
            (u.size === best!.size &&
              (u.team.team_name.localeCompare(best!.team.team_name) < 0 ||
                (u.team.team_name === best!.team.team_name &&
                  u.team.id.localeCompare(best!.team.id) < 0)))))
      ) {
        best = u;
        bestScored = scored;
      }
    }
    if (!best || !bestScored) continue;

    suggestions.push({
      key: `${d.id}:${best.team.id}`,
      delegateId: d.id,
      delegateName: d.full_name,
      delegateEmail: d.email,
      collegeName: d.college_name,
      course: d.course,
      yearOfStudy: d.year_of_study,
      teamId: best.team.id,
      teamName: best.team.team_name,
      problemTitle: best.team.problem_title,
      sizeBefore: best.size,
      sizeAfter: best.size + 1,
      score: bestScored.score,
      reasons:
        bestScored.reasons.length > 0
          ? bestScored.reasons
          : ["Only remaining option with a free seat"],
      warnings: bestScored.warnings,
    });

    // Simulate the placement so later students see this team as it will be.
    best.capacity -= 1;
    best.size += 1;
    best.collegeIds.push(d.college_id);
    best.courses.push(d.course);
    best.years.push(d.year_of_study);
  }

  const seatShortfall = blocked.length;

  return {
    suggestions,
    blocked,
    awaiting,
    stats: {
      unteamed: unteamed.length,
      suggested: suggestions.length,
      blocked: blocked.length,
      awaitingResponse: awaiting.length,
      openTeams: usable.length,
      openSeats,
      openSeatsPhysical,
      pendingInvites,
      frozenTeams: frozenTeams.length,
      frozenSeats: frozenTeams.reduce((n, t) => n + seatsOf(t), 0),
      leaderlessTeams: leaderless.length,
      leaderlessSeats: leaderless.reduce((n, t) => n + seatsOf(t), 0),
      seatShortfall,
      newTeamsNeeded: Math.ceil(seatShortfall / cap),
      teamSizeMax: cap,
    },
  };
}
