"use server";

// ═══════════════════════════════════════════════════════════════════════
// Yi Youth Academy — national reports (Phase 15).
//
// Spec (docs/yi-youth-academy-spec.md "National — dashboard" + "Metrics
// derivations"): KPI cards, per-academy usage-norm compliance (RAG vs ≥3
// engagements/month one-each-E/I/L + ≥30 active days/year — sessions ARE
// the engagements, computed from COMPLETED run_sessions only), quarterly
// review CSV, and email-queue ops visibility.
//
// Gate: requireYuvaNational() on EVERY export (platform master-data tier —
// NOT run-scoped). Reads use the service client (yuva has no RLS read
// policies for national aggregates); gate-first is the authorization layer.
//
// Pure math lives in lib/yuva/norms.ts (TDD Phase 3) and
// lib/yuva/quarterly.ts (TDD this phase) — this file is I/O assembly only.
// ═══════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ActionResult } from "@/lib/yuva/action-result";
import { toCSV } from "@/lib/yuva/csv";
import {
  activeDaysYTD,
  engagementsByMonth,
  normRag,
  type NormRag,
} from "@/lib/yuva/norms";
import {
  buildQuarterlyRows,
  type Quarter,
  type QuarterSession,
} from "@/lib/yuva/quarterly";
import { requireYuvaNational } from "@/lib/yuva/auth/require-national";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import type { ProgramCategory } from "@/lib/yuva/constants";
import { fetchAcademies } from "@/components/yuva/academies/data";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

// ─── Shared assembly: completed sessions attributed to academies ─────────
// run_sessions has no category/academy — join run_sessions → runs → programs
// in three flat queries (tables are small; avoids cross-table embed typing).

async function fetchCompletedSessions(svc: Svc): Promise<QuarterSession[]> {
  const [{ data: runs }, { data: programs }, { data: sessions }] =
    await Promise.all([
      svc.from("runs").select("id, academy_id, program_id"),
      svc.from("programs").select("id, category"),
      svc
        .from("run_sessions")
        .select("run_id, status, scheduled_at")
        .eq("status", "completed"),
    ]);

  const categoryByProgram = new Map<string, ProgramCategory>(
    (programs ?? []).map((p) => [p.id, p.category])
  );
  const runMeta = new Map<string, { academy_id: string; category: ProgramCategory }>();
  for (const run of runs ?? []) {
    const category = categoryByProgram.get(run.program_id);
    if (category) runMeta.set(run.id, { academy_id: run.academy_id, category });
  }

  const out: QuarterSession[] = [];
  for (const s of sessions ?? []) {
    const meta = runMeta.get(s.run_id);
    if (!meta) continue;
    out.push({
      academy_id: meta.academy_id,
      status: s.status,
      scheduled_at: s.scheduled_at,
      category: meta.category,
    });
  }
  return out;
}

// ─── getComplianceSnapshot ───────────────────────────────────────────────

export interface AcademyCompliance {
  id: string;
  display_name: string;
  chapter: string;
  institution_name: string | null;
  /** Completed sessions in the current month, total. */
  month_total: number;
  /** Current-month counts for the three required categories. */
  month_entrepreneurship: number;
  month_innovation: number;
  month_learning: number;
  active_days_ytd: number;
  rag: NormRag;
  qualitative_notes: string | null;
}

export interface ComplianceSnapshot {
  /** The "YYYY-MM" the monthly criterion is judged against (current month). */
  month: string;
  kpis: {
    active_academies: number;
    runs_in_progress: number;
    sessions_this_month: number;
    students_engaged: number;
    students_certified: number;
  };
  academies: AcademyCompliance[];
}

export async function getComplianceSnapshot(): Promise<
  ActionResult<ComplianceSnapshot>
> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const month = new Date().toISOString().slice(0, 7);

  const [academies, sessions, runsInProgress, enrollments, certified] =
    await Promise.all([
      // Active academies with institution name + qualitative notes resolved.
      fetchAcademies({ kind: "all" }),
      fetchCompletedSessions(svc),
      svc
        .from("runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      // Students engaged = DISTINCT enrolled persons (spec derivation).
      svc.from("enrollments").select("person_id"),
      // Students certified = certificates issued (revoked excluded).
      svc
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .eq("revoked", false),
    ]);

  const active = academies.filter((a) => a.is_active);

  const sessionsByAcademy = new Map<string, QuarterSession[]>();
  for (const s of sessions) {
    const bucket = sessionsByAcademy.get(s.academy_id);
    if (bucket) bucket.push(s);
    else sessionsByAcademy.set(s.academy_id, [s]);
  }

  const compliance: AcademyCompliance[] = active.map((a) => {
    const own = sessionsByAcademy.get(a.id) ?? [];
    const monthBucket = engagementsByMonth(own)[month] ?? {};
    const monthTotal = Object.values(monthBucket).reduce(
      (sum, n) => sum + (n ?? 0),
      0
    );
    return {
      id: a.id,
      display_name: a.display_name,
      chapter: a.chapter,
      institution_name: a.institution_name,
      month_total: monthTotal,
      month_entrepreneurship: monthBucket.entrepreneurship ?? 0,
      month_innovation: monthBucket.innovation ?? 0,
      month_learning: monthBucket.learning ?? 0,
      active_days_ytd: activeDaysYTD(own),
      rag: normRag(own, month),
      qualitative_notes: a.qualitative_notes,
    };
  });

  const engagedPersons = new Set(
    (enrollments.data ?? []).map((e) => e.person_id)
  );
  const sessionsThisMonth = sessions.filter(
    (s) => s.scheduled_at && s.scheduled_at.slice(0, 7) === month
  ).length;

  return {
    success: true,
    data: {
      month,
      kpis: {
        active_academies: active.length,
        runs_in_progress: runsInProgress.count ?? 0,
        sessions_this_month: sessionsThisMonth,
        students_engaged: engagedPersons.size,
        students_certified: certified.count ?? 0,
      },
      academies: compliance,
    },
  };
}

// ─── getAcademyCompliance (compact strip on the academy detail page) ─────

export interface AcademyComplianceStrip {
  month: string;
  /** Current-month completed sessions per category (E/I/L + other rolled up). */
  month_entrepreneurship: number;
  month_innovation: number;
  month_learning: number;
  month_other: number;
  month_total: number;
  active_days_ytd: number;
  rag: NormRag;
}

export async function getAcademyCompliance(
  academyId: string
): Promise<ActionResult<AcademyComplianceStrip>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  if (!z.string().uuid().safeParse(academyId).success) {
    return { success: false, error: "Invalid academy id." };
  }

  const svc = await createServiceClient();
  const month = new Date().toISOString().slice(0, 7);
  const own = (await fetchCompletedSessions(svc)).filter(
    (s) => s.academy_id === academyId
  );

  const monthBucket = engagementsByMonth(own)[month] ?? {};
  const monthTotal = Object.values(monthBucket).reduce(
    (sum, n) => sum + (n ?? 0),
    0
  );
  const e = monthBucket.entrepreneurship ?? 0;
  const i = monthBucket.innovation ?? 0;
  const l = monthBucket.learning ?? 0;

  return {
    success: true,
    data: {
      month,
      month_entrepreneurship: e,
      month_innovation: i,
      month_learning: l,
      month_other: monthTotal - e - i - l,
      month_total: monthTotal,
      active_days_ytd: activeDaysYTD(own),
      rag: normRag(own, month),
    },
  };
}

// ─── exportQuarterlyCsv ──────────────────────────────────────────────────

const QUARTERLY_COLUMNS = [
  { key: "academy", label: "Academy" },
  { key: "chapter", label: "Chapter" },
  { key: "institution", label: "Institution" },
  { key: "sessions_total", label: "Sessions (quarter)" },
  { key: "sessions_entrepreneurship", label: "Entrepreneurship" },
  { key: "sessions_innovation", label: "Innovation" },
  { key: "sessions_learning", label: "Learning" },
  { key: "sessions_other", label: "Other categories" },
  { key: "active_days_quarter", label: "Active days (quarter)" },
  { key: "active_days_ytd", label: "Active days (YTD)" },
  { key: "students_engaged", label: "Students engaged (to date)" },
  { key: "students_certified", label: "Students certified (to date)" },
  { key: "norm_rag", label: "Norm status" },
  { key: "qualitative_notes", label: "Qualitative notes" },
];

