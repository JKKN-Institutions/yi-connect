import "server-only";

import { cache } from "react";
import { rxService } from "./supabase";
import type {
  AwardRow,
  ChapterRow,
  CitationEditRow,
  CycleRow,
  DecisionRow,
  EvaluatorRow,
  MentorSendBackRow,
  ModerationVersionRow,
  NominationRow,
  PredictionRow,
  ScoreHistoryRow,
  ScoreRow,
} from "./types";
import { HOME_CHAPTER_BLOCKS_SCORING, type Category } from "./constants";
import { computeCompleteness, dutySeesNomination, type Completeness } from "./scoring";
import { computePhase, latestDecisionFor, type Phase } from "./phase";
import { inRace, isAddedForChapter } from "./check-rules";
import { layer1ForAward } from "./health-card";

/**
 * Read layer for Yi Recognitions. NO function here checks permissions —
 * every caller must pass a gate from ./auth.ts first and must use the
 * narrowest read for its role (e.g. an evaluator reads ONLY its own scores
 * via listScoresForDuty, never listScoresForAward).
 */

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`recognitions: ${context} failed: ${error?.message ?? "unknown error"}`);
}

export const getCurrentCycle = cache(async (): Promise<CycleRow | null> => {
  const { data, error } = await rxService()
    .from("recognition_cycles")
    .select("*")
    .eq("is_current", true)
    .maybeSingle();
  if (error) fail("read current cycle", error);
  return (data as CycleRow | null) ?? null;
});

export async function listCycles(): Promise<CycleRow[]> {
  const { data, error } = await rxService()
    .from("recognition_cycles")
    .select("*")
    .order("yi_year", { ascending: false });
  if (error) fail("list cycles", error);
  return (data ?? []) as CycleRow[];
}

export const listAwards = cache(async (cycleId: string, includeInactive = false): Promise<AwardRow[]> => {
  let q = rxService().from("recognition_awards").select("*").eq("cycle_id", cycleId);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order").order("title");
  if (error) fail("list awards", error);
  return (data ?? []) as AwardRow[];
});

export const getAward = cache(async (awardId: string): Promise<AwardRow | null> => {
  const { data, error } = await rxService()
    .from("recognition_awards")
    .select("*")
    .eq("id", awardId)
    .maybeSingle();
  if (error) fail("read award", error);
  return (data as AwardRow | null) ?? null;
});

export const getCycle = cache(async (cycleId: string): Promise<CycleRow | null> => {
  const { data, error } = await rxService()
    .from("recognition_cycles")
    .select("*")
    .eq("id", cycleId)
    .maybeSingle();
  if (error) fail("read cycle", error);
  return (data as CycleRow | null) ?? null;
});

export const listChapters = cache(async (): Promise<ChapterRow[]> => {
  const { data, error } = await rxService()
    .schema("yi")
    .from("chapters")
    .select("id, name, city, region")
    .eq("is_active", true)
    .order("name");
  if (error) fail("list chapters", error);
  return (data ?? []) as ChapterRow[];
});

export async function chapterMap(): Promise<Map<string, ChapterRow>> {
  return new Map((await listChapters()).map((c) => [c.id, c]));
}

export const getChapterCategories = cache(async (cycleId: string): Promise<Map<string, Category>> => {
  const { data, error } = await rxService()
    .from("recognition_chapter_categories")
    .select("chapter_id, category")
    .eq("cycle_id", cycleId);
  if (error) fail("read chapter categories", error);
  return new Map(
    ((data ?? []) as Array<{ chapter_id: string; category: Category }>).map((r) => [r.chapter_id, r.category])
  );
});

export async function listNominationsForAward(awardId: string): Promise<NominationRow[]> {
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .select("*")
    .eq("award_id", awardId);
  if (error) fail("list nominations", error);
  return (data ?? []) as NominationRow[];
}

/**
 * A chapter's OWN nominations. By default a nomination National Leadership
 * added for the chapter (recognitions_03) is left out: the chapter didn't
 * file it, chapters never see results, so its desk shows that award as not
 * applied for (Director, 2026-10-10). The chapter actions pass
 * includeNlAdded so they can refuse to touch such a row.
 * Filtered in code, not SQL, so this still works before migration 03 adds
 * the origin column.
 */
export async function listNominationsForChapter(
  chapterId: string,
  awardIds: string[],
  opts: { includeNlAdded?: boolean } = {}
): Promise<NominationRow[]> {
  if (awardIds.length === 0) return [];
  const { data, error } = await rxService()
    .from("recognition_nominations")
    .select("*")
    .eq("chapter_id", chapterId)
    .in("award_id", awardIds);
  if (error) fail("list chapter nominations", error);
  const rows = (data ?? []) as NominationRow[];
  // recognitions_05: a chapter a Regional Mentor or the NMT added is hidden the same way.
  return opts.includeNlAdded ? rows : rows.filter((n) => !isAddedForChapter(n));
}

