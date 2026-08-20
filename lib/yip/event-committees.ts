/**
 * Per-EVENT committee numbering (Director, 2026-08-14).
 *
 * ─── THE MODEL ────────────────────────────────────────────────────────────
 * The NUMBER is a committee's identity; the ministry name is a label a chapter
 * attributes to that number later, once. So an event runs "Committee 1..N",
 * always contiguous and always starting at 1, and a chapter may later decide
 * that its Committee 3 is Ministry of Health. Another chapter's Committee 3 is
 * whatever that chapter chose — the numbers are NOT comparable across events.
 *
 * This replaces the previous model in lib/yip/committee-number.ts, where the
 * number was the catalogue's global `topic_number` and therefore identical in
 * every event. That property read well but nothing consumed it: every screen
 * (jury committees, participants table, participant profile, committee roster)
 * renders `{number} · {name}` inside ONE event. What it cost was real, though —
 * a chapter running three committees that happened to be catalogue 2, 7 and 14
 * handed its students "Committee 14" when there were only three groups in the
 * room.
 *
 * ─── WHY RENUMBERING IS SAFE ──────────────────────────────────────────────
 * A number is only ever announced to a student at allocation, and allocation
 * writes it onto `participants.committee_number`. So:
 *   • BEFORE allocation nobody has been told a number, and reordering or
 *     renaming the committee list is harmless.
 *   • AFTER allocation each student's number is frozen on their own row, and
 *     attributing a ministry to a number updates only the display name.
 * That is the whole reason this needed no schema change.
 */

/** Prefix for a committee that has a number but no ministry attributed yet. */
const UNNAMED_PREFIX = "Committee ";

/** The placeholder name for slot `n` — e.g. 3 → "Committee 3". */
export function unnamedCommitteeName(n: number): string {
  return `${UNNAMED_PREFIX}${n}`;
}

/**
 * The slot number encoded in a placeholder name, or null for a real ministry.
 * "Committee 3" → 3. "Ministry of Health" → null. Tolerant of casing and
 * padding because these strings round-trip through jsonb keys and CSV imports.
 */
export function parseUnnamedCommittee(name: string): number | null {
  const m = /^\s*committee\s+(\d{1,3})\s*$/i.exec(name);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** True when this committee is still just a number, with no ministry attached. */
export function isUnnamedCommittee(name: string): boolean {
  return parseUnnamedCommittee(name) !== null;
}

export type EventCommittee = {
  /** 1..N within this event. */
  number: number;
  /** The stored committee name — a ministry, or "Committee 3" when unnamed. */
  name: string;
  /** False once a chapter has attributed a ministry to this number. */
  unnamed: boolean;
};

/**
 * Put an event's committee names into their canonical order and number them
 * 1..N. Deterministic, so two calls on the same list always agree.
 *
 * Ordering rules, in priority order:
 *   1. Placeholders keep the number written in their own name ("Committee 3" is
 *      always 3) — that is the number its students were already told.
 *   2. Named committees fill the remaining numbers, ordered by the catalogue's
 *      topic_number when known so the sequence follows the official ministry
 *      order rather than whatever order jsonb happens to hand back (jsonb does
 *      NOT preserve key insertion order — never rely on it).
 *   3. Anything left over sorts alphabetically, so the result is still stable.
 *
 * `catalogueNumberByName` is the lowercased-name → topic_number map from
 * getCommitteeNumbering(); pass an empty map to order purely alphabetically.
 */
export function orderEventCommittees(
  names: readonly string[],
  catalogueNumberByName?: ReadonlyMap<string, number>
): EventCommittee[] {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

  const placeholders: Array<{ name: string; number: number }> = [];
  const named: string[] = [];
  for (const name of clean) {
    const slot = parseUnnamedCommittee(name);
    if (slot != null) placeholders.push({ name, number: slot });
    else named.push(name);
  }

  named.sort((a, b) => {
    const ca = catalogueNumberByName?.get(a.toLowerCase());
    const cb = catalogueNumberByName?.get(b.toLowerCase());
    if (ca != null && cb != null && ca !== cb) return ca - cb;
    if (ca != null && cb == null) return -1;
    if (ca == null && cb != null) return 1;
    return a.localeCompare(b);
  });

  // Placeholders own their numbers; named committees take what is left, lowest
  // first, so the set is always exactly 1..N with no gaps and no collisions.
  const taken = new Set(placeholders.map((p) => p.number));
  const out: EventCommittee[] = placeholders.map((p) => ({
    number: p.number,
    name: p.name,
    unnamed: true,
  }));

  let next = 1;
  for (const name of named) {
    while (taken.has(next)) next++;
    taken.add(next);
    out.push({ number: next, name, unnamed: false });
    next++;
  }

  out.sort((a, b) => a.number - b.number);
  return out;
}

/** Lookup of committee name → its 1..N number for this event. */
export function eventCommitteeNumberByName(
  names: readonly string[],
  catalogueNumberByName?: ReadonlyMap<string, number>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of orderEventCommittees(names, catalogueNumberByName)) {
    map.set(c.name.toLowerCase(), c.number);
  }
  return map;
}

/**
 * The list of names for an event that will run `count` committees but has not
 * attributed any ministries yet — ["Committee 1", … , "Committee N"].
 */
export function unnamedCommitteeNames(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) =>
    unnamedCommitteeName(i + 1)
  );
}

/** What a student sees for a committee whose ministry is not decided yet. */
export const UNNAMED_COMMITTEE_TOPIC_LABEL = "Topic to be announced";
