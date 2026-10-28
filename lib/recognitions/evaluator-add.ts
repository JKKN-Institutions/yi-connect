import "server-only";

import { getChapterCategories, getCurrentCycle, listChapters, type AwardState } from "./data";
import { awaitingNmtApproval, effectiveStatus } from "./check-rules";
import { isPast } from "./phase";
import { WORDS, type Category } from "./constants";
import type { ChapterRow, EvaluatorRow, NominationRow } from "./types";

/**
 * The NMT puts forward a chapter that did not apply. Piyush, 28 Oct 2026,
 * replaces the 15 Oct window below: only the NMT adds, and only in the
 * NMT_ADD_DAYS days after nominations close (8 to 10 Nov 2026). Regional
 * Mentors and Regional Chairs tell the NMT instead. A Mentor's addition from
 * before this change still waits for, and can get, an NMT approval.
 *
 * Earlier rule (recognitions_05, Piyush 15 Oct 2026):
 *   - A Regional Mentor (an active RM duty on the recognition) may add any
 *     chapter of THEIR OWN region that has no nomination for it, with a
 *     written reason. An NMT member of that recognition must approve it
 *     before it is scored.
 *   - An NMT member may add any chapter directly, with a reason. No further
 *     approval.
 *   - Window: until scoring closes (the cycle's Stage 1 deadline).
 * Same safety rules as National Leadership's add (lib/recognitions/nl-add.ts):
 * the chapter must be active, have a category this cycle and have NO
 * nomination for the recognition (a draft, or a declined add, counts), and
 * someone must be able to score it. Fail closed: the adder must not be
 * linked to the chapter (the conflict rule the scoring sheets apply).
 *
 * No permission check here: callers pass requireRxDuty first.
 */

/** The reason is capped like National Leadership's (100 words). */
export const ADD_REASON_WORDS = WORDS.nlAddedReason;
/** Technical cap only; matches the DB CHECK (2000 characters). */
export const ADD_REASON_CHARS = 2000;

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const sameRegion = (a: string | null | undefined, b: string | null | undefined) => norm(a) !== "" && norm(a) === norm(b);

export type AddWindow = { open: true } | { open: false; reason: string };

/** Days after the nomination deadline in which the NMT may add a missed chapter (Piyush, 28 Oct 2026). */
export const NMT_ADD_DAYS = 3;

