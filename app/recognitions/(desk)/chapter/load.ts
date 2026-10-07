import "server-only";

import { getRxViewer, requireRxChapter, type Gate } from "@/lib/recognitions/auth";
import {
  chapterMap,
  getCurrentCycle,
  latestDecisionFor,
  listAwards,
  listCycles,
  listDecisions,
  listModerationVersions,
  listNominationsForAward,
} from "@/lib/recognitions/data";
import { isPast } from "@/lib/recognitions/phase";
import type { Category, Vertical } from "@/lib/recognitions/constants";
import type { ChapterRow, CycleRow } from "@/lib/recognitions/types";
import { pickChapterId } from "./shared";

/** Gate the page for the chapter in ?chapter= (or the viewer's first chapter). */
export async function gateChapterPage(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<{ gate: Gate<ChapterRow>; chapters: ChapterRow[] }> {
  const sp = await searchParams;
  const viewer = await getRxViewer();
  const chapters = viewer?.chapters ?? [];
  const gate = await requireRxChapter(pickChapterId(chapters, sp.chapter));
  return { gate, chapters };
}

export type NominationWindow =
  | { state: "open"; deadline: string }
  | { state: "not_open" }
  | { state: "closed"; deadline: string };

/** A cycle with no deadline set is still being set up: nominations are not open yet. */
export function nominationWindow(cycle: CycleRow): NominationWindow {
  if (!cycle.nomination_deadline) return { state: "not_open" };
  if (isPast(cycle.nomination_deadline)) return { state: "closed", deadline: cycle.nomination_deadline };
  return { state: "open", deadline: cycle.nomination_deadline };
}

export type PastPodium = {
  cycleName: string;
  awardTitle: string;
  vertical: Vertical;
  places: Array<{ category: Category; rank: 1 | 2 | 3; chapterName: string }>;
};

/**
 * Finalised podiums of earlier cycles: per award, the latest SUBMITTED
 * moderation version whose latest decision is "approve". Only chapter
 * names, categories and ranks leave this function — never scores.
 */
export async function previousWinners(current: CycleRow): Promise<PastPodium[]> {
  const earlier = (await listCycles()).filter((c) => c.id !== current.id && c.yi_year <= current.yi_year);
  if (earlier.length === 0) return [];
  const chapters = await chapterMap();
  const out: PastPodium[] = [];
  for (const cycle of earlier) {
    const awards = await listAwards(cycle.id, true);
    for (const award of awards) {
      const [versions, decisions] = await Promise.all([listModerationVersions(award.id), listDecisions(award.id)]);
      const version = versions.find((v) => v.status === "submitted");
      if (!version) continue;
      if (latestDecisionFor(decisions, version.id)?.decision !== "approve") continue;
      const top3 = Array.isArray(version.top3) ? version.top3 : [];
      if (top3.length === 0) continue;
      const noms = new Map((await listNominationsForAward(award.id)).map((n) => [n.id, n.chapter_id]));
      const places = top3
        .map((t) => {
          const chapterId = noms.get(t.nomination_id);
          const name = chapterId ? chapters.get(chapterId)?.name : undefined;
          return name ? { category: t.category, rank: t.rank, chapterName: name } : null;
        })
        .filter((p): p is { category: Category; rank: 1 | 2 | 3; chapterName: string } => p !== null)
        .sort((a, b) => a.rank - b.rank);
      if (places.length > 0) {
        out.push({ cycleName: cycle.name, awardTitle: award.title, vertical: award.vertical, places });
      }
    }
  }
  return out;
}

export { getCurrentCycle };