export async function listEvaluators(awardId: string, includeInactive = false): Promise<EvaluatorRow[]> {
  let q = rxService().from("recognition_evaluators").select("*").eq("award_id", awardId);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) fail("list evaluators", error);
  return (data ?? []) as EvaluatorRow[];
}

export type PersonLite = { id: string; full_name: string; email: string | null; user_id: string | null };

export async function getPeople(ids: string[]): Promise<Map<string, PersonLite>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await rxService()
    .schema("yi_directory")
    .from("people")
    .select("id, full_name, email, user_id")
    .in("id", unique);
  if (error) fail("read people", error);
  return new Map(((data ?? []) as PersonLite[]).map((p) => [p.id, p]));
}

/**
 * An evaluator's home chapters: any ACTIVE directory role the person holds in
 * a chapter (any app), plus the chapters recorded on the duty
 * (conflict_chapter_ids, set on the Evaluators page or by a sheet load).
 */
export async function homeChaptersForDuties(duties: EvaluatorRow[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (duties.length === 0) return out;
  const linked = await linkedChapters([...new Set(duties.map((d) => d.person_id))]);
  for (const d of duties) {
    out.set(d.id, new Set([...(linked.get(d.person_id) ?? []), ...(d.conflict_chapter_ids ?? [])]));
  }
  return out;
}

/**
 * Conflict rule: the chapters a duty must NOT score. Empty for every duty
 * while home chapters are only flagged (HOME_CHAPTER_BLOCKS_SCORING).
 */
export async function conflictsForDuties(duties: EvaluatorRow[]): Promise<Map<string, Set<string>>> {
  if (HOME_CHAPTER_BLOCKS_SCORING) return homeChaptersForDuties(duties);
  return new Map(duties.map((d) => [d.id, new Set<string>()]));
}

/**
 * Chapter name -> who on this recognition calls it home, e.g. "Omkar Sambary (NMT)".
 * Shown to the NMT, National Leadership and the super admin only; never on chapter pages.
 */
export async function homeChapterNotes(state: AwardState): Promise<Record<string, string[]>> {
  const active = state.duties.filter((d) => d.is_active);
  if (active.length === 0) return {};
  const [chapters, people] = await Promise.all([chapterMap(), getPeople(active.map((d) => d.person_id))]);
  const out: Record<string, string[]> = {};
  for (const d of active) {
    const who = `${people.get(d.person_id)?.full_name ?? "An evaluator"} (${d.layer === "rm" ? "RM" : "NMT"})`;
    for (const id of state.homeByDuty.get(d.id) ?? []) {
      const name = chapters.get(id)?.name;
      if (!name) continue;
      if (!(out[name] ??= []).includes(who)) out[name].push(who);
    }
  }
  return out;
}

/**
 * The same conflict rule for a nomination CHECKER (recognitions_02): any
 * ACTIVE directory role the person holds in a chapter. A Regional Chair has
 * no duty row, so this is keyed by person.
 */
export async function conflictsForPerson(personId: string): Promise<Set<string>> {
  if (!HOME_CHAPTER_BLOCKS_SCORING) return new Set<string>();
  return (await linkedChapters([personId])).get(personId) ?? new Set<string>();
}

/** person_id -> chapter ids the person holds any active directory role in (any app). */
export async function linkedChapters(personIds: string[]): Promise<Map<string, Set<string>>> {
  const { data, error } = await rxService()
    .schema("yi_directory")
    .from("role_assignments")
    .select("person_id, yi_chapter, is_active")
    .in("person_id", personIds)
    .eq("is_active", true)
    .not("yi_chapter", "is", null);
  if (error) fail("read conflict roles", error);

  const byName = new Map((await listChapters()).map((c) => [norm(c.name), c.id]));
  const linked = new Map<string, Set<string>>();
  for (const r of (data ?? []) as Array<{ person_id: string; yi_chapter: string | null }>) {
    const id = byName.get(norm(r.yi_chapter));
    if (!id) continue;
    if (!linked.has(r.person_id)) linked.set(r.person_id, new Set());
    linked.get(r.person_id)!.add(id);
  }
  return linked;
}

/** ALL scores on an award. Oversight / NMT-in-Stage-2 only. Never for evaluators in Stage 1. */
export async function listScoresForAward(awardId: string): Promise<ScoreRow[]> {
  const { data: noms, error: nErr } = await rxService()
    .from("recognition_nominations")
    .select("id")
    .eq("award_id", awardId);
  if (nErr) fail("list award nominations for scores", nErr);
  const ids = ((noms ?? []) as Array<{ id: string }>).map((n) => n.id);
  if (ids.length === 0) return [];
  const { data, error } = await rxService().from("recognition_scores").select("*").in("nomination_id", ids);
  if (error) fail("list scores", error);
  return (data ?? []) as ScoreRow[];
}

/** BLIND read: one evaluator duty's own scores, filtered in the query. */
export async function listScoresForDuty(evaluatorId: string): Promise<ScoreRow[]> {
  const { data, error } = await rxService()
    .from("recognition_scores")
    .select("*")
    .eq("evaluator_id", evaluatorId);
  if (error) fail("list own scores", error);
  return (data ?? []) as ScoreRow[];
}

/**
 * chapter_id -> Layer 1 (0-100). Per-measure Health Card scores first
 * (recognitions_06), the award's single recognition_layer1 score as the
 * fallback. A chapter with neither is absent (= missing). See health-card.ts.
 */
export async function getLayer1(awardId: string): Promise<Map<string, number>> {
  const award = await getAward(awardId);
  if (!award) return new Map();
  return layer1ForAward(award);
}

export async function listHealthCardFiles(awardId: string) {
  const { data, error } = await rxService()
    .from("recognition_health_card_files")
    .select("*")
    .eq("award_id", awardId)
    .order("uploaded_at", { ascending: false });
  if (error) fail("list health card files", error);
  return (data ?? []) as Array<{
    id: string;
    award_id: string;
    storage_path: string;
    file_name: string;
    uploaded_by: string | null;
    uploaded_at: string;
  }>;
}

export async function listModerationVersions(awardId: string): Promise<ModerationVersionRow[]> {
  const { data, error } = await rxService()
    .from("recognition_moderation_versions")
    .select("*")
    .eq("award_id", awardId)
    .order("version", { ascending: false });
  if (error) fail("list moderation versions", error);
  return (data ?? []) as ModerationVersionRow[];
}

export async function listDecisions(awardId: string): Promise<DecisionRow[]> {
  const { data, error } = await rxService()
    .from("recognition_governance_decisions")
    .select("*")
    .eq("award_id", awardId)
    .order("decided_at", { ascending: false });
  if (error) fail("list decisions", error);
  return (data ?? []) as DecisionRow[];
}

export async function listCitationEdits(awardId: string): Promise<CitationEditRow[]> {
  const { data, error } = await rxService()
    .from("recognition_citation_edits")
    .select("*")
    .eq("award_id", awardId)
    .order("edited_at", { ascending: false });
  if (error) fail("list citation edits", error);
  return (data ?? []) as CitationEditRow[];
}

export async function listPredictionsForAward(awardId: string): Promise<PredictionRow[]> {
  const { data, error } = await rxService().from("recognition_predictions").select("*").eq("award_id", awardId);
  if (error) fail("list predictions", error);
  return (data ?? []) as PredictionRow[];
}

export async function listPredictionsByChapter(chapterId: string, awardIds: string[]): Promise<PredictionRow[]> {
  if (awardIds.length === 0) return [];
  const { data, error } = await rxService()
    .from("recognition_predictions")
    .select("*")
    .eq("predictor_chapter_id", chapterId)
    .in("award_id", awardIds);
  if (error) fail("list chapter predictions", error);
  return (data ?? []) as PredictionRow[];
}

/**
 * True when PostgREST says the table is not there (a migration not yet
 * applied): the caller then treats it as empty instead of failing the page.
 */
function missingTable(error: { code?: string; message: string } | null): boolean {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message));
}

