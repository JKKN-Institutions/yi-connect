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
  ModerationVersionRow,
  NominationRow,
  PredictionRow,
  ScoreRow,
} from "./types";
import type { Category } from "./constants";
import { computeCompleteness, dutySeesNomination, type Completeness } from "./scoring";
import { computePhase, latestDecisionFor, type Phase } from "./phase";
import { inRace, isNlAdded } from "./check-rules";

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
  return opts.includeNlAdded ? rows : rows.filter((n) => !isNlAdded(n));
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
 * Conflict rule (mail 3): an evaluator linked to a chapter must not score
 * it. "Linked" = any ACTIVE directory role the person holds in that chapter
 * (any app), plus the chapters the super admin declared on the duty.
 */
export async function conflictsForDuties(duties: EvaluatorRow[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (duties.length === 0) return out;
  const linked = await linkedChapters([...new Set(duties.map((d) => d.person_id))]);
  for (const d of duties) {
    out.set(d.id, new Set([...(linked.get(d.person_id) ?? []), ...(d.conflict_chapter_ids ?? [])]));
  }
  return out;
}

/**
 * The same conflict rule for a nomination CHECKER (recognitions_02): any
 * ACTIVE directory role the person holds in a chapter. A Regional Chair has
 * no duty row, so this is keyed by person.
 */
export async function conflictsForPerson(personId: string): Promise<Set<string>> {
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

export async function getLayer1(awardId: string): Promise<Map<string, number>> {
  const { data, error } = await rxService()
    .from("recognition_layer1")
    .select("chapter_id, score")
    .eq("award_id", awardId);
  if (error) fail("read layer 1", error);
  return new Map(
    ((data ?? []) as Array<{ chapter_id: string; score: number | string }>).map((r) => [r.chapter_id, Number(r.score)])
  );
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
  /** Nominations both checkers passed: the only ones in the race (recognitions_02). */
  checkedNominations: NominationRow[];
  duties: EvaluatorRow[];
  conflictsByDuty: Map<string, Set<string>>;
  completeness: Completeness;
  versions: ModerationVersionRow[];
  latestVersion: ModerationVersionRow | null;
  latestSubmittedVersion: ModerationVersionRow | null;
  decisions: DecisionRow[];
  phase: Phase;
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

  const [nominations, duties, versions, decisions, scores] = await Promise.all([
    listNominationsForAward(awardId),
    listEvaluators(awardId),
    listModerationVersions(awardId),
    listDecisions(awardId),
    listScoresForAward(awardId),
  ]);
  const conflictsByDuty = await conflictsForDuties(duties);
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
    completeness,
    versions,
    latestVersion,
    latestSubmittedVersion,
    decisions,
    phase,
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
