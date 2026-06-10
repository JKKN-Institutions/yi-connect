import "server-only";

/**
 * Run read-side assembly shared by the Phase 7 RSC pages (chapter runs list,
 * create-run picker, run management, dashboard "active runs" slot).
 * READ-ONLY — every mutation goes through app/youth-academy/actions/runs.ts
 * (gate-first).
 *
 * ⚠️ Callers are gated pages — these helpers do NOT authorize. Pass the
 * scope that matches the caller's access (runScopeFromAccess).
 */

import type { ProgramCategory, RunStatus } from "@/lib/yuva/constants";
import type { YuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema (donor
// cross-schema access path — app/youth-academy/chapter/mentors/page.tsx).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";
import { YUVA_APP, ROLE_MENTOR } from "@/lib/yuva/constants";
import type { RunListItem } from "./run-card";

export type RunScope =
  | { kind: "all" }
  | { kind: "chapter"; chapter: string }
  | { kind: "academies"; ids: string[] };

/** Map the caller's capability object to the run list scope it may see. */
export function runScopeFromAccess(access: YuvaAccess): RunScope {
  if (access.isNational) return { kind: "all" };
  if (access.chapterAdminOf) {
    return { kind: "chapter", chapter: access.chapterAdminOf };
  }
  // Coordinator (possibly none — empty ids ⇒ empty list, fail closed).
  return { kind: "academies", ids: access.coordinatorAcademyIds };
}

// Statuses shown in the dashboard "active runs" slot.
const ACTIVE_RUN_STATUSES: RunStatus[] = [
  "draft",
  "published",
  "applications_closed",
  "in_progress",
];

export async function fetchRuns(
  scope: RunScope,
  opts?: { activeOnly?: boolean; limit?: number }
): Promise<RunListItem[]> {
  const svc = await createServiceClient();

  let query = svc
    .from("runs")
    .select(
      "id, program_id, academy_id, chapter, status, start_date, end_date, apply_close_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (scope.kind === "chapter") query = query.eq("chapter", scope.chapter);
  if (scope.kind === "academies") {
    if (scope.ids.length === 0) return [];
    query = query.in("academy_id", scope.ids);
  }
  if (opts?.activeOnly) query = query.in("status", ACTIVE_RUN_STATUSES);
  if (opts?.limit) query = query.limit(opts.limit);

  const { data: runs } = await query;
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const programIds = [...new Set(runs.map((r) => r.program_id))];
  const academyIds = [...new Set(runs.map((r) => r.academy_id))];

  const [programsRes, academiesRes, sessionsRes, applicationsRes] =
    await Promise.all([
      svc.from("programs").select("id, title, category").in("id", programIds),
      svc.from("academies").select("id, display_name").in("id", academyIds),
      svc
        .from("run_sessions")
        .select("run_id, scheduled_at")
        .in("run_id", runIds),
      svc.from("applications").select("run_id").in("run_id", runIds),
    ]);

  const programById = new Map(
    (programsRes.data ?? []).map((p) => [p.id, p])
  );
  const academyById = new Map(
    (academiesRes.data ?? []).map((a) => [a.id, a])
  );

  const sessionsCount = new Map<string, number>();
  const scheduledCount = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    sessionsCount.set(s.run_id, (sessionsCount.get(s.run_id) ?? 0) + 1);
    if (s.scheduled_at) {
      scheduledCount.set(s.run_id, (scheduledCount.get(s.run_id) ?? 0) + 1);
    }
  }
  const applicationsCount = new Map<string, number>();
  for (const a of applicationsRes.data ?? []) {
    applicationsCount.set(a.run_id, (applicationsCount.get(a.run_id) ?? 0) + 1);
  }

  return runs.map((r) => {
    const program = programById.get(r.program_id);
    const academy = academyById.get(r.academy_id);
    return {
      id: r.id,
      status: r.status as RunStatus,
      chapter: r.chapter,
      program_title: program?.title ?? "Untitled program",
      program_category: (program?.category ??
        "learning") as ProgramCategory,
      academy_name: academy?.display_name ?? "—",
      start_date: r.start_date,
      end_date: r.end_date,
      apply_close_at: r.apply_close_at,
      sessions_count: sessionsCount.get(r.id) ?? 0,
      scheduled_sessions_count: scheduledCount.get(r.id) ?? 0,
      applications_count: applicationsCount.get(r.id) ?? 0,
      created_at: r.created_at,
    };
  });
}

// ─── Run detail (management page) ─────────────────────────────────────────

export type RunSessionDetail = {
  id: string;
  seq: number;
  name: string;
  duration_minutes: number;
  learning_objective: string | null;
  expects_submission: boolean;
  scheduled_at: string | null;
  venue: string | null;
  remarks: string | null;
  mentor_person_id: string | null;
  status: "scheduled" | "completed" | "cancelled";
};

export type RunDetail = {
  id: string;
  program_id: string;
  academy_id: string;
  chapter: string;
  status: RunStatus;
  apply_open_at: string | null;
  apply_close_at: string | null;
  cohort_announce_date: string | null;
  capacity: number;
  start_date: string | null;
  end_date: string | null;
  published_at: string | null;
  created_at: string;
  program_title: string;
  program_category: ProgramCategory;
  academy_name: string;
  sessions: RunSessionDetail[];
  applications_count: number;
  accepted_count: number;
  enrollments_count: number;
};

export async function fetchRunDetail(id: string): Promise<RunDetail | null> {
  const svc = await createServiceClient();

  const { data: run } = await svc
    .from("runs")
    .select(
      "id, program_id, academy_id, chapter, status, apply_open_at, apply_close_at, cohort_announce_date, capacity, start_date, end_date, published_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!run) return null;

  const [programRes, academyRes, sessionsRes, appsRes, acceptedRes, enrRes] =
    await Promise.all([
      svc
        .from("programs")
        .select("id, title, category")
        .eq("id", run.program_id)
        .maybeSingle(),
      svc
        .from("academies")
        .select("id, display_name")
        .eq("id", run.academy_id)
        .maybeSingle(),
      svc
        .from("run_sessions")
        .select(
          "id, seq, name, duration_minutes, learning_objective, expects_submission, scheduled_at, venue, remarks, mentor_person_id, status"
        )
        .eq("run_id", run.id)
        .order("seq", { ascending: true }),
      svc
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id),
      svc
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id)
        .eq("status", "accepted"),
      svc
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id)
        .eq("status", "active"),
    ]);

  return {
    ...run,
    status: run.status as RunStatus,
    program_title: programRes.data?.title ?? "Untitled program",
    program_category: (programRes.data?.category ??
      "learning") as ProgramCategory,
    academy_name: academyRes.data?.display_name ?? "—",
    sessions: (sessionsRes.data ?? []) as RunSessionDetail[],
    applications_count: appsRes.count ?? 0,
    accepted_count: acceptedRes.count ?? 0,
    enrollments_count: enrRes.count ?? 0,
  };
}

