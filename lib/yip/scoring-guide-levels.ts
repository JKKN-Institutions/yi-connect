// What the Scoring & Awards Guide should SAY at one round level.
//
// WHY THIS FILE EXISTS
// /yip/dashboard/scoring-guide explains how marking works. Until #957 there was
// exactly one set of scoring rules, so one explanation was always right. #957
// added yip.session_parameters.levels, so a criteria sheet may now be written
// for chapter / regional / national rounds specifically. A guide that keeps
// printing the chapter numbers at a regional round is worse than no guide: it
// is a confident wrong answer, handed to someone who has no other reference.
//
// This module answers, for one level, the two questions the page needs:
//   1. WHICH criteria sheets apply here, and is each one written FOR this level
//      or merely shared with every level? (The page must say which — a shared
//      sheet must never be presented as "the regional rules".)
//   2. HOW MANY POINTS is one student marked out of on each sheet? That is NOT
//      the sheet total once a sheet lists both benches' criteria side by side.
//
// It is read-only. It writes nothing, needs no migration and adds no column:
// the bench tag it looks for (see `readBench`) would live inside the existing
// untyped `parameters` jsonb, so this file only reports whether it is there.
//
// Resolution is delegated to lib/yip/round-level.ts (pickByLevel) so the guide
// can never drift from what the jury screen and the results engine resolve. It
// is not reimplemented here.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/yip/database";
import {
  pickByLevel,
  toRoundLevel,
  ROUND_LEVEL_LABELS,
  type RoundLevel,
} from "@/lib/yip/round-level";

/* ── the criteria inside one sheet ─────────────────────────────────────── */

/**
 * Which students a criterion is marked for.
 *
 * "all" is the answer for every criterion in the app today, and is what an
 * untagged criterion means — before benches were split, every criterion on a
 * sheet was marked for every student. `ruling` / `opposition` mirror the
 * vocabulary already used for bench-scoped awards in lib/yip/award-formula.ts.
 */
export type GuideBench = "all" | "ruling" | "opposition";

export type GuideCriterion = {
  key: string;
  label: string;
  /** "participation" criteria are attendance-style; "evaluation" are marked. */
  kind: string;
  maxScore: number;
  bench: GuideBench;
};

/**
 * Read a criterion's bench tag out of the raw jsonb, tolerantly.
 *
 * NOTHING WRITES THIS FIELD YET. Splitting a sheet by bench is another lane's
 * work and the field name is theirs to choose; because `parameters` is jsonb
 * they need no migration and no type change to add it. So this reads the
 * plausible spellings and treats anything it does not recognise as "all".
 *
 * That default is not a guess — it is the only correct answer for every sheet
 * that exists today, where every criterion really is marked for every student.
 * And the page never presents a derived per-student figure as fact on its own:
 * when no criterion carries a tag, `benchSplit` is null and the page says the
 * sheet is not split by bench rather than implying that it is.
 */
function readBench(raw: Record<string, unknown>): GuideBench {
  const v = raw.bench ?? raw.side ?? raw.applies_to ?? raw.appliesTo;
  if (typeof v !== "string") return "all";
  const s = v.trim().toLowerCase();
  if (s === "ruling" || s === "government" || s === "treasury") return "ruling";
  if (s === "opposition") return "opposition";
  return "all";
}

/** Parse the `parameters` jsonb of one sheet. Anything malformed is skipped. */
export function readGuideCriteria(parameters: unknown): GuideCriterion[] {
  if (!Array.isArray(parameters)) return [];
  const out: GuideCriterion[] = [];
  for (const entry of parameters) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const max = Number(raw.max_score);
    out.push({
      key: typeof raw.key === "string" ? raw.key : "",
      label: typeof raw.label === "string" ? raw.label : "(unnamed criterion)",
      kind: typeof raw.kind === "string" ? raw.kind : "evaluation",
      maxScore: Number.isFinite(max) ? max : 0,
      bench: readBench(raw),
    });
  }
  return out;
}

/* ── one sheet, summarised for a reader ────────────────────────────────── */

export type GuideBenchSplit = {
  /** Points on criteria marked for every student, whichever bench they sit on. */
  shared: number;
  ruling: number;
  opposition: number;
};

