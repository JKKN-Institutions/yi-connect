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
  openSeats: number;
  frozenTeams: number;
  frozenSeats: number;
  leaderlessTeams: number;
  leaderlessSeats: number;
  /** Students with no seat available anywhere in the chapter. */
  seatShortfall: number;
  /** New teams needed to absorb the shortfall at TEAM_SIZE_MAX per team. */
  newTeamsNeeded: number;
};

export type PlacementPlan = {
  suggestions: PlacementSuggestion[];
  blocked: PlacementBlocked[];
  awaiting: PlacementAwaiting[];
  stats: PlacementStats;
};

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
  t: PlacementTeam
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
  score += (TEAM_SIZE_MAX - t.member_count) * 2;

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
}): PlacementPlan {
  const { unteamed, teams } = input;

  const frozenTeams = teams.filter((t) => t.is_frozen);
  const leaderless = teams.filter((t) => !t.is_frozen && !t.has_leader);
  const seatsOf = (t: PlacementTeam) =>
    Math.max(0, TEAM_SIZE_MAX - t.member_count);

  // A team is usable only if `inviteMember` would accept it: not frozen (it
  // refuses locked teams), has a captain/leader (invited_by is NOT NULL), and
  // has a free seat. Suggesting into a team that fails any of these would
  // produce a row that is guaranteed to fail at send time.
  const usable = teams
    .filter((t) => !t.is_frozen && t.has_leader && t.member_count < TEAM_SIZE_MAX)
    .map((t) => ({
      team: t,
      capacity: seatsOf(t),
      collegeIds: [...t.member_college_ids],
      courses: [...t.member_courses],
      years: [...t.member_years],
      size: t.member_count,
    }));

  const openSeats = usable.reduce((n, u) => n + u.capacity, 0);

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
            ? "No open team in this chapter has a free seat"
            : "Every free seat in this chapter is already taken by a suggestion above",
      });
      continue;
    }

    let best: (typeof candidates)[number] | null = null;
    let bestScored: { score: number; reasons: string[]; warnings: string[] } | null =
      null;
    for (const u of candidates) {
      const scored = scorePair(d, {
        ...u.team,
        member_count: u.size,
        member_college_ids: u.collegeIds,
        member_courses: u.courses,
        member_years: u.years,
      });
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
      frozenTeams: frozenTeams.length,
      frozenSeats: frozenTeams.reduce((n, t) => n + seatsOf(t), 0),
      leaderlessTeams: leaderless.length,
      leaderlessSeats: leaderless.reduce((n, t) => n + seatsOf(t), 0),
      seatShortfall,
      newTeamsNeeded: Math.ceil(seatShortfall / TEAM_SIZE_MAX),
    },
  };
}
