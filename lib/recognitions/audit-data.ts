import "server-only";

import { rxService } from "./supabase";
import { getPeople, type AuditRow } from "./data";
import { RX_APP, RX_ROLES } from "./constants";
import type { AuditLookups } from "./audit-log";

/**
 * Reads for the Audit trail page and its download. NO permission checks here:
 * callers pass requireRxSuperAdmin first.
 *
 * PostgREST returns at most 1000 rows per request, so every read pages and
 * then checks it got the full count, failing loudly instead of coming up short.
 */

const PAGE = 1000;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`recognitions: ${context} failed: ${error?.message ?? "unknown error"}`);
}

/** Every audit row of the cycle, newest first. */
export async function loadCycleAudit(cycleId: string): Promise<AuditRow[]> {
  const rows: AuditRow[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  // Oldest first while paging, so rows written during the read land at the end
  // and cannot shift a page; reversed at the end.
  for (;;) {
    const { data, error, count } = await rxService()
      .from("recognition_audit_log")
      .select("*", { count: "exact" })
      .eq("cycle_id", cycleId)
      .order("at", { ascending: true })
      .order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE - 1);
    if (error) fail("read audit", error);
    if (expected === null) expected = count ?? 0;
    const page = (data ?? []) as AuditRow[];
    if (page.length === 0) break;
    for (const r of page) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        rows.push(r);
      }
    }
    if (rows.length >= expected) break;
  }
  if (rows.length < (expected ?? 0)) fail(`read audit (got ${rows.length} of ${expected} rows)`, null);
  return rows.reverse();
}

/** nomination id -> chapter id, for every nomination (to match "a nomination of this chapter"). */
async function nominationChapters(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let expected: number | null = null;
  for (;;) {
    const { data, error, count } = await rxService()
      .from("recognition_nominations")
      .select("id, chapter_id", { count: "exact" })
      .order("id", { ascending: true })
      .range(out.size, out.size + PAGE - 1);
    if (error) fail("read nominations", error);
    if (expected === null) expected = count ?? 0;
    const page = (data ?? []) as Array<{ id: string; chapter_id: string }>;
    if (page.length === 0) break;
    for (const n of page) out.set(n.id.toLowerCase(), n.chapter_id.toLowerCase());
    if (out.size >= expected) break;
  }
  if (out.size < (expected ?? 0)) fail(`read nominations (got ${out.size} of ${expected})`, null);
  return out;
}

/** evaluator id -> "RM WR", "NMT" or "NMT leader", for every evaluator duty (all cycles; a few hundred rows). */
async function evaluatorLabels(): Promise<Map<string, string>> {
  const { data, error, count } = await rxService()
    .from("recognition_evaluators")
    .select("id, layer, region, is_nmt_leader", { count: "exact" })
    .range(0, PAGE - 1);
  if (error) fail("read evaluators", error);
  const rows = (data ?? []) as Array<{ id: string; layer: string; region: string | null; is_nmt_leader: boolean | null }>;
  if (rows.length < (count ?? 0)) fail(`read evaluators (got ${rows.length} of ${count})`, null);
  return new Map(
    rows.map((e) => [
      e.id.toLowerCase(),
      e.layer === "rm" ? `RM${e.region ? ` ${e.region}` : ""}` : e.is_nmt_leader ? "NMT leader" : "NMT",
    ])
  );
}

function chunks<T>(xs: T[], n = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Names of everyone who acted in the rows, the nomination -> chapter map, and evaluator labels. */
export async function auditLookups(rows: AuditRow[]): Promise<AuditLookups> {
  const ids = [...new Set(rows.map((r) => r.actor_person_id ?? "").filter(Boolean))];
  const [maps, nominationChapter, evaluatorLabel] = await Promise.all([
    Promise.all(chunks(ids).map((c) => getPeople(c))),
    nominationChapters(),
    evaluatorLabels(),
  ]);
  const personName = new Map<string, string>();
  for (const m of maps) for (const [id, p] of m) personName.set(id, p.full_name);
  return { personName, nominationChapter, evaluatorLabel };
}

const ROLE_LABEL: Record<string, string> = {
  [RX_ROLES.superAdmin]: "Recognitions super admin",
  [RX_ROLES.nationalLeadership]: "National Leadership",
  [RX_ROLES.chapterRep]: "Chapter representative",
  [RX_ROLES.rm]: "Regional Mentor",
  [RX_ROLES.regionalChair]: "Regional Chair",
  [RX_ROLES.nmt]: "NMT member",
  [RX_ROLES.nmtLeader]: "NMT leader",
};

/**
 * Each person's ACTIVE Recognitions-relevant roles today, e.g.
 * "Chapter Chair (Erode); Regional Mentor (SR)". Not the role they held at the
 * time of the action — the log does not record that.
 */
export async function currentRoles(personIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(personIds.filter(Boolean))];
  const labels = new Map<string, Set<string>>();
  for (const c of chunks(ids)) {
    const { data, error } = await rxService()
      .schema("yi_directory")
      .from("role_assignments")
      .select("person_id, app, role, yi_chapter, yi_zone")
      .in("person_id", c)
      .eq("is_active", true);
    if (error) fail("read roles", error);
    for (const a of (data ?? []) as Array<{ person_id: string; app: string; role: string; yi_chapter: string | null; yi_zone: string | null }>) {
      let label: string | null = null;
      // Same rule as auth.ts: either role, in any app, is a platform super admin.
      if (a.role === "platform_super_admin" || a.role === "super_admin") label = "Platform super admin";
      else if (a.app === "yi" && (a.role === "chapter_chair" || a.role === "chapter_co_chair"))
        label = `${a.role === "chapter_chair" ? "Chapter Chair" : "Chapter Co-Chair"}${a.yi_chapter ? ` (${a.yi_chapter})` : ""}`;
      else if (a.app === RX_APP && ROLE_LABEL[a.role]) {
        const where = a.role === RX_ROLES.chapterRep ? a.yi_chapter : a.yi_zone;
        label = `${ROLE_LABEL[a.role]}${where ? ` (${where})` : ""}`;
      }
      if (!label) continue;
      if (!labels.has(a.person_id)) labels.set(a.person_id, new Set());
      labels.get(a.person_id)!.add(label);
    }
  }
  return new Map([...labels].map(([id, s]) => [id, [...s].sort().join("; ")]));
}
