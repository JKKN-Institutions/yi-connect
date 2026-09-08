/**
 * VERTICAL REGISTRY CHECK — the check that would have caught all three of the
 * 2026-08-24 YIQ misses, none of which failed loudly on their own.
 *
 *     npx tsx lib/yi/__tests__/verticals.check.ts
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script in the style of lib/yiq/__tests__/scoring.check.ts. It
 * exits non-zero on any failure, so it can be wired into CI as-is.
 *
 * ── HOW IT WORKS ────────────────────────────────────────────────────────
 * It reads the three hand-maintained lists AS TEXT with fs.readFileSync. It
 * does NOT import them: app/hub/page.tsx and app/super-admin/page.tsx are
 * React Server Components that cannot execute outside Next, and
 * role-write-guard.ts is `server-only`. Text is the only way to assert on all
 * three from one plain script, and it is enough — the bug in every case was a
 * missing entry in an array literal.
 *
 * For EVERY vertical in lib/yi/verticals.ts it asserts:
 *   1. `{app}_super_admin` is covered by lib/yi/auth/role-write-guard.ts
 *      (bug 1 — the fail-open privilege escalation)
 *   2. its route prefix has a tile in app/hub/page.tsx            (bug 2)
 *   3. its route prefix has a tile in app/super-admin/page.tsx    (bug 3)
 *
 * ── WHY IT CANNOT GO VACUOUSLY GREEN ────────────────────────────────────
 * A text check that stops finding anything passes silently, which is the same
 * failure mode it exists to prevent. So the EXTRACTION itself is asserted
 * first: if the guard's array or a page's tile shape is refactored so nothing
 * parses, the sanity block fails loudly before any per-vertical assertion runs.
 *
 * ── PRECISION ───────────────────────────────────────────────────────────
 * Matching is on exact tokens, never bare substrings. `/yi` must not match
 * `/yip`, `/yifi` or `/yi-future`; route prefixes are compared whole or at a
 * `/` segment boundary, and role names are compared against the set of quoted
 * string literals actually present in the file.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

import {
  VERTICALS,
  APP_KEYS,
  SUPER_TIER_ROLE_NAMES,
  CHAPTER_PARTITIONED_APPS,
  PLATFORM_SUPER_ROLE_NAMES,
  getVertical,
  isVerticalApp,
  verticalForPath,
  isSuperTierRole,
} from "../verticals";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  check(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`
  );
}

// ─── Locate the repo root (works from any cwd inside the repo) ───────────

const GUARD_REL = "lib/yi/auth/role-write-guard.ts";
const HUB_REL = "app/hub/page.tsx";
const SUPER_REL = "app/super-admin/page.tsx";

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, HUB_REL))) {
      return dir;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  console.error(
    `\nFATAL: could not find the repo root from ${process.cwd()} ` +
      `(looking for package.json + ${HUB_REL}).\n`
  );
  process.exit(2);
}

const ROOT = findRepoRoot();

function readSource(rel: string): string {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`\nFATAL: expected source file is missing: ${rel}\n`);
    process.exit(2);
  }
  return readFileSync(abs, "utf8");
}

// ─── Extraction (text, exact tokens) ─────────────────────────────────────

/** Every double-quoted string literal in a source file. */
function quotedLiterals(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/"([^"\\\n]*)"/g)) out.add(m[1]);
  return out;
}

/**
 * Entries of a named `const X = [ ... ]` array of string literals, or null if
 * the array is not found (so the caller can fail loudly rather than silently
 * treat "not found" as "empty").
 */
function arrayLiteralEntries(src: string, name: string): string[] | null {
  const re = new RegExp(`const\\s+${name}\\s*(?::[^=]*)?=\\s*\\[([\\s\\S]*?)\\]`);
  const m = src.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"\\\n]*)"/g)].map((x) => x[1]);
}

/**
 * Every `{app}_super_admin` role name the guard covers: names written out
 * literally, PLUS the names it builds from its `SUPER_TIER_APPS` array (the
 * guard derives them as `${a}_super_admin`, so a literal grep alone would find
 * none of them and report a false failure for every vertical).
 */
function guardedSuperRoles(src: string): {
  roles: Set<string>;
  apps: string[] | null;
} {
  const roles = new Set<string>();
  for (const lit of quotedLiterals(src)) {
    if (/^[a-z][a-z0-9_]*_super_admin$/.test(lit)) roles.add(lit);
  }
  const apps = arrayLiteralEntries(src, "SUPER_TIER_APPS");
  for (const a of apps ?? []) roles.add(`${a}_super_admin`);
  return { roles, apps };
}

