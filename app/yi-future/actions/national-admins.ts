"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import {
  ROLE_ALLOWLIST_OWNER,
  ROLE_PLAIN_ADMIN,
  ROLE_PLATFORM_OPERATOR,
  countFutureRoleHolders,
  deactivateFutureAdminRoles,
  hasCrossAppOwnerRole,
  hasFutureBroadAdminRole,
  hasFuturePlatformTier,
  isFutureAllowlistOwner,
  isFuturePlatformOperator,
  listFutureAdmins,
  setFutureRoleActive,
} from "@/lib/yi-future/auth/admin-source";

// SOURCE OF TRUTH (2026-08-11): every read and every write in this file
// resolves to yi_directory.role_assignments via admin-source.ts above.
// yi.national_admins is no longer consulted for ANY authorization decision
// in Yi-Future. See lib/yi-future/auth/admin-source.ts for why, and for the
// role vocabulary (allowlist_owner / platform_admin / future_admin).
//
// "Remove" now REVOKES. It used to delete a yi.national_admins row while the
// target kept every yi_directory-derived capability — the button lied. It now
// deactivates every app='future' admin role, and refuses outright for
// cross-app platform owners rather than half-revoking them.

// ═══════════════════════════════════════════════════════════════════════
// National admins — allow-list management for /national/admin/*
//
// Two tiers (yi_directory, app='future'):
//   • role='allowlist_owner' ("Super admin" badge) = can mutate the
//     allow-list, reset other admins' passwords. Today: director@jkkn.ac.in.
//   • any other admin role = read-only on /national/admin/admins.
//
// All write paths in this file MUST call requireSuperAdmin() first.
// requireSuperAdmin() is exported so the page can decide which buttons
// to render (it calls the same helper that gates the actions).
//
// Last-super-admin guard
// ──────────────────────
// removeNationalAdmin() and toggleSuperAdmin(..., false) both refuse
// the operation if the target is the LAST remaining allow-list owner. The
// guard is computed inside the server action AFTER requireSuperAdmin()
// passes, so it is race-safe at the application layer (two concurrent
// removals from two browser tabs would both see the same count, but the
// SECOND write would still leave at least one owner because the FIRST
// writer already committed by then — at worst you get a no-op error,
// never zero owners). Belt-and-braces would be a SQL CHECK, but that
// requires a subquery on every UPDATE of a table this hot.
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
  // Source: yi_directory app='future' role='allowlist_owner'. Fail closed —
  // unknown email, no directory person, or no active role all deny.
  if (!(await isFutureAllowlistOwner(email))) {
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
  return { email, isSuper: await isFutureAllowlistOwner(email) };
}

// ─── Role-tier predicates (yi_directory source of truth) ────────────
//
// SECURITY (2026-06-01): a single predicate used to gate BOTH the broad
// VIEW surface AND the privileged WRITE actions. That accepted the
// regular admin tier (future_admin / national_admin) for privileged
// writes — a privilege escalation: a regular national admin could
// promote/demote platform admins, reset other admins' passwords, and
// broadcast. We now split into TWO predicates with different strictness.
//
// Two-step lookup (resolve people.id by email, then probe
// role_assignments) — kept because it is the known-good path used since
// the 2026-05-28 source-of-truth migration. The four hand-written
// `as unknown as {...}` builder casts that used to live here (and a fifth
// copy in push.ts) are now ONE structural accessor in
// lib/yi-future/auth/admin-source.ts. The role sets moved with them,
// byte-identical — membership is unchanged.

/**
 * STRICT platform/super tier. Returns true iff `email` resolves to a
 * yi_directory person who holds EITHER:
 *   (a) a cross-app platform-owner role on ANY app — role in
 *       (platform_super_admin, super_admin), is_active — which short-
 *       circuits every per-app gate (e.g. director@jkkn.ac.in holds
 *       platform_super_admin on app='platform', NOT 'future'); OR
 *   (b) an active app='future' role in the platform/super set:
 *       (future_super_admin, platform_super_admin, super_admin,
 *       platform_admin).
 *
 * DELIBERATELY EXCLUDES the regular admin tier (future_admin,
 * national_admin) — those may VIEW but never perform privileged writes.
 *
 * Gates: requirePlatformAdmin, isCurrentUserPlatformAdmin (button
 * visibility), and push.ts#isSuperOrPlatform — all three now call the SAME
 * implementation (admin-source.ts#hasFuturePlatformTier), so there is no
 * longer a duplicated role set to keep in sync.
 */

