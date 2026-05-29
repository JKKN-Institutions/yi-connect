/**
 * Directory Admin — Read-only Server Actions (Phase A, 2026-05-28)
 *
 * Cross-vertical view of `yi_directory.people` and `yi_directory.role_assignments`.
 * Per the 2026-05-28 CLAUDE.md addition, yi_directory is the MOTHER SOURCE for
 * Yi people + roles. This module is read-only; mutations live in
 * `directory-mutations.ts` (owned by the AA agent).
 *
 * Auth: callers are responsible for gating with `isCurrentUserSuperAdmin()`
 * from `lib/yip/auth/require-super-admin.ts`. These reads use the service
 * client because RLS on yi_directory is not yet configured for cross-vertical
 * staff reads.
 */
"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

export type DirectoryStatusFilter =
  | "active"
  | "inactive"
  | "pending_auth"
  | "all";

export type DirectoryFilters = {
  search?: string; // matches name OR email (ilike)
  apps?: string[]; // multi-select: yip|future|yuva|thalir|masoom|yi
  role?: string; // single role string, exact match
  yi_year?: number;
  yi_chapter?: string; // free-text contains
  status?: DirectoryStatusFilter;
  sort?: "name" | "email" | "role_count";
  sort_dir?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type DirectoryPersonRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  user_id: string | null;
  has_auth: boolean;
  active_role_count: number;
  apps: string[]; // unique apps from active role assignments
};

export type DirectoryListResult = {
  rows: DirectoryPersonRow[];
  total: number;
  page: number;
  limit: number;
  available_years: number[];
};

