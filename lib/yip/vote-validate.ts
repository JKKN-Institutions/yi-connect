// Shared vote-value validation — used by every cast path (self / kiosk /
// organizer) so a junk or non-candidate value can never enter the tally.
// Pure module (no "use server") so it can be imported by server actions.

const BILL_VALUES = new Set(["aye", "nay", "abstain"]);

type VoteSessionLike = {
  vote_type: string;
  config: unknown;
};

/**
 * Validate a vote_value against the session.
 * - bill_vote                       → must be aye | nay | abstain
 * - speaker_election / party_leader → must be one of config.candidateIds
 * - any other type                  → allowed (unknown poll types are not constrained here)
 */
export function validateVoteValue(
  session: VoteSessionLike,
  voteValue: string
): { ok: true } | { ok: false; error: string } {
  const value = (voteValue ?? "").trim();
  if (!value) return { ok: false, error: "No vote value provided" };

  if (session.vote_type === "bill_vote") {
    return BILL_VALUES.has(value)
      ? { ok: true }
      : { ok: false, error: "Invalid bill vote — must be Aye, Nay, or Abstain" };
  }

  // Candidate ballots (Speaker election and Party-Leader election) both store
  // the chosen candidate's participant id in vote_value, constrained to the
  // session's config.candidateIds.
  if (
    session.vote_type === "speaker_election" ||
    session.vote_type === "party_leader"
  ) {
    const cfg = (session.config ?? {}) as { candidateIds?: unknown };
    const ids = Array.isArray(cfg.candidateIds)
      ? cfg.candidateIds.filter((x): x is string => typeof x === "string")
      : [];
    return ids.includes(value)
      ? { ok: true }
      : { ok: false, error: "Invalid choice — not a listed candidate" };
  }

  return { ok: true };
}
