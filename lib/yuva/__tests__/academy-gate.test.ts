/**
 * Academy RECORD mutation gate — TDD contract test (Phase 5).
 * Run ad-hoc: npx tsx lib/yuva/__tests__/academy-gate.test.ts
 * (Donor pattern: lib/yuva/__tests__/yuva-access.test.ts — plain assertions,
 * exit code 1 on any failure; no test runner in this repo.)
 *
 * THE CONTRACT THIS PINS (spec docs/yi-youth-academy-spec.md, "National —
 * academies"): the academy RECORD (create / edit / logo / activate-deactivate)
 * is mutable by NATIONAL ONLY. A chapter_admin — even of the academy's own
 * chapter — and an institution_coordinator can NEVER mutate the record.
 * `canManageAcademy` being true for an own-chapter admin grants the
 * chapter-level surface (assignCoordinator, qualitative notes) — it is NOT
 * the record-mutation predicate. The record predicate is `isNational`,
 * enforced in app/youth-academy/actions/academies.ts by calling
 * `requireYuvaNational()` first in every record-mutation action.
 *
 * Two layers:
 *   A. PURE decision — resolveYuvaCaps: chapter/coordinator caps are never
 *      national, so a requireYuvaNational-gated action can never admit them.
 *   B. SOURCE contract — the actions file wires requireYuvaNational() into
 *      exactly the record-mutation functions (and NOT into the chapter-owned
 *      ones, which must stay on getYuvaAccess().canManageAcademy). This is
 *      what goes RED before the actions are gated and GREEN after.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// ─── A. Pure decision: who may mutate the academy RECORD ────────────────

test("national (yuva_super_admin) IS the record-mutation tier", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "yuva_super_admin", yi_chapter: null, is_active: true }],
    []
  );
  assert(caps.isNational, "isNational true — record mutations admitted");
});

test("national (yuva_admin) IS the record-mutation tier", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "yuva_admin", yi_chapter: null, is_active: true }],
    []
  );
  assert(caps.isNational, "yuva_admin is national tier");
});

test("platform_super_admin IS the record-mutation tier", () => {
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
});

test("chapter_admin of the academy's OWN chapter can NEVER mutate the record", () => {
  const caps = resolveYuvaCaps(
    [{ app: "yuva", role: "chapter_admin", yi_chapter: ERODE, is_active: true }],
    []
  );
  assert(!caps.isNational, "chapter_admin is NOT national");
  // Pin the distinction: canManageAcademy=true is the CHAPTER surface
  // (coordinator assignment + notes), not record mutation. A gate that used
  // canManageAcademy for create/edit/logo/activate would wrongly admit this
  // caps object — the record gate must be requireYuvaNational (isNational).
  assert(
    caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "canManageAcademy true for own chapter (chapter surface only)"
  );
  assert(
    !caps.isNational,
    "…but record mutations (create/edit/logo/activate) stay denied: not national"
  );
});

test("institution_coordinator can NEVER mutate the record", () => {
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
  assert(!caps.isNational, "coordinator is NOT national");
  assert(
    !caps.canManageAcademy({ id: "a1", chapter: ERODE }),
    "coordinator does not even hold the chapter academy surface"
  );
});

test("no roles ⇒ denied (fail closed)", () => {
  const caps = resolveYuvaCaps([], []);
  assert(!caps.isNational, "anonymous/roleless is NOT national");
});

// ─── B. Source contract: the actions file wires the gates correctly ─────

const ACTIONS_PATH = join(
  __dirname,
  "../../../app/youth-academy/actions/academies.ts"
);

/**
 * Slice the body of one exported async function out of the source — ends at
 * the NEXT top-level function declaration of any kind so non-exported
 * helpers between functions are not attributed to the wrong body.
 */
function functionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  if (start === -1) return "";
  const nextDecl = /\n(?:export )?(?:async )?function /g;
  nextDecl.lastIndex = start + 1;
  const m = nextDecl.exec(src);
  return m ? src.slice(start, m.index) : src.slice(start);
}

const RECORD_MUTATIONS = [
  "createAcademy",
  "updateAcademy",
  "uploadAcademyLogo",
  "setAcademyActive",
] as const;

const CHAPTER_OWNED = [
  "assignCoordinator",
  "removeCoordinator",
  "updateQualitativeNotes",
] as const;

test("actions/academies.ts exists and imports requireYuvaNational", () => {
  const src = readFileSync(ACTIONS_PATH, "utf8");
  assert(src.length > 0, "actions/academies.ts readable");
  assert(
    /import\s*\{[^}]*requireYuvaNational[^}]*\}\s*from\s*["']@\/lib\/yuva\/auth\/require-national["']/.test(
      src
    ),
    "imports requireYuvaNational from lib/yuva/auth/require-national"
  );
});

test("every record-mutation action calls requireYuvaNational()", () => {
  const src = readFileSync(ACTIONS_PATH, "utf8");
  for (const fn of RECORD_MUTATIONS) {
    const body = functionBody(src, fn);
    assert(body.length > 0, `${fn} is exported`);
    assert(
      body.includes("requireYuvaNational("),
      `${fn} gates with requireYuvaNational()`
    );
    assert(
      !body.includes("canManageAcademy(") &&
        !body.includes("gateChapterSurface("),
      `${fn} does NOT use the weaker chapter-surface predicate`
    );
  }
});

test("chapter-owned actions gate via getYuvaAccess().canManageAcademy — NOT national-only", () => {
  const src = readFileSync(ACTIONS_PATH, "utf8");
  // The chapter gate may be inlined or factored into a shared helper
  // (gateChapterSurface) — either way the decision must be
  // getYuvaAccess().canManageAcademy, never requireYuvaNational.
  const helperStart = src.indexOf("function gateChapterSurface");
  const helperEnd =
    helperStart === -1 ? -1 : src.indexOf("export async function", helperStart);
  const helper =
    helperStart === -1
      ? ""
      : src.slice(helperStart, helperEnd === -1 ? undefined : helperEnd);
  const helperIsChapterGate =
    helper.includes("getYuvaAccess(") && helper.includes("canManageAcademy(");
  for (const fn of CHAPTER_OWNED) {
    const body = functionBody(src, fn);
    assert(body.length > 0, `${fn} is exported`);
    const inlineGate =
      body.includes("getYuvaAccess(") && body.includes("canManageAcademy(");
    const viaHelper =
      body.includes("gateChapterSurface(") && helperIsChapterGate;
    assert(
      inlineGate || viaHelper,
      `${fn} gates with getYuvaAccess().canManageAcademy`
    );
    assert(
      !body.includes("requireYuvaNational("),
      `${fn} must NOT be national-only (chapter admins are the spec's assigners)`
    );
  }
});

console.log("\n═════════════════════════════════════");
console.log("Academy Record-Gate Test Suite — Complete");
console.log("═════════════════════════════════════\n");
