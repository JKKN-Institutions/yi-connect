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
 *   national   super admin, National Leadership, anyone holding the nmt or
 *              nmt_leader role or an NMT duty: every region.
 *   regions    a Regional Mentor (rm role zone, or an RM duty's region):
 *              only chapters of that region.
 * Anyone else (chapter logins included) gets an explicit deny.
 */

export type BoardSight = { national: true } | { national: false; regions: string[] };

const up = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

export function boardSight(v: RxViewer): BoardSight | null {
  if (v.isSuperAdmin || v.isNationalLeadership || v.holdsNmtRole || v.duties.some((d) => d.layer === "nmt")) {
    return { national: true };
  }
  const regions = [
    ...new Set([...v.rmRoleZones, ...v.duties.filter((d) => d.layer === "rm").map((d) => up(d.region))].filter((z) => z !== "")),
  ];
  return regions.length > 0 ? { national: false, regions } : null;
}

/** One plain line under each board's title. */
export function sightLine(sight: BoardSight): string {
  return sight.national ? "You see every region." : `You see your region only: ${sight.regions.join(", ")}.`;
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
      error: "The boards are for National Leadership, the NMT and Regional Mentors. Ask the Recognitions super admin if you should have access.",
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
  const inSight = (chapterId: string, region?: string | null) => {
    if (sight.national) return true;
    const r = up(region ?? chapterById.get(chapterId)?.region);
    return r !== "" && sight.regions.includes(r);
  };
  const awardIds = awards.map((a) => a.id);
  const cells = new Map(awards.map((a) => [a.id, emptyCells()]));

  if (awardIds.length > 0 && kind === "nominations") {
    const { data, error } = await rxService()
      .from("recognition_nominations")
      .select("award_id, chapter_id, category, region, status, submitted_at")
      .in("award_id", awardIds)
      .in("status", FILED)
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(`recognitions: read nominations for the board: ${error.message}`);
    for (const n of (data ?? []) as Array<{ award_id: string; chapter_id: string; category: Category | null; region: string | null }>) {
      if (!inSight(n.chapter_id, n.region)) continue;
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
      if (!inSight(p.predicted_chapter_id)) continue;
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
  const rows = awards.map((award) => ({ award, cells: cells.get(award.id) ?? emptyCells() }));
  const total = rows.reduce((s, r) => s + CATEGORIES.reduce((t, c) => t + r.cells[c].length, 0), 0);
  return { cycle, columns, rows, total };
}
