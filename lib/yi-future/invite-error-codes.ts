/**
 * Machine-readable failure codes for the Yi Future team-invitation actions.
 *
 * WHY THIS EXISTS
 * ---------------
 * `respondInvite` (app/yi-future/actions/team-invites.ts) used to communicate
 * WHICH refusal happened only through its English sentence. Two bad things
 * followed from that:
 *
 *   1. Callers had to pattern-match prose. The dashboard reminder banner
 *      (components/yi-future/team/PendingInviteActions.tsx) detects the
 *      "team filled up mid-tap" race — the one refusal that has a real next
 *      step — by matching `That team is already at 5 members.` through
 *      `isTeamFullError()` in lib/yi-future/invite-options.ts. Any reword of
 *      that sentence silently breaks the feature: the student gets a flat error
 *      instead of their remaining invitations.
 *   2. Some paths had no sentence at all and returned the Postgres message
 *      verbatim, so a 17-year-old could be shown
 *      `duplicate key value violates unique constraint "uniq_delegate_per_edition"`.
 *
 * So: every failure now carries a `code`, and every failure carries a sentence
 * written for a student. The sentences live HERE, not in the action, for two
 * reasons — a "use server" file may export only async functions (a plain
 * exported const breaks the Vercel build at module eval), and keeping them in a
 * pure module makes the "no raw database text ever reaches a student"
 * guarantee unit-testable. See lib/yi-future/__tests__/invite-error-codes.test.ts.
 *
 * COMPATIBILITY CONTRACT (do not break casually)
 * ----------------------------------------------
 * Every sentence below that existed before this file was introduced is
 * reproduced BYTE-FOR-BYTE, because `isTeamFullError()` and `humanise()` in
 * lib/yi-future/invite-options.ts still read the prose. The codes were ADDED
 * alongside the prose rather than replacing it, so the existing consumer keeps
 * working untouched.
 *
 * The three sentences that are NEW are exactly the three paths that previously
 * returned raw Postgres text. Each new sentence is the sentence `humanise()`
 * already produced for that class of error, so what the student reads does not
 * change — the raw text is simply no longer sent over the wire.
 *
 * FOLLOW-UP: switch PendingInviteActions.tsx from `isTeamFullError(res.error)`
 * to `res.code === "team_full"`, then `isTeamFullError` can be deleted.
 */

import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { INVITE_EXPIRY_DAYS } from "@/lib/yi-future/invite-expiry";

/**
 * Every way answering a team invitation can fail. Callers should branch on
 * these, never on the sentence.
 */
export type RespondInviteErrorCode =
  /** No delegate session (signed out, or signed in as an admin). */
  | "not_signed_in"
  /** No invitation row with that id. */
  | "invite_not_found"
  /** The invitation belongs to a different delegate. */
  | "not_your_invite"
  /** Already accepted, declined, cancelled or expired. */
  | "invite_not_pending"
  /** Still pending but past the INVITE_EXPIRY_DAYS window. */
  | "invite_expired"
  /** The team row is gone (deleted between render and tap). */
  | "team_not_found"
  /** The chapter or the captain locked the team; nobody new can join. */
  | "team_frozen"
  /** The team hit TEAM_SIZE_MAX. THE race this feature causes at scale. */
  | "team_full"
  /** uniq_delegate_per_edition rejected the join — one team per edition. */
  | "already_on_team"
  /** The join landed but the invitation row could not be marked accepted. */
  | "partially_applied"
  /** Anything else the database refused. Nothing was changed. */
  | "unexpected";

/** Every way unlocking a team from the chapter admin UI can fail. */
export type UnfreezeTeamErrorCode =
  /** No team row with that id. Fails closed. */
  | "team_not_found"
  /** The team exists but has no chapter, so no chapter admin owns it. Fails closed. */
  | "team_chapter_unknown"
  /** Nothing to do — the team was not locked. */
  | "not_frozen"
  /** The database refused the update. Nothing was changed. */
  | "unexpected";

/**
 * Student-facing sentence for each `respondInvite` failure.
 *
 * PRESERVED means the string is unchanged from before codes were introduced and
 * is load-bearing for lib/yi-future/invite-options.ts prose matching.
 * NEW means this path previously returned the raw Postgres message.
 */
