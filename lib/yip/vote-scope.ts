// Single source of truth for "which vote session applies to which voter".
//
// YIP runs several kinds of vote, with different audiences:
//   • House-wide  (speaker_election, bill_vote, no_confidence, impeach_speaker)
//       → every checked-in participant votes.
//   • Party-scoped (party_leader, cabinet_minister, shadow_minister)
//       → ONLY members of config.partyId vote. These can run in PARALLEL —
//         one election per party, all open at once.
//   • Bench-scoped (prime_minister, deputy_prime_minister → ruling bench;
//       leader_of_opposition → opposition bench).
//
// Both the per-viewer screen (use-vote-session) and the kiosk (vote-capture)
// resolve visibility through THIS file so the rule never drifts. The tally
// scoping in actions/voting.ts uses the same config.partyId / config.side keys.

export type VoteScopeKind = "house" | "party" | "bench";

export type ViewerScope = {
  /** The viewer's party (participants.party_id). Null = no party yet. */
  partyId: string | null;
  /** The viewer's bench (participants.party_side). */
  side: "ruling" | "opposition" | null;
};

export type ScopedSession = {
  vote_type: string;
  config: unknown;
};

const PARTY_SCOPED = new Set([
  "party_leader",
  "cabinet_minister",
  "shadow_minister",
]);

const BENCH_SCOPED = new Set([
  "prime_minister",
  "deputy_prime_minister",
  "leader_of_opposition",
]);

export function isPartyScoped(voteType: string): boolean {
  return PARTY_SCOPED.has(voteType);
}

/**
 * Election kinds that may run CONCURRENTLY — one per party, all open at once.
 * Today: party leader only. Cabinet/shadow stay one-at-a-time via the main
 * control panel (they run after government formation, sequentially). Concurrency
 * (openVote) and the control's parallel manager key off this; per-voter
 * VISIBILITY keys off isPartyScoped (a cabinet ballot is still party-private).
 */
export function isParallelKind(voteType: string): boolean {
  return voteType === "party_leader";
}

export function isBenchScoped(voteType: string): boolean {
  return BENCH_SCOPED.has(voteType);
}

export function voteScopeKind(voteType: string): VoteScopeKind {
  if (PARTY_SCOPED.has(voteType)) return "party";
  if (BENCH_SCOPED.has(voteType)) return "bench";
  return "house";
}

/** The bench a bench-scoped seat belongs to. */
export function benchSideForType(
  voteType: string
): "ruling" | "opposition" | null {
  if (voteType === "leader_of_opposition") return "opposition";
  if (voteType === "prime_minister" || voteType === "deputy_prime_minister")
    return "ruling";
  return null;
}

function configPartyId(config: unknown): string | null {
  const cfg = (config ?? {}) as { partyId?: unknown };
  return typeof cfg.partyId === "string" ? cfg.partyId : null;
}

function configSide(config: unknown): "ruling" | "opposition" | null {
  const cfg = (config ?? {}) as { side?: unknown };
  return cfg.side === "ruling" || cfg.side === "opposition" ? cfg.side : null;
}

/**
 * Does this vote session apply to this viewer (i.e. should it show on their
 * screen and may they cast)?
 *
 * Fails CLOSED: a party/bench election is hidden whenever the viewer's
 * party/side is unknown, so a member never sees another party's ballot.
 */
export function sessionAppliesToViewer(
  s: ScopedSession,
  viewer: ViewerScope
): boolean {
  const kind = voteScopeKind(s.vote_type);

  if (kind === "house") return true;

  if (kind === "party") {
    const target = configPartyId(s.config);
    // Fail closed: no target party, or viewer has no party → hidden.
    return !!target && !!viewer.partyId && viewer.partyId === target;
  }

  // bench
  const target = configSide(s.config) ?? benchSideForType(s.vote_type);
  return !!target && !!viewer.side && viewer.side === target;
}