/** recognitions_05: the NMT leader's send-backs to the Regional Mentors, newest first. */
export async function listMentorSendBacks(awardId: string): Promise<MentorSendBackRow[]> {
  const { data, error } = await rxService()
    .from("recognition_mentor_sendbacks")
    .select("id, award_id, round, remark, sent_by, sent_at, scores_reopened")
    .eq("award_id", awardId)
    .order("sent_at", { ascending: false });
  if (missingTable(error)) return [];
  if (error) fail("list mentor send-backs", error);
  return (data ?? []) as MentorSendBackRow[];
}

/** recognitions_05: every Mentor score a send-back reopened, frozen as it was. Oversight only. */
export async function listScoreHistory(awardId: string): Promise<ScoreHistoryRow[]> {
  const { data, error } = await rxService()
    .from("recognition_score_history")
    .select("*")
    .eq("award_id", awardId)
    .order("archived_at", { ascending: false });
  if (missingTable(error)) return [];
  if (error) fail("list score history", error);
  return (data ?? []) as ScoreHistoryRow[];
}

export type AuditRow = {
  id: string;
  award_id: string | null;
  actor_person_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  at: string;
};

export async function listAudit(opts: { awardId?: string; cycleId?: string; limit?: number }): Promise<AuditRow[]> {
  let q = rxService().from("recognition_audit_log").select("*");
  if (opts.awardId) q = q.eq("award_id", opts.awardId);
  if (opts.cycleId) q = q.eq("cycle_id", opts.cycleId);
  const { data, error } = await q.order("at", { ascending: false }).limit(opts.limit ?? 200);
  if (error) fail("read audit", error);
  return (data ?? []) as AuditRow[];
}

