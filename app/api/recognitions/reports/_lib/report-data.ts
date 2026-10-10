import "server-only";

import {
  chapterMap,
  getAwardState,
  getCurrentCycle,
  getLayer1,
  getPeople,
  listAwards,
  listCitationEdits,
  listEvaluators,
  listScoresForAward,
  effectiveText,
} from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, LAYER_LABEL, RANK_LABEL, VERTICAL_LABEL, type Category } from "@/lib/recognitions/constants";
import { computeMatrix, paramsTotal } from "@/lib/recognitions/scoring";
import { PHASE_LABEL } from "@/lib/recognitions/phase";
import { isNlAdded } from "@/lib/recognitions/check-rules";
import type { CycleRow } from "@/lib/recognitions/types";

/**
 * Data for the two super-admin reports. Callers MUST pass
 * requireRxSuperAdmin first; nothing here checks permissions.
 */

export type CeremonyPlace = {
  category: Category;
  categoryLabel: string;
  rank: 1 | 2 | 3;
  rankLabel: string;
  chapterName: string;
  region: string;
  keyAchievements: string[];
  citation: string;
  announcement: string;
};

export type CeremonyAward = {
  title: string;
  verticalLabel: string;
  approved: boolean;
  version: number;
  places: CeremonyPlace[];
  ceremonyScript: string | null;
};

export type CeremonyReport = {
  cycle: CycleRow;
  awards: CeremonyAward[];
  /** Awards left out, with the reason, so the reader knows the list is partial. */
  notIncluded: Array<{ title: string; why: string }>;
};

