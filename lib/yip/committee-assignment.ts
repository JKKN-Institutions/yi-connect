/**
 * Committee Assignment Engine — pure, deterministic, no DB, no randomness.
 *
 * Rules (interview 2026-06-15; school-balance added 2026-06-20):
 *  1. Committees contain ORDINARY MPs only. All office-holders — Speaker,
 *     Deputy Speaker, Prime Minister, Deputy PM, Leader of Opposition, cabinet
 *     & shadow ministers, party leaders, independents — get NO committee.
 *  2. MPs are spread so every committee is balanced on TWO keys at once — the
 *     N parties AND the schools — with committee sizes kept even. Each MP joins
 *     the committee with the lowest combined load of "same party already here"
 *     + "same school already here" (tie-broken by the smallest committee, then
 *     lowest index), so no committee is dominated by one party OR one school.
 *
 * This must run AFTER parties are formed (party_id known) — that is the only
 * moment the party balance can be computed. (Parties are themselves already
 * school-balanced by party-formation.ts; this keeps that spread inside the
 * committees too.)
 */

// Handbook model (YIP 2026, p.19): all students are grouped across parties into
// mixed committees for bill drafting — EXCEPT the Speaker Panel (Speaker + Deputy
// Speakers), who preside over the House and are therefore not in any committee.
// PM, LoP, ministers, party leaders and independents all sit on a committee.
const PRESIDING_ROLES = new Set(["speaker", "deputy_speaker"]);
export function isCommitteeEligible(parliamentRole: string | null): boolean {
  return !PRESIDING_ROLES.has(parliamentRole ?? "");
}

export interface CommitteeParticipant {
  id: string;
  /** Party id (one of the N parties). null/"" = its own group, still spread. */
  partyId: string | null;
  parliamentRole: string | null;
  /** School/institution name. Blank/unknown ("") is distributed for size but
   *  never treated as "the same school" (each blank is its own group). */
  schoolName: string | null;
}

export interface CommitteeAssignment {
  participantId: string;
  /** "" when the participant is not committee-eligible (office-holder). */
  committeeName: string;
  /** 1-based committee index, or null when not eligible. */
  committeeNumber: number | null;
}

const partyKeyOf = (p: CommitteeParticipant) => p.partyId ?? "";
const schoolKeyOf = (p: CommitteeParticipant) =>
  (p.schoolName ?? "").trim().toLowerCase();

/**
 * Plan committee membership. Eligible MPs are spread so each committee is
 * balanced by BOTH party and school; everyone else is assigned committeeName
 * "" / number null.
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

  // Spread eligible MPs so each committee is balanced by BOTH party and school.
  // Each MP joins the committee with the lowest combined load — (# of the same
  // party already there) + (# of the same school already there) — tie-broken by
  // the smallest committee overall, then lowest index. A blank/unknown school
  // contributes 0 school-load (each blank is its own group) but still balances
  // by party and size.
  const sizes = new Array(n).fill(0);
  const partyCounts: Array<Map<string, number>> = Array.from(
    { length: n },
    () => new Map<string, number>()
  );
  const schoolCounts: Array<Map<string, number>> = Array.from(
    { length: n },
    () => new Map<string, number>()
  );

  const byParty = new Map<string, CommitteeParticipant[]>();
  for (const p of eligible) {
    const key = partyKeyOf(p);
    if (!byParty.has(key)) byParty.set(key, []);
    byParty.get(key)!.push(p);
  }
  // Largest parties first; within a party, largest schools first — so the most
  // concentrated groups fan out before the committees fill (stable: first-seen
  // breaks ties, keeping the plan deterministic).
  const sortedParties = [...byParty.entries()].sort((a, b) => b[1].length - a[1].length);

  for (const [pkey, members] of sortedParties) {
    const bySchool = new Map<string, CommitteeParticipant[]>();
    for (const m of members) {
      const sk = schoolKeyOf(m);
      if (!bySchool.has(sk)) bySchool.set(sk, []);
      bySchool.get(sk)!.push(m);
    }
    const ordered = [...bySchool.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .flatMap(([, ms]) => ms);

    for (const m of ordered) {
      const skey = schoolKeyOf(m);
      let bestIdx = 0;
      let bestCost = Infinity;
      let bestSize = Infinity;
      for (let i = 0; i < n; i++) {
        const pc = partyCounts[i].get(pkey) ?? 0;
        const sc = skey === "" ? 0 : schoolCounts[i].get(skey) ?? 0;
        const cost = pc + sc;
        if (cost < bestCost || (cost === bestCost && sizes[i] < bestSize)) {
          bestIdx = i;
          bestCost = cost;
          bestSize = sizes[i];
        }
      }
      out.push({
        participantId: m.id,
        committeeName: committeeNames[bestIdx],
        committeeNumber: bestIdx + 1,
      });
      sizes[bestIdx] += 1;
      partyCounts[bestIdx].set(pkey, (partyCounts[bestIdx].get(pkey) ?? 0) + 1);
      if (skey !== "") {
        schoolCounts[bestIdx].set(skey, (schoolCounts[bestIdx].get(skey) ?? 0) + 1);
      }
    }
  }

  return out;
}
