/**
 * How many times did a member take the floor? — the ONE rule.
 *
 * This existed twice, and the two copies disagreed. The Chair's speaking board
 * counted a turn from `agenda_speakers` OR from a `'spoken'` speaking_request;
 * the member's own profile counted only `agenda_speakers`. A member could
 * therefore read "2 times you took the floor" on their phone while the Chair's
 * board showed 3 — at a scored, competitive event, in front of a minor.
 *
 * On the SRTN event that gap was one member and one turn. It is written to grow:
 * the mirror that keeps the two tables in step is non-fatal by design, so every
 * failed broadcast adds another member whose profile disagrees with the record.
 *
 * So the rule lives here, once, and both read it.
 *
 * THE RULE — one turn per occasion. Since the floor's Call started mirroring
 * onto `agenda_speakers`, a single floor turn leaves a trace in BOTH tables.
 * Counting both credited that member twice and pushed them down the fairness
 * order faster than someone who spoke as often through the aide console, which
 * writes only `agenda_speakers`. `agenda_speakers` is therefore the primary
 * record, and a `'spoken'` request counts only when that member has NO completed
 * row for the SAME agenda item — a turn taken before the mirror existed, or one
 * whose broadcast failed. A member who genuinely speaks twice in one debate
 * still has two `agenda_speakers` rows, and still gets two turns.
 */

export interface TurnRow {
  participant_id: string | null;
  agenda_item_id: string | null;
}

/** participant_id → turns taken. Members with no turn are absent, not zero. */
export function countTurns(
  /** `agenda_speakers` rows with status 'completed', for this event's agenda. */
  formal: TurnRow[],
  /** `speaking_requests` rows with status 'spoken', for this event. */
  spoken: TurnRow[]
): Map<string, number> {
  const turns = new Map<string, number>();
  const formalPairs = new Set<string>();

  const key = (r: TurnRow) =>
    `${r.participant_id}|${r.agenda_item_id ?? ""}`;
  const bump = (pid: string) => turns.set(pid, (turns.get(pid) ?? 0) + 1);

  for (const r of formal) {
    if (!r.participant_id) continue;
    formalPairs.add(key(r));
    bump(r.participant_id);
  }
  for (const r of spoken) {
    if (!r.participant_id) continue;
    if (formalPairs.has(key(r))) continue;
    bump(r.participant_id);
  }
  return turns;
}