export async function ceremonyReport(includePending: boolean): Promise<CeremonyReport | null> {
  const cycle = await getCurrentCycle();
  if (!cycle) return null;
  const [awards, chapters] = await Promise.all([listAwards(cycle.id), chapterMap()]);
  const out: CeremonyReport = { cycle, awards: [], notIncluded: [] };

  for (const award of awards) {
    const state = await getAwardState(award.id);
    if (!state) continue;
    const approved = state.phase === "finalized";
    const pending = state.phase === "governance";
    const version = state.latestSubmittedVersion;
    if (!version || (!approved && !(includePending && pending))) {
      out.notIncluded.push({ title: award.title, why: PHASE_LABEL[state.phase] });
      continue;
    }
    const edits = await listCitationEdits(award.id);
    const noms = new Map(state.nominations.map((n) => [n.id, n]));
    const places: CeremonyPlace[] = [];
    for (const category of CATEGORIES) {
      for (const rank of [1, 2, 3] as const) {
        const entry = version.top3.find((t) => t.category === category && t.rank === rank);
        if (!entry) continue;
        const nom = noms.get(entry.nomination_id);
        const chapter = nom ? chapters.get(nom.chapter_id) : undefined;
        const achievements = (nom?.reasons ?? []).map((r) => r.trim()).filter((r) => r !== "");
        if (nom?.flagship_event?.trim()) achievements.push(`Flagship event: ${nom.flagship_event.trim()}`);
        // A chapter National Leadership added (recognitions_03) has no form: its reason is the case.
        if (nom && isNlAdded(nom) && nom.added_reason?.trim()) {
          achievements.push(`Added by National Leadership: ${nom.added_reason.trim()}`);
        }
        places.push({
          category,
          categoryLabel: CATEGORY_LABEL[category],
          rank,
          rankLabel: RANK_LABEL[rank],
          chapterName: chapter?.name ?? "Chapter not found",
          region: nom?.region ?? "",
          keyAchievements: achievements,
          citation: effectiveText(edits, version.id, "citation", category, rank, entry.citation ?? ""),
          announcement: effectiveText(edits, version.id, "announcement", category, rank, nom?.announcement_draft ?? ""),
        });
      }
    }
    const script = edits
      .filter((e) => e.field === "ceremony_script")
      .sort((a, b) => Date.parse(b.edited_at) - Date.parse(a.edited_at))[0];
    out.awards.push({
      title: award.title,
      verticalLabel: VERTICAL_LABEL[award.vertical],
      approved,
      version: version.version,
      places,
      ceremonyScript: script?.body ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vertical-wise report: the full combined matrix per award.
// ---------------------------------------------------------------------------

export type VerticalSheet = {
  title: string;
  /** Rows as arrays, header block first; ready for XLSX.utils.aoa_to_sheet. */
  aoa: Array<Array<string | number | null>>;
};

const pct = (f: number | null) => (f === null ? null : Math.round(f * 1000) / 10);
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

export async function verticalReport(): Promise<{ cycle: CycleRow; sheets: VerticalSheet[] } | null> {
  const cycle = await getCurrentCycle();
  if (!cycle) return null;
  const [awards, chapters] = await Promise.all([listAwards(cycle.id), chapterMap()]);
  const sheets: VerticalSheet[] = [];

  for (const award of awards) {
    const state = await getAwardState(award.id);
    if (!state) continue;
    const [scores, layer1, evaluators] = await Promise.all([
      listScoresForAward(award.id),
      getLayer1(award.id),
      listEvaluators(award.id, true),
    ]);
    const matrix = computeMatrix({ cycle, nominations: state.nominations, scores, layer1 });
    const people = await getPeople(evaluators.map((e) => e.person_id));

    // One column per evaluator who is active or has submitted at least one score.
    const submitted = scores.filter((s) => s.status === "submitted");
    const scored = new Set(submitted.map((s) => s.evaluator_id));
    const cols = evaluators
      .filter((e) => e.is_active || scored.has(e.id))
      .sort((a, b) => (a.layer === b.layer ? (a.region ?? "").localeCompare(b.region ?? "") : a.layer === "rm" ? -1 : 1));
    const rmCols = cols.filter((c) => c.layer === "rm");
    const nmtCols = cols.filter((c) => c.layer === "nmt");
    const name = (id: string) => people.get(id)?.full_name ?? "Unknown person";
    const colHead = (c: (typeof cols)[number]) =>
      c.layer === "rm"
        ? `RM ${name(c.person_id)} (${c.region ?? ""})${c.is_active ? "" : " [removed]"}`
        : `NMT ${name(c.person_id)}${c.is_nmt_leader ? " (leader)" : ""}${c.is_active ? "" : " [removed]"}`;
    const totalOf = (evaluatorId: string, nominationId: string) => {
      const s = submitted.find((x) => x.evaluator_id === evaluatorId && x.nomination_id === nominationId);
      return s ? paramsTotal(s.params) : null;
    };

    const version = state.latestSubmittedVersion;
    const finalBy = new Map((version?.rankings ?? []).map((r) => [r.nomination_id, r]));

    const aoa: VerticalSheet["aoa"] = [
      ["Award", award.title],
      ["Vertical", VERTICAL_LABEL[award.vertical]],
      ["Phase", PHASE_LABEL[state.phase]],
      ["Weights", `Layer 1 ${cycle.weight_layer1}% · Layer 2 ${cycle.weight_layer2}% · Layer 3 ${cycle.weight_layer3}%`],
      ["Layer 2 counted as", cycle.layer2_mode === "percentile" ? "Percentile within the region" : "Raw score out of 25"],
      ["Final rank from", version ? `Moderation version ${version.version} (submitted)` : "No submitted moderation yet"],
      ["Scoring progress", `${LAYER_LABEL.rm}: ${state.completeness.rm.submitted}/${state.completeness.rm.required} · NMT: ${state.completeness.nmt.submitted}/${state.completeness.nmt.required}`],
      [],
      [
        "Category",
        "Matrix rank",
        "Chapter",
        "Region",
        "Layer 1 (0-100)",
        ...rmCols.map(colHead),
        "RM average (/25)",
        "Layer 2 counted (%)",
        ...nmtCols.map(colHead),
        "NMT average (/25)",
        "Layer 3 counted (%)",
        "Combined total (/100)",
        "Missing layers",
        "Final score",
        "Final rank",
      ],
    ];
    for (const row of matrix) {
      const fin = finalBy.get(row.nomination_id);
      aoa.push([
        CATEGORY_LABEL[row.category],
        row.rank,
        chapters.get(row.chapter_id)?.name ?? "Chapter not found",
        row.region,
        row.l1,
        ...rmCols.map((c) => totalOf(c.id, row.nomination_id)),
        round2(row.l2Avg),
        pct(row.l2Fraction),
        ...nmtCols.map((c) => totalOf(c.id, row.nomination_id)),
        round2(row.l3Avg),
        pct(row.l3Fraction),
        row.total,
        row.missing.map((m) => m.replace("layer", "Layer ")).join(", "),
        fin?.final_score ?? null,
        fin?.final_rank ?? null,
      ]);
    }
    if (matrix.length === 0) aoa.push(["No nomination for this award passed both checks."]);
    sheets.push({ title: award.title, aoa });
  }
  return { cycle, sheets };
}

export function fileSlug(s: string): string {
  // Bounded input + loop trim: an anchored `-+$` regex is polynomial on long dash runs.
  const collapsed = s.slice(0, 200).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let start = 0;
  let end = collapsed.length;
  while (start < end && collapsed[start] === "-") start++;
  while (end > start && collapsed[end - 1] === "-") end--;
  return collapsed.slice(start, end).slice(0, 40) || "cycle";
}