/**
 * BROAD "any future admin" tier. Returns true iff `email` resolves to a
 * yi_directory person who holds EITHER the strict platform tier (via the
 * cross-app short-circuit, so platform owners always pass) OR an active
 * app='future' role in the FULL admin set, INCLUDING the regular tier:
 *   (future_super_admin, future_admin, super_admin, platform_admin,
 *   national_admin).
 *
 * Used ONLY for the VIEW gate (national/admin/layout.tsx) so a regular
 * national admin (e.g. vedant@wrs.energy = future_admin) keeps read
 * access to /national/admin. MUST NOT gate any privileged write.
 * Implemented by admin-source.ts#hasFutureBroadAdminRole.
 */

/**
 * Non-redirecting probe: returns whether the signed-in user is ANY
 * future admin (BROAD tier, regular tier included). Drives the VIEW gate
 * in national/admin/layout.tsx so a regular national admin keeps read
 * access to /national/admin.
 *
 * MUST NOT be used to gate privileged writes — use
 * requirePlatformAdmin / isCurrentUserPlatformAdmin (STRICT) for those.
 */
export async function isCurrentUserFutureAdmin(): Promise<{
  email: string | null;
  isAdmin: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { email: null, isAdmin: false };

  const email = normalizeEmail(user.email);
  const isAdmin = await hasFutureBroadAdminRole(email);
  return { email, isAdmin };
}

/**
 * Returns the signed-in user's email if and only if they are in the
 * STRICT platform/super tier. Otherwise redirects: unauthenticated →
 * /login, authenticated but not platform → /national/admin?error=not_platform_admin.
 *
 * Gates the privileged write actions (togglePlatformAdmin, the promote
 * action, structural-config mutations). STRICT: accepts only
 * future_super_admin / platform_super_admin / super_admin /
 * platform_admin on app='future', plus the cross-app platform-owner
 * short-circuit. EXCLUDES the regular tier (future_admin / national_admin)
 * — closing the 2026-06-01 privilege-escalation finding.
 */
export async function requirePlatformAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");

  const email = normalizeEmail(user.email);
  const allowed = await hasFuturePlatformTier(email);
  if (!allowed) {
    redirect("/yi-future/national/admin?error=not_platform_admin");
  }
  return email;
}

/**
 * Non-redirecting probe: returns whether the signed-in user is in the
 * STRICT platform/super tier. Drives button visibility on the Admins
 * page (Promote/Demote-platform, Reset-password) and the structural-
 * config pages (editions/tracks/problems). Uses the same predicate as
 * requirePlatformAdmin so UI visibility never diverges from gate
 * behavior. Regular admins (future_admin / national_admin) get isPlatform
 * = false and therefore see the read-only surface only.
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
  const isPlatform = await hasFuturePlatformTier(email);
  return { email, isPlatform };
}

// ─── Reads ──────────────────────────────────────────────────────────

/**
 * Everyone holding ANY Yi-Future admin capability, joined with auth.users
 * to grab each admin's last_sign_in_at (via the admin REST API). Returns
 * rows sorted: allow-list owners first, then by added_at desc.
 *
 * SOURCE (2026-08-11): yi_directory, not yi.national_admins. The page shape
 * (NationalAdminRow) is unchanged, so the page renders identically — but two
 * accounts that held real power while being invisible on this screen
 * (yiqa.futuresuper@jkkn.ac.in, yiqa.futureadmin@jkkn.ac.in) now appear and
 * can be removed. Listing anything narrower than what the gates read is how
 * invisible power happens.
 *
 * `note` is now the person's active roles rather than a free-text seed note,
 * because the roles ARE the grant. `added_by` is null — yi_directory does
 * not record it and the page does not render it.
 */
