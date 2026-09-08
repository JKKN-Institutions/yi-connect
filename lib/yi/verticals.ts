/**
 * THE VERTICAL REGISTRY — one place that knows every Yi vertical.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * yi-connect hosts several verticals in one Next.js app, and several files
 * enumerate them by hand. On 2026-08-24, YIQ shipped and was missed by THREE
 * of those hardcoded lists on the same day. None of them failed loudly:
 *
 *   1. lib/yi/auth/role-write-guard.ts — `SUPER_TIER_APPS` listed six apps and
 *      omitted `yiq`, so `yiq_super_admin` slipped past the "only a platform
 *      super-admin may assign a super-admin role" check. A FAIL-OPEN privilege
 *      escalation: a YIQ super could mint a peer YIQ super. Nothing errored,
 *      nothing logged — the check simply did not fire.
 *   2. app/hub/page.tsx — `MODULE_APPS` had no YIQ tile, so YIQ staff signing
 *      in saw no way into their own app.
 *   3. app/super-admin/page.tsx — its own separate module list had no YIQ tile,
 *      so the platform super-admin, who /hub redirects there, could not reach
 *      YIQ at all.
 *
 * Each was found by a human noticing. This registry plus
 * lib/yi/__tests__/verticals.check.ts turns "a human notices" into "a script
 * fails". Add ONE entry here and every derived set below updates; the check
 * then tells you which hand-written lists still need the new vertical.
 *
 * PURE — no I/O, no `server-only`, no React/Next imports. It is read both by
 * server gates and by a plain `npx tsx` script that runs outside Next.
 *
 * ── WHAT IS AND IS NOT REGISTERED ───────────────────────────────────────
 * Registered: the five verticals that have a live hub tile and/or a live
 * per-app super tier — yip, future, yifi, yuva, yiq.
 *
 * DELIBERATELY NOT REGISTERED (report, do not silently adopt):
 *   • `varnam` (Varnam Vizha, app/varnam-vizha, lib/varnam/auth/access.ts)
 *     stores roles in yi_directory with app='varnam' and has its own
 *     `varnam_super_admin`. It is NOT in role-write-guard's SUPER_TIER_APPS
 *     today, which means `varnam_super_admin` is fail-open in exactly the way
 *     `yiq` was — but whether Varnam Vizha is a VERTICAL or a one-off festival
 *     is a product decision, and registering it here would silently create a
 *     hub tile and a super-admin tile for it. Flagged for the Director rather
 *     than decided here.
 *   • `thalir` / `masoom` appear in role-write-guard's SUPER_TIER_APPS and in
 *     the directory app picker, but ship no routes and no gates. The guard
 *     being a SUPERSET of this registry is safe (it only ever denies more);
 *     the guard being a SUBSET is the bug. The check asserts one direction
 *     only: every registered vertical must be covered by the guard.
 */

export type YiVerticalApp = "yip" | "future" | "yifi" | "yuva" | "yiq";

export type YiVertical = {
  /**
   * The `app` value stored in `yi_directory.role_assignments.app`. This — not
   * the route, not the display name — is the identity of a vertical.
   */
  readonly app: YiVerticalApp;
  /** Display name, as shown on the /hub tile. */
  readonly name: string;
  /**
   * URL prefix every page of this vertical lives under. Note it does NOT
   * always match `app`: app='future' routes at /yi-future, app='yuva' routes
   * at /youth-academy.
   */
  readonly routePrefix: string;
  /**
   * Canonical per-app super-admin role name. Always `${app}_super_admin` —
   * asserted by the check, so a typo here cannot ship.
   */
  readonly superAdminRole: string;
  /**
   * Older role names the LIVE gates still honour as this app's super tier
   * during the rename window. Mirrors `LEGACY_APP_SUPER_ROLES` in
   * lib/yi/auth/role-write-guard.ts + lib/yi/auth/yi-directory-roles.ts, plus
   * `yiq_national` which lib/yiq/auth/require-super-admin.ts and
   * lib/yiq/auth/event-access.ts accept. These are just as dangerous to assign
   * as the canonical name, so they belong in the super tier too.
   */
  readonly legacySuperAdminRoles: readonly string[];
  /**
   * True when the vertical is partitioned per Yi chapter, i.e. a chapter-wide
   * chair legitimately administers this vertical for THEIR chapter.
   *
   * `yifi` is deliberately FALSE (Director, 2026-06-14): YiFi is a single
   * national summit with no per-chapter slice, so auto-granting a chapter
   * chair would expose every founder's data nationally. A chair still reaches
   * YiFi by holding an explicit `yifi` role. This flag is the reason
   * app/hub/page.tsx's CHAIR_DEFAULT_APPS excludes yifi.
   */
  readonly chapterPartitioned: boolean;
  /**
   * Where a person holding a role in this vertical enters it. These are the
   * hrefs the /hub tiles use; each self-routes by the person's tier.
   * app/super-admin/page.tsx deep-links some verticals straight to their
   * national console instead (e.g. /yi-future/national/admin), which is why
   * the check matches on `routePrefix` and not on this exact string.
   */
  readonly adminHref: string;
};