export type GuideSheet = {
  id: string;
  sessionKey: string;
  label: string;
  agendaType: string | null;
  displayOrder: number;
  sessionWeight: number;
  levels: readonly string[] | null;
  /**
   * "level" = a sheet written for the level being viewed.
   * "shared" = the one global sheet, shown because no level-specific sheet
   * exists. The page MUST distinguish these; a shared sheet presented as the
   * regional rules is the exact failure this page exists to prevent.
   */
  source: "level" | "shared";
  criteria: GuideCriterion[];
  /** Every criterion on the sheet added up — what an admin sees while editing. */
  sheetTotal: number;
  /**
   * What ONE student can be marked out of: the shared criteria plus their own
   * bench's. Equal to `sheetTotal` when the sheet is not split by bench, which
   * is correct — then every criterion really is marked for every student.
   */
  perStudentMax: number;
  /** Null when no criterion carries a bench tag, i.e. the sheet is not split. */
  benchSplit: GuideBenchSplit | null;
};

function summariseSheet(criteria: readonly GuideCriterion[]): {
  sheetTotal: number;
  perStudentMax: number;
  benchSplit: GuideBenchSplit | null;
} {
  let shared = 0;
  let ruling = 0;
  let opposition = 0;
  for (const c of criteria) {
    if (c.bench === "ruling") ruling += c.maxScore;
    else if (c.bench === "opposition") opposition += c.maxScore;
    else shared += c.maxScore;
  }
  const sheetTotal = shared + ruling + opposition;
  const isSplit = ruling > 0 || opposition > 0;
  return {
    sheetTotal,
    // The larger bench half, so the figure is the most any one student could
    // face. The two halves are meant to be equal; when a sheet is lopsided the
    // page shows both halves rather than hiding the difference behind one
    // number.
    perStudentMax: isSplit ? shared + Math.max(ruling, opposition) : sheetTotal,
    benchSplit: isSplit ? { shared, ruling, opposition } : null,
  };
}

/* ── resolving the catalogue for one level ─────────────────────────────── */

/** The subset of a yip.session_parameters row this module needs. */
export type GuideConfigRow = {
  id: string;
  session_key: string;
  label: string;
  agenda_type: string | null;
  display_order: number;
  session_weight: number | string;
  is_active: boolean | null;
  parameters: unknown;
  levels: readonly string[] | null;
};

/** Lowest display_order wins within a tier — the resolver's own tiebreak. */
function lowestPerKey(
  rows: readonly GuideConfigRow[]
): Map<string, GuideConfigRow> {
  const out = new Map<string, GuideConfigRow>();
  for (const r of rows) {
    const held = out.get(r.session_key);
    if (!held || r.display_order < held.display_order) out.set(r.session_key, r);
  }
  return out;
}

/**
 * The criteria sheets someone marking at `level` could be handed, in agenda
 * order.
 *
 * The precedence rule is the one in lib/yip/session-config-resolution.ts,
 * applied across the whole catalogue instead of to one agenda item:
 *
 *   1. inactive sheets are invisible;
 *   2. `pickByLevel` splits the rest into sheets scoped to this level and
 *      shared sheets, and DROPS anything scoped to a different level;
 *   3. per session_key, a level-scoped sheet beats the shared one; ties inside
 *      a tier break on the lowest display_order, matching the resolver.
 *
 * A null `level` is FAIL CLOSED, exactly as in round-level.ts: only shared
 * sheets are returned. Nothing is guessed for an event whose level is unknown.
 */