export async function listNationalAdmins(): Promise<NationalAdminRow[]> {
  const rows = await listFutureAdmins();
  if (rows.length === 0) return [];

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
    // If the REST call fails, we still return the rows — just without
    // last_sign_in_at. The page renders a "—" in that cell.
  }

  const enriched: NationalAdminRow[] = rows.map((r) => ({
    email: r.email,
    is_super_admin: r.isAllowlistOwner,
    is_platform_admin: r.isPlatformOperator,
    added_at: r.addedAt ?? "",
    added_by: null,
    note: r.title ?? (r.roles.join(", ") || null),
    last_sign_in_at: lastSignInByEmail.get(r.email) ?? null,
  }));

  enriched.sort((a, b) => {
    if (a.is_super_admin !== b.is_super_admin) {
      return a.is_super_admin ? -1 : 1;
    }
    return (b.added_at ?? "").localeCompare(a.added_at ?? "");
  });
  return enriched;
}

/** Distinct people holding an active app='future' allowlist_owner role. */
async function countSuperAdmins(): Promise<number> {
  return countFutureRoleHolders(ROLE_ALLOWLIST_OWNER);
}

/** Distinct people holding an active app='future' platform_admin role. */
async function countPlatformAdmins(): Promise<number> {
  return countFutureRoleHolders(ROLE_PLATFORM_OPERATOR);
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

  // Already listed? Say so rather than silently re-activating, which is
  // what the old duplicate-key branch communicated.
  if (await hasFutureBroadAdminRole(email)) {
    return { ok: false, error: `${email} is already an admin.` };
  }

  // Grants the plain view-only tier. Promote to platform/super afterwards
  // with the row buttons — same two-step as before.
  const result = await setFutureRoleActive(email, ROLE_PLAIN_ADMIN, true, note);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/yi-future/national/admin/admins");
  return { ok: true, message: `Added ${email}.` };
}

export async function removeNationalAdmin(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { ok: false, error: "Missing email." };

  // Load the target row to learn whether it's a super or platform admin.
  if (!(await hasFutureBroadAdminRole(email))) {
    return { ok: false, error: `${email} is not an admin.` };
  }

  if (await isFutureAllowlistOwner(email)) {
    const supers = await countSuperAdmins();
    if (supers <= 1) {
      return {
        ok: false,
        error:
          "Cannot remove the last super admin. Promote another admin first.",
      };
    }
  }

  if (await isFuturePlatformOperator(email)) {
    const platforms = await countPlatformAdmins();
    if (platforms <= 1) {
      return {
        ok: false,
        error:
          "Cannot remove the last platform admin. Promote another admin first.",
      };
    }
  }

  // Cross-app platform owners cannot be removed from here. Deactivating
  // their app='future' roles would leave the cross-app short-circuit intact
  // (they would still pass every Yi-Future tier gate) while the page showed
  // them as removed — precisely the lying-button behaviour this change
  // exists to end. Refuse EXPLICITLY instead of half-revoking.
  if (await hasCrossAppOwnerRole(email)) {
    return {
      ok: false,
      error: `${email} holds a cross-app platform-owner role. Remove that in the directory admin (/admin/directory) — removing it here would not revoke their access.`,
    };
  }

  // Genuine revoke: every app='future' admin role goes is_active = false.
  const result = await deactivateFutureAdminRoles(email);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/yi-future/national/admin/admins");
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

  const result = await setFutureRoleActive(email, ROLE_ALLOWLIST_OWNER, next);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/yi-future/national/admin/admins");
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

  const result = await setFutureRoleActive(email, ROLE_PLATFORM_OPERATOR, next);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/yi-future/national/admin/admins");
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
  const [viewerIsOwner, viewerIsPlatform] = await Promise.all([
    isFutureAllowlistOwner(viewerEmail),
    isFuturePlatformOperator(viewerEmail),
  ]);
  if (!viewerIsOwner && !viewerIsPlatform) {
    redirect("/yi-future/national/admin?error=not_super_or_platform_admin");
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { ok: false, error: "Missing email." };

  // Confirm the target is actually a national admin (don't let this
  // turn into a generic password-reset endpoint for arbitrary users).
  if (!(await hasFutureBroadAdminRole(email))) {
    return { ok: false, error: `${email} is not a national admin.` };
  }

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

  revalidatePath("/yi-future/national/admin/admins");
  return { ok: true, email, password: newPassword };
}
