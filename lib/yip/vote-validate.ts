// Shared vote-value validation — used by every cast path (self / kiosk /
// organizer) so a junk or non-candidate value can never enter the tally.
// Pure module (no "use server") so it can be imported by server actions.

// aye / nay / abstain ballots: bill votes, no-confidence AND impeach-speaker
// motion votes (all three are a whole-House Aye/Nay/Abstain decision).
const AYE_NAY_ABSTAIN = new Set(["aye", "nay", "abstain"]);

type VoteSessionLike = {
  vote_type: string;
  config: unknown;
};

/**
 * Validate a vote_value against the session.
 * - bill_vote / no_confidence / impeach_speaker → must be aye | nay | abstain
 * - speaker_election / party_leader             → must be one of config.candidateIds
 * - any other type                              → allowed (unknown poll types are not constrained here)
 */
export function validateVoteValue(
  session: VoteSessionLike,
  voteValue: string
): { ok: true } | { ok: false; error: string } {
  const value = (voteValue ?? "").trim();
  if (!value) return { ok: false, error: "No vote value provided" };

  if (
    session.vote_type === "bill_vote" ||
    session.vote_type === "no_confidence" ||
    session.vote_type === "impeach_speaker"
  ) {
    return AYE_NAY_ABSTAIN.has(value)
      ? { ok: true }
      : { ok: false, error: "Invalid vote — must be Aye, Nay, or Abstain" };
  }

  // Candidate ballots (Speaker, Party-Leader, and the single-winner bench seats
  // PM / Deputy PM / Leader of Opposition) all store the chosen candidate's
  // participant id in vote_value, constrained to the session's config.candidateIds.
  if (
    session.vote_type === "speaker_election" ||
    session.vote_type === "party_leader" ||
    session.vote_type === "prime_minister" ||
    session.vote_type === "deputy_prime_minister" ||
    session.vote_type === "leader_of_opposition" ||
    session.vote_type === "cabinet_minister" ||
    session.vote_type === "shadow_minister"
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
