import "server-only";

import { getRxViewer, type RxViewer } from "./auth";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "./constants";
import { getChapterCategories, getCurrentCycle, listAwards, listChapters } from "./data";
import { rxService } from "./supabase";
import type { AwardRow, CycleRow } from "./types";

/**
 * The two boards the national team asked for on 27 Oct: recognitions down
 * the left, the three chapter categories across the top.
 *   Nominations board  the chapters that have filed, as they file.
 *   Predictor board    the chapters other chapters predict will win, each
 *                      with its vote count, the leader on top.
 * Who sees what:
 *   everything super admin and National Leadership: every recognition, every region.
 *   own        anyone with an evaluator duty (Piyush, 5 Nov 2026): only the
 *              recognitions they evaluate. An NMT duty shows that
 *              recognition for every region; an RM duty shows it for the
 *              duty's region only.
 * Anyone else gets an explicit deny: chapter logins, and an rm, nmt or
 * nmt_leader role with no evaluator duty yet.
 */

/** Which chapters of a recognition are shown: every region, or the listed regions only. */
export type AreaSight = { national: true } | { national: false; regions: string[] };
/**
 * The viewer's sight. The top level is the union across everything they see
 * (it drives the column counts and the line under the title). `awards`, when
 * present, limits the rows to those recognitions, each with its own area.
 */
export type BoardSight = AreaSight & { awards?: Record<string, AreaSight> };

const up = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

export function boardSight(v: RxViewer): BoardSight | null {
  if (v.isSuperAdmin || v.isNationalLeadership) return { national: true };

  // Duty holders see only the recognitions they evaluate (Piyush, 5 Nov 2026).
  const awards: Record<string, AreaSight> = {};
  for (const d of v.duties) {
    const prev = awards[d.award_id];
    if (prev?.national) continue;
    if (d.layer === "nmt") {
      awards[d.award_id] = { national: true };
      continue;
    }
    const r = up(d.region);
    if (r === "") continue; // a blank region grants nothing
    const regions = prev && !prev.national ? prev.regions : [];
    awards[d.award_id] = { national: false, regions: [...new Set([...regions, r])] };
  }
  const areas = Object.values(awards);
  if (areas.length > 0) {
    if (areas.some((a) => a.national)) return { national: true, awards };
    const regions = [...new Set(areas.flatMap((a) => (a.national ? [] : a.regions)))];
    return { national: false, regions, awards };
  }

  // No duty: nothing to show. A directory role alone no longer opens the
  // boards (fail closed; on 5 Nov every rm, nmt and nmt_leader role had a duty).
  return null;
}

/** One plain line under each board's title. */
export function sightLine(sight: BoardSight): string {
  const where = sight.national ? "every region" : `your region only: ${sight.regions.join(", ")}`;
  if (!sight.awards) return sight.national ? "You see every region." : `You see your region only: ${sight.regions.join(", ")}.`;
  if (sight.national && Object.values(sight.awards).some((a) => !a.national)) {
    return "You see only the recognitions you evaluate: every region where you are on the NMT, your region where you are a Regional Mentor.";
  }
  return `You see only the recognitions you evaluate, ${where}.`;
}

/** True when the viewer may open the boards (drives the desk nav). */
export function canSeeBoards(v: RxViewer): boolean {
  return boardSight(v) !== null;
}

export type BoardGate =
  | { ok: true; viewer: RxViewer; sight: BoardSight }
  | { ok: false; error: string };

export async function requireRxBoard(): Promise<BoardGate> {
  const v = await getRxViewer();
  if (!v) return { ok: false, error: "You are not signed in, or your account is not in the Yi directory." };
  const sight = boardSight(v);
  if (!sight) {
    console.log(JSON.stringify({ tag: "recognitions_gate", gate: "board", verdict: "deny", person: v.personId }));
    return {
      ok: false,
      error:
        v.holdsNmtRole || v.rmRoleZones.length > 0
          ? "The boards show the recognitions you evaluate, and none is assigned to you yet. Ask the Recognitions super admin to assign you."
          : "The boards are for National Leadership, the NMT and Regional Mentors. Ask the Recognitions super admin if you should have access.",
    };
  }
  return { ok: true, viewer: v, sight };
}