export type RoleAssignmentRow = {
  id: string;
  app: string;
  role: string;
  yi_year: number;
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_edition_id: string | null;
  title: string | null;
  is_active: boolean;
  is_primary: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type DirectoryPersonDetail = {
  person: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    is_active: boolean;
    user_id: string | null;
    has_auth: boolean;
    source_yip_profile_id: string | null;
    source_future_team_id: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  active_roles: RoleAssignmentRow[];
  inactive_roles: RoleAssignmentRow[];
};

// ─── Internals ──────────────────────────────────────────────────────────

type PeopleRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean | null;
  user_id: string | null;
  source_yip_profile_id: string | null;
  source_future_team_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RawRoleRow = {
  id: string;
  person_id: string;
  app: string;
  role: string;
  yi_year: number;
  yi_chapter: string | null;
  yi_zone: string | null;
  yi_edition_id: string | null;
  title: string | null;
  is_active: boolean | null;
  is_primary: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function dirClient(svc: Awaited<ReturnType<typeof createServiceClient>>) {
  // yi_directory schema cast — same pattern used across yi-future actions.
  return svc.schema("yi_directory" as "public") as unknown as {
    from: (t: "people") => {
      select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => {
        eq: (k: string, v: unknown) => unknown;
        order: (k: string, opts?: { ascending?: boolean }) => unknown;
        in: (k: string, v: unknown[]) => unknown;
        is: (k: string, v: unknown) => unknown;
        or: (filter: string) => unknown;
        ilike: (k: string, v: string) => unknown;
        range: (a: number, b: number) => unknown;
      };
    };
  };
}

// We use a permissive `any`-shaped helper to keep the chain type-safe enough
// without dragging the full generated types for yi_directory.
type AnyQuery = {
  eq: (k: string, v: unknown) => AnyQuery;
  in: (k: string, v: unknown[]) => AnyQuery;
  is: (k: string, v: unknown) => AnyQuery;
  or: (filter: string) => AnyQuery;
  ilike: (k: string, v: string) => AnyQuery;
  order: (k: string, opts?: { ascending?: boolean }) => AnyQuery;
  range: (a: number, b: number) => AnyQuery;
  then: <T>(
    onfulfilled: (v: { data: unknown; error: unknown; count: number | null }) => T
  ) => Promise<T>;
};

// ─── listDirectoryPeople ────────────────────────────────────────────────

export async function listDirectoryPeople(
  filters: DirectoryFilters = {}
): Promise<DirectoryListResult> {
  const svc = await createServiceClient();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Step 1: pull a candidate set of people. We filter by people-level
  // attributes here (search, is_active) and refine by role attributes after.
  const dirAny = svc.schema("yi_directory" as "public") as unknown as {
    from: (t: string) => AnyQuery & {
      select: (
        cols: string,
        opts?: { count?: "exact"; head?: boolean }
      ) => AnyQuery;
    };
  };

  // Step 1a: load ALL active role_assignments first so we can apply
  // role-level filters (app, role, year, chapter) by intersecting person_ids.
  let roleQuery = (svc.schema("yi_directory" as "public") as unknown as typeof dirAny).from("role_assignments").select(
    "id, person_id, app, role, yi_year, yi_chapter, yi_zone, yi_edition_id, title, is_active, is_primary, created_at, updated_at"
  );

  if (filters.apps && filters.apps.length > 0) {
    roleQuery = roleQuery.in("app", filters.apps);
  }
  if (filters.role) {
    roleQuery = roleQuery.eq("role", filters.role);
  }
  if (typeof filters.yi_year === "number") {
    roleQuery = roleQuery.eq("yi_year", filters.yi_year);
  }
  if (filters.yi_chapter && filters.yi_chapter.trim()) {
    roleQuery = roleQuery.ilike("yi_chapter", `%${filters.yi_chapter.trim()}%`);
  }
  // Only consider active role rows for filtering/roll-up
  roleQuery = roleQuery.eq("is_active", true);

  const roleRes = (await (roleQuery as unknown as Promise<{
    data: RawRoleRow[] | null;
    error: unknown;
  }>)) as { data: RawRoleRow[] | null; error: unknown };

  const allActiveRoles: RawRoleRow[] = roleRes.data ?? [];

  // Build per-person roll-ups.
  const rolesByPerson = new Map<string, RawRoleRow[]>();
  for (const r of allActiveRoles) {
    const arr = rolesByPerson.get(r.person_id) ?? [];
    arr.push(r);
    rolesByPerson.set(r.person_id, arr);
  }

  const hasRoleFilters =
    (filters.apps && filters.apps.length > 0) ||
    !!filters.role ||
    typeof filters.yi_year === "number" ||
    (!!filters.yi_chapter && !!filters.yi_chapter.trim());

  // Step 2: pull people. If role filters applied, restrict to matching person_ids.
  const personIdsFromRoles = hasRoleFilters
    ? Array.from(rolesByPerson.keys())
    : null;

  if (hasRoleFilters && personIdsFromRoles && personIdsFromRoles.length === 0) {
    // No matches at all
    return {
      rows: [],
      total: 0,
      page,
      limit,
      available_years: await fetchAvailableYears(svc),
    };
  }

  let peopleQuery = (svc.schema("yi_directory" as "public") as unknown as typeof dirAny).from("people")
    .select(
      "id, full_name, email, phone, photo_url, is_active, user_id, source_yip_profile_id, source_future_team_id, created_at, updated_at",
      { count: "exact" }
    );

  if (personIdsFromRoles) {
    peopleQuery = peopleQuery.in("id", personIdsFromRoles);
  }

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().replace(/[,]/g, " ");
    peopleQuery = peopleQuery.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  const status = filters.status ?? "active";
  if (status === "active") {
    peopleQuery = peopleQuery.eq("is_active", true);
  } else if (status === "inactive") {
    peopleQuery = peopleQuery.eq("is_active", false);
  } else if (status === "pending_auth") {
    peopleQuery = peopleQuery.is("user_id", null);
  }

  // Sort: name/email at SQL level; role_count is handled post-fetch.
  const sort = filters.sort ?? "name";
  const ascending = (filters.sort_dir ?? "asc") === "asc";
  if (sort === "name") {
    peopleQuery = peopleQuery.order("full_name", { ascending });
  } else if (sort === "email") {
    peopleQuery = peopleQuery.order("email", { ascending });
  } else {
    // For role_count we still page server-side by name as a stable secondary,
    // and re-sort the returned page locally.
    peopleQuery = peopleQuery.order("full_name", { ascending: true });
  }

  peopleQuery = peopleQuery.range(from, to);

  const peopleRes = (await (peopleQuery as unknown as Promise<{
    data: PeopleRow[] | null;
    error: unknown;
    count: number | null;
  }>)) as { data: PeopleRow[] | null; error: unknown; count: number | null };

  const people = peopleRes.data ?? [];
  const total = peopleRes.count ?? people.length;

  const rows: DirectoryPersonRow[] = people.map((p) => {
    const roles = rolesByPerson.get(p.id) ?? [];
    const apps = Array.from(new Set(roles.map((r) => r.app))).sort();
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      photo_url: p.photo_url,
      is_active: p.is_active !== false,
      user_id: p.user_id,
      has_auth: !!p.user_id,
      active_role_count: roles.length,
      apps,
    };
  });

  // Local sort for role_count
  if (sort === "role_count") {
    rows.sort((a, b) =>
      ascending
        ? a.active_role_count - b.active_role_count
        : b.active_role_count - a.active_role_count
    );
  }

  return {
    rows,
    total,
    page,
    limit,
    available_years: await fetchAvailableYears(svc),
  };
}

async function fetchAvailableYears(
  svc: Awaited<ReturnType<typeof createServiceClient>>
): Promise<number[]> {
  const dirAny = svc.schema("yi_directory" as "public") as unknown as {
    from: (t: string) => {
      select: (cols: string) => Promise<{
        data: Array<{ yi_year: number }> | null;
        error: unknown;
      }>;
    };
  };
  const res = await (svc.schema("yi_directory" as "public") as unknown as typeof dirAny).from("role_assignments").select("yi_year");
  const years = new Set<number>();
  for (const r of res.data ?? []) {
    if (typeof r.yi_year === "number") years.add(r.yi_year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

// ─── getPersonDetail ────────────────────────────────────────────────────

export async function getPersonDetail(
  personId: string
): Promise<DirectoryPersonDetail | null> {
  if (!personId) return null;
  const svc = await createServiceClient();
  const dirAny = svc.schema("yi_directory" as "public") as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (k: string, v: unknown) => {
          maybeSingle: () => Promise<{
            data: PeopleRow | null;
            error: unknown;
          }>;
          order: (
            k: string,
            opts?: { ascending?: boolean }
          ) => {
            order: (
              k: string,
              opts?: { ascending?: boolean }
            ) => Promise<{
              data: RawRoleRow[] | null;
              error: unknown;
            }>;
          };
        };
      };
    };
  };

  const personRes = await (svc.schema("yi_directory" as "public") as unknown as typeof dirAny).from("people")
    .select(
      "id, full_name, email, phone, photo_url, is_active, user_id, source_yip_profile_id, source_future_team_id, created_at, updated_at"
    )
    .eq("id", personId)
    .maybeSingle();

  if (!personRes.data) return null;
  const p = personRes.data;

  const rolesRes = await (svc.schema("yi_directory" as "public") as unknown as typeof dirAny).from("role_assignments")
    .select(
      "id, person_id, app, role, yi_year, yi_chapter, yi_zone, yi_edition_id, title, is_active, is_primary, created_at, updated_at"
    )
    .eq("person_id", personId)
    .order("yi_year", { ascending: false })
    .order("app", { ascending: true });

  const all = (rolesRes.data ?? []) as RawRoleRow[];
  const toRow = (r: RawRoleRow): RoleAssignmentRow => ({
    id: r.id,
    app: r.app,
    role: r.role,
    yi_year: r.yi_year,
    yi_chapter: r.yi_chapter,
    yi_zone: r.yi_zone,
    yi_edition_id: r.yi_edition_id,
    title: r.title,
    is_active: r.is_active !== false,
    is_primary: r.is_primary === true,
    created_at: r.created_at,
    updated_at: r.updated_at,
  });

  const active_roles = all.filter((r) => r.is_active !== false).map(toRow);
  const inactive_roles = all.filter((r) => r.is_active === false).map(toRow);

  return {
    person: {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      photo_url: p.photo_url,
      is_active: p.is_active !== false,
      user_id: p.user_id,
      has_auth: !!p.user_id,
      source_yip_profile_id: p.source_yip_profile_id,
      source_future_team_id: p.source_future_team_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
    },
    active_roles,
    inactive_roles,
  };
}