/** Append one audit row. Failure is logged loudly but does not undo the action. */
export async function audit(entry: {
  cycleId?: string | null;
  awardId?: string | null;
  actorPersonId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await rxService().from("recognition_audit_log").insert({
    cycle_id: entry.cycleId ?? null,
    award_id: entry.awardId ?? null,
    actor_person_id: entry.actorPersonId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    detail: entry.detail ?? {},
  });
  if (error) console.error(JSON.stringify({ tag: "recognitions_audit_write_failed", error: error.message, entry }));
}

// ---------------------------------------------------------------------------
// One-shot award state: the facts every stage page needs.
// ---------------------------------------------------------------------------

export type AwardState = {
  award: AwardRow;
  cycle: CycleRow;
  nominations: NominationRow[];
  /** Nominations in the race (check-rules inRace; 2026: every submitted one). The name is from recognitions_02. */
  checkedNominations: NominationRow[];
  duties: EvaluatorRow[];
  conflictsByDuty: Map<string, Set<string>>;
  /** Each duty's home chapters, for the flag; they do not hide anything (HOME_CHAPTER_BLOCKS_SCORING). */
  homeByDuty: Map<string, Set<string>>;
  completeness: Completeness;
  versions: ModerationVersionRow[];
  latestVersion: ModerationVersionRow | null;
  latestSubmittedVersion: ModerationVersionRow | null;
  decisions: DecisionRow[];
  phase: Phase;
  /** recognitions_05: the NMT leader's send-backs to the Regional Mentors, newest first. */
  sendBacks: MentorSendBackRow[];
};

/**
 * Uses every score on the award to work out completeness. The scores
 * themselves are NOT returned — callers that may see them must read them
 * separately through the read their role allows.
 */
export async function getAwardState(awardId: string): Promise<AwardState | null> {
  const award = await getAward(awardId);
  if (!award) return null;
  const cycle = await getCycle(award.cycle_id);
  if (!cycle) return null;

  const [nominations, duties, versions, decisions, scores, sendBacks] = await Promise.all([
    listNominationsForAward(awardId),
    listEvaluators(awardId),
    listModerationVersions(awardId),
    listDecisions(awardId),
    listScoresForAward(awardId),
    listMentorSendBacks(awardId),
  ]);
  const [conflictsByDuty, homeByDuty] = await Promise.all([conflictsForDuties(duties), homeChaptersForDuties(duties)]);
  const completeness = computeCompleteness({ cycle, nominations, duties, conflictsByDuty, scores });
  const latestVersion = versions[0] ?? null;
  const latestSubmittedVersion = versions.find((v) => v.status === "submitted") ?? null;
  const phase = computePhase({
    cycle,
    award,
    stage1Complete: completeness.complete,
    latestVersion,
    decisions,
  });

  return {
    award,
    cycle,
    nominations,
    checkedNominations: nominations.filter(inRace),
    duties,
    conflictsByDuty,
    homeByDuty,
    completeness,
    versions,
    latestVersion,
    latestSubmittedVersion,
    decisions,
    phase,
    sendBacks,
  };
}

/** Nominations one duty may see, after conflicts. */
export function nominationsForDuty(state: AwardState, duty: EvaluatorRow): NominationRow[] {
  const conflicts = state.conflictsByDuty.get(duty.id) ?? new Set<string>();
  return state.nominations.filter((n) => dutySeesNomination(duty, n, conflicts));
}

export { latestDecisionFor };

/**
 * Effective citation / announcement text for a podium place: the latest
 * super-admin polish if any, else what the moderation (citation) or the
 * chapter (announcement) wrote. Edits are bound to the moderation version
 * they were made on, so a re-evaluation that changes the podium never
 * carries an old winner's polished text onto a new winner.
 */
export function effectiveText(
  edits: CitationEditRow[],
  versionId: string,
  field: "citation" | "announcement",
  category: Category,
  rank: number,
  fallback: string
): string {
  const hit = edits
    .filter(
      (e) =>
        e.moderation_version_id === versionId &&
        e.field === field &&
        e.category === category &&
        e.rank === rank
    )
    .sort((a, b) => Date.parse(b.edited_at) - Date.parse(a.edited_at))[0];
  return hit ? hit.body : fallback;
}