export const RESPOND_INVITE_MESSAGES: Record<RespondInviteErrorCode, string> = {
  // PRESERVED
  not_signed_in: "Sign in as a delegate first.",
  // PRESERVED
  invite_not_found: "Invite not found.",
  // PRESERVED — matched by humanise() via "not addressed to you".
  not_your_invite: "This invite is not addressed to you.",
  // PRESERVED — matched by humanise() via "no longer pending".
  invite_not_pending: "That invite is no longer pending.",
  // PRESERVED
  invite_expired: `This invite has expired — invites are valid for ${INVITE_EXPIRY_DAYS} days. Ask the team to send you a new one.`,
  // PRESERVED
  team_not_found: "Team no longer exists.",
  // PRESERVED — matched by humanise() via "frozen".
  team_frozen: "That team is frozen — can't accept.",
  // PRESERVED — LOAD-BEARING. isTeamFullError() matches "already at" plus
  // "<TEAM_SIZE_MAX> member", and PendingInviteActions.tsx routes this case to
  // "here are your other options". Rewording it breaks that feature.
  team_full: `That team is already at ${TEAM_SIZE_MAX} members.`,
  // NEW — was `insErr.message`, i.e. the uniq_delegate_per_edition duplicate-key
  // text. This is verbatim what humanise() already turned that text into, so the
  // student reads exactly the same sentence as before.
  already_on_team:
    "You're already on a team, so this invitation can't be accepted. Reload to see your team.",
  // NEW — was `upErr.message`. The join DID land, so the old generic
  // "you weren't added to the team" wording was actively misleading here.
  partially_applied:
    "You've been added to the team, but we couldn't finish updating your invitation. Reload to see your team.",
  // NEW — was `error.message`. Verbatim what humanise() already produced for any
  // database-shaped message, so nothing the student reads changes.
  unexpected:
    "Something went wrong at our end and you weren't added to the team. Reload to see where things stand.",
};

/**
 * Admin-facing sentence for each `unfreezeTeam` failure. Shown inline by
 * components/yi-future/LockedTeamsPanel.tsx, which prints `res.error` directly
 * with no translation layer — so these must already be readable.
 */
export const UNFREEZE_TEAM_MESSAGES: Record<UnfreezeTeamErrorCode, string> = {
  // PRESERVED
  team_not_found: "Team not found.",
  // NEW — a team with no chapter has no chapter admin, so it is denied rather
  // than allowed through on a null scope.
  team_chapter_unknown:
    "That team isn't linked to a chapter, so it can't be unlocked here. Contact the Yi Future national team.",
  // PRESERVED
  not_frozen: "Team is not frozen.",
  // NEW — was `error.message`, printed raw into the admin's screen.
  unexpected:
    "Couldn't unlock that team just now — nothing was changed. Reload the page and try again.",
};

/** A refusal that names both a branchable code and a sentence to display. */
export type CodedFailure<TCode extends string> = {
  ok: false;
  code: TCode;
  error: string;
};

/**
 * What `respondInvite` returns. Structurally assignable to the older
 * `{ ok: true; message?: string } | { ok: false; error: string }` shape, which
 * is why existing callers compile and behave unchanged.
 */
export type RespondInviteResult =
  | { ok: true; message?: string }
  | CodedFailure<RespondInviteErrorCode>;

/** What `unfreezeTeam` returns. Same backwards-compatible shape. */
export type UnfreezeTeamResult =
  | { ok: true; message?: string }
  | CodedFailure<UnfreezeTeamErrorCode>;

/** Build a `respondInvite` refusal. Keeps code and sentence impossible to desync. */
export function respondInviteError(
  code: RespondInviteErrorCode
): CodedFailure<RespondInviteErrorCode> {
  return { ok: false, code, error: RESPOND_INVITE_MESSAGES[code] };
}

/** Build an `unfreezeTeam` refusal. */
export function unfreezeTeamError(
  code: UnfreezeTeamErrorCode
): CodedFailure<UnfreezeTeamErrorCode> {
  return { ok: false, code, error: UNFREEZE_TEAM_MESSAGES[code] };
}

/**
 * Is this Postgres error the one-team-per-edition unique index rejecting a join?
 *
 * 23505 is unique_violation. The constraint name is checked too because the
 * service client surfaces some errors with an empty code, and because a
 * duplicate (team_id, delegate_id) row means the same thing to the student.
 */
export function isDuplicateMembershipError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string | null; message?: string | null };
  if (e.code === "23505") return true;
  const msg = e.message ?? "";
  return /uniq_delegate_per_edition|duplicate key/i.test(msg);
}
