import "server-only";

/**
 * Academy read-side assembly shared by the Phase 5 RSC pages (national list /
 * detail, chapter dashboard / academy view). READ-ONLY — every mutation goes
 * through app/youth-academy/actions/academies.ts (gate-first).
 *
 * ⚠️ Callers are gated pages — these helpers do NOT authorize. Pass the
 * scope filter that matches the caller's access (see getYuvaAccess()).
 */

import { publicUrl } from "@/lib/yuva/storage";
import { createServiceClient } from "@/lib/yuva/supabase/service";
import type { Database } from "@/types/yuva/database";
import type { AcademySummary } from "./academy-card";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

// Minimal structural cast for cross-schema reads (yi / yi_directory are not
// in the yuva Database type — repo precedent: lib/yi/directory/resolve-person.ts).
type DbErr = { message: string } | null;
interface LooseBuilder extends PromiseLike<{
  data: Record<string, unknown>[] | null;
  error: DbErr;
}> {
  select: (cols: string) => LooseBuilder;
  in: (col: string, vals: unknown[]) => LooseBuilder;
}
function crossSchema(svc: Svc, schema: "yi" | "yi_directory") {
  return svc.schema(schema as never) as unknown as {
    from: (table: string) => LooseBuilder;
  };
}

const LIVE_RUN_STATUSES = new Set([
  "published",
  "applications_closed",
  "in_progress",
]);

export type AcademySignatory = { label: string; name: string | null };

export type AcademyRecord = AcademySummary & {
  institution_id: string | null;
  institution_other: string | null;
  coordinator_person_id: string | null;
  /** Configured certificate signature blocks (decision 2026-06-11). */
  signatories: AcademySignatory[];
  created_at: string;
  updated_at: string;
  runs_count: number;
  live_runs_count: number;
};

/** Normalize the academy.signatories jsonb into the typed record shape. */
function coerceSignatories(raw: unknown): AcademySignatory[] {
  if (!Array.isArray(raw)) return [];
  const out: AcademySignatory[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { label?: unknown; name?: unknown };
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (!label) continue;
    const name = typeof rec.name === "string" ? rec.name.trim() || null : null;
    out.push({ label, name });
    if (out.length === 3) break;
  }
  return out;
}

export type AcademyScope =
  | { kind: "all" }
  | { kind: "chapter"; chapter: string }
  | { kind: "ids"; ids: string[] };

export async function fetchAcademies(
  scope: AcademyScope
): Promise<AcademyRecord[]> {
  const svc = await createServiceClient();

  let query = svc
    .from("academies")
    .select(
      "id, chapter, display_name, institution_id, institution_other, is_active, logo_storage_path, capacity_norm, qualitative_notes, coordinator_person_id, created_at, updated_at, signatories"
    )
    .order("created_at", { ascending: false });
  if (scope.kind === "chapter") query = query.eq("chapter", scope.chapter);
  if (scope.kind === "ids") {
    if (scope.ids.length === 0) return [];
    query = query.in("id", scope.ids);
  }
  const { data } = await query;
  if (!data || data.length === 0) return [];
  // `signatories` (jsonb, added 2026-06-11) is post-types-regen — including it
  // in the typed select poisons the row into a SelectQueryError. Read the rows
  // through a local typed shape so the existing columns stay strongly typed
  // and `signatories` is available for normalization below.
  type AcademyRow = Database["yuva"]["Tables"]["academies"]["Row"] & {
    signatories: unknown;
  };
  const academies = data as unknown as AcademyRow[];

  // Institution names (canonical master).
  const institutionIds = [
    ...new Set(
      academies.map((a) => a.institution_id).filter((v): v is string => !!v)
    ),
  ];
  const institutionName = new Map<string, string>();
  if (institutionIds.length > 0) {
    const { data } = await crossSchema(svc, "yi")
      .from("institutions")
      .select("id, name")
      .in("id", institutionIds);
    for (const row of data ?? []) {
      institutionName.set(String(row.id), String(row.name));
    }
  }

  // Coordinator identities.
  const coordinatorIds = [
    ...new Set(
      academies
        .map((a) => a.coordinator_person_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const coordinator = new Map<string, { name: string; email: string | null }>();
  if (coordinatorIds.length > 0) {
    const { data } = await crossSchema(svc, "yi_directory")
      .from("people")
      .select("id, full_name, email")
      .in("id", coordinatorIds);
    for (const row of data ?? []) {
      coordinator.set(String(row.id), {
        name: String(row.full_name ?? "—"),
        email: (row.email as string | null) ?? null,
      });
    }
  }

  // Run counts per academy (runs table is small at this stage).
  const runsCount = new Map<string, number>();
  const liveRunsCount = new Map<string, number>();
  const { data: runs } = await svc
    .from("runs")
    .select("academy_id, status")
    .in(
      "academy_id",
      academies.map((a) => a.id)
    );
  for (const run of runs ?? []) {
    runsCount.set(run.academy_id, (runsCount.get(run.academy_id) ?? 0) + 1);
    if (LIVE_RUN_STATUSES.has(run.status)) {
      liveRunsCount.set(
        run.academy_id,
        (liveRunsCount.get(run.academy_id) ?? 0) + 1
      );
    }
  }

  return academies.map((a) => ({
    id: a.id,
    chapter: a.chapter,
    display_name: a.display_name,
    institution_id: a.institution_id,
    institution_other: a.institution_other,
    institution_name: a.institution_id
      ? (institutionName.get(a.institution_id) ?? null)
      : (a.institution_other ?? null),
    is_active: a.is_active,
    // Cache-bust the fixed storage path with updated_at so logo replacements
    // show without a hard refresh.
    logo_url: a.logo_storage_path
      ? `${publicUrl(a.logo_storage_path)}?v=${encodeURIComponent(a.updated_at)}`
      : null,
    capacity_norm: a.capacity_norm,
    qualitative_notes: a.qualitative_notes,
    coordinator_person_id: a.coordinator_person_id,
    signatories: coerceSignatories(a.signatories),
    coordinator: a.coordinator_person_id
      ? (coordinator.get(a.coordinator_person_id) ?? null)
      : null,
    created_at: a.created_at,
    updated_at: a.updated_at,
    runs_count: runsCount.get(a.id) ?? 0,
    live_runs_count: liveRunsCount.get(a.id) ?? 0,
  }));
}

export async function fetchAcademyById(
  id: string
): Promise<AcademyRecord | null> {
  const rows = await fetchAcademies({ kind: "ids", ids: [id] });
  return rows[0] ?? null;
}
