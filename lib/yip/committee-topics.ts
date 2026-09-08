// Resolving a COMMITTEE topic for one round, now that the catalogue has levels.
//
// WHY THIS FILE EXISTS
// yip.topics gained a `levels` column (see supabase/migrations/yip_topics_round_level.sql)
// so the regional round can debate its own committee topics. Twelve of the
// fifteen regional committees reuse a ministry NAME already held by a chapter
// committee, and eight of those titles are byte-identical. Before this file,
// every consumer looked a committee up by (category='committee', title=?) and
// called .maybeSingle() — which returns an ERROR, not a row, the moment two
// rows match. All of those call sites discard the error, so a duplicate title
// would have made the ministry's topic silently VANISH from the participant
// page, the committee room, and every AI grounding payload — on chapter events
// that had nothing to do with the regional round.
//
// So a committee is no longer identified by its title alone. It is identified
// by (title, round level), and this module is the one place that rule lives.
//
// THE RULE (the same precedence as lib/yip/round-level.ts pickByLevel)
//   a row scoped to the event's level   -> wins
//   a row scoped to no level at all     -> the fallback, and what all 90
//                                          pre-2026-08 rows are
//   a row scoped to a DIFFERENT level   -> never reachable
//
// FAIL CLOSED: when the event's level cannot be read, `level` is null and only
// globally-scoped rows resolve — i.e. exactly the catalogue that existed before
// this feature. An unknown level never reaches a level-scoped topic.
//
// NAMING TRAP: topic_category has a value 'regional' that means ZONE-SPECIFIC,
// not "regional round". Everything here keys on `levels`, never on category
// 'regional'. The two are unrelated axes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { pickByLevel, fetchEventRoundLevel, type RoundLevel } from "./round-level";

// The action/lib files create their own client; this module stays free of
// request-scoped state (same shape as lib/yip/round-level.ts).
type Db = SupabaseClient<never, "yip", never>;

/** The committee columns every consumer needs, plus the scope used to choose. */
export type CommitteeTopicRow = {
  id?: string;
  title: string;
  description: string | null;
  linked_scheme: string | null;
  topic_number?: number | null;
  levels?: readonly string[] | null;
};

/**
 * Reduce a mixed-scope committee list to ONE row per title for `level`.
 *
 * Rows are grouped by title; within a title the level-scoped row wins and the
 * global row is the fallback. Order of the input is preserved for the winners,
 * so a caller that ordered by topic_number keeps that order.
 */
export function resolveCommitteeRowsForLevel<
  T extends { title: string; levels?: readonly string[] | null },
>(rows: readonly T[], level: RoundLevel | null | undefined): T[] {
  const byTitle = new Map<string, { scoped?: T; global?: T }>();
  const order: string[] = [];
  for (const row of rows) {
    const key = row.title.trim().toLowerCase();
    if (!byTitle.has(key)) {
      byTitle.set(key, {});
      order.push(key);
    }
    const slot = byTitle.get(key)!;
    // pickByLevel drops anything scoped to another level, so a row that
    // survives is either this level's or global.
    const { scoped, global } = pickByLevel([row], level);
    if (scoped.length && !slot.scoped) slot.scoped = scoped[0];
    else if (global.length && !slot.global) slot.global = global[0];
  }
  const out: T[] = [];
  for (const key of order) {
    const slot = byTitle.get(key)!;
    const winner = slot.scoped ?? slot.global;
    if (winner) out.push(winner);
  }
  return out;
}

/**
 * One row per committee TITLE, the globally-scoped row winning.
 *
 * This is the rule for anything that treats a committee name as a PERMANENT,
 * cross-event identity — the committee numbering in lib/yip/committee-number.ts
 * and the national taxonomy gap map. It is deliberately NOT the event-level
 * rule above: "Ministry of Education" is committee #1 at every level, so a
 * level-scoped row must never take the number the shared row already owns. A
 * title that ONLY a scoped row holds (the three ministries new in the regional
 * set) still resolves, to that scoped row.
 */
export function preferGlobalPerTitle<
  T extends { title: string; levels?: readonly string[] | null },
>(rows: readonly T[]): T[] {
  const byTitle = new Map<string, T>();
  const order: string[] = [];
  for (const row of rows) {
    const key = (row.title ?? "").trim().toLowerCase();
    if (!key) continue;
    const held = byTitle.get(key);
    if (!held) {
      byTitle.set(key, row);
      order.push(key);
      continue;
    }
    const heldIsScoped = !!held.levels?.length;
    const rowIsGlobal = !row.levels?.length;
    if (heldIsScoped && rowIsGlobal) byTitle.set(key, row);
  }
  return order.map((k) => byTitle.get(k)!);
}

/**
 * The committee SET a round runs from — a different question to "what is this
 * one committee's topic", and deliberately a different rule.
 *
 * A level that has committees of its own runs THOSE AND ONLY THOSE. It does not
 * inherit the shared list as well. The regional round is defined by fifteen
 * proposed committees from which the host picks ten; folding in the eleven
 * shared committees that happen to have no regional counterpart would hand the
 * host twenty-six and quietly break that rule.
 *
 * A level with NO committees of its own falls back to the shared list in full —
 * which is what chapter and national rounds do, so their catalogue is exactly
 * the one they had before levels existed.
 *
 * Contrast resolveCommitteeRowsForLevel(), which answers "what is THIS named
 * committee's topic here" and does fall back per title, so a committee that
 * only exists on the shared list still resolves its topic.
 */
export function committeeCatalogueForLevel<
  T extends { title: string; levels?: readonly string[] | null },
>(rows: readonly T[], level: RoundLevel | null | undefined): T[] {
  const { scoped, global } = pickByLevel(rows, level);
  return scoped.length > 0 ? scoped : global;
}

const COMMITTEE_COLS = "id, title, description, linked_scheme, topic_number, levels";

/**
 * The committee catalogue as ONE round at `level` sees it: its own committees
 * where it has them, the shared ones everywhere else.
 *
 * For a chapter event this returns precisely the rows it returned before the
 * levels column existed, because no committee is scoped to 'chapter'.
 */
export async function fetchCommitteeCatalogueForLevel(
  db: Db,
  level: RoundLevel | null | undefined,
  opts?: { includeInactive?: boolean }
): Promise<CommitteeTopicRow[]> {
  let q = db
    .from("topics" as never)
    .select(COMMITTEE_COLS)
    .eq("category", "committee");
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  const { data } = await q.order("topic_number", { nullsFirst: false });
  const rows = (data ?? []) as unknown as CommitteeTopicRow[];
  return committeeCatalogueForLevel(rows, level);
}

/**
 * ONE committee topic, chosen for the event's round level.
 *
 * Replaces the (category, title) + .maybeSingle() lookup that six call sites
 * used to do inline. Returns null when the name is blank or unknown — never an
 * error row, and never the wrong level's topic.
 */
export async function fetchCommitteeTopicForEvent(
  db: Db,
  eventId: string,
  title: string | null | undefined
): Promise<CommitteeTopicRow | null> {
  const clean = (title ?? "").trim();
  if (!clean || !eventId) return null;
  const level = await fetchEventRoundLevel(db, eventId);
  const { data } = await db
    .from("topics" as never)
    .select(COMMITTEE_COLS)
    .eq("category", "committee")
    .eq("title", clean)
    .eq("is_active", true);
  const rows = (data ?? []) as unknown as CommitteeTopicRow[];
  return resolveCommitteeRowsForLevel(rows, level)[0] ?? null;
}
