import "server-only";

import { rxService } from "./supabase";
import { conflictsForDuties, getChapterCategories, getCurrentCycle, linkedChapters, listChapters, type AwardState } from "./data";
import { isPast } from "./phase";
import { RX_APP, RX_ROLES, type Category } from "./constants";
import type { ChapterRow } from "./types";

/**
 * National Leadership adds a chapter that did not nominate (recognitions_03).
 *
 * Briefing (Take Pride 2026): during its review National Leadership may find
 * a chapter "which has done great but they have not nominated ... they
 * deserve to be there", which triggers re-evaluation. Director, 2026-10-10:
 *   - window: from when the award reaches National Leadership review
 *     (phase governance) through re-evaluation, until the cycle's
 *     re-evaluation deadline
 *   - the chapter must be active, have a category this cycle, and must NOT
 *     already have any nomination for the award (a draft counts)
 *
 * One more rule, so an added chapter can never sit in a dead end: someone
 * must be able to check it AND score it. Fail closed: the award needs, for
 * the chapter's region, a Regional Chair and a Regional Mentor duty, plus an
 * NMT evaluator, none of them linked to the chapter (the same conflict rule
 * the check desk and scoring sheets apply).
 *
 * No permission check here: callers pass requireRxOversight first.
 */

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export type AddWindow = { open: true } | { open: false; reason: string };

export function addWindow(state: AwardState): AddWindow {
  if (!state.award.is_active) return { open: false, reason: "This award is switched off." };
  if (state.phase === "finalized") {
    return { open: false, reason: "National Leadership has already approved this award, so no chapter can be added." };
  }
  if (state.phase !== "governance" && state.phase !== "reevaluation") {
    return {
      open: false,
      reason: "A chapter can be added once this award reaches National Leadership review, until re-evaluation closes.",
    };
  }
  if (isPast(state.cycle.reevaluation_deadline)) {
    return { open: false, reason: "Re-evaluation has closed, so no chapter can be added." };
  }
  return { open: true };
}

export type AddableChapter = { id: string; name: string; region: string; category: Category };
export type SkippedChapter = { name: string; why: string };

/**
 * Which chapters National Leadership may add to this award right now, and
 * why every other active chapter is not offered (shown to NL, so a missing
 * chapter is never a mystery).
 */
export async function addableChapters(
  state: AwardState
): Promise<{ eligible: AddableChapter[]; skipped: SkippedChapter[] }> {
  const current = await getCurrentCycle();
  if (!current || current.id !== state.award.cycle_id) {
    return { eligible: [], skipped: [] };
  }
  const [chapters, categories, rcByZone, dutyConflicts] = await Promise.all([
    listChapters(),
    getChapterCategories(state.cycle.id),
    regionalChairsByZone(),
    conflictsForDuties(state.duties),
  ]);
  const nominated = new Set(state.nominations.map((n) => n.chapter_id));
  const rcPeople = [...new Set([...rcByZone.values()].flat())];
  const rcConflicts = rcPeople.length > 0 ? await linkedChapters(rcPeople) : new Map<string, Set<string>>();

  const eligible: AddableChapter[] = [];
  const skipped: SkippedChapter[] = [];
  for (const c of chapters) {
    const why = ineligibleReason(c, { categories, nominated, state, rcByZone, rcConflicts, dutyConflicts });
    if (why) skipped.push({ name: c.name, why });
    else eligible.push({ id: c.id, name: c.name, region: (c.region ?? "").trim(), category: categories.get(c.id)! });
  }
  return { eligible, skipped };
}

/** The same rules for ONE chapter: null = eligible, else the plain-English refusal. */
export async function chapterAddRefusal(
  state: AwardState,
  chapterId: string
): Promise<{ ok: true; chapter: AddableChapter } | { ok: false; error: string }> {
  const { eligible, skipped } = await addableChapters(state);
  const hit = eligible.find((c) => c.id === chapterId);
  if (hit) return { ok: true, chapter: hit };
  const name = (await listChapters()).find((c) => c.id === chapterId)?.name;
  if (!name) return { ok: false, error: "That chapter is not an active Yi chapter. Reload the page and pick again." };
  const why = skipped.find((s) => s.name === name)?.why ?? "It can't be added to this award right now.";
  return { ok: false, error: `${name} can't be added: ${why}` };
}

function ineligibleReason(
  c: ChapterRow,
  ctx: {
    categories: Map<string, Category>;
    nominated: Set<string>;
    state: AwardState;
    rcByZone: Map<string, string[]>;
    rcConflicts: Map<string, Set<string>>;
    dutyConflicts: Map<string, Set<string>>;
  }
): string | null {
  if (ctx.nominated.has(c.id)) {
    return "it already has a nomination for this award (a draft or a filed one), so there is nothing to add.";
  }
  if (!ctx.categories.get(c.id)) {
    return "it has no category (Pioneers, Trailblazers or Sparks) this cycle. The Recognitions super admin sets it.";
  }
  const region = (c.region ?? "").trim();
  if (region === "") return "it has no region on record.";

  const rcs = (ctx.rcByZone.get(region.toUpperCase()) ?? []).filter((p) => !ctx.rcConflicts.get(p)?.has(c.id));
  if (rcs.length === 0) return `no Regional Chair for region ${region} can check it.`;

  const free = (layer: "rm" | "nmt") =>
    ctx.state.duties.some(
      (d) =>
        d.is_active &&
        d.layer === layer &&
        (layer === "nmt" || (norm(d.region) !== "" && norm(d.region) === norm(region))) &&
        !(ctx.dutyConflicts.get(d.id) ?? new Set([c.id])).has(c.id)
    );
  if (!free("rm")) return `no Regional Mentor on this award for region ${region} can check and score it.`;
  if (!free("nmt")) return "no NMT evaluator on this award can score it.";
  return null;
}

/** Yi zone code (upper case) -> person ids holding an active regional_chair role for it. */
async function regionalChairsByZone(): Promise<Map<string, string[]>> {
  const { data, error } = await rxService()
    .schema("yi_directory")
    .from("role_assignments")
    .select("person_id, yi_zone")
    .eq("app", RX_APP)
    .eq("role", RX_ROLES.regionalChair)
    .eq("is_active", true);
  if (error) throw new Error(`recognitions: read regional chairs failed: ${error.message}`);
  const out = new Map<string, string[]>();
  for (const r of (data ?? []) as Array<{ person_id: string; yi_zone: string | null }>) {
    const z = (r.yi_zone ?? "").trim().toUpperCase();
    if (z === "") continue; // fail closed: a blank zone checks nothing
    out.set(z, [...(out.get(z) ?? []), r.person_id]);
  }
  return out;
}
