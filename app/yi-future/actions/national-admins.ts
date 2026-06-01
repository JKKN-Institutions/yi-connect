"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";

// ═══════════════════════════════════════════════════════════════════════
// National admins — allow-list management for /national/admin/*
//
// Two tiers (see migration 132):
//   • super_admin = can mutate the allow-list, reset other admins'
//     passwords. Today: director@jkkn.ac.in (seeded).
//   • non-super national admin = read-only on /national/admin/admins.
//
// All write paths in this file MUST call requireSuperAdmin() first.
// requireSuperAdmin() is exported so the page can decide which buttons
// to render (it calls the same helper that gates the actions).
//
// Last-super-admin guard
// ──────────────────────
// removeNationalAdmin() and toggleSuperAdmin(..., false) both refuse
// the operation if the target is the LAST remaining super admin. The
// guard is computed inside the server action AFTER requireSuperAdmin()
// passes, so it is race-safe at the application layer (two concurrent
// super-admin removals from two browser tabs would both see the same
// count, but the SECOND write would still leave at least one super
// admin because the FIRST writer already committed by then — at worst
// you get a no-op error, never zero supers). Belt-and-braces would be
// a SQL CHECK, but that requires a subquery on every UPDATE, which we
// deemed too costly for a table this hot in the middleware path.
// ═══════════════════════════════════════════════════════════════════════

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type ResetPasswordResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

export type NationalAdminRow = {
  email: string;
  is_super_admin: boolean;
  is_platform_admin: boolean;
  added_at: string;
  added_by: string | null;
  note: string | null;
  last_sign_in_at: string | null;
};

// Same alphabet as scripts/seed_chapter_chairs.py — excludes 0 O o I l 1 2 Z B 8
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXY" + "abcdefghijkmnpqrstuvwxy" + "3456789";
const PASSWORD_LENGTH = 12;

function generatePassword(): string {
  // crypto.getRandomValues is available in Node 19+ (and Next runs on it).
  const bytes = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET.charAt(bytes[i] % PASSWORD_ALPHABET.length);
  }
  return out;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ─── Guards ─────────────────────────────────────────────────────────

/**
 * Returns the signed-in user's email if and only if they are a super
 * admin. Otherwise redirects: unauthenticated → /login, authenticated
 * but not super → /national/admin?error=not_super_admin.
 *
 * Exported so the page server component can use the same predicate as
 * the action layer (single source of truth for "am I super?").
 */
export async function requireSuperAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");

  const email = normalizeEmail(user.email);
  const svc = await createServiceClient();
  const { data, error } = await svc
    .schema("yi")
    .from("national_admins")
    // Cast selection list as never to bypass generated-type narrowing —
    // is_super_admin is added by migration 132, but types may not yet
    // be regenerated when this file first compiles.
    .select("email, is_super_admin" as never)
    .eq("email", email)
    .maybeSingle<{ email: string; is_super_admin: boolean }>();

  if (error || !data || !data.is_super_admin) {
    redirect("/yi-future/national/admin?error=not_super_admin");
  }
  return email;
}

/**
 * Non-redirecting probe: returns whether the signed-in user is a super
 * admin. The page uses this to decide which buttons to render WITHOUT
 * forcing a redirect for non-super viewers (who are still allowed to
 * see the read-only list).
 */
export async function isCurrentUserSuperAdmin(): Promise<{
  email: string | null;
  isSuper: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { email: null, isSuper: false };

  const email = normalizeEmail(user.email);
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("national_admins")
    .select("is_super_admin" as never)
    .eq("email", email)
    .maybeSingle<{ is_super_admin: boolean }>();
  return { email, isSuper: Boolean(data?.is_super_admin) };
}

/**
 * Internal: returns true iff `email` has an active yi_directory
 * role_assignment for app='future' with role in
 * (super_admin, platform_admin, national_admin).
 *
 * Two-step lookup because yi_directory.role_assignments keys on
 * person_id, not email: (1) resolve people.id by email, (2) probe
 * role_assignments for the required role. Service client is used so
 * cross-schema reads bypass RLS.
 *
 * Casts via `unknown` mirror the existing pattern in chapter-chairs.ts
 * — the generated Database type for yi-future pins schema='future', so
 * yi_directory tables aren't in the typed surface area. Re-generating
 * types with `supabase gen types --schema yi_directory` would remove
 * the casts.
 *
 * Source-of-truth migration (2026-05-28): replaces the previous
 * yi.national_admins.is_platform_admin flag check. yi.national_admins
 * is kept for back-compat reads from un-migrated paths.
 */
