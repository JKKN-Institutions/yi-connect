/**
 * Directory Admin — Sync-Status Server Actions (Phase C, 2026-05-28)
 *
 * Detects drift between legacy auth tables and the canonical
 * `yi_directory.role_assignments`. Read-only: surfaces drift, never mutates.
 *
 * Three independent gaps:
 *   1) yi.national_admins        → yi_directory.role_assignments(app='future')
 *   2) yip.organizers            → yi_directory.role_assignments(app='yip')
 *   3) future.chapter_core_team  → yi_directory.role_assignments(
 *                                    app='future', role='chapter_chair')
 *
 * Auth: callers MUST gate with `isCurrentUserSuperAdmin()`. We use the
 * service client because RLS on legacy schemas is not configured for
 * cross-vertical staff reads.
 */
"use server";

import { createServiceClient } from "@/lib/yip/supabase/server";

// ─── Public Types ───────────────────────────────────────────────────────

export type DriftKind = "MISSING" | "ROLE_MISMATCH" | "ORPHAN";

export type DriftRow = {
  kind: DriftKind;
  /** Stable identifier per gap (legacy PK or person id for orphans). */
  source_id: string;
  email: string | null;
  full_name: string | null;
  /** What the legacy row says (e.g. is_super_admin=true, role='chapter_em'). */
  legacy_summary: string;
  /** What yi_directory currently says (or "—" when missing). */
  directory_summary: string;
  /** Plain-English recommended action. */
  suggested_action: string;
};

export type GapResult = {
  gap: "yi_national_admins" | "yip_organizers" | "future_chapter_core_team";
  legacy_total: number;
  synced_count: number;
  drift_count: number;
  sync_pct: number; // 0..100, rounded to nearest int
  missing: DriftRow[];
  role_mismatch: DriftRow[];
  orphan: DriftRow[];
};

// ─── Internal helpers ───────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;
type AnyClient = {
  // Loose typing; we trust the schema-cast pattern used elsewhere in this dir.
  from: (t: string) => {
    select: (cols: string) => {
      then: <T>(fn: (v: { data: unknown; error: unknown }) => T) => Promise<T>;
    };
  };
};

async function loadAll(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  schema: string,
  table: string,
  cols: string
): Promise<AnyRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (svc as any).schema(schema) as AnyClient;
  const res = await client.from(table).select(cols);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = res as any;
  if (error) {
    throw new Error(
      `[sync-status] ${schema}.${table} read failed: ${
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any)?.message ?? String(error)
      }`
    );
  }
  return (data as AnyRow[]) ?? [];
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 100;
  return Math.round((numerator / denominator) * 100);
}

// ─── Gap 1: yi.national_admins → yi_directory(app='future') ─────────────