export function resolveGuideSheets(
  rows: readonly GuideConfigRow[],
  level: RoundLevel | null
): GuideSheet[] {
  const active = rows.filter((r) => r.is_active !== false);
  const { scoped, global } = pickByLevel(active, level);

  const sharedByKey = lowestPerKey(global);
  const scopedByKey = lowestPerKey(scoped);

  const chosen: { row: GuideConfigRow; source: "level" | "shared" }[] = [];
  for (const [key, row] of sharedByKey) {
    if (!scopedByKey.has(key)) chosen.push({ row, source: "shared" });
  }
  for (const [, row] of scopedByKey) chosen.push({ row, source: "level" });

  return chosen
    .map(({ row, source }) => {
      const criteria = readGuideCriteria(row.parameters);
      return {
        id: row.id,
        sessionKey: row.session_key,
        label: row.label,
        agendaType: row.agenda_type,
        displayOrder: row.display_order,
        sessionWeight: Number(row.session_weight) || 0,
        levels: row.levels ?? null,
        source,
        criteria,
        ...summariseSheet(criteria),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/* ── what the page needs to state plainly ──────────────────────────────── */

export type GuideScopeSummary = {
  total: number;
  levelScoped: number;
  shared: number;
  /** False = every sheet shown is the shared one. The page must say so. */
  anyLevelScoped: boolean;
  /** True = at least one sheet lists separate ruling / opposition criteria. */
  anyBenchSplit: boolean;
};

export function summariseGuideScope(
  sheets: readonly GuideSheet[]
): GuideScopeSummary {
  const levelScoped = sheets.filter((s) => s.source === "level").length;
  return {
    total: sheets.length,
    levelScoped,
    shared: sheets.length - levelScoped,
    anyLevelScoped: levelScoped > 0,
    anyBenchSplit: sheets.some((s) => s.benchSplit !== null),
  };
}

/**
 * The per-student ceiling the national scoring note of 18 August 2026 sets for
 * the six regional rounds: every session is worth 10 points per student,
 * however many points the sheet lists across both benches.
 *
 * This is a WRITTEN RULE, not something the app can derive — no table records
 * it. It is kept here, named and dated, so the page can hold the configured
 * sheets up against it and flag a disagreement instead of silently printing
 * whichever number happens to be in the database. If the rule changes, change
 * it here; once it is configured properly the comparison simply agrees.
 */
export const STATED_PER_STUDENT_MAX = 10;

/** The levels that note covers. It was issued for the regional rounds. */
export const STATED_PER_STUDENT_LEVELS: readonly RoundLevel[] = ["regional"];

export function statedPerStudentMax(level: RoundLevel | null): number | null {
  return level && STATED_PER_STUDENT_LEVELS.includes(level)
    ? STATED_PER_STUDENT_MAX
    : null;
}

/** Sheets whose configured per-student ceiling disagrees with the stated rule. */
export function sheetsDisagreeingWithStatedRule(
  sheets: readonly GuideSheet[],
  level: RoundLevel | null
): GuideSheet[] {
  const stated = statedPerStudentMax(level);
  if (stated === null) return [];
  return sheets.filter((s) => s.perStudentMax !== stated);
}

/** "Regional round" — for headings and sentences. */
export function roundLevelNoun(level: RoundLevel | null): string {
  return level ? `${ROUND_LEVEL_LABELS[level]} round` : "round";
}

/* ── the one database read ─────────────────────────────────────────────── */

// Same shape as lib/yip/round-level.ts#fetchEventRoundLevel: the client is
// created by the caller and passed in, so this module holds no request state.
// Typed against the generated schema rather than `never`, so the callers here
// need no `as never` cast and the column list is checked.
type Db = SupabaseClient<Database, "yip">;

/**
 * Every criteria sheet, unfiltered. Resolution happens in
 * `resolveGuideSheets`, not in SQL, so the guide uses the same rule as the jury
 * screen rather than a second one written in a query.
 *
 * MUST be called with the SERVICE client. yip.session_parameters has row-level
 * security enabled and no policies, so a user-scoped client reads zero rows and
 * the guide would silently show an empty catalogue. The page that calls this is
 * already gated to YIP admins, and these sheets are global master data — the
 * same rows the admin console lists.
 */
export async function fetchGuideConfigRows(db: Db): Promise<GuideConfigRow[]> {
  const { data } = await db
    .from("session_parameters")
    .select(
      "id, session_key, label, agenda_type, display_order, session_weight, is_active, parameters, levels"
    )
    .order("display_order", { ascending: true });
  return (data ?? []) as GuideConfigRow[];
}

/**
 * The round level of one event, together with its name, or null when the event
 * cannot be read or the viewer may not see it.
 *
 * Kept next to the guide rather than in round-level.ts because the guide needs
 * the NAME as well (so it can say which event it is describing) and because
 * the caller must apply the event-scoped gate before calling this.
 */
export async function fetchGuideEventContext(
  db: Db,
  eventId: string
): Promise<{ id: string; name: string; level: RoundLevel | null } | null> {
  const { data } = await db
    .from("events")
    .select("id, name, level")
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; name: string | null; level: unknown };
  return {
    id: row.id,
    name: row.name ?? "this event",
    // toRoundLevel is the single narrowing rule; an unrecognised value becomes
    // null, and a null level resolves to shared sheets only (fail closed).
    level: toRoundLevel(row.level),
  };
}
