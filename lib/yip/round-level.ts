// Round level (chapter / regional / national) as a first-class scoping concept.
//
// WHY THIS FILE EXISTS
// `level` used to exist on exactly one table in the yip schema — yip.events.
// Every scoring-configuration table was one global set shared by all three
// levels, so a regional round was scored exactly like a chapter round, and the
// only workaround (editing the shared sheets) silently re-scored rounds that had
// already finished, because results are recomputed on demand.
//
// This module holds the vocabulary — the level values, how a set of levels is
// normalised for storage, and whether a scoped row applies to a given level.
// It is deliberately PURE and client-safe (its only import is type-only), so the
// admin screen and the server actions share one definition.
//
// THE PATTERN, for the tables that follow (awards, rubrics, scoring buckets /
// settings / flags / committee dimensions, agenda template):
//   1. add a nullable `levels public.event_level[]` column — NULL = every level,
//      which is exactly how every pre-existing row already behaves;
//   2. widen that table's natural unique key to include `levels`, NULLS NOT
//      DISTINCT, so one global row per key is still guaranteed;
//   3. resolve with `pickByLevel()` below — scoped row first, global row second,
//      a row scoped to another level never;
//   4. let the admin screen set and filter by the scope.

import type { SupabaseClient } from "@supabase/supabase-js";

/** The three round levels. Mirrors the public.event_level Postgres enum. */
export const ROUND_LEVELS = ["chapter", "regional", "national"] as const;

export type RoundLevel = (typeof ROUND_LEVELS)[number];

export const ROUND_LEVEL_LABELS: Record<RoundLevel, string> = {
  chapter: "Chapter",
  regional: "Regional",
  national: "National",
};

export function isRoundLevel(value: unknown): value is RoundLevel {
  return (
    typeof value === "string" && (ROUND_LEVELS as readonly string[]).includes(value)
  );
}

/** Narrow an unknown DB/form value to a RoundLevel, or null when unrecognised. */
export function toRoundLevel(value: unknown): RoundLevel | null {
  return isRoundLevel(value) ? value : null;
}

/**
 * Canonical storage form for a level scope.
 *
 * Returns null for "applies to every level" — null and an empty array would
 * otherwise be two spellings of the same thing and the widened unique key could
 * not tell them apart. Unknown values are dropped, duplicates removed, and the
 * result is ordered chapter → regional → national so the same scope always
 * produces the same array (the unique index compares arrays literally).
 * Selecting all three is the same statement as "applies everywhere", so it is
 * stored as null too.
 */
export function normaliseRoundLevels(raw: unknown): RoundLevel[] | null {
  if (!Array.isArray(raw)) return null;
  const set = new Set<RoundLevel>();
  for (const v of raw) if (isRoundLevel(v)) set.add(v);
  if (set.size === 0) return null;
  if (set.size === ROUND_LEVELS.length) return null;
  return ROUND_LEVELS.filter((l) => set.has(l));
}

/** A row with no level scope is GLOBAL — it applies to every level. */
export function isGlobalScope(
  levels: readonly string[] | null | undefined
): boolean {
  return !levels || levels.length === 0;
}

/**
 * Does a row scoped to `levels` apply to an event at `level`?
 *
 * FAIL CLOSED: when the event's level is unknown (null), only global rows
 * apply. A level-scoped row is never handed to an event whose level could not
 * be established.
 */
export function scopeAppliesToLevel(
  levels: readonly string[] | null | undefined,
  level: RoundLevel | null | undefined
): boolean {
  if (isGlobalScope(levels)) return true;
  if (!level) return false;
  return (levels as readonly string[]).includes(level);
}

/** Human-readable scope, for admin screens. */
export function describeRoundLevels(
  levels: readonly string[] | null | undefined
): string {
  if (isGlobalScope(levels)) return "Every round";
  return (levels as readonly string[])
    .filter(isRoundLevel)
    .map((l) => ROUND_LEVEL_LABELS[l])
    .join(" + ");
}

/**
 * Split candidate rows into the scoped tier and the global tier for `level`,
 * dropping anything scoped to a different level.
 *
 * Callers resolve the scoped tier FIRST and only then the global tier, which is
 * the whole precedence rule: a sheet written for this level beats the shared
 * one, and a sheet written for another level is never reachable.
 */
export function pickByLevel<T extends { levels?: readonly string[] | null }>(
  rows: readonly T[],
  level: RoundLevel | null | undefined
): { scoped: T[]; global: T[] } {
  const scoped: T[] = [];
  const globals: T[] = [];
  for (const r of rows) {
    if (isGlobalScope(r.levels)) globals.push(r);
    else if (scopeAppliesToLevel(r.levels, level)) scoped.push(r);
  }
  return { scoped, global: globals };
}

/**
 * Canonical string form of a scope, for comparing two scopes for equality and
 * for grouping rows by scope in the admin screen. "*" is the global scope.
 */
export function roundLevelScopeKey(
  levels: readonly string[] | null | undefined
): string {
  const norm = normaliseRoundLevels(levels ? [...levels] : null);
  return norm === null ? "*" : norm.join(",");
}

/** Do two scopes both claim at least one level? Global rows never conflict. */
export function scopesOverlap(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined
): boolean {
  if (isGlobalScope(a) || isGlobalScope(b)) return false;
  return (a as readonly string[]).some((x) =>
    (b as readonly string[]).includes(x)
  );
}

// The action files are "use server"; the Supabase client is created there and
// passed in, so this module stays free of request-scoped state (same shape as
// lib/yip/email-log.ts).
type Db = SupabaseClient<never, "yip", never>;

/**
 * The round level of one event, or null when it cannot be read.
 *
 * Null is the fail-closed value: callers that cannot establish a level fall
 * back to global-only configuration rather than guessing a level.
 */
export async function fetchEventRoundLevel(
  db: Db,
  eventId: string
): Promise<RoundLevel | null> {
  const { data } = await db
    .from("events" as never)
    .select("level")
    .eq("id", eventId)
    .maybeSingle();
  return toRoundLevel((data as { level?: unknown } | null)?.level);
}
