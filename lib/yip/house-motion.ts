// A free-text motion put to the House by the Chair — "Shall the House sit
// late?", "Shall the debate be extended by ten minutes?" — decided by an
// Aye / Nay / Abstain vote of every checked-in Member.
//
// It is deliberately its OWN vote_type. The obvious shortcut, reusing
// `no_confidence`, is a trap: revealing a PASSED no_confidence demotes every
// sitting Prime Minister on the event to ex_prime_minister (see the reveal path
// in app/yip/actions/voting.ts). A question about sitting hours must never be
// able to remove the Government.
//
// Pure module (no "use server") so the server action, the Chair's control panel
// and any future participant / projector surface all read the SAME rules.

import type { VoteTally } from "@/lib/yip/election-outcome";

/** vote_sessions.vote_type for a free-text House motion. */
export const HOUSE_MOTION_VOTE_TYPE = "house_motion";

/** Longest question the Chair may put. Long enough for a real motion, short
 *  enough to read on a phone ballot and a projector in one line or two. */
export const HOUSE_MOTION_TEXT_MAX = 200;

/**
 * Aye / Nay / Abstain floor votes. These decide a QUESTION — they never elect
 * anybody, so no outcome of theirs may reach seat designation.
 */
const AYE_NAY_VOTE_TYPES = new Set<string>([
  "bill_vote",
  "no_confidence",
  "impeach_speaker",
  HOUSE_MOTION_VOTE_TYPE,
]);

export function isAyeNayVoteType(voteType: string): boolean {
  return AYE_NAY_VOTE_TYPES.has(voteType);
}

export function isHouseMotionVoteType(voteType: string): boolean {
  return voteType === HOUSE_MOTION_VOTE_TYPE;
}

/** The only values a House motion ballot may carry. */
export const HOUSE_MOTION_VALUES = ["aye", "nay", "abstain"] as const;
export type HouseMotionValue = (typeof HOUSE_MOTION_VALUES)[number];

export function isHouseMotionValue(value: string): value is HouseMotionValue {
  return (HOUSE_MOTION_VALUES as readonly string[]).includes(value);
}

/** What openHouseMotion stores in vote_sessions.config. */
export type HouseMotionConfig = {
  /** The Chair's question, exactly as the House will see it. */
  motionText: string;
  /** Live-event escape hatch, same meaning as every other vote session. */
  override_checkin?: boolean;
};

/**
 * Clean and validate the Chair's typed question.
 *
 * Whitespace-only is NOT a motion, and neither is an essay: both are rejected
 * here so the check is identical on the server action and in the panel that
 * enables the button. Internal runs of whitespace (including a pasted newline)
 * collapse to single spaces so the stored text renders the same everywhere.
 */
export function normalizeMotionText(
  raw: unknown
): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Type the motion before putting it to the House." };
  }
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) {
    return { ok: false, error: "Type the motion before putting it to the House." };
  }
  if (text.length > HOUSE_MOTION_TEXT_MAX) {
    return {
      ok: false,
      error: `Keep the motion under ${HOUSE_MOTION_TEXT_MAX} characters — it has to fit on a phone ballot.`,
    };
  }
  return { ok: true, text };
}

/** Read the question back out of a stored session config. Null when absent. */
export function houseMotionText(config: unknown): string | null {
  const cfg = (config ?? {}) as { motionText?: unknown };
  return typeof cfg.motionText === "string" && cfg.motionText.trim()
    ? cfg.motionText
    : null;
}

/**
 * Read an Aye/Nay/Abstain tally. A motion is CARRIED on a simple majority of
 * the Ayes over the Nays — abstentions are recorded but do not count against
 * it, and a tie is NOT carried (the same reading bills already use).
 */
export function houseMotionOutcome(tallies: VoteTally[]): {
  aye: number;
  nay: number;
  abstain: number;
  carried: boolean;
} {
  const countOf = (value: string) =>
    tallies.find((t) => t.vote_value.toLowerCase() === value)?.count ?? 0;
  const aye = countOf("aye");
  const nay = countOf("nay");
  return { aye, nay, abstain: countOf("abstain"), carried: aye > nay };
}