// ─── Approved programs (create-run picker) ────────────────────────────────

export type ApprovedProgram = {
  id: string;
  title: string;
  category: ProgramCategory;
  total_minutes: number;
  summary: string | null;
  sessions_count: number;
};

export async function fetchApprovedPrograms(): Promise<ApprovedProgram[]> {
  const svc = await createServiceClient();
  const { data: programs } = await svc
    .from("programs")
    .select("id, title, category, total_minutes, summary")
    .eq("status", "approved")
    .order("title", { ascending: true });
  if (!programs || programs.length === 0) return [];

  const { data: sessions } = await svc
    .from("program_sessions")
    .select("program_id")
    .in(
      "program_id",
      programs.map((p) => p.id)
    );
  const counts = new Map<string, number>();
  for (const s of sessions ?? []) {
    counts.set(s.program_id, (counts.get(s.program_id) ?? 0) + 1);
  }

  return programs.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category as ProgramCategory,
    total_minutes: p.total_minutes,
    summary: p.summary,
    sessions_count: counts.get(p.id) ?? 0,
  }));
}

// ─── Chapter mentor roster (schedule table mentor select) ─────────────────

export type MentorOption = { personId: string; name: string };

/**
 * Active mentors of a chapter's Mentor YUVA Network (canonical source:
 * yi_directory.role_assignments app='yuva' role='mentor').
 */
export async function fetchChapterMentors(
  chapter: string
): Promise<MentorOption[]> {
  const dir = await createDirService();
  const { data: rows } = await dir
    .schema("yi_directory")
    .from("role_assignments")
    .select("person_id, person:people!inner(full_name, is_active)")
    .eq("app", YUVA_APP)
    .eq("role", ROLE_MENTOR)
    .eq("yi_chapter", chapter)
    .eq("is_active", true);

  const seen = new Set<string>();
  const options: MentorOption[] = [];
  for (const row of rows ?? []) {
    const person = row.person as unknown as {
      full_name: string | null;
      is_active: boolean | null;
    };
    if (!person || person.is_active === false) continue;
    if (seen.has(row.person_id)) continue;
    seen.add(row.person_id);
    options.push({
      personId: row.person_id,
      name: person.full_name ?? "—",
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}