export type BoardEntry = { chapterId: string; chapterName: string; votes: number | null };
export type BoardRow = { award: AwardRow; cells: Record<Category, BoardEntry[]> };
export type BoardData = {
  cycle: CycleRow;
  columns: Array<{ category: Category; label: string; chapterCount: number }>;
  rows: BoardRow[];
  /** Chapters counted across the whole board. */
  total: number;
};

/** Nomination statuses that count as filed: everything except a draft or an exclusion. */
const FILED = ["submitted", "checked", "returned"];

const emptyCells = (): Record<Category, BoardEntry[]> => ({ pioneers: [], trailblazers: [], sparks: [] });

export async function loadBoard(kind: "nominations" | "predictions", sight: BoardSight): Promise<BoardData | null> {
  const cycle = await getCurrentCycle();
  if (!cycle) return null;
  const [awards, chapters, categories] = await Promise.all([
    listAwards(cycle.id),
    listChapters(),
    getChapterCategories(cycle.id),
  ]);
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const inArea = (area: AreaSight, chapterId: string, region?: string | null) => {
    if (area.national) return true;
    const r = up(region ?? chapterById.get(chapterId)?.region);
    return r !== "" && area.regions.includes(r);
  };
  /** Column counts and the union view use the top-level area. */
  const inSight = (chapterId: string, region?: string | null) => inArea(sight, chapterId, region);
  /** Rows: only the viewer's own recognitions when the sight lists them. */
  const shown = sight.awards ? awards.filter((a) => sight.awards![a.id]) : awards;
  const inAwardSight = (awardId: string, chapterId: string, region?: string | null) => {
    const area = sight.awards ? sight.awards[awardId] : sight;
    return !!area && inArea(area, chapterId, region);
  };
  const awardIds = shown.map((a) => a.id);
  const cells = new Map(shown.map((a) => [a.id, emptyCells()]));

  if (awardIds.length > 0 && kind === "nominations") {
    const { data, error } = await rxService()
      .from("recognition_nominations")
      .select("award_id, chapter_id, category, region, status, submitted_at")
      .in("award_id", awardIds)
      .in("status", FILED)
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(`recognitions: read nominations for the board: ${error.message}`);
    for (const n of (data ?? []) as Array<{ award_id: string; chapter_id: string; category: Category | null; region: string | null }>) {
      if (!inAwardSight(n.award_id, n.chapter_id, n.region)) continue;
      const cat = n.category ?? categories.get(n.chapter_id);
      const row = cells.get(n.award_id);
      if (!cat || !row || !row[cat]) continue;
      row[cat].push({ chapterId: n.chapter_id, chapterName: chapterById.get(n.chapter_id)?.name ?? "Unknown chapter", votes: null });
    }
  }

  if (awardIds.length > 0 && kind === "predictions") {
    const { data, error } = await rxService()
      .from("recognition_predictions")
      .select("award_id, category, predicted_chapter_id")
      .in("award_id", awardIds);
    if (error) throw new Error(`recognitions: read predictions for the board: ${error.message}`);
    const tally = new Map<string, number>();
    for (const p of (data ?? []) as Array<{ award_id: string; category: Category; predicted_chapter_id: string }>) {
      if (!inAwardSight(p.award_id, p.predicted_chapter_id)) continue;
      const key = `${p.award_id}|${p.category}|${p.predicted_chapter_id}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    for (const [key, votes] of tally) {
      const [awardId, cat, chapterId] = key.split("|") as [string, Category, string];
      const row = cells.get(awardId);
      if (!row || !row[cat]) continue;
      row[cat].push({ chapterId, chapterName: chapterById.get(chapterId)?.name ?? "Unknown chapter", votes });
    }
    for (const row of cells.values()) {
      for (const cat of CATEGORIES) {
        row[cat].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.chapterName.localeCompare(b.chapterName));
      }
    }
  }

  const columns = CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    chapterCount: [...categories].filter(([id, c]) => c === category && inSight(id)).length,
  }));
  const rows = shown.map((award) => ({ award, cells: cells.get(award.id) ?? emptyCells() }));
  const total = rows.reduce((s, r) => s + CATEGORIES.reduce((t, c) => t + r.cells[c].length, 0), 0);
  return { cycle, columns, rows, total };
}
