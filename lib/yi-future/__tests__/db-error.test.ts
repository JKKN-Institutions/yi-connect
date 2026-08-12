/**
 * The guarantee: no raw database text reaches a student.
 *
 * These are real messages Postgres/PostgREST produce on the delegate-facing
 * paths in app/yi-future/actions/*.ts — the strings that were being returned
 * verbatim before safeError() was put in front of them.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { safeError } from "../db-error";
import { looksLikeDatabaseText } from "../invite-options";

// Real driver output, not invented examples.
const RAW_DATABASE_TEXT = [
  'duplicate key value violates unique constraint "uniq_delegate_per_edition"',
  'insert or update on table "team_members" violates foreign key constraint "team_members_team_id_fkey"',
  'new row for relation "teams" violates check constraint "teams_team_name_check"',
  "null value in column \"delegate_id\" of relation \"team_members\" violates not-null constraint",
  "permission denied for table team_invitations",
  'JWT expired',
  'new row violates row-level security policy for table "submissions"',
];

test("no raw database text survives safeError", () => {
  for (const raw of RAW_DATABASE_TEXT) {
    const out = safeError(raw, "test");
    assert.notEqual(out, raw, `passed through unchanged: ${raw}`);
    assert.ok(
      !looksLikeDatabaseText(out),
      `still database-shaped after translation: ${raw} -> ${out}`
    );
    assert.ok(out.length > 0, "produced an empty message");
  }
});

test("a sentence written for a student passes through untouched", () => {
  // The actions' own hand-written messages must not be mangled.
  const human = [
    "This invite has expired — invites are valid for 7 days.",
    "Invite not found.",
    "Team no longer exists.",
  ];
  for (const s of human) {
    assert.equal(safeError(s, "test"), s, `rewrote a human sentence: ${s}`);
  }
});

test("an empty or missing message still produces something actionable", () => {
  for (const empty of ["", "   ", null, undefined]) {
    const out = safeError(empty, "test");
    assert.ok(out.length > 0, "empty input produced an empty message");
    assert.ok(!looksLikeDatabaseText(out), "empty input produced database text");
  }
});