export async function checkYiNationalAdminsDrift(): Promise<GapResult> {
  const svc = await createServiceClient();

  const nationalAdmins = await loadAll(
    svc,
    "yi",
    "national_admins",
    "email, is_super_admin, is_platform_admin, note"
  );

  const directoryPeople = await loadAll(
    svc,
    "yi_directory",
    "people",
    "id, email, full_name"
  );

  const directoryRoles = await loadAll(
    svc,
    "yi_directory",
    "role_assignments",
    "person_id, app, role, is_active"
  );

  // Build email → roles[] map for app='future', is_active=true
  const personById = new Map<string, AnyRow>();
  for (const p of directoryPeople) personById.set(String(p.id), p);

  const rolesByEmail = new Map<string, Set<string>>();
  for (const r of directoryRoles) {
    if (r.app !== "future" || r.is_active !== true) continue;
    const person = personById.get(String(r.person_id));
    const email = person?.email
      ? String(person.email).toLowerCase()
      : null;
    if (!email) continue;
    if (!rolesByEmail.has(email)) rolesByEmail.set(email, new Set());
    rolesByEmail.get(email)!.add(String(r.role));
  }

  const missing: DriftRow[] = [];
  const role_mismatch: DriftRow[] = [];
  const orphan: DriftRow[] = [];

  const legacyEmails = new Set<string>();
  let synced = 0;

  for (const na of nationalAdmins) {
    const email = na.email ? String(na.email).toLowerCase() : null;
    if (!email) continue;
    legacyEmails.add(email);
    const roles = rolesByEmail.get(email) ?? new Set<string>();
    const isSuper = na.is_super_admin === true;
    const isPlatform = na.is_platform_admin === true;

    const legacySummary = [
      isSuper ? "is_super_admin" : null,
      isPlatform ? "is_platform_admin" : null,
      !isSuper && !isPlatform ? "national_admin" : null,
    ]
      .filter(Boolean)
      .join(" + ");

    const dirSummary =
      roles.size === 0 ? "—" : Array.from(roles).sort().join(", ");

    if (roles.size === 0) {
      missing.push({
        kind: "MISSING",
        source_id: email,
        email,
        full_name: null,
        legacy_summary: legacySummary,
        directory_summary: "—",
        suggested_action:
          "INSERT into yi_directory.people + role_assignments(app='future')",
      });
      continue;
    }

    const wantSuper = isSuper && !roles.has("super_admin");
    const wantPlatform = isPlatform && !roles.has("platform_admin");

    if (wantSuper || wantPlatform) {
      const needed: string[] = [];
      if (wantSuper) needed.push("super_admin");
      if (wantPlatform) needed.push("platform_admin");
      role_mismatch.push({
        kind: "ROLE_MISMATCH",
        source_id: email,
        email,
        full_name: null,
        legacy_summary: legacySummary,
        directory_summary: dirSummary,
        suggested_action: `Add role(s) [${needed.join(", ")}] to existing role_assignments`,
      });
      continue;
    }

    synced += 1;
  }

  // Orphans: yi_directory rows with app='future' + role in (super_admin,
  // platform_admin, national_admin) whose email is NOT in legacy table.
  const nationalRoleSet = new Set([
    "super_admin",
    "platform_admin",
    "national_admin",
  ]);
  for (const r of directoryRoles) {
    if (r.app !== "future" || r.is_active !== true) continue;
    if (!nationalRoleSet.has(String(r.role))) continue;
    const person = personById.get(String(r.person_id));
    const email = person?.email
      ? String(person.email).toLowerCase()
      : null;
    if (!email) continue;
    if (legacyEmails.has(email)) continue;
    orphan.push({
      kind: "ORPHAN",
      source_id: String(person?.id ?? email),
      email,
      full_name: person?.full_name ? String(person.full_name) : null,
      legacy_summary: "—",
      directory_summary: `${String(r.role)} (future)`,
      suggested_action: "Deactivate orphan role_assignment in yi_directory",
    });
  }

  const legacy_total = nationalAdmins.length;
  const drift_count = missing.length + role_mismatch.length + orphan.length;
  return {
    gap: "yi_national_admins",
    legacy_total,
    synced_count: synced,
    drift_count,
    sync_pct: pct(synced, legacy_total),
    missing,
    role_mismatch,
    orphan,
  };
}

// ─── Gap 2: yip.organizers → yi_directory(app='yip') ────────────────────

