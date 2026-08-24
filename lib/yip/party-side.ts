// Bench (ruling / opposition) as organiser-supplied MASTER DATA.
//
// WHY THIS FILE EXISTS
// Regional scoring shows a juror only the criteria that apply to the student in
// front of them, and which criteria those are is decided by the student's bench
// (yip.participants.party_side). When the bench cannot be determined the juror
// is asked to pick one — and the national admin's rule (18 Aug 2026) is
// explicit: "The jury need not be aware how the app evaluates ruling and
// opposition participants." So the bench has to be settled from master data
// BEFORE the round, never in the hall.
//
// Until now the ONLY way a participant got a bench was to inherit it from their
// party (yip.parties.side). Imports deliberately create parties with side NULL
// ("benchless model", see importParticipants), so in practice the bench stayed
// null: on 18 Aug 2026 all 196 students on the SRTN regional round had no bench,
// and the other five regional rounds had no roster loaded at all.
//
// This module is the shared vocabulary for reading a human-written bench value.
// It is deliberately PURE and client-safe (no imports at all) so the CSV
// importer (client) and the server actions validate identically — a value the
// preview accepts is a value the server accepts, and vice versa.
//
// THE ONE RULE THAT MATTERS: an unrecognised value is an ERROR, never a
// default. Silently defaulting a bench mis-scores a child, because they are
// then marked against the wrong two criteria.

/** The two benches. Mirrors the public.party_side Postgres enum. */
export const PARTY_SIDES = ["ruling", "opposition"] as const;

export type PartySideValue = (typeof PARTY_SIDES)[number];

export const PARTY_SIDE_LABELS: Record<PartySideValue, string> = {
  ruling: "Ruling",
  opposition: "Opposition",
};

/**
 * Accepted human spellings, normalised (see `normaliseBenchToken`).
 *
 * Single letters are deliberately NOT accepted. "R" / "O" are indistinguishable
 * from a party letter, so a spreadsheet whose party column was mapped to the
 * bench column by mistake would import as a full set of confident, wrong
 * benches instead of failing loudly.
 */
const BENCH_ALIASES: Record<string, PartySideValue> = {
  ruling: "ruling",
  "ruling party": "ruling",
  "ruling bench": "ruling",
  "ruling side": "ruling",
  treasury: "ruling",
  "treasury bench": "ruling",
  "treasury side": "ruling",
  govt: "ruling",
  "govt bench": "ruling",
  gov: "ruling",
  government: "ruling",
  "government bench": "ruling",
  "government side": "ruling",
  "ruling government": "ruling",
  "government ruling": "ruling",
  // Rosters often write the pair with a slash: "Ruling/Govt", "Treasury / Ruling".
  "ruling govt": "ruling",
  "govt ruling": "ruling",
  "ruling treasury": "ruling",
  "treasury ruling": "ruling",

  opposition: "opposition",
  "opposition party": "opposition",
  "opposition bench": "opposition",
  "opposition side": "opposition",
  opp: "opposition",
  "opp bench": "opposition",
  oppn: "opposition",
  "opposition opp": "opposition",
};

/**
 * Lowercase, then collapse every run of non-alphanumerics (spaces, slashes,
 * underscores, dots, hyphens, brackets) to a single space, and trim. So
 * "Ruling / Govt.", "RULING_GOVT" and "ruling govt" all compare equal.
 */
function normaliseBenchToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every spelling this parser understands, for error messages and help text. */
export const BENCH_ACCEPTED_SPELLINGS =
  "Ruling / Treasury / Govt / Government, or Opposition / Opp";

export type ParsedPartySide =
  | { ok: true; value: PartySideValue | null }
  | { ok: false; error: string };

/**
 * Read a human-written bench value.
 *
 *   blank / undefined  → { ok: true, value: null }  — "not stated", NOT an error.
 *                        The bench column can legitimately be empty on some
 *                        rows; those students simply keep whatever bench they
 *                        already have (import) or are left unset.
 *   a known spelling   → { ok: true, value: "ruling" | "opposition" }
 *   anything else      → { ok: false, error }  — the caller MUST reject the row.
 *
 * Never guesses. There is no fuzzy match and no default.
 */
export function parsePartySide(raw: unknown): ParsedPartySide {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: `bench must be text (${BENCH_ACCEPTED_SPELLINGS})`,
    };
  }

  const token = normaliseBenchToken(raw);
  if (token === "") return { ok: true, value: null };

  const hit = BENCH_ALIASES[token];
  if (hit) return { ok: true, value: hit };

  return {
    ok: false,
    error: `bench "${raw.trim()}" not recognised — use ${BENCH_ACCEPTED_SPELLINGS}`,
  };
}

/** Narrow a value already stored in the DB to a bench, or null. */
export function toPartySide(value: unknown): PartySideValue | null {
  return typeof value === "string" &&
    (PARTY_SIDES as readonly string[]).includes(value)
    ? (value as PartySideValue)
    : null;
}

/** Human label for a stored bench; "Not set" when there is none. */
export function describePartySide(value: unknown): string {
  const side = toPartySide(value);
  return side ? PARTY_SIDE_LABELS[side] : "Not set";
}
