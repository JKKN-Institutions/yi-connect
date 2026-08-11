/**
 * Shared contract for "that team just filled up — here are your other options".
 *
 * WHY THIS EXISTS: when the in-app invitation reminder ships, a whole chapter
 * of students act at once. Erode (chapter final 12 Aug 2026) has 141 live
 * pending invitations held by 93 students against 106 open seats across 43
 * teams — capacity covers demand, but only just, and it is first-come. Teams
 * WILL fill up while another student is mid-tap.
 *
 * The director's call: an Accept that fails because the team is now full must
 * say so plainly AND show the invitations the student is still holding, so a
 * dead end becomes a next step.
 *
 * Pure module (no "use server") so the server action, the server component and
 * the client component can all import from it. Types and constants may not be
 * exported from a "use server" file — that breaks the Vercel build at module
 * eval — which is the reason this file exists at all.
 */

import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";

/**
 * One invitation the student could accept INSTEAD. Only ever built from a live
 * server read, never from a client-side list — the whole point is that the
 * situation changed in the seconds since the page rendered.
 */
export type InviteOption = {
  /** team_invitations.id — what respondInvite is called with. */
  id: string;
  teamName: string;
  /** Null when the inviter's delegate row is missing; UI says "a team member". */
  inviterName: string | null;
  memberCount: number;
  /** TEAM_SIZE_MAX - memberCount, as read a moment ago. Never <= 0. */
  seatsLeft: number;
};

export type RemainingInvitesResult =
  | {
      ok: true;
      /**
       * True when the student turns out to already be on a team — either their
       * Accept actually landed, or they joined by another route. Nothing is
       * offered in that case: uniq_delegate_per_edition would reject it.
       */
      alreadyOnTeam: boolean;
      /** Live, non-expired, joinable invitations. Excludes the one that failed. */
      options: InviteOption[];
      /**
       * Live invitations that exist but are NOT joinable right now (their team
       * is full or locked too). Counted, never offered — offering one just
       * moves the dead end. Lets the UI say "your other 2 are full as well"
       * instead of pretending the student has nothing.
       */
      blockedCount: number;
    }
  | { ok: false; error: string };

/**
 * Does this respondInvite error mean specifically "the team filled up"?
 *
 * respondInvite (app/yi-future/actions/team-invites.ts) reports that case as
 *   `That team is already at ${TEAM_SIZE_MAX} members.`
 * and the sibling sendInvite phrases the same condition as
 *   `Team is already at the maximum of ${TEAM_SIZE_MAX} members.`
 * Both are matched here; the count is read from TEAM_SIZE_MAX rather than
 * hard-coded so changing the team size cannot silently un-match it.
 *
 * This deliberately does NOT match the other refusals respondInvite can
 * return — frozen team, expired invite, invite no longer pending, invite not
 * addressed to you, or the uniq_delegate_per_edition duplicate-key error. Those
 * are different problems with different answers and must not be papered over
 * with "here are your other options".
 *
 * FOLLOW-UP (not done here — team-invites.ts is out of this change's scope):
 * respondInvite should return a machine-readable `code: "team_full"` so this
 * stops depending on prose. Until then the two files are coupled by that
 * sentence, which is why the coupling lives in one documented place.
 */
export function isTeamFullError(raw: string): boolean {
  const s = raw.toLowerCase();
  if (!s.includes(`${TEAM_SIZE_MAX} member`)) return false;
  return s.includes("already at");
}

/**
 * Turn whatever respondInvite returned into a sentence a 17-year-old can act on.
 *
 * Lives here rather than in the client component so that this — the guarantee
 * that no raw database text ever reaches a student — is unit-testable. There is
 * exactly ONE humanise in the codebase; the client component imports it.
 *
 * respondInvite surfaces `insErr.message` straight from Postgres when the
 * one-team-per-edition unique index rejects the join. That reads
 * "duplicate key value violates unique constraint uniq_delegate_per_edition" —
 * useless to a student. Translate the ones we can recognise; pass anything
 * already-plain through untouched; replace anything database-shaped wholesale.
 */
export function humanise(raw: string): string {
  const s = raw.toLowerCase();
  if (
    s.includes("uniq_delegate_per_edition") ||
    s.includes("duplicate key") ||
    s.includes("already on another team")
  ) {
    return "You're already on a team, so this invitation can't be accepted. Reload to see your team.";
  }
  if (s.includes("no longer pending")) {
    return "This invitation was withdrawn or already answered. Reload to see your current invitations.";
  }
  if (s.includes("not addressed to you")) {
    return "This invitation isn't yours to answer. Reload the page.";
  }
  if (s.includes("permission") || s.includes("jwt") || s.includes("row-level")) {
    return "Your sign-in seems to have expired. Reload the page and enter your access code again.";
  }
  if (isTeamFullError(raw)) {
    // Normally intercepted before humanise() and answered with the student's
    // remaining options. This is the safety net if it arrives another way.
    return "That team filled up before your tap landed, so you couldn't be added.";
  }
  if (s.includes("frozen")) {
    return "That team has been locked by the chapter, so nobody new can join it. Decline it and pick another team.";
  }
  if (looksLikeDatabaseText(raw)) {
    return "Something went wrong at our end and you weren't added to the team. Reload to see where things stand.";
  }
  return raw;
}

/**
 * Last line of defence for "no raw database text may ever reach a student".
 * respondInvite returns `insErr.message` / `error.message` straight from
 * Postgres for any error it has no sentence of its own for, so humanise's
 * fallthrough cannot be trusted to be readable. Anything carrying
 * database-shaped vocabulary is replaced wholesale rather than shown.
 *
 * Verified against every message respondInvite can produce: its own human
 * sentences ("This invite has expired — invites are valid for 7 days…",
 * "Invite not found.", "Team no longer exists.") do not match, and pass through.
 */
export function looksLikeDatabaseText(raw: string): boolean {
  return /violat|constraint|relation |column |sqlstate|syntax error|null value|permission denied|duplicate|pgrst|\b2\d{4}\b|\b4\d{4}\b/i.test(
    raw
  );
}
