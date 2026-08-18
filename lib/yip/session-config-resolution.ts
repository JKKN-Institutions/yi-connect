// Canonical rule for "which scoring criteria sheet applies to this agenda item?"
//
// WHY THIS FILE EXISTS
// The jury screen and the results engine each used to resolve this themselves,
// and they disagreed. The jury screen filtered to ACTIVE sheets before picking
// the lowest display_order; the results engine did not filter at all. When an
// INACTIVE sheet carried a LOWER display_order than the active one, a juror
// marked against sheet A while the engine weighted the marks as sheet B.
// (Live case: agenda_type 'debate' — short_duration_debate, display_order 5,
// inactive, session_weight 1 vs debate_central_agenda, display_order 10,
// active, session_weight 10. Ten times understated.)
//
// Every consumer must resolve through this function so the two sides cannot
// drift apart again. `app/yip/actions/scoring.ts#getSessionScoringParams` is the
// authoritative behaviour this encodes — it is what a human actually marked
// against — and it applies the same rule directly in SQL.

/** The subset of a yip.session_parameters row needed to resolve a match. */
export type SessionConfigLike = {
  session_key: string;
  agenda_type: string | null;
  display_order: number;
  is_active: boolean;
};

/** The subset of a yip.agenda row needed to resolve a match. */
export type AgendaItemLike = {
  session_key: string | null;
  agenda_type: string | null;
};

/**
 * Resolve the scoring criteria sheet for one agenda item.
 *
 * The rule, in order:
 *   1. Only ACTIVE sheets can ever be resolved. A deactivated sheet is invisible
 *      to both the jury screen and the results engine.
 *   2. session_key is the primary key and wins EXACTLY — there is no agenda_type
 *      fallback once an item is tagged with a session_key. This mirrors the jury
 *      screen: an item whose session_key matches no active sheet shows the role
 *      rubric, not some other session's criteria.
 *   3. Otherwise fall back to agenda_type, taking the LOWEST display_order among
 *      active sheets so the choice is deterministic when several share a type.
 *
 * Returns null when nothing resolves (caller falls back to the role rubric, and
 * the engine treats the session as unconfigured: max 0, weight 1).
 */
export function resolveSessionConfig<T extends SessionConfigLike>(
  item: AgendaItemLike,
  configs: readonly T[]
): T | null {
  const active = configs.filter((c) => c.is_active);

  if (item.session_key) {
    return active.find((c) => c.session_key === item.session_key) ?? null;
  }

  if (item.agenda_type) {
    let best: T | null = null;
    for (const c of active) {
      if (c.agenda_type !== item.agenda_type) continue;
      if (best === null || c.display_order < best.display_order) best = c;
    }
    return best;
  }

  return null;
}
