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
// against — and it now resolves THROUGH this function rather than re-applying
// the rule in SQL, so there is exactly one implementation.
//
// ROUND LEVEL (2026-08)
// A criteria sheet may now be scoped to chapter / regional / national rounds.
// An unscoped sheet applies everywhere, which is how every sheet behaved before
// the scope existed, so this file returns identical answers until someone scopes
// a sheet. See lib/yip/round-level.ts.

import { pickByLevel, type RoundLevel } from "@/lib/yip/round-level";

/** The subset of a yip.session_parameters row needed to resolve a match. */
export type SessionConfigLike = {
  session_key: string;
  agenda_type: string | null;
  display_order: number;
  is_active: boolean;
  /**
   * Round levels this sheet applies to (yip.session_parameters.levels).
   * NULL / undefined / empty = every level, which is how every sheet behaved
   * before the column existed. Optional so callers that do not read the column
   * keep the old, global behaviour unchanged.
   */
  levels?: readonly string[] | null;
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
 *   2. Only sheets whose ROUND LEVEL scope covers this event can be resolved,
 *      and a sheet written for THIS level beats a shared one — see `level`
 *      below. A sheet scoped to a different level is never returned.
 *   3. session_key is the primary key and wins EXACTLY — there is no agenda_type
 *      fallback once an item is tagged with a session_key. This mirrors the jury
 *      screen: an item whose session_key matches no active sheet shows the role
 *      rubric, not some other session's criteria.
 *   4. Otherwise fall back to agenda_type, taking the LOWEST display_order among
 *      active sheets so the choice is deterministic when several share a type.
 *
 * `level` is the round level of the event the agenda item belongs to (from
 * yip.events.level). Rules 3 and 4 are applied TWICE: first over sheets scoped
 * to that level, then over unscoped (global) sheets. So:
 *
 *   - a regional sheet exists for this session  -> the regional sheet;
 *   - only a shared sheet exists                -> the shared sheet;
 *   - only a chapter sheet exists, event is
 *     regional                                  -> null (role rubric), never
 *                                                  the chapter sheet.
 *
 * Omitting `level`, or passing null when an event's level cannot be read, is
 * FAIL CLOSED: only unscoped sheets are considered, which is exactly the
 * behaviour of every sheet before the levels column existed. That is why adding
 * this argument changes nothing until someone scopes a sheet to a level.
 *
 * Returns null when nothing resolves (caller falls back to the role rubric, and
 * the engine treats the session as unconfigured: max 0, weight 1).
 */
export function resolveSessionConfig<T extends SessionConfigLike>(
  item: AgendaItemLike,
  configs: readonly T[],
  level?: RoundLevel | null
): T | null {
  const active = configs.filter((c) => c.is_active);
  const { scoped, global } = pickByLevel(active, level);

  // Level-scoped sheets first, then the shared ones. Within each tier the rule
  // is unchanged from before levels existed.
  for (const tier of [scoped, global]) {
    const hit = matchWithinTier(item, tier);
    if (hit) return hit;
  }

  return null;
}

/** Rules 3 and 4, applied to one level tier. */
function matchWithinTier<T extends SessionConfigLike>(
  item: AgendaItemLike,
  tier: readonly T[]
): T | null {
  if (item.session_key) {
    return tier.find((c) => c.session_key === item.session_key) ?? null;
  }

  if (item.agenda_type) {
    let best: T | null = null;
    for (const c of tier) {
      if (c.agenda_type !== item.agenda_type) continue;
      if (best === null || c.display_order < best.display_order) best = c;
    }
    return best;
  }

  return null;
}