/** When the NMT's add window closes: the nomination deadline plus NMT_ADD_DAYS. Null without a deadline. */
export function nmtAddCloses(cycle: { nomination_deadline: string | null }): string | null {
  if (!cycle.nomination_deadline) return null;
  const t = Date.parse(cycle.nomination_deadline);
  if (!Number.isFinite(t)) return null;
  return new Date(t + NMT_ADD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Adding a chapter: NMT only, from the nomination deadline until
 * nmtAddCloses (and never after scoring closes), even when every mark for
 * the recognition is already in. A Regional Mentor is always refused with
 * who to tell instead.
 */
export function evaluatorAddWindow(
  state: AwardState,
  when: (iso: string | null) => string,
  layer: "rm" | "nmt"
): AddWindow {
  if (!state.award.is_active) return { open: false, reason: "This recognition is switched off." };
  const closes = nmtAddCloses(state.cycle);
  const span = closes
    ? `after nominations close on ${when(state.cycle.nomination_deadline)}, until ${when(closes)}`
    : "for a few days after nominations close";
  if (layer !== "nmt") {
    return {
      open: false,
      reason: `Regional Mentors and Regional Chairs don't add chapters. If a deserving chapter is missing, tell the NMT of this recognition: they can add it ${span}.`,
    };
  }
  if (!closes) return { open: false, reason: "The nomination deadline isn't set yet, so no chapter can be added." };
  if (!isPast(state.cycle.nomination_deadline)) {
    return { open: false, reason: `You can add a missed chapter ${span}.` };
  }
  if (isPast(closes) || isPast(state.cycle.stage1_deadline)) {
    return { open: false, reason: `The window to add a missed chapter closed on ${when(closes)}.` };
  }
  // The dates above are the real limit. Stage 1 may already be complete for this
  // recognition (every mark in): an add reopens it, because the new chapter is
  // unscored. Not once the NMT leader has force-unlocked Stage 2 (the new
  // chapter could never be scored) or started a moderation.
  const stage1Done = state.phase === "stage2" && !state.latestVersion && !state.award.stage2_unlocked_at;
  if (state.phase !== "stage1" && !stage1Done) {
    return { open: false, reason: "Chapters can no longer be added: Stage 2 moderation has started for this recognition." };
  }
  return { open: true };
}

/** Approving or declining a Mentor's earlier addition: until scoring closes, as before. */
export function approvalWindow(state: AwardState, when: (iso: string | null) => string): AddWindow {
  if (!state.award.is_active) return { open: false, reason: "This recognition is switched off." };
  if (state.phase !== "nominations" && state.phase !== "stage1") {
    return { open: false, reason: "Added chapters can be decided only until scoring ends." };
  }
  if (isPast(state.cycle.stage1_deadline)) {
    return { open: false, reason: `Scoring closed on ${when(state.cycle.stage1_deadline)}.` };
  }
  return { open: true };
}

export type AddableChapter = { id: string; name: string; region: string; category: Category };
export type SkippedChapter = { name: string; why: string };

/**
 * Which chapters this duty may add right now, and why the others in its
 * reach are not offered. An RM only ever sees chapters of its own region.
 */
export async function addableForDuty(
  state: AwardState,
  duty: EvaluatorRow
): Promise<{ eligible: AddableChapter[]; skipped: SkippedChapter[] }> {
  const current = await getCurrentCycle();
  if (!current || current.id !== state.award.cycle_id) return { eligible: [], skipped: [] };
  const [chapters, categories] = await Promise.all([listChapters(), getChapterCategories(state.cycle.id)]);
  const nominated = new Set(state.nominations.map((n) => n.chapter_id));
  // Fail closed: a duty with no conflict entry is treated as linked to everything.
  const mine = state.conflictsByDuty.get(duty.id);

  const eligible: AddableChapter[] = [];
  const skipped: SkippedChapter[] = [];
  for (const c of chapters) {
    if (duty.layer === "rm" && !sameRegion(duty.region, c.region)) continue; // other regions: never offered
    const why = refusal(c, { state, duty, categories, nominated, mine });
    if (why) skipped.push({ name: c.name, why });
    else eligible.push({ id: c.id, name: c.name, region: (c.region ?? "").trim(), category: categories.get(c.id)! });
  }
  return { eligible, skipped };
}

/** The same rules for ONE chapter, with a plain-English refusal. */
export async function chapterAddVerdict(
  state: AwardState,
  duty: EvaluatorRow,
  chapterId: string
): Promise<{ ok: true; chapter: AddableChapter } | { ok: false; error: string }> {
  const chapter = (await listChapters()).find((c) => c.id === chapterId);
  if (!chapter) return { ok: false, error: "That chapter is not an active Yi chapter. Reload the page and pick again." };
  if (duty.layer === "rm" && !sameRegion(duty.region, chapter.region)) {
    return {
      ok: false,
      error: `${chapter.name} is in region ${chapter.region ?? "(none)"}. As Regional Mentor you can add only chapters of region ${duty.region ?? ""}.`,
    };
  }
  const { eligible, skipped } = await addableForDuty(state, duty);
  const hit = eligible.find((c) => c.id === chapterId);
  if (hit) return { ok: true, chapter: hit };
  const why = skipped.find((s) => s.name === chapter.name)?.why ?? "it can't be added to this recognition right now.";
  return { ok: false, error: `${chapter.name} can't be added: ${why}` };
}

function refusal(
  c: ChapterRow,
  ctx: {
    state: AwardState;
    duty: EvaluatorRow;
    categories: Map<string, Category>;
    nominated: Set<string>;
    mine: Set<string> | undefined;
  }
): string | null {
  if (ctx.nominated.has(c.id)) return "it already has a nomination for this recognition (filed, draft or added).";
  if (!ctx.mine || ctx.mine.has(c.id)) return "you hold a role in this chapter, so you can't put it forward.";
  if (!ctx.categories.get(c.id)) {
    return "it has no category (Pioneers, Trailblazers or Sparks) this cycle. The Recognitions super admin sets it.";
  }
  const region = (c.region ?? "").trim();
  if (region === "") return "it has no region on record.";
  const free = (layer: "rm" | "nmt") =>
    ctx.state.duties.some(
      (d) =>
        d.is_active &&
        d.layer === layer &&
        (layer === "nmt" || sameRegion(d.region, region)) &&
        !(ctx.state.conflictsByDuty.get(d.id) ?? new Set([c.id])).has(c.id)
    );
  if (!free("rm")) return `no Regional Mentor on this recognition for region ${region} can score it.`;
  if (!free("nmt")) return "no NMT evaluator on this recognition can score it.";
  return null;
}

export type PendingApproval = {
  nomination: NominationRow;
  /** Null = this NMT member may approve or decline it; else why not. */
  blocked: string | null;
};

/**
 * A Regional Mentor's added chapters still waiting for an NMT approval, for
 * one NMT duty. A conflicted NMT member sees the row but can't act on it.
 */
export function pendingApprovalsFor(state: AwardState, duty: EvaluatorRow): PendingApproval[] {
  if (duty.layer !== "nmt") return [];
  const conflicts = state.conflictsByDuty.get(duty.id);
  return state.nominations
    .filter((n) => awaitingNmtApproval(n) && effectiveStatus(n, state.cycle) === "submitted")
    .sort((a, b) => Date.parse(a.added_at ?? "") - Date.parse(b.added_at ?? ""))
    .map((n) => ({
      nomination: n,
      blocked:
        !conflicts || conflicts.has(n.chapter_id)
          ? "You hold a role in this chapter, so another NMT member must decide."
          : null,
    }));
}
