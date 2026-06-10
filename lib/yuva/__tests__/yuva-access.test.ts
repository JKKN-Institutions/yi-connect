/**
 * Minimal self-test harness for the Yi Youth Academy capability resolver.
 * Run ad-hoc: npx tsx lib/yuva/__tests__/yuva-access.test.ts
 * (Donor pattern: lib/yi-future/__tests__/allocation.test.ts — plain
 * assertions, exit code 1 on any failure; no test runner in this repo.)
 *
 * Tests the PURE resolver resolveYuvaCaps(roles, coordinatorAcademyIds) —
 * zero I/O. The IO wrapper getYuvaAccess() is exercised in later phases via
 * real role rows; the authorization DECISION lives entirely in this resolver.
 */

import { resolveYuvaCaps } from "../auth/yuva-access";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function test(name: string, fn: () => void) {
  console.log(`\n▶ ${name}`);
  try {
    fn();
    console.log(`  PASS`);
  } catch (e) {
    console.error(`  FAIL: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

const ERODE = "Erode";
const SALEM = "Salem";

test("national (yuva_super_admin) sees all", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "yuva_super_admin", yi_chapter: null, is_active: true }],
    []
  );
  assert(caps.isNational, "isNational true");
  assert(
    caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "manages any academy"
  );
  assert(
    caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "manages run in any chapter"
  );
  assert(
    caps.canManageRun({ academy_id: "a2", chapter: SALEM }),
    "manages run in another chapter too"
  );
});

test("national (yuva_admin) sees all", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "yuva_admin", yi_chapter: null, is_active: true }],
    []
  );
  assert(caps.isNational, "yuva_admin is national tier");
  assert(
    caps.canManageRun({ academy_id: "a1", chapter: SALEM }),
    "manages any run"
  );
});

test("platform_super_admin (cross-app tier) is national", () => {
  const caps = resolveYuvaCaps(
    [
      {
        app: "directory",
        role: "platform_super_admin",
        yi_chapter: null,
        is_active: true,
      },
    ],
    []
  );
  assert(caps.isNational, "platform tier short-circuits to national");
  assert(
    caps.canManageAcademy({ id: "a9", chapter: SALEM }),
    "manages any academy"
  );
});

test("chapter_admin with NULL chapter ⇒ DENIED with explicit reason (fail closed)", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "chapter_admin", yi_chapter: null, is_active: true }],
    []
  );
  assert(caps.chapterAdminOf === null, "chapterAdminOf is null");
  assert(!caps.isNational, "not national");
  assert(
    !caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "cannot manage any run"
  );
  assert(
    !caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "cannot manage any academy"
  );
  assert(
    /null/i.test(caps.reason) && /chapter/i.test(caps.reason),
    `reason names the null chapter scope explicitly (got: "${caps.reason}")`
  );
});

test("chapter_admin manages own-chapter run, denied other chapter", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "chapter_admin", yi_chapter: ERODE, is_active: true }],
    []
  );
  assert(caps.chapterAdminOf === ERODE, "chapterAdminOf resolved");
  assert(
    caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "manages own-chapter run"
  );
  assert(
    !caps.canManageRun({ academy_id: "a2", chapter: SALEM }),
    "denied other-chapter run"
  );
  assert(
    !caps.canManageRun({ academy_id: "a1", chapter: null }),
    "run with null chapter denied (fail closed)"
  );
  assert(
    caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "manages own-chapter academy"
  );
  assert(
    !caps.canManageAcademy({ id: "a2", chapter: SALEM }),
    "denied other-chapter academy"
  );
  assert(
    !caps.canManageAcademy({ id: "a3", chapter: null }),
    "academy with null chapter denied (fail closed)"
  );
});

test("inactive chapter_admin role grants nothing", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "chapter_admin", yi_chapter: ERODE, is_active: false }],
    []
  );
  assert(caps.chapterAdminOf === null, "inactive role ignored");
  assert(
    !caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "no run management"
  );
});

test("coordinator manages only bound academy's runs", () => {
  const caps = resolveYuvaCaps(
    [
      {
        app: "yuva",
        role: "institution_coordinator",
        yi_chapter: ERODE,
        is_active: true,
      },
    ],
    ["a1"]
  );
  assert(
    caps.coordinatorAcademyIds.includes("a1"),
    "bound academy id present"
  );
  assert(
    caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "manages bound academy's run"
  );
  assert(
    !caps.canManageRun({ academy_id: "a2", chapter: ERODE }),
    "denied same-chapter run of a DIFFERENT academy"
  );
  assert(
    !caps.canManageRun({ academy_id: null, chapter: ERODE }),
    "run with null academy_id denied (fail closed)"
  );
  // Academy editing + mentor network are chapter/national-owned (spec: the
  // coordinator "cannot invite mentors to the chapter network"; academy CRUD
  // is national-only, chapter-level academy admin uses canManageAcademy).
  assert(
    !caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "coordinator does not manage the academy record itself"
  );
});

test("mentor manages nothing", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "mentor", yi_chapter: ERODE, is_active: true }],
    []
  );
  assert(caps.isMentor, "isMentor true");
  assert(!caps.isNational, "not national");
  assert(caps.chapterAdminOf === null, "no chapter-admin scope");
  assert(
    !caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "cannot manage runs"
  );
  assert(
    !caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "cannot manage academies"
  );
});

test("no active yuva roles ⇒ all denied with reason", () => {
  const caps = resolveYuvaCaps([], []);
  assert(!caps.isNational, "not national");
  assert(caps.chapterAdminOf === null, "no chapter scope");
  assert(!caps.isMentor, "not mentor");
  assert(
    !caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "cannot manage runs"
  );
  assert(caps.reason.length > 0, "reason is non-empty");
});

test("roles on OTHER apps do not leak into yuva", () => {
  const caps = resolveYuvaCaps(
    [
      { app: "yip", role: "chapter_admin", yi_chapter: ERODE, is_active: true },
      { app: "future", role: "mentor", yi_chapter: ERODE, is_active: true },
    ],
    []
  );
  assert(caps.chapterAdminOf === null, "yip chapter_admin does not leak");
  assert(!caps.isMentor, "future mentor does not leak");
  assert(
    !caps.canManageRun({ academy_id: "a1", chapter: ERODE }),
    "no management from foreign-app roles"
  );
});

console.log("\n═════════════════════════════════════");
console.log("Yuva Access Resolver Test Suite — Complete");
console.log("═════════════════════════════════════\n");
