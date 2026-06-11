/**
 * Email-template completeness tests (tsx harness) — Phase 16.
 * Run: npx tsx lib/yuva/__tests__/email-templates.test.ts
 *
 * Pins the contract the actions code (Phases 7–14) builds against:
 *   - every YuvaEmailType has a template in TEMPLATE_BY_TYPE (no missing,
 *     no extras)
 *   - every template returns non-empty subject + html + text
 *   - every html carries the brand (header band + Young Indians · CII footer)
 *   - acceptance includes the access code it was given (html AND text),
 *     the login link, and the optional scheduleSummary when provided
 *   - otp includes the code and the 10-minute validity
 *   - user-supplied strings are HTML-escaped
 */

import {
  TEMPLATE_BY_TYPE,
  applicationConfirmationEmail,
  acceptanceEmail,
  rejectionEmail,
  otpEmail,
  certificateEmail,
  scheduleChangeEmail,
  mentorInviteEmail,
  coordinatorInviteEmail,
  runCancelledEmail,
  type RenderedEmail,
} from "../email-templates";
import type { YuvaEmailType } from "../email";

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

// The 8 trigger types (mirrors YuvaEmailType in lib/yuva/email.ts; the
// Record<YuvaEmailType, ...> sample map below makes drift a compile error).
const ALL_TYPES: YuvaEmailType[] = [
  "application_confirmation",
  "acceptance",
  "rejection",
  "otp",
  "certificate",
  "schedule_change",
  "mentor_invite",
  "coordinator_invite",
  "run_cancelled",
];

const ACCESS_CODE = "AB3K9XQZ";
const OTP_CODE = "482917";

/** One rendered sample per type, with realistic inputs. */
const SAMPLES: Record<YuvaEmailType, RenderedEmail> = {
  application_confirmation: applicationConfirmationEmail({
    studentName: "Priya S",
    programName: "Climate Champions 2026",
    statusUrl: "https://yi-connect-app.vercel.app/youth-academy/applications/tok123",
  }),
  acceptance: acceptanceEmail({
    studentName: "Priya S",
    programName: "Climate Champions 2026",
    accessCode: ACCESS_CODE,
    loginUrl: "https://yi-connect-app.vercel.app/youth-academy/login",
    scheduleSummary: "Yi Erode · 12 Jul – 30 Aug 2026 · 8 sessions",
  }),
  rejection: rejectionEmail({
    studentName: "Priya S",
    programName: "Climate Champions 2026",
  }),
  otp: otpEmail({ code: OTP_CODE }),
  certificate: certificateEmail({
    studentName: "Priya S",
    programName: "Climate Champions 2026",
    certificateNo: "YUVA-2026-000042",
    downloadUrl: "https://yi-connect-app.vercel.app/youth-academy/me/certificate",
  }),
  schedule_change: scheduleChangeEmail({
    programName: "Climate Champions 2026",
    sessionName: "Session 3 — Field Visit",
    changeSummary: "19 Jul 2026, 10:00 → 26 Jul 2026, 14:00",
  }),
  mentor_invite: mentorInviteEmail({
    mentorName: "Arun K",
    chapter: "Erode",
    portalUrl: "https://yi-connect-app.vercel.app/youth-academy/login",
  }),
  coordinator_invite: coordinatorInviteEmail({
    coordinatorName: "Meena R",
    academyName: "KV Matric Hr Sec School",
    portalUrl: "https://yi-connect-app.vercel.app/youth-academy/login",
  }),
};

// ─── Completeness ──────────────────────────────────────────────────────────

test("every YuvaEmailType has a template (no missing, no extras)", () => {
  const mapKeys = Object.keys(TEMPLATE_BY_TYPE).sort();
  const expected = [...ALL_TYPES].sort();
  assert(
    mapKeys.length === expected.length,
    `TEMPLATE_BY_TYPE has ${mapKeys.length} entries (expected ${expected.length})`
  );
  for (const t of expected) {
    assert(t in TEMPLATE_BY_TYPE, `TEMPLATE_BY_TYPE has '${t}'`);
    assert(
      typeof TEMPLATE_BY_TYPE[t] === "function",
      `TEMPLATE_BY_TYPE['${t}'] is a function`
    );
  }
});

test("every template returns non-empty subject + html + text", () => {
  for (const t of ALL_TYPES) {
    const r = SAMPLES[t];
    assert(r.subject.trim().length > 0, `${t}: subject non-empty`);
    assert(r.html.trim().length > 0, `${t}: html non-empty`);
    assert(r.text.trim().length > 0, `${t}: text fallback non-empty`);
  }
});

test("every html carries the brand shell", () => {
  for (const t of ALL_TYPES) {
    const r = SAMPLES[t];
    assert(r.html.includes("Yi Youth Academy"), `${t}: header brand present`);
    assert(r.html.includes("#0f2557"), `${t}: navy brand colour present`);
    assert(
      r.html.includes("Young Indians &middot; CII"),
      `${t}: Young Indians · CII footer present`
    );
  }
});

// ─── Content pins ──────────────────────────────────────────────────────────

test("acceptance includes the access code, login link and scheduleSummary", () => {
  const r = SAMPLES.acceptance;
  assert(r.html.includes(ACCESS_CODE), "html contains the access code");
  assert(r.text.includes(ACCESS_CODE), "text contains the access code");
  assert(
    r.html.includes("https://yi-connect-app.vercel.app/youth-academy/login"),
    "html contains the login link"
  );
  assert(
    r.html.includes("Yi Erode · 12 Jul – 30 Aug 2026 · 8 sessions"),
    "html contains the scheduleSummary when provided"
  );

  const noSummary = acceptanceEmail({
    studentName: "Priya S",
    programName: "Climate Champions 2026",
    accessCode: ACCESS_CODE,
    loginUrl: "https://yi-connect-app.vercel.app/youth-academy/login",
  });
  assert(
    !noSummary.html.includes("border-left"),
    "summary block omitted when scheduleSummary absent"
  );
  assert(noSummary.html.includes(ACCESS_CODE), "code still present without summary");
});

test("otp includes the code and the 10-minute validity", () => {
  const r = SAMPLES.otp;
  assert(r.html.includes(OTP_CODE), "html contains the OTP code");
  assert(r.text.includes(OTP_CODE), "text contains the OTP code");
  assert(r.html.includes("10 minutes"), "html states 10-minute validity");
  assert(r.text.includes("10 minutes"), "text states 10-minute validity");
});

test("user-supplied strings are HTML-escaped", () => {
  const r = applicationConfirmationEmail({
    studentName: '<script>alert("x")</script>',
    programName: "A & B <Program>",
    statusUrl: "https://example.com/status",
  });
  assert(!r.html.includes("<script>"), "raw <script> never appears in html");
  assert(r.html.includes("&lt;script&gt;"), "script tag is escaped");
  assert(r.html.includes("A &amp; B &lt;Program&gt;"), "ampersand + brackets escaped");
});

console.log("\nDone.");