export async function checkYipOrganizersDrift(): Promise<GapResult> {
  const svc = await createServiceClient();

  const organizers = await loadAll(
    svc,
    "yip",
    "organizers",
    "id, user_id, email, full_name, role, chapter_name, is_active"
  );

  const people = await loadAll(
    svc,
    "yi_directory",
    "people",
    "id, user_id, email, full_name"
  );

  const roles = await loadAll(
    svc,
    "yi_directory",
    "role_assignments",
    "person_id, app, role, is_active"
  );

  const personByUserId = new Map<string, AnyRow>();
  for (const p of people) {
    if (p.user_id) personByUserId.set(String(p.user_id), p);
  }

  // person_id → set of active yip roles
  const yipRolesByPerson = new Map<string, Set<string>>();
  for (const r of roles) {
    if (r.app !== "yip" || r.is_active !== true) continue;
    const pid = String(r.person_id);
    if (!yipRolesByPerson.has(pid)) yipRolesByPerson.set(pid, new Set());
    yipRolesByPerson.get(pid)!.add(String(r.role));
  }

  const missing: DriftRow[] = [];
  const role_mismatch: DriftRow[] = [];
  const orphan: DriftRow[] = [];

  const seenPersonIds = new Set<string>();
  let synced = 0;

  for (const o of organizers) {
    const userId = o.user_id ? String(o.user_id) : null;
    const oRole = o.role ? String(o.role) : null;
    const isActive = o.is_active === true;
    const label =
      `${oRole ?? "?"}` +
      (o.chapter_name ? ` @ ${String(o.chapter_name)}` : "") +
      (isActive ? "" : " [inactive]");

    if (!userId) {
      // Organizer has no auth user — cannot be matched. Flag as MISSING.
      if (isActive) {
        missing.push({
          kind: "MISSING",
          source_id: String(o.id),
          email: o.email ? String(o.email) : null,
          full_name: o.full_name ? String(o.full_name) : null,
          legacy_summary: `${label} (no user_id)`,
          directory_summary: "—",
          suggested_action:
            "Provision auth user, then INSERT into yi_directory.people + role_assignments(app='yip')",
        });
      } else {
        synced += 1; // inactive + no user_id → ignored as "synced" (no work needed)
      }
      continue;
    }

    const person = personByUserId.get(userId);
    if (!person) {
      missing.push({
        kind: "MISSING",
        source_id: String(o.id),
        email: o.email ? String(o.email) : null,
        full_name: o.full_name ? String(o.full_name) : null,
        legacy_summary: label,
        directory_summary: "—",
        suggested_action:
          "INSERT into yi_directory.people + role_assignments(app='yip')",
      });
      continue;
    }

    seenPersonIds.add(String(person.id));
    const yipRoles = yipRolesByPerson.get(String(person.id)) ?? new Set<string>();

    if (yipRoles.size === 0) {
      if (isActive) {
        missing.push({
          kind: "MISSING",
          source_id: String(o.id),
          email: o.email ? String(o.email) : null,
          full_name: o.full_name ? String(o.full_name) : null,
          legacy_summary: label,
          directory_summary: "—",
          suggested_action:
            "INSERT role_assignments(app='yip') for existing person",
        });
      } else {
        synced += 1;
      }
      continue;
    }

    // Role alignment: organizers.role must match SOME active app='yip' role.
    if (oRole && !yipRoles.has(oRole)) {
      role_mismatch.push({
        kind: "ROLE_MISMATCH",
        source_id: String(o.id),
        email: o.email ? String(o.email) : null,
        full_name: o.full_name ? String(o.full_name) : null,
        legacy_summary: label,
        directory_summary: Array.from(yipRoles).sort().join(", "),
        suggested_action: `Update role on existing assignment to '${oRole}'`,
      });
      continue;
    }

    if (!isActive) {
      // Legacy says inactive but directory has active role → drift.
      role_mismatch.push({
        kind: "ROLE_MISMATCH",
        source_id: String(o.id),
        email: o.email ? String(o.email) : null,
        full_name: o.full_name ? String(o.full_name) : null,
        legacy_summary: label,
        directory_summary: Array.from(yipRoles).sort().join(", "),
        suggested_action:
          "Deactivate role_assignment to match legacy inactive flag",
      });
      continue;
    }

    synced += 1;
  }

  // Orphans: yi_directory has app='yip' role for a person whose user_id is
  // NOT referenced by any active yip.organizers row.
  const orgUserIds = new Set<string>();
  for (const o of organizers) {
    if (o.is_active === true && o.user_id) orgUserIds.add(String(o.user_id));
  }
  for (const r of roles) {
    if (r.app !== "yip" || r.is_active !== true) continue;
    const pid = String(r.person_id);
    if (seenPersonIds.has(pid)) continue;
    const person = people.find((p) => String(p.id) === pid);
    const userId = person?.user_id ? String(person.user_id) : null;
    if (userId && orgUserIds.has(userId)) continue;
    orphan.push({
      kind: "ORPHAN",
      source_id: pid,
      email: person?.email ? String(person.email) : null,
      full_name: person?.full_name ? String(person.full_name) : null,
      legacy_summary: "—",
      directory_summary: `${String(r.role)} (yip)`,
      suggested_action: "Deactivate orphan role_assignment in yi_directory",
    });
  }

  const legacy_total = organizers.length;
  const drift_count = missing.length + role_mismatch.length + orphan.length;
  return {
    gap: "yip_organizers",
    legacy_total,
    synced_count: synced,
    drift_count,
    sync_pct: pct(synced, legacy_total),
    missing,
    role_mismatch,
    orphan,
  };
}

// ─── Gap 3: future.chapter_core_team → yi_directory(future/chapter_chair) ─

