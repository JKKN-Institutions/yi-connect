/**
 * YIQ role-grant checks.
 *
 * This repo has NO test runner installed (no vitest, no jest), so this is a
 * standalone script rather than a spec file:
 *
 *     npx tsx lib/yiq/__tests__/roles.check.ts
 *
 * Exits non-zero on any failure, so it can be wired into CI as-is.
 *
 * WHY THESE RULES ARE WORTH A TEST: every assertion below is the difference
 * between "this person can run their chapter's quiz" and "this person can run
 * EVERY chapter's quiz". A scoped role written with a blank scope is the
 * classic fail-open — the row looks granted to a human and matches nothing in
 * the gate, or worse, a future gate written with `scope && target !== scope`
 * would skip the check entirely and hand over the whole platform.
 */
import {
  YIQ_ROLES,
  YIQ_ROLE_ORDER,
  YIQ_ZONE_CODES,
  isYiqRoleValue,
  isYiZoneCode,
  yiqRoleDef,
  yiqRoleLabel,
  roleNeedsChapter,
  roleNeedsZone,
  validateRoleGrant,
  normalizeRoleGrant,
  yiqAssignmentTitle,
  groupYiqTeam,
  type YiqTeamMember,
} from "../roles";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
}
function eq(name: string, a: unknown, b: unknown) {
  check(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`
  );
}
/** Asserts a grant is REJECTED and the message is actually shown to a human. */
function rejects(name: string, err: string | null) {
  check(
    name,
    typeof err === "string" && err.trim().length > 0,
    `got ${JSON.stringify(err)} — expected a non-empty error string`
  );
}

console.log("\n── catalogue ──");
eq("four roles, no more", YIQ_ROLE_ORDER.length, 4);
eq(
  "the four the live gates read",
  [...YIQ_ROLE_ORDER].sort(),
  ["chapter_admin", "chapter_organizer", "regional_admin", "yiq_super_admin"]
);
check(
  "every role declares a scope kind",
  YIQ_ROLES.every((r) => ["national", "zone", "chapter"].includes(r.scope))
);
check(
  "every role says what it CANNOT do",
  YIQ_ROLES.every((r) => r.cannot.length > 0 && r.can.length > 0)
);
eq("scope kinds", YIQ_ROLES.map((r) => `${r.value}:${r.scope}`), [
  "yiq_super_admin:national",
  "regional_admin:zone",
  "chapter_admin:chapter",
  "chapter_organizer:chapter",
]);
eq("six Yi zones", [...YIQ_ZONE_CODES].sort(), [
  "ER",
  "NER",
  "NR",
  "SRTKKA",
  "SRTN",
  "WR",
]);
eq("roleNeedsChapter", YIQ_ROLE_ORDER.filter(roleNeedsChapter), [
  "chapter_admin",
  "chapter_organizer",
]);
eq("roleNeedsZone", YIQ_ROLE_ORDER.filter(roleNeedsZone), ["regional_admin"]);
eq("unknown role needs no scope (and is not a role)", roleNeedsChapter("captain"), false);

console.log("\n── unknown roles are rejected ──");
rejects("a role nobody defined", validateRoleGrant({ role: "quizmaster", chapter: "Erode" }));
rejects("a YIP role does not work here", validateRoleGrant({ role: "chapter_em", chapter: "Erode" }));
rejects("a directory chair role is not grantable as a YIQ role", validateRoleGrant({ role: "chapter_chair", chapter: "Erode" }));
rejects("empty role", validateRoleGrant({ role: "", chapter: "Erode" }));
rejects("whitespace role", validateRoleGrant({ role: "   ", chapter: "Erode" }));
rejects("null role", validateRoleGrant({ role: null, chapter: "Erode" }));
rejects("undefined role", validateRoleGrant({ role: undefined, chapter: "Erode" }));
check("isYiqRoleValue rejects a near-miss", !isYiqRoleValue("chapter_organiser"));
check("isYiqRoleValue accepts the real spelling", isYiqRoleValue("chapter_organizer"));
check("isYiqRoleValue rejects a non-string", !isYiqRoleValue(7));
eq("unknown role still renders readably", yiqRoleLabel("quizmaster"), "quizmaster");
eq("no role at all renders as a dash", yiqRoleLabel(null), "—");
eq("yiqRoleDef on an unknown role is null", yiqRoleDef("quizmaster"), null);

console.log("\n── chapter roles: a blank chapter is REJECTED, never 'all' ──");
for (const role of ["chapter_admin", "chapter_organizer"]) {
  rejects(`${role} + missing chapter`, validateRoleGrant({ role }));
  rejects(`${role} + null chapter`, validateRoleGrant({ role, chapter: null }));
  rejects(`${role} + undefined chapter`, validateRoleGrant({ role, chapter: undefined }));
  rejects(`${role} + empty chapter`, validateRoleGrant({ role, chapter: "" }));
  rejects(`${role} + whitespace chapter`, validateRoleGrant({ role, chapter: "   " }));
  rejects(`${role} + tab/newline chapter`, validateRoleGrant({ role, chapter: "\t\n " }));
  rejects(`${role} + one-character chapter`, validateRoleGrant({ role, chapter: "-" }));
  eq(`${role} + a real chapter is accepted`, validateRoleGrant({ role, chapter: "Erode" }), null);
  eq(
    `${role} + chapter with padding is accepted and trimmed`,
    normalizeRoleGrant({ role, chapter: "  Erode  " })?.chapter,
    "Erode"
  );
}
check(
  "a rejected chapter grant normalizes to null — nothing partial reaches the DB",
  normalizeRoleGrant({ role: "chapter_organizer", chapter: "  " }) === null
);
rejects(
  "chapter role carrying a bogus zone",
  validateRoleGrant({ role: "chapter_admin", chapter: "Erode", zone: "SOUTH" })
);
eq(
  "chapter role may carry its real zone as metadata",
  validateRoleGrant({ role: "chapter_admin", chapter: "Erode", zone: "SRTN" }),
  null
);
eq(
  "  and that zone is kept",
  normalizeRoleGrant({ role: "chapter_admin", chapter: "Erode", zone: "srtn" }),
  { role: "chapter_admin", chapter: "Erode", zone: "SRTN" }
);

console.log("\n── zone roles: a blank zone is REJECTED, never 'all' ──");
rejects("regional_admin + missing zone", validateRoleGrant({ role: "regional_admin" }));
rejects("regional_admin + null zone", validateRoleGrant({ role: "regional_admin", zone: null }));
rejects("regional_admin + empty zone", validateRoleGrant({ role: "regional_admin", zone: "" }));
rejects("regional_admin + whitespace zone", validateRoleGrant({ role: "regional_admin", zone: "  " }));
rejects("regional_admin + invented zone", validateRoleGrant({ role: "regional_admin", zone: "SR" }));
rejects(
  "regional_admin given a CHAPTER instead of a zone",
  validateRoleGrant({ role: "regional_admin", chapter: "Erode" })
);
eq("regional_admin + real zone", validateRoleGrant({ role: "regional_admin", zone: "SRTN" }), null);
eq(
  "zone matching is case-insensitive and normalizes to the canonical code",
  normalizeRoleGrant({ role: "regional_admin", zone: " srtn " }),
  { role: "regional_admin", chapter: null, zone: "SRTN" }
);
eq(
  "a chapter passed to a zone role is dropped, not written",
  normalizeRoleGrant({ role: "regional_admin", zone: "ER", chapter: "Erode" })?.chapter,
  null
);
check("isYiZoneCode rejects blank", !isYiZoneCode("   "));
check("isYiZoneCode rejects null", !isYiZoneCode(null));
check("isYiZoneCode accepts lowercase", isYiZoneCode("er"));

console.log("\n── national role needs no scope ──");
eq("yiq_super_admin with nothing else", validateRoleGrant({ role: "yiq_super_admin" }), null);
eq(
  "yiq_super_admin with null scopes",
  validateRoleGrant({ role: "yiq_super_admin", chapter: null, zone: null }),
  null
);
eq(
  "a stray chapter on a national role is DROPPED, not stored as a narrowing",
  normalizeRoleGrant({ role: "yiq_super_admin", chapter: "Erode", zone: "SRTN" }),
  { role: "yiq_super_admin", chapter: null, zone: null }
);

console.log("\n── assignment titles ──");
eq(
  "national",
  yiqAssignmentTitle({ role: "yiq_super_admin", chapter: null, zone: null }),
  "YIQ National admin"
);
eq(
  "zone",
  yiqAssignmentTitle({ role: "regional_admin", chapter: null, zone: "SRTN" }),
  "YIQ Regional admin — SRTN"
);
eq(
  "chapter beats zone in the title",
  yiqAssignmentTitle({ role: "chapter_organizer", chapter: "Erode", zone: "SRTN" }),
  "YIQ Chapter organiser — Erode"
);

console.log("\n── team grouping ──");
const mk = (
  role: YiqTeamMember["role"],
  fullName: string,
  chapter: string | null,
  source: YiqTeamMember["source"] = "granted"
): YiqTeamMember => ({
  assignmentId: source === "granted" ? `a-${fullName}` : null,
  personId: `p-${fullName}`,
  fullName,
  email: `${fullName.toLowerCase()}@example.org`,
  role,
  chapter,
  zone: null,
  yiYear: 2026,
  source,
  hasLogin: true,
});

const grouped = groupYiqTeam([
  mk("chapter_organizer", "Zoya", "Salem"),
  mk("yiq_super_admin", "Asha", null),
  mk("chapter_admin", "Bala", "Erode", "derived_chapter_chair"),
  mk("chapter_organizer", "Arun", "Erode"),
]);
eq("groups follow catalogue order, empty groups dropped", grouped.map((g) => g.role), [
  "yiq_super_admin",
  "chapter_admin",
  "chapter_organizer",
]);
eq(
  "members sort by scope then name",
  grouped[2].members.map((m) => m.fullName),
  ["Arun", "Zoya"]
);
eq("a derived chair has no assignment to revoke", grouped[1].members[0].assignmentId, null);
eq("empty team groups to nothing", groupYiqTeam([]).length, 0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
