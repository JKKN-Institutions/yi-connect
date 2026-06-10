import "server-only";

/**
 * PUBLIC read-side assembly for the Phase 8 anonymous pages (landing grid,
 * run detail, apply gate). Renders via the SERVICE client with EXPLICIT
 * status filters — the yuva schema has NO anon access by design (spec:
 * "Anon access — No anon grants on yuva at all; public pages read via RSC +
 * service client").
 *
 * ⚠️ Every fetcher here filters to publicly-visible statuses in code. Never
 * loosen those filters — they ARE the public/private boundary.
 */

import type { ProgramCategory, RunStatus } from "@/lib/yuva/constants";
import { publicUrl } from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
// yip server module's Database type includes the yi_directory schema (donor
// cross-schema access path — app/youth-academy/mentors/page.tsx).
import { createServiceClient as createDirService } from "@/lib/yip/supabase/server";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

// Minimal structural cast for yi.* cross-schema reads (repo precedent:
// components/yuva/academies/data.ts).
type DbErr = { message: string } | null;
interface LooseBuilder extends PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: DbErr;
}> {
  select: (cols: string) => LooseBuilder;
  in: (col: string, vals: unknown[]) => LooseBuilder;
}
function yiSchema(svc: Svc) {
  return svc.schema("yi" as never) as unknown as {
    from: (table: string) => LooseBuilder;
  };
}

// ─── Apply-window state (pure) ────────────────────────────────────────────

export type ApplyState =
  | "open"
  | "not_yet_open"
  | "closed_deadline"
  | "closed_full"
  | "closed_status";

/**
 * UI-level apply state for a publicly-visible run.
 * - null apply_open_at ⇒ open now; null apply_close_at ⇒ no deadline.
 * - capacity is a SOFT cap: the landing/detail UI shows "Applications
 *   closed" when full, but submitApplication does NOT enforce it (the
 *   chapter handles overflow at accept time).
 */
export function computeApplyState(
  run: {
    status: string;
    apply_open_at: string | null;
    apply_close_at: string | null;
    accepted_count: number;
    capacity: number;
  },
  now: Date = new Date()
): ApplyState {
  if (run.status !== "published") return "closed_status";
  if (run.apply_open_at && now < new Date(run.apply_open_at)) {
    return "not_yet_open";
  }
  if (run.apply_close_at && now > new Date(run.apply_close_at)) {
    return "closed_deadline";
  }
  if (run.capacity > 0 && run.accepted_count >= run.capacity) {
    return "closed_full";
  }
  return "open";
}

// ─── Landing grid ─────────────────────────────────────────────────────────

/** Statuses that appear on the landing grid ("Applications closed" cards
 *  are SHOWN, not hidden — spec edge case). */
const LANDING_STATUSES: RunStatus[] = ["published", "applications_closed"];

export type PublicRunSummary = {
  id: string;
  program_title: string;
  program_category: ProgramCategory;
  academy_name: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  total_minutes: number;
  capacity: number;
  accepted_count: number;
  apply_open_at: string | null;
  apply_close_at: string | null;
  cohort_announce_date: string | null;
  state: ApplyState;
};