/**
 * Tile destinations in a module-list page: the values of object-literal
 * `href: "..."` properties. Deliberately NOT JSX `href="..."` attributes —
 * app/hub/page.tsx links to `/yip/join` and `/yip/logos/...` outside its tile
 * list, and counting those would let the YIP tile be deleted while the check
 * still passed.
 */
function tileHrefs(src: string): string[] {
  return [...src.matchAll(/href:\s*"([^"\\\n]+)"/g)].map((m) => m[1]);
}

/** True if any tile links into `prefix` — whole match or at a `/` boundary. */
function hasTileFor(hrefs: readonly string[], prefix: string): boolean {
  return hrefs.some((h) => h === prefix || h.startsWith(`${prefix}/`));
}

const guardSrc = readSource(GUARD_REL);
const hubSrc = readSource(HUB_REL);
const superSrc = readSource(SUPER_REL);

const guardLits = quotedLiterals(guardSrc);
const { roles: guardRoles, apps: guardApps } = guardedSuperRoles(guardSrc);
const hubHrefs = tileHrefs(hubSrc);
const superHrefs = tileHrefs(superSrc);

// ─── 0. Sanity: the extraction still works ───────────────────────────────
// If a refactor changes the shape of any of these lists, FAIL HERE rather
// than let every assertion below pass on an empty set.

console.log("\n── extraction sanity (a check that cannot fail is worthless) ──");
check(
  `${GUARD_REL}: SUPER_TIER_APPS array parsed`,
  guardApps !== null && guardApps.length >= 4,
  guardApps === null
    ? "array literal not found — was it renamed or restructured?"
    : `only ${guardApps.length} entries`
);
check(
  `${GUARD_REL}: >=4 super-admin role names covered`,
  guardRoles.size >= 4,
  `found ${guardRoles.size}: ${[...guardRoles].join(", ")}`
);
check(
  `${HUB_REL}: >=4 tile hrefs parsed`,
  hubHrefs.length >= 4,
  `found ${hubHrefs.length}: ${hubHrefs.join(", ")}`
);
check(
  `${SUPER_REL}: >=4 tile hrefs parsed`,
  superHrefs.length >= 4,
  `found ${superHrefs.length}: ${superHrefs.join(", ")}`
);
check(
  "route-prefix matching is segment-precise, not substring",
  !hasTileFor(["/yip/dashboard", "/yifi/admin", "/yi-future"], "/yi") &&
    hasTileFor(["/yip/dashboard"], "/yip") &&
    !hasTileFor(["/yipsomething"], "/yip")
);

// ─── 1. Registry self-consistency ────────────────────────────────────────

console.log("\n── registry shape ──");
check("at least the five known verticals are registered", VERTICALS.length >= 5);
eq(
  "app keys are unique",
  new Set(APP_KEYS).size,
  APP_KEYS.length
);
eq(
  "route prefixes are unique",
  new Set(VERTICALS.map((v) => v.routePrefix)).size,
  VERTICALS.length
);
for (const v of VERTICALS) {
  check(
    `${v.app}: superAdminRole is exactly {app}_super_admin`,
    v.superAdminRole === `${v.app}_super_admin`,
    `got "${v.superAdminRole}"`
  );
  check(
    `${v.app}: routePrefix starts with "/" and has no trailing slash`,
    v.routePrefix.startsWith("/") && !v.routePrefix.endsWith("/"),
    `got "${v.routePrefix}"`
  );
  check(
    `${v.app}: adminHref lives under its own routePrefix`,
    v.adminHref === v.routePrefix || v.adminHref.startsWith(`${v.routePrefix}/`),
    `adminHref "${v.adminHref}" is outside "${v.routePrefix}"`
  );
}
// No prefix may swallow another, or verticalForPath becomes order-dependent.
for (const a of VERTICALS) {
  for (const b of VERTICALS) {
    if (a.app === b.app) continue;
    check(
      `${a.app} prefix does not swallow ${b.app}`,
      !b.routePrefix.startsWith(`${a.routePrefix}/`),
      `"${b.routePrefix}" sits under "${a.routePrefix}"`
    );
  }
}

// ─── 2. THE THREE CHECKS — one per bug, for EVERY vertical ───────────────