async function hasYiFuturePlatformRole(email: string): Promise<boolean> {
  const svc = await createServiceClient();
  const svcDir = (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    };
  }).schema("yi_directory");

  const { data: person } = await svcDir
    .from("people")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!person) return false;

  const svcDirRoles = (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: boolean) => {
                in: (
                  k: string,
                  v: string[]
                ) => Promise<{ data: Array<{ role: string }> | null }>;
              };
            };
          };
        };
      };
    };
  }).schema("yi_directory");

  const { data: rows } = await svcDirRoles
    .from("role_assignments")
    .select("role")
    .eq("person_id", person.id)
    .eq("app", "future")
    .eq("is_active", true)
    // Accept BOTH the new app-scoped names (future_super_admin / future_admin,
    // migrated 2026-06-01) AND the legacy names during the transition window,
    // so admins are never locked out between the data migration and code deploy.
    .in("role", [
      "future_super_admin",
      "future_admin",
      "super_admin",
      "platform_admin",
      "national_admin",
    ]);

  return (rows ?? []).length > 0;
}

/**
 * Returns the signed-in user's email if and only if they are a platform
 * admin. Otherwise redirects: unauthenticated → /login, authenticated
 * but not platform → /national/admin?error=not_platform_admin.
 *
 * Gates structural-config mutations (editions/tracks/problems/rubrics).
 * Source of truth: yi_directory.role_assignments (app='future', role in
 * super_admin/platform_admin/national_admin, is_active=true). Replaces
 * the legacy yi.national_admins.is_platform_admin check (2026-05-28).
 */
export async function requirePlatformAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");

  const email = normalizeEmail(user.email);
  const allowed = await hasYiFuturePlatformRole(email);
  if (!allowed) {
    redirect("/yi-future/national/admin?error=not_platform_admin");
  }
  return email;
}

/**
 * Non-redirecting probe: returns whether the signed-in user is a
 * platform admin. The structural-config pages use this to decide which
 * buttons to render WITHOUT forcing a redirect for non-platform viewers
 * (who are still allowed to see the read-only data).
 */
export async function isCurrentUserPlatformAdmin(): Promise<{
  email: string | null;
  isPlatform: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { email: null, isPlatform: false };

  const email = normalizeEmail(user.email);
  // Source-of-truth migration (2026-05-28): use the same yi_directory
  // predicate as requirePlatformAdmin so UI button visibility never
  // diverges from gate behavior.
  const isPlatform = await hasYiFuturePlatformRole(email);
  return { email, isPlatform };
}

// ─── Reads ──────────────────────────────────────────────────────────

/**
 * List all rows in yi.national_admins, joined with auth.users to grab
 * each admin's last_sign_in_at (via the admin REST API; no SQL JOIN
 * across schemas needed). Returns rows sorted: super admins first,
 * then by added_at desc.
 */
export async function listNationalAdmins(): Promise<NationalAdminRow[]> {
  const svc = await createServiceClient();
  const { data: rows, error } = await svc
    .schema("yi")
    .from("national_admins")
    .select(
      "email, is_super_admin, is_platform_admin, added_at, added_by, note" as never
    )
    .returns<
      {
        email: string;
        is_super_admin: boolean;
        is_platform_admin: boolean;
        added_at: string;
        added_by: string | null;
        note: string | null;
      }[]
    >();
  if (error || !rows) return [];

  // Fetch users via the admin REST API. At our scale (≤ ~50 national
  // admins) one page is more than enough; we don't paginate.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const lastSignInByEmail = new Map<string, string | null>();
  try {
    const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as {
        users?: { email?: string; last_sign_in_at?: string | null }[];
      };
      for (const u of body.users ?? []) {
        if (u.email) {
          lastSignInByEmail.set(
            normalizeEmail(u.email),
            u.last_sign_in_at ?? null
          );
        }
      }
    }
  } catch {
    // If the REST call fails, we still return the table rows — just
    // without last_sign_in_at. The page can render a "—" in that cell.
  }

  const enriched: NationalAdminRow[] = rows.map((r) => ({
    email: r.email,
    is_super_admin: Boolean(r.is_super_admin),
    is_platform_admin: Boolean(r.is_platform_admin),
    added_at: r.added_at,
    added_by: r.added_by,
    note: r.note,
    last_sign_in_at: lastSignInByEmail.get(normalizeEmail(r.email)) ?? null,
  }));

  enriched.sort((a, b) => {
    if (a.is_super_admin !== b.is_super_admin) {
      return a.is_super_admin ? -1 : 1;
    }
    return (b.added_at ?? "").localeCompare(a.added_at ?? "");
  });
  return enriched;
}

