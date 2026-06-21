/**
 * Committee display label.
 *
 * Committees are shown to users as a NUMBER ("Committee 1", "Committee 2"…),
 * not the internal ministry name. The number is `participants.committee_number`
 * (1-based, assigned in lockstep with committee_name by the allocation /
 * assignCommittees engine). For group views that only have the committee NAME,
 * derive the number from the event's ordered committee list (the order of
 * committee_topics keys === committee_number order).
 *
 * NOTE: committee_name (the ministry name) stays the internal join key for
 * bills, committee_scores, bill_documents and chat channels — only the visible
 * label changes.
 */

export function committeeLabel(
  committeeNumber: number | null | undefined
): string {
  return committeeNumber != null ? `Committee ${committeeNumber}` : "—";
}

/** Map a committee name to its 1-based number using the event's ordered list. */
export function committeeNumberFromName(
  name: string | null | undefined,
  orderedNames: string[]
): number | null {
  if (!name) return null;
  const i = orderedNames.indexOf(name);
  return i >= 0 ? i + 1 : null;
}
