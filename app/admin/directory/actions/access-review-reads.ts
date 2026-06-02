/**
 * Directory Admin — Access Review reads (2026-06-02)
 *
 * Read-only "who can do what" governance queries over yi_directory. Platform-
 * super-admin only (the page + export route gate; these reads assume a gated
 * caller, exactly as directory-reads.ts documents). Service client bypasses
 * RLS — the gate is the whole boundary.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";

export type RoleHolderRow = {
  person_id: string;
  full_name: string;
  email: string | null;
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_year: number | null;
  title: string | null;
  is_primary: boolean;
};

export type AccessSummaryCell = {
  app: string;
  role: string;
  count: number;
};

export type PersonSearchRow = {
  id: string;
  full_name: string;
  email: string | null;
};

// Permissive cast — yi_directory is not in the generated yip types (same
// approach used across directory-reads.ts).
type AnyQuery = {
  eq: (k: string, v: unknown) => AnyQuery;
  in: (k: string, v: unknown[]) => AnyQuery;
  or: (filter: string) => AnyQuery;
  ilike: (k: string, v: string) => AnyQuery;
  order: (k: string, opts?: { ascending?: boolean }) => AnyQuery;
  limit: (n: number) => AnyQuery;
  then: <T>(on: (v: { data: unknown; error: unknown }) => T) => Promise<T>;
};

function dir(svc: Awaited<ReturnType<typeof createServiceClient>>) {
  return svc.schema("yi_directory" as "public") as unknown as {
    from: (t: string) => { select: (cols: string) => AnyQuery };
  };
}

/**
 * App×role summary of ACTIVE role holders — the "who can do what at a glance"
 * grid. Counts distinct active role_assignments grouped by (app, role).
 */
export async function getAccessSummaryGrid(): Promise<AccessSummaryCell[]> {
  const svc = await createServiceClient();
  const res = (await dir(svc)
    .from("role_assignments")
    .select("app, role, is_active")
    .eq("is_active", true)) as { data: { app: string; role: string }[] | null };

  const counts = new Map<string, AccessSummaryCell>();
  for (const r of res.data ?? []) {
    const key = `${r.app}__${r.role}`;
    const cell = counts.get(key) ?? { app: r.app, role: r.role, count: 0 };
    cell.count += 1;
    counts.set(key, cell);
  }
  return Array.from(counts.values()).sort(
    (a, b) => a.app.localeCompare(b.app) || a.role.localeCompare(b.role)
  );
}

/**
 * Everyone who actively holds a given (app, role) — the per-role holder list.
 */
export async function getRoleHolders(
  app: string,
  role: string
): Promise<RoleHolderRow[]> {
  const svc = await createServiceClient();

  const roleRes = (await dir(svc)
    .from("role_assignments")
    .select(
      "person_id, yi_chapter, yi_zone, yi_year, title, is_primary, is_active"
    )
    .eq("is_active", true)
    .eq("app", app)
    .eq("role", role)) as {
    data:
      | {
          person_id: string;
          yi_chapter: string | null;
          yi_zone: string | null;
          yi_year: number | null;
          title: string | null;
          is_primary: boolean | null;
        }[]
      | null;
  };
  const roles = roleRes.data ?? [];
  if (roles.length === 0) return [];

  const personIds = [...new Set(roles.map((r) => r.person_id))];
  const peopleRes = (await dir(svc)
    .from("people")
    .select("id, full_name, email")
    .in("id", personIds)) as {
    data: { id: string; full_name: string; email: string | null }[] | null;
  };
  const byId = new Map((peopleRes.data ?? []).map((p) => [p.id, p]));

  return roles
    .map((r) => {
      const p = byId.get(r.person_id);
      return {
        person_id: r.person_id,
        full_name: p?.full_name ?? "(unknown)",
        email: p?.email ?? null,
        yi_chapter: r.yi_chapter,
        yi_zone: r.yi_zone,
        yi_year: r.yi_year,
        title: r.title,
        is_primary: r.is_primary === true,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Typeahead search for the per-person access sheet picker.
 */
export async function searchDirectoryPeople(
  query: string
): Promise<PersonSearchRow[]> {
  const q = query.trim();
  if (!q) return [];
  const svc = await createServiceClient();
  const safe = q.replace(/[%,()]/g, "");
  if (!safe) return [];
  const res = (await dir(svc)
    .from("people")
    .select("id, full_name, email")
    .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .order("full_name", { ascending: true })
    .limit(20)) as { data: PersonSearchRow[] | null };
  return res.data ?? [];
}