async function countSuperAdmins(): Promise<number> {
  const svc = await createServiceClient();
  const { count } = await svc
    .schema("yi")
    .from("national_admins")
    .select("email", { count: "exact", head: true })
    // The generated types may not include is_super_admin until after the
    // human regenerates types post-migration-132. Cast guards the build.
    .eq("is_super_admin" as never, true as never);
  return count ?? 0;
}

async function countPlatformAdmins(): Promise<number> {
  const svc = await createServiceClient();
  const { count } = await svc
    .schema("yi")
    .from("national_admins")
    .select("email", { count: "exact", head: true })
    // Same casting reason as countSuperAdmins — column is added by
    // migration 134 and may pre-date type regeneration.
    .eq("is_platform_admin" as never, true as never);
  return count ?? 0;
}

// ─── Writes ─────────────────────────────────────────────────────────

export async function addNationalAdmin(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const rawEmail = String(formData.get("email") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const email = normalizeEmail(rawEmail);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("national_admins")
    .insert({
      email,
      added_by: user?.id ?? null,
      note,
    });

  if (error) {
    if (error.code === "23505" || /duplicate/i.test(error.message)) {
      return { ok: false, error: `${email} is already an admin.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/national/admin/admins");
  return { ok: true, message: `Added ${email}.` };
}

export async function removeNationalAdmin(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { ok: false, error: "Missing email." };

  // Load the target row to learn whether it's a super or platform admin.
  const svc = await createServiceClient();
  const { data: target } = await svc
    .schema("yi")
    .from("national_admins")
    .select("email, is_super_admin, is_platform_admin" as never)
    .eq("email", email)
    .maybeSingle<{
      email: string;
      is_super_admin: boolean;
      is_platform_admin: boolean;
    }>();
  if (!target) return { ok: false, error: `${email} is not an admin.` };

  if (target.is_super_admin) {
    const supers = await countSuperAdmins();
    if (supers <= 1) {
      return {
        ok: false,
        error:
          "Cannot remove the last super admin. Promote another admin first.",
      };
    }
  }

  if (target.is_platform_admin) {
    const platforms = await countPlatformAdmins();
    if (platforms <= 1) {
      return {
        ok: false,
        error:
          "Cannot remove the last platform admin. Promote another admin first.",
      };
    }
  }

  const { error } = await svc
    .schema("yi")
    .from("national_admins")
    .delete()
    .eq("email", email);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/admins");
  return { ok: true, message: `Removed ${email}.` };
}

export async function toggleSuperAdmin(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const next = String(formData.get("next") ?? "") === "true";
  if (!email) return { ok: false, error: "Missing email." };

  // Demoting? Guard against removing the last super admin.
  if (!next) {
    const supers = await countSuperAdmins();
    if (supers <= 1) {
      return {
        ok: false,
        error:
          "Cannot demote the last super admin. Promote another admin first.",
      };
    }
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("national_admins")
    // Cast for the same reason as countSuperAdmins() above.
    .update({ is_super_admin: next } as never)
    .eq("email", email);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/admins");
  return {
    ok: true,
    message: next ? `Promoted ${email} to super admin.` : `Demoted ${email}.`,
  };
}

/**
 * Promote/demote a national admin to/from platform-admin tier.
 *
 * Gated by requirePlatformAdmin() — only an existing platform admin can
 * manage the platform-admin allow-list. This deliberately mirrors how
 * toggleSuperAdmin requires super-admin: each tier is responsible for
 * curating itself.
 *
 * Last-platform-admin guard: demotion refuses when there is exactly one
 * platform admin remaining (which is also the only path by which a
 * platform admin could "lock themselves out" of structural config).
 */
export async function togglePlatformAdmin(
  formData: FormData
): Promise<ActionResult> {
  await requirePlatformAdmin();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const next = String(formData.get("next") ?? "") === "true";
  if (!email) return { ok: false, error: "Missing email." };

  // Demoting? Guard against removing the last platform admin.
  if (!next) {
    const platforms = await countPlatformAdmins();
    if (platforms <= 1) {
      return {
        ok: false,
        error:
          "Cannot demote the last platform admin. Promote another admin first.",
      };
    }
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("yi")
    .from("national_admins")
    // Cast for the same reason as countPlatformAdmins() above.
    .update({ is_platform_admin: next } as never)
    .eq("email", email);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/national/admin/admins");
  return {
    ok: true,
    message: next
      ? `Promoted ${email} to platform admin.`
      : `Demoted ${email} from platform admin.`,
  };
}

/**
 * Reset another national admin's password to a freshly generated value.
 *
 * Returns the new password to the caller for ONE-SHOT display in the
 * UI. We never log it. The page-side reveal hides it after 30s.
 *
 * Implementation note: we look up the target user via the admin REST
 * API (search by email), then PATCH /auth/v1/admin/users/:id with the
 * new password. This mirrors what scripts/seed_chapter_chairs.py does
 * for the bulk chair seed.
 */
export async function resetNationalAdminPassword(
  formData: FormData
): Promise<ResetPasswordResult> {
  // Reset is open to BOTH super and platform admins, per design:
  // platform admins are on-call operators who handle "I forgot my
  // password" requests; super admin is just one option, not the only.
  // We try super first (no-op no-throw via a try) and fall back to
  // platform — either passing satisfies the guard.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");
  const viewerEmail = normalizeEmail(user.email);
  const svcGuard = await createServiceClient();
  const { data: viewerRow } = await svcGuard
    .schema("yi")
    .from("national_admins")
    .select("is_super_admin, is_platform_admin" as never)
    .eq("email", viewerEmail)
    .maybeSingle<{ is_super_admin: boolean; is_platform_admin: boolean }>();
  if (!viewerRow || (!viewerRow.is_super_admin && !viewerRow.is_platform_admin)) {
    redirect("/yi-future/national/admin?error=not_super_or_platform_admin");
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { ok: false, error: "Missing email." };

  // Confirm the target is actually a national admin (don't let this
  // turn into a generic password-reset endpoint for arbitrary users).
  const svc = await createServiceClient();
  const { data: target } = await svc
    .schema("yi")
    .from("national_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (!target) return { ok: false, error: `${email} is not a national admin.` };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  // 1. Look up the auth user id by email.
  const findRes = await fetch(
    `${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`,
    { headers, cache: "no-store" }
  );
  if (!findRes.ok) {
    return {
      ok: false,
      error: `Failed to look up ${email} in auth.users (HTTP ${findRes.status}).`,
    };
  }
  const findBody = (await findRes.json()) as {
    users?: { id: string; email?: string }[];
  };
  const userRow = (findBody.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === email
  );
  if (!userRow) {
    return {
      ok: false,
      error: `${email} is on the allow-list but has no auth.users row. Have them sign in once first, or create the user via the admin console.`,
    };
  }

  // 2. Generate + apply the new password.
  const newPassword = generatePassword();
  const patchRes = await fetch(`${url}/auth/v1/admin/users/${userRow.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password: newPassword, email_confirm: true }),
    cache: "no-store",
  });
  if (!patchRes.ok) {
    const txt = await patchRes.text();
    return {
      ok: false,
      error: `Failed to update password (HTTP ${patchRes.status}): ${txt.slice(0, 200)}`,
    };
  }

  revalidatePath("/national/admin/admins");
  return { ok: true, email, password: newPassword };
}