export async function checkChapterCoreTeamDrift(): Promise<GapResult> {
  const svc = await createServiceClient();

  const team = await loadAll(
    svc,
    "future",
    "chapter_core_team",
    "id, user_id, full_name, email, role, chapter_id, is_active"
  );

  const chapters = await loadAll(
    svc,
    "yi",
    "chapters",
    "id, name"
  );
  const chapterNameById = new Map<string, string>();
  for (const c of chapters) chapterNameById.set(String(c.id), String(c.name));

  const people = await loadAll(
    svc,
    "yi_directory",
    "people",
    "id, user_id, email, full_name"
  );

  const roles = await loadAll(
    svc,
    "yi_directory",
    "role_assignments",
    "person_id, app, role, yi_chapter, is_active"
  );

  const personByUserId = new Map<string, AnyRow>();
  for (const p of people) {
    if (p.user_id) personByUserId.set(String(p.user_id), p);
  }

  // person_id → list of chapter_chair role rows (yi_chapter, is_active)
  const chairRolesByPerson = new Map<
    string,
    Array<{ yi_chapter: string | null; is_active: boolean }>
  >();
  for (const r of roles) {
    if (r.app !== "future" || r.role !== "chapter_chair") continue;
    const pid = String(r.person_id);
    if (!chairRolesByPerson.has(pid)) chairRolesByPerson.set(pid, []);
    chairRolesByPerson.get(pid)!.push({
      yi_chapter: r.yi_chapter ? String(r.yi_chapter) : null,
      is_active: r.is_active === true,
    });
  }

  const missing: DriftRow[] = [];
  const role_mismatch: DriftRow[] = [];
  const orphan: DriftRow[] = [];

  const seenPersonIds = new Set<string>();
  let synced = 0;

  for (const t of team) {
    const userId = t.user_id ? String(t.user_id) : null;
    const isActive = t.is_active === true;
    const chapterName = t.chapter_id
      ? chapterNameById.get(String(t.chapter_id)) ?? null
      : null;
    const label = `${String(t.role ?? "?")}${
      chapterName ? ` @ ${chapterName}` : ""
    }${isActive ? "" : " [inactive]"}`;

    // Only chapter_chair is in scope per the spec.
    if (String(t.role) !== "chapter_chair") {
      // Non-chair core team rows are not expected in yi_directory — ignore.
      synced += 1;
      continue;
    }

    if (!userId) {
      if (isActive) {
        missing.push({
          kind: "MISSING",
          source_id: String(t.id),
          email: t.email ? String(t.email) : null,
          full_name: t.full_name ? String(t.full_name) : null,
          legacy_summary: `${label} (no user_id)`,
          directory_summary: "—",
          suggested_action:
            "Provision auth user, then INSERT into yi_directory + role_assignments(app='future', role='chapter_chair')",
        });
      } else {
        synced += 1;
      }
      continue;
    }

    const person = personByUserId.get(userId);
    if (!person) {
      missing.push({
        kind: "MISSING",
        source_id: String(t.id),
        email: t.email ? String(t.email) : null,
        full_name: t.full_name ? String(t.full_name) : null,
        legacy_summary: label,
        directory_summary: "—",
        suggested_action:
          "INSERT into yi_directory.people + role_assignments(app='future', role='chapter_chair')",
      });
      continue;
    }

    seenPersonIds.add(String(person.id));
    const chairs = chairRolesByPerson.get(String(person.id)) ?? [];

    if (chairs.length === 0) {
      if (isActive) {
        missing.push({
          kind: "MISSING",
          source_id: String(t.id),
          email: t.email ? String(t.email) : null,
          full_name: t.full_name ? String(t.full_name) : null,
          legacy_summary: label,
          directory_summary: "—",
          suggested_action:
            "INSERT role_assignments(app='future', role='chapter_chair') for existing person",
        });
      } else {
        synced += 1;
      }
      continue;
    }

    const matchedChair = chairs.find(
      (c) =>
        c.is_active === isActive &&
        (chapterName == null || c.yi_chapter === chapterName)
    );

    if (!matchedChair) {
      role_mismatch.push({
        kind: "ROLE_MISMATCH",
        source_id: String(t.id),
        email: t.email ? String(t.email) : null,
        full_name: t.full_name ? String(t.full_name) : null,
        legacy_summary: label,
        directory_summary: chairs
          .map(
            (c) =>
              `chapter_chair${c.yi_chapter ? ` @ ${c.yi_chapter}` : ""}${
                c.is_active ? "" : " [inactive]"
              }`
          )
          .join("; "),
        suggested_action: chapterName
          ? `Update yi_chapter / is_active on existing chapter_chair assignment to match '${chapterName}'`
          : "Align is_active flag on existing chapter_chair assignment",
      });
      continue;
    }

    synced += 1;
  }

  // Orphans: yi_directory has active chapter_chair but no matching team row
  // (by user_id).
  const teamUserIds = new Set<string>();
  for (const t of team) {
    if (
      t.is_active === true &&
      String(t.role) === "chapter_chair" &&
      t.user_id
    ) {
      teamUserIds.add(String(t.user_id));
    }
  }
  for (const r of roles) {
    if (r.app !== "future" || r.role !== "chapter_chair") continue;
    if (r.is_active !== true) continue;
    const pid = String(r.person_id);
    if (seenPersonIds.has(pid)) continue;
    const person = people.find((p) => String(p.id) === pid);
    const userId = person?.user_id ? String(person.user_id) : null;
    if (userId && teamUserIds.has(userId)) continue;
    orphan.push({
      kind: "ORPHAN",
      source_id: pid,
      email: person?.email ? String(person.email) : null,
      full_name: person?.full_name ? String(person.full_name) : null,
      legacy_summary: "—",
      directory_summary: `chapter_chair${
        r.yi_chapter ? ` @ ${String(r.yi_chapter)}` : ""
      }`,
      suggested_action: "Deactivate orphan chapter_chair in yi_directory",
    });
  }

  const legacy_total = team.length;
  const drift_count = missing.length + role_mismatch.length + orphan.length;
  return {
    gap: "future_chapter_core_team",
    legacy_total,
    synced_count: synced,
    drift_count,
    sync_pct: pct(synced, legacy_total),
    missing,
    role_mismatch,
    orphan,
  };
}
