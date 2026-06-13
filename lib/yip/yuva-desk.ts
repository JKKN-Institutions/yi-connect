// Pure desk-scope matching for YUVA volunteers. No "use server", no I/O —
// imported by server actions AND unit-tested directly (npx tsx).

export type DeskAssignment = {
  party_id: string | null;
  committee_name: string | null;
};

export type DeskTarget = {
  party_id: string | null;
  committee_name: string | null;
};

const clean = (s: string | null | undefined) => (s ?? "").trim();

/**
 * The distinct party ids and committee names a volunteer's assignments cover.
 * Blank/empty committee names are dropped so they can never match a blank
 * target (fail-closed).
 */
export function deskScope(assignments: DeskAssignment[]): {
  partyIds: string[];
  committeeNames: string[];
} {
  const partyIds = new Set<string>();
  const committeeNames = new Set<string>();
  for (const a of assignments) {
    if (a.party_id) partyIds.add(a.party_id);
    const c = clean(a.committee_name);
    if (c) committeeNames.add(c);
  }
  return { partyIds: [...partyIds], committeeNames: [...committeeNames] };
}

/**
 * True iff the target student falls inside the volunteer's desk: same party_id
 * as an assignment, OR same (non-blank) committee_name. No assignments -> false.
 */
export function matchesDesk(
  target: DeskTarget,
  assignments: DeskAssignment[]
): boolean {
  const { partyIds, committeeNames } = deskScope(assignments);
  if (target.party_id && partyIds.includes(target.party_id)) return true;
  const c = clean(target.committee_name);
  if (c && committeeNames.includes(c)) return true;
  return false;
}
