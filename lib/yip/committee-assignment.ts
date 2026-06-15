/**
 * Committee Assignment Engine — pure, deterministic, no DB, no randomness.
 *
 * Rules (interview 2026-06-15):
 *  1. Committees contain ORDINARY MPs only. All office-holders — Speaker,
 *     Deputy Speaker, Prime Minister, Deputy PM, Leader of Opposition, cabinet
 *     & shadow ministers, party leaders, independents — get NO committee.
 *  2. MPs are spread so every committee draws EVENLY from each of the N parties
 *     (party-balanced), with committee sizes kept even. Same school-aware
 *     round-robin idea as party-formation, but the spread key is the PARTY id
 *     (so no committee is dominated by one party).
 *
 * This must run AFTER parties are formed (party_id known) — that is the only
 * moment the 5-party balance can be computed.
 */

// Only ordinary MPs sit on committees (per the chair's ruling). Everyone with a
// leadership / presiding / ministerial / independent role is excluded.
export function isCommitteeEligible(parliamentRole: string | null): boolean {
  return parliamentRole === "mp";
}

export interface CommitteeParticipant {
  id: string;
  /** Party id (one of the N parties). null/"" = its own group, still spread. */
  partyId: string | null;
  parliamentRole: string | null;
}

export interface CommitteeAssignment {
  participantId: string;
  /** "" when the participant is not committee-eligible (office-holder). */
  committeeName: string;
  /** 1-based committee index, or null when not eligible. */
  committeeNumber: number | null;
}

const partyKeyOf = (p: CommitteeParticipant) => p.partyId ?? "";

/**
 * Plan committee membership. Eligible MPs are spread party-evenly across the
 * given committees; everyone else is assigned committeeName "" / number null.
 */
export function planCommitteeAssignment(
  participants: CommitteeParticipant[],
  committeeNames: string[]
): CommitteeAssignment[] {
  const n = committeeNames.length;
  const out: CommitteeAssignment[] = [];

  if (n === 0) {
    return participants.map((p) => ({
      participantId: p.id,
      committeeName: "",
      committeeNumber: null,
    }));
  }

  // Office-holders → no committee.
  const eligible = participants.filter((p) => isCommitteeEligible(p.parliamentRole));
  for (const p of participants) {
    if (!isCommitteeEligible(p.parliamentRole)) {
      out.push({ participantId: p.id, committeeName: "", committeeNumber: null });
    }
  }

  // Spread eligible MPs party-evenly: group by party (largest party first),
  // each MP joins the committee with the fewest of THIS party, tie-broken by
  // the smallest committee overall, then lowest index.
  const sizes = new Array(n).fill(0);
  const partyCounts: Array<Map<string, number>> = Array.from(
    { length: n },
    () => new Map<string, number>()
  );

  const byParty = new Map<string, CommitteeParticipant[]>();
  for (const p of eligible) {
    const key = partyKeyOf(p);
    if (!byParty.has(key)) byParty.set(key, []);
    byParty.get(key)!.push(p);
  }
  // Largest parties first (stable — first-seen breaks ties).
  const sortedParties = [...byParty.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [key, members] of sortedParties) {
    for (const m of members) {
      let bestIdx = 0;
      let bestPartyCount = Infinity;
      let bestSize = Infinity;
      for (let i = 0; i < n; i++) {
        const pc = partyCounts[i].get(key) ?? 0;
        if (pc < bestPartyCount || (pc === bestPartyCount && sizes[i] < bestSize)) {
          bestIdx = i;
          bestPartyCount = pc;
          bestSize = sizes[i];
        }
      }
      out.push({
        participantId: m.id,
        committeeName: committeeNames[bestIdx],
        committeeNumber: bestIdx + 1,
      });
      sizes[bestIdx] += 1;
      partyCounts[bestIdx].set(key, (partyCounts[bestIdx].get(key) ?? 0) + 1);
    }
  }

  return out;
}