console.log("\n── bug 1: fail-open super-admin assignment (role-write-guard) ──");
for (const v of VERTICALS) {
  check(
    `${v.app}: "${v.superAdminRole}" is guarded in role-write-guard.ts`,
    guardRoles.has(v.superAdminRole),
    `MISSING: ${v.app} not guarded in role-write-guard.ts — ` +
      `add "${v.app}" to SUPER_TIER_APPS. Until then a ${v.superAdminRole} ` +
      `can mint a peer ${v.superAdminRole} (privilege escalation, fails silently).`
  );
  for (const legacy of v.legacySuperAdminRoles) {
    check(
      `${v.app}: legacy alias "${legacy}" is guarded too`,
      guardLits.has(legacy),
      `MISSING: "${legacy}" absent from role-write-guard.ts — a live gate ` +
        `accepts it as ${v.app} super tier, so it must be unassignable too.`
    );
  }
}

console.log("\n── bug 2: vertical invisible on /hub ──");
for (const v of VERTICALS) {
  check(
    `${v.app}: "${v.routePrefix}" has a tile in ${HUB_REL}`,
    hasTileFor(hubHrefs, v.routePrefix),
    `MISSING: ${v.app} has no tile in ${HUB_REL} — its staff sign in and ` +
      `see no way into their own app. Add it to MODULE_APPS.`
  );
}

console.log("\n── bug 3: vertical invisible to the platform super-admin ──");
for (const v of VERTICALS) {
  check(
    `${v.app}: "${v.routePrefix}" has a tile in ${SUPER_REL}`,
    hasTileFor(superHrefs, v.routePrefix),
    `MISSING: ${v.app} has no tile in ${SUPER_REL} — /hub redirects the ` +
      `platform super-admin here, so they cannot reach ${v.name} at all. ` +
      `Add it to MODULES.`
  );
}

// ─── 3. Derived sets stay in step with the registry ──────────────────────

console.log("\n── derived sets ──");
for (const v of VERTICALS) {
  check(
    `${v.app}: super tier set contains "${v.superAdminRole}"`,
    SUPER_TIER_ROLE_NAMES.has(v.superAdminRole)
  );
  for (const legacy of v.legacySuperAdminRoles) {
    check(
      `${v.app}: super tier set contains legacy "${legacy}"`,
      SUPER_TIER_ROLE_NAMES.has(legacy)
    );
  }
}
for (const p of PLATFORM_SUPER_ROLE_NAMES) {
  check(`super tier set contains platform role "${p}"`, isSuperTierRole(p));
}
check(
  "an operational role is NOT super tier",
  !isSuperTierRole("chapter_organizer") && !isSuperTierRole("regional_admin")
);
check(
  "yifi is deliberately NOT chapter-partitioned (national summit; " +
    "auto-granting chairs would expose founder data nationally)",
  !CHAPTER_PARTITIONED_APPS.has("yifi")
);
eq(
  "chapter-partitioned apps",
  [...CHAPTER_PARTITIONED_APPS].sort(),
  ["future", "yip", "yiq", "yuva"]
);
eq("APP_KEYS matches the registry", APP_KEYS.length, VERTICALS.length);

console.log("\n── lookups ──");
eq("getVertical('yiq') resolves", getVertical("yiq")?.name, "YIQ");
eq("getVertical is case/space tolerant", getVertical("  YIQ ")?.app, "yiq");
eq("getVertical('nope') is undefined", getVertical("nope"), undefined);
eq("getVertical('') is undefined", getVertical(""), undefined);
check("isVerticalApp('yifi')", isVerticalApp("yifi"));
check("isVerticalApp('varnam') is false (unregistered)", !isVerticalApp("varnam"));

// The /yifi vs /yi-future vs /yip confusion, asserted explicitly.
eq("verticalForPath('/yifi/admin')", verticalForPath("/yifi/admin")?.app, "yifi");
eq(
  "verticalForPath('/yi-future/national/admin')",
  verticalForPath("/yi-future/national/admin")?.app,
  "future"
);
eq("verticalForPath('/yip')", verticalForPath("/yip")?.app, "yip");
eq("verticalForPath('/yiq/dashboard')", verticalForPath("/yiq/dashboard")?.app, "yiq");
eq(
  "verticalForPath('/youth-academy/national')",
  verticalForPath("/youth-academy/national")?.app,
  "yuva"
);
eq("verticalForPath('/hub') is undefined", verticalForPath("/hub"), undefined);
eq("verticalForPath('/yi') is undefined", verticalForPath("/yi"), undefined);
eq(
  "verticalForPath('/yipsomething') is undefined (segment boundary)",
  verticalForPath("/yipsomething"),
  undefined
);
eq("verticalForPath('yip') without a slash is undefined", verticalForPath("yip"), undefined);

// Every registered vertical's own adminHref must resolve back to it.
for (const v of VERTICALS) {
  eq(`${v.app}: adminHref round-trips`, verticalForPath(v.adminHref)?.app, v.app);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