const exportSchema = z.object({
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  year: z.number().int().min(2024).max(2100),
});

/**
 * Quarterly review CSV — one row per academy (inactive included: an academy
 * deactivated mid-quarter still belongs in that quarter's review). The CSV
 * string is returned for client-side download (quarterly-export.tsx).
 */
export async function exportQuarterlyCsv(input: {
  quarter: number;
  year: number;
}): Promise<ActionResult<{ csv: string; filename: string }>> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Pick a valid quarter and year." };
  }
  const { quarter, year } = parsed.data;

  const svc = await createServiceClient();
  const [academies, sessions, { data: runs }, { data: enrollments }] =
    await Promise.all([
      fetchAcademies({ kind: "all" }),
      fetchCompletedSessions(svc),
      svc.from("runs").select("id, academy_id"),
      svc.from("enrollments").select("id, person_id, run_id"),
    ]);

  // Attribute enrollments (and their certificates) to academies via runs.
  const academyByRun = new Map<string, string>(
    (runs ?? []).map((r) => [r.id, r.academy_id])
  );
  const engagedByAcademy = new Map<string, Set<string>>();
  const academyByEnrollment = new Map<string, string>();
  for (const e of enrollments ?? []) {
    const academyId = academyByRun.get(e.run_id);
    if (!academyId) continue;
    academyByEnrollment.set(e.id, academyId);
    const set = engagedByAcademy.get(academyId) ?? new Set<string>();
    set.add(e.person_id);
    engagedByAcademy.set(academyId, set);
  }

  const certsAgg: Record<string, number> = {};
  const { data: certs } = await svc
    .from("certificates")
    .select("enrollment_id")
    .eq("revoked", false);
  for (const c of certs ?? []) {
    const academyId = academyByEnrollment.get(c.enrollment_id);
    if (!academyId) continue;
    certsAgg[academyId] = (certsAgg[academyId] ?? 0) + 1;
  }

  const enrollmentsAgg: Record<string, number> = {};
  for (const [academyId, persons] of engagedByAcademy) {
    enrollmentsAgg[academyId] = persons.size;
  }

  const rows = buildQuarterlyRows(
    academies.map((a) => ({
      id: a.id,
      display_name: a.display_name,
      chapter: a.chapter,
      institution_name: a.institution_name,
      qualitative_notes: a.qualitative_notes,
    })),
    sessions,
    enrollmentsAgg,
    certsAgg,
    quarter as Quarter,
    year
  );

  return {
    success: true,
    data: {
      csv: toCSV(rows, QUARTERLY_COLUMNS),
      filename: `yi-youth-academy-quarterly-Q${quarter}-${year}.csv`,
    },
  };
}

// ─── getEmailQueueHealth (ops visibility — durable email queue) ──────────

export interface EmailQueueHealth {
  pending: number;
  failed: number;
  /** Age of the oldest still-pending email, in whole minutes (null if none). */
  oldest_pending_minutes: number | null;
}

export async function getEmailQueueHealth(): Promise<
  ActionResult<EmailQueueHealth>
> {
  const gate = await requireYuvaNational();
  if (!gate.ok) return { success: false, error: gate.error };

  const svc = await createServiceClient();
  const [pending, failed, oldest] = await Promise.all([
    svc
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    svc
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    svc
      .from("notification_log")
      .select("created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  const oldestAt = oldest.data?.[0]?.created_at ?? null;
  return {
    success: true,
    data: {
      pending: pending.count ?? 0,
      failed: failed.count ?? 0,
      oldest_pending_minutes: oldestAt
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(oldestAt).getTime()) / 60_000)
          )
        : null,
    },
  };
}
