/**
 * Minimal self-test harness for the Yi Youth Academy student session cookie.
 * Run ad-hoc: npx tsx lib/yuva/__tests__/student-session.test.ts
 * (Donor pattern: lib/yi-future/__tests__/allocation.test.ts.)
 *
 * Tests the PURE sign/verify pair (secret injected via parameter — no env,
 * no cookies()). The cookie-jar wrappers mintStudentSession /
 * getStudentSession / clearStudentSession are thin shells over these.
 *
 * Contract under test (shared-middleware compatible):
 *   value = base64url(JSON payload) + "." + base64url(HMAC-SHA256(json))
 *   payload = { type: "student", personId, exp } ONLY — the `type` field is
 *   what lib/supabase/middleware.ts parseSessionCookie() checks.
 */

import { createHmac } from "node:crypto";
import {
  signStudentSessionValue,
  verifyStudentSessionValue,
  type StudentSessionPayload,
} from "../auth/student-session";

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

const SECRET = "test-secret-0123456789abcdef";

function freshPayload(overrides?: Partial<StudentSessionPayload>) {
  return {
    type: "student" as const,
    personId: "person-123",
    exp: Date.now() + 60_000,
    ...overrides,
  };
}

test("sign → verify roundtrip", () => {
  const payload = freshPayload();
  const value = signStudentSessionValue(payload, SECRET);
  const out = verifyStudentSessionValue(value, SECRET);
  assert(out !== null, "verify returns a payload");
  assert(out!.type === "student", "type is student");
  assert(out!.personId === "person-123", "personId survives roundtrip");
  assert(out!.exp === payload.exp, "exp survives roundtrip");
});

test("middleware shape: payload left of '.' is base64url JSON with type=student", () => {
  const value = signStudentSessionValue(freshPayload(), SECRET);
  const dot = value.indexOf(".");
  assert(dot > 0, "value contains a '.' separator");
  const json = Buffer.from(value.slice(0, dot), "base64url").toString("utf8");
  const parsed = JSON.parse(json) as Record<string, unknown>;
  assert(parsed.type === "student", "middleware-visible type field present");
  assert(
    Object.keys(parsed).sort().join(",") === "exp,personId,type",
    "payload carries { personId, exp, type } ONLY (no enrollment data)"
  );
});

test("tampered payload rejected (fail closed)", () => {
  const value = signStudentSessionValue(freshPayload(), SECRET);
  const dot = value.indexOf(".");
  const sig = value.slice(dot + 1);
  // Swap personId in the payload half, keep the original signature.
  const forgedJson = JSON.stringify(freshPayload({ personId: "attacker-999" }));
  const forged =
    Buffer.from(forgedJson, "utf8").toString("base64url") + "." + sig;
  assert(
    verifyStudentSessionValue(forged, SECRET) === null,
    "modified payload with stale signature is rejected"
  );
});

test("valid signature but wrong type rejected (fail closed)", () => {
  // A correctly-signed cookie whose payload claims a different role must not
  // mint a student session (cross-vertical / cross-role replay guard).
  const json = JSON.stringify({
    type: "jury",
    personId: "person-123",
    exp: Date.now() + 60_000,
  });
  const sig = createHmac("sha256", SECRET).update(json).digest("base64url");
  const value = Buffer.from(json, "utf8").toString("base64url") + "." + sig;
  assert(
    verifyStudentSessionValue(value, SECRET) === null,
    "non-student type rejected even with a valid signature"
  );
});

test("wrong secret rejected", () => {
  const value = signStudentSessionValue(freshPayload(), SECRET);
  assert(
    verifyStudentSessionValue(value, "some-other-secret") === null,
    "signature minted under a different secret is rejected"
  );
});

test("expired session rejected", () => {
  const value = signStudentSessionValue(
    freshPayload({ exp: Date.now() - 1_000 }),
    SECRET
  );
  assert(
    verifyStudentSessionValue(value, SECRET) === null,
    "exp in the past is rejected"
  );
});

test("malformed values rejected (fail closed on ANY failure)", () => {
  assert(verifyStudentSessionValue("", SECRET) === null, "empty string");
  assert(
    verifyStudentSessionValue("not-a-cookie", SECRET) === null,
    "no separator"
  );
  assert(
    verifyStudentSessionValue(".onlysig", SECRET) === null,
    "empty payload half"
  );
  assert(
    verifyStudentSessionValue("eyJhIjoxfQ.", SECRET) === null,
    "empty signature half"
  );
  assert(
    verifyStudentSessionValue("@@@@.@@@@", SECRET) === null,
    "garbage base64"
  );
  const plaintext = JSON.stringify(freshPayload());
  assert(
    verifyStudentSessionValue(plaintext, SECRET) === null,
    "unsigned plaintext JSON rejected (new app — no legacy window)"
  );
});

test("missing/empty secret fails closed", () => {
  const value = signStudentSessionValue(freshPayload(), SECRET);
  assert(
    verifyStudentSessionValue(value, "") === null,
    "empty secret can never verify"
  );
});

test("missing personId rejected", () => {
  const json = JSON.stringify({ type: "student", exp: Date.now() + 60_000 });
  const sig = createHmac("sha256", SECRET).update(json).digest("base64url");
  const value = Buffer.from(json, "utf8").toString("base64url") + "." + sig;
  assert(
    verifyStudentSessionValue(value, SECRET) === null,
    "payload without personId is rejected"
  );
});

console.log("\n═════════════════════════════════════");
console.log("Student Session Test Suite — Complete");
console.log("═════════════════════════════════════\n");