/**
 * THE LIST. Adding a vertical to yi-connect means adding it HERE FIRST, then
 * running `npx tsx lib/yi/__tests__/verticals.check.ts` to find every
 * hand-written list that still needs it.
 */
export const VERTICALS = [
  {
    app: "yip",
    name: "Yi Parliament (YIP)",
    routePrefix: "/yip",
    superAdminRole: "yip_super_admin",
    // Pre-rename YIP national admins are still recognised as the super tier.
    legacySuperAdminRoles: ["national"],
    chapterPartitioned: true,
    adminHref: "/yip/dashboard",
  },
  {
    app: "future",
    name: "Yi Future",
    routePrefix: "/yi-future",
    superAdminRole: "future_super_admin",
    legacySuperAdminRoles: ["national_admin", "platform_admin"],
    chapterPartitioned: true,
    adminHref: "/yi-future",
  },
  {
    app: "yifi",
    name: "YiFi",
    routePrefix: "/yifi",
    superAdminRole: "yifi_super_admin",
    legacySuperAdminRoles: [],
    // NOT chapter-partitioned — see the field docs above. Changing this to
    // true silently hands every chapter chair national founder data.
    chapterPartitioned: false,
    adminHref: "/yifi/admin",
  },
  {
    app: "yuva",
    name: "Youth Academy",
    routePrefix: "/youth-academy",
    superAdminRole: "yuva_super_admin",
    legacySuperAdminRoles: [],
    chapterPartitioned: true,
    adminHref: "/youth-academy",
  },
  {
    app: "yiq",
    name: "YIQ",
    routePrefix: "/yiq",
    superAdminRole: "yiq_super_admin",
    // lib/yiq/auth/require-super-admin.ts + event-access.ts both honour this.
    legacySuperAdminRoles: ["yiq_national"],
    chapterPartitioned: true,
    adminHref: "/yiq/dashboard",
  },
] as const satisfies readonly YiVertical[];

/**
 * Platform-tier role names — cross-app, above every vertical. NOT derived from
 * VERTICALS because they belong to no vertical. Mirrors PLATFORM_SUPER_ROLES
 * in lib/yi/auth/role-write-guard.ts and lib/yi/auth/yi-directory-roles.ts
 * (`super_admin` is the legacy name accepted during the rename window).
 */
export const PLATFORM_SUPER_ROLE_NAMES: readonly string[] = [
  "platform_super_admin",
  "super_admin",
];

// ─── Derived sets. Add a VERTICALS entry, these follow. ──────────────────

/** Every registered `app` key, in registry order. */
export const APP_KEYS: readonly YiVerticalApp[] = VERTICALS.map((v) => v.app);

/**
 * Every role name that ONLY a platform super-admin may assign: each vertical's
 * `{app}_super_admin` plus its legacy aliases, plus the platform tier itself.
 * This is the set lib/yi/auth/role-write-guard.ts builds by hand today; a
 * vertical missing from it FAILS OPEN.
 */
export const SUPER_TIER_ROLE_NAMES: ReadonlySet<string> = new Set<string>([
  ...PLATFORM_SUPER_ROLE_NAMES,
  ...VERTICALS.flatMap((v) => [v.superAdminRole, ...v.legacySuperAdminRoles]),
]);

/**
 * Apps a chapter-wide chair administers for their own chapter by default.
 * Mirrors CHAIR_DEFAULT_APPS in app/hub/page.tsx. Excludes yifi by design.
 */
export const CHAPTER_PARTITIONED_APPS: ReadonlySet<YiVerticalApp> = new Set(
  VERTICALS.filter((v) => v.chapterPartitioned).map((v) => v.app)
);

const BY_APP = new Map<string, YiVertical>(VERTICALS.map((v) => [v.app, v]));

// ─── Lookups ─────────────────────────────────────────────────────────────

/** The vertical for an `app` key, or undefined. Never throws. */
export function getVertical(app: string): YiVertical | undefined {
  return BY_APP.get((app ?? "").trim().toLowerCase());
}

/** True if `app` is a registered vertical. */
export function isVerticalApp(app: string): app is YiVerticalApp {
  return BY_APP.has((app ?? "").trim().toLowerCase());
}

/**
 * The vertical a pathname belongs to, matched on a SEGMENT boundary so `/yip`
 * never matches `/yipsomething` and `/yi` matches nothing at all. Returns
 * undefined for paths outside every vertical (e.g. /hub, /dashboard).
 */
export function verticalForPath(pathname: string): YiVertical | undefined {
  const path = (pathname ?? "").trim();
  if (!path.startsWith("/")) return undefined;
  return VERTICALS.find(
    (v) => path === v.routePrefix || path.startsWith(`${v.routePrefix}/`)
  );
}

/**
 * True if `role` may be assigned ONLY by a platform super-admin. Fail-closed on
 * blank input: an unknown role is not silently treated as safe by callers that
 * negate this — callers must still deny unknown roles on their own terms.
 */
export function isSuperTierRole(role: string): boolean {
  return SUPER_TIER_ROLE_NAMES.has((role ?? "").trim());
}
