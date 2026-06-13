/**
 * Desk-scope matching tests (tsx harness, same pattern as election-outcome).
 * Run: npx tsx lib/yip/__tests__/yuva-desk.test.ts
 */
import assert from "node:assert";
import { matchesDesk, deskScope, type DeskAssignment } from "../yuva-desk";

const A: DeskAssignment[] = [
  { party_id: "p1", committee_name: null },
  { party_id: null, committee_name: "Finance" },
];

// In-scope by party
assert.equal(matchesDesk({ party_id: "p1", committee_name: "Health" }, A), true);
// In-scope by committee
assert.equal(matchesDesk({ party_id: "p9", committee_name: "Finance" }, A), true);
// Out of scope on both
assert.equal(matchesDesk({ party_id: "p9", committee_name: "Health" }, A), false);
// No assignments -> nothing in scope (fail closed)
assert.equal(matchesDesk({ party_id: "p1", committee_name: "Finance" }, []), false);
// Null target fields never match a real desk
assert.equal(matchesDesk({ party_id: null, committee_name: null }, A), false);
// Empty-string committee must NOT match a null/blank assignment
assert.equal(matchesDesk({ party_id: null, committee_name: "" }, A), false);
// Whitespace committee is treated as blank
assert.equal(matchesDesk({ party_id: null, committee_name: "  " }, A), false);
// Committee match is trim-tolerant on the assignment side
assert.equal(
  matchesDesk({ party_id: null, committee_name: "Finance" }, [
    { party_id: null, committee_name: " Finance " },
  ]),
  true
);

// deskScope returns the distinct party ids + committee names for querying
const s = deskScope(A);
assert.deepEqual(s.partyIds.sort(), ["p1"]);
assert.deepEqual(s.committeeNames.sort(), ["Finance"]);

// Blank committee assignments are dropped from scope
const s2 = deskScope([{ party_id: null, committee_name: "  " }]);
assert.deepEqual(s2.committeeNames, []);

console.log("yuva-desk: all assertions passed");