export async function fetchPublicRuns(): Promise<PublicRunSummary[]> {
  const svc = await createServiceClient();

  const { data: runs } = await svc
    .from("runs")
    .select(
      "id, program_id, academy_id, status, capacity, apply_open_at, apply_close_at, cohort_announce_date, start_date, end_date, published_at"
    )
    .in("status", LANDING_STATUSES)
    .order("apply_close_at", { ascending: true, nullsFirst: false });
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const programIds = [...new Set(runs.map((r) => r.program_id))];
  const academyIds = [...new Set(runs.map((r) => r.academy_id))];

  const [programsRes, academiesRes, sessionsRes, acceptedRes] =
    await Promise.all([
      svc.from("programs").select("id, title, category").in("id", programIds),
      svc
        .from("academies")
        .select("id, display_name, institution_id")
        .in("id", academyIds),
      svc
        .from("run_sessions")
        .select("run_id, duration_minutes")
        .in("run_id", runIds),
      svc
        .from("applications")
        .select("run_id")
        .in("run_id", runIds)
        .eq("status", "accepted"),
    ]);

  const programById = new Map((programsRes.data ?? []).map((p) => [p.id, p]));
  const academyById = new Map(
    (academiesRes.data ?? []).map((a) => [a.id, a])
  );

  // City comes from the academy's canonical institution (yi.institutions).
  const institutionIds = [
    ...new Set(
      (academiesRes.data ?? [])
        .map((a) => a.institution_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const cityByInstitution = new Map<string, string | null>();
  if (institutionIds.length > 0) {
    const { data } = await yiSchema(svc)
      .from("institutions")
      .select("id, city")
      .in("id", institutionIds);
    for (const row of data ?? []) {
      cityByInstitution.set(String(row.id), (row.city as string | null) ?? null);
    }
  }

  const minutesByRun = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    minutesByRun.set(
      s.run_id,
      (minutesByRun.get(s.run_id) ?? 0) + (s.duration_minutes ?? 0)
    );
  }
  const acceptedByRun = new Map<string, number>();
  for (const a of acceptedRes.data ?? []) {
    acceptedByRun.set(a.run_id, (acceptedByRun.get(a.run_id) ?? 0) + 1);
  }

  const now = new Date();
  return runs.map((r) => {
    const program = programById.get(r.program_id);
    const academy = academyById.get(r.academy_id);
    const accepted = acceptedByRun.get(r.id) ?? 0;
    return {
      id: r.id,
      program_title: program?.title ?? "Untitled program",
      program_category: (program?.category ?? "learning") as ProgramCategory,
      academy_name: academy?.display_name ?? "—",
      city: academy?.institution_id
        ? (cityByInstitution.get(academy.institution_id) ?? null)
        : null,
      start_date: r.start_date,
      end_date: r.end_date,
      total_minutes: minutesByRun.get(r.id) ?? 0,
      capacity: r.capacity,
      accepted_count: accepted,
      apply_open_at: r.apply_open_at,
      apply_close_at: r.apply_close_at,
      cohort_announce_date: r.cohort_announce_date,
      state: computeApplyState(
        {
          status: r.status,
          apply_open_at: r.apply_open_at,
          apply_close_at: r.apply_close_at,
          accepted_count: accepted,
          capacity: r.capacity,
        },
        now
      ),
    };
  });
}

// ─── Run detail (public) ──────────────────────────────────────────────────

/** Statuses a visitor may see on /programs/[runId] — draft/cancelled 404. */
const PUBLIC_DETAIL_STATUSES = new Set<string>([
  "published",
  "applications_closed",
  "in_progress",
  "completed",
  "certified",
]);

export type PublicSessionView = {
  id: string;
  seq: number;
  name: string;
  duration_minutes: number;
  learning_objective: string | null;
  scheduled_at: string | null;
  venue: string | null;
  mentor: { name: string; photoUrl: string | null } | null;
};

export type PublicRunDetail = {
  id: string;
  status: RunStatus;
  capacity: number;
  accepted_count: number;
  apply_open_at: string | null;
  apply_close_at: string | null;
  cohort_announce_date: string | null;
  start_date: string | null;
  end_date: string | null;
  total_minutes: number;
  state: ApplyState;
  program: {
    title: string;
    category: ProgramCategory;
    summary: string | null;
    objective: string | null;
    takeaways: string[];
  };
  academy: {
    display_name: string;
    chapter: string;
    institution_name: string | null;
    city: string | null;
    logo_url: string | null;
  };
  sessions: PublicSessionView[];
};

export async function fetchPublicRunDetail(
  runId: string
): Promise<PublicRunDetail | null> {
  const svc = await createServiceClient();

  const { data: run } = await svc
    .from("runs")
    .select(
      "id, program_id, academy_id, status, capacity, apply_open_at, apply_close_at, cohort_announce_date, start_date, end_date"
    )
    .eq("id", runId)
    .maybeSingle();
  if (!run || !PUBLIC_DETAIL_STATUSES.has(run.status)) return null;

  const [programRes, academyRes, sessionsRes, acceptedRes] = await Promise.all(
    [
      svc
        .from("programs")
        .select("id, title, category, summary, objective, takeaways")
        .eq("id", run.program_id)
        .maybeSingle(),
      svc
        .from("academies")
        .select(
          "id, display_name, chapter, institution_id, institution_other, logo_storage_path, updated_at"
        )
        .eq("id", run.academy_id)
        .maybeSingle(),
      svc
        .from("run_sessions")
        .select(
          "id, seq, name, duration_minutes, learning_objective, scheduled_at, venue, mentor_person_id"
        )
        .eq("run_id", run.id)
        .order("seq", { ascending: true }),
      svc
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id)
        .eq("status", "accepted"),
    ]
  );

  const sessions = sessionsRes.data ?? [];

  // Mentor identities (canonical: yi_directory) + PUBLIC profile photos only.
  const mentorIds = [
    ...new Set(
      sessions
        .map((s) => s.mentor_person_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const mentorName = new Map<string, string>();
  const mentorPhoto = new Map<string, string>();
  if (mentorIds.length > 0) {
    const dir = await createDirService();
    const { data: people } = await dir
      .schema("yi_directory")
      .from("people")
      .select("id, full_name")
      .in("id", mentorIds);
    for (const p of people ?? []) {
      mentorName.set(p.id, p.full_name ?? "—");
    }

    const { data: profiles } = await svc
      .from("mentor_profiles")
      .select("person_id, photo_storage_path, is_public, updated_at")
      .in("person_id", mentorIds)
      .eq("is_public", true);
    for (const prof of profiles ?? []) {
      if (prof.photo_storage_path) {
        mentorPhoto.set(
          prof.person_id,
          `${publicUrl(prof.photo_storage_path)}?v=${Date.parse(prof.updated_at) || 0}`
        );
      }
    }
  }

  // Academy institution name + city (canonical master, when attached).
  const academy = academyRes.data;
  let institutionName: string | null = academy?.institution_other ?? null;
  let city: string | null = null;
  if (academy?.institution_id) {
    const { data } = await yiSchema(svc)
      .from("institutions")
      .select("id, name, city")
      .in("id", [academy.institution_id]);
    const row = (data ?? [])[0];
    if (row) {
      institutionName = String(row.name);
      city = (row.city as string | null) ?? null;
    }
  }

  const takeawaysRaw = programRes.data?.takeaways;
  const takeaways = Array.isArray(takeawaysRaw)
    ? takeawaysRaw.filter((t): t is string => typeof t === "string")
    : [];

  const accepted = acceptedRes.count ?? 0;
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0
  );

  return {
    id: run.id,
    status: run.status as RunStatus,
    capacity: run.capacity,
    accepted_count: accepted,
    apply_open_at: run.apply_open_at,
    apply_close_at: run.apply_close_at,
    cohort_announce_date: run.cohort_announce_date,
    start_date: run.start_date,
    end_date: run.end_date,
    total_minutes: totalMinutes,
    state: computeApplyState({
      status: run.status,
      apply_open_at: run.apply_open_at,
      apply_close_at: run.apply_close_at,
      accepted_count: accepted,
      capacity: run.capacity,
    }),
    program: {
      title: programRes.data?.title ?? "Untitled program",
      category: (programRes.data?.category ?? "learning") as ProgramCategory,
      summary: programRes.data?.summary ?? null,
      objective: programRes.data?.objective ?? null,
      takeaways,
    },
    academy: {
      display_name: academy?.display_name ?? "—",
      chapter: academy?.chapter ?? "—",
      institution_name: institutionName,
      city,
      logo_url: academy?.logo_storage_path
        ? `${publicUrl(academy.logo_storage_path)}?v=${encodeURIComponent(academy.updated_at)}`
        : null,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      seq: s.seq,
      name: s.name,
      duration_minutes: s.duration_minutes,
      learning_objective: s.learning_objective,
      scheduled_at: s.scheduled_at,
      venue: s.venue,
      mentor: s.mentor_person_id
        ? {
            name: mentorName.get(s.mentor_person_id) ?? "—",
            photoUrl: mentorPhoto.get(s.mentor_person_id) ?? null,
          }
        : null,
    })),
  };
}

// ─── "Our Network" — ALL active academies ─────────────────────────────────

export type PublicAcademy = {
  id: string;
  display_name: string;
  chapter: string;
  institution_name: string | null;
  logo_url: string | null;
};

export async function fetchActiveAcademiesPublic(): Promise<PublicAcademy[]> {
  const svc = await createServiceClient();
  const { data: academies } = await svc
    .from("academies")
    .select(
      "id, display_name, chapter, institution_id, institution_other, logo_storage_path, updated_at"
    )
    .eq("is_active", true)
    .order("chapter", { ascending: true });
  if (!academies || academies.length === 0) return [];

  const institutionIds = [
    ...new Set(
      academies.map((a) => a.institution_id).filter((v): v is string => !!v)
    ),
  ];
  const institutionName = new Map<string, string>();
  if (institutionIds.length > 0) {
    const { data } = await yiSchema(svc)
      .from("institutions")
      .select("id, name")
      .in("id", institutionIds);
    for (const row of data ?? []) {
      institutionName.set(String(row.id), String(row.name));
    }
  }

  return academies.map((a) => ({
    id: a.id,
    display_name: a.display_name,
    chapter: a.chapter,
    institution_name: a.institution_id
      ? (institutionName.get(a.institution_id) ?? null)
      : (a.institution_other ?? null),
    logo_url: a.logo_storage_path
      ? `${publicUrl(a.logo_storage_path)}?v=${encodeURIComponent(a.updated_at)}`
      : null,
  }));
}
