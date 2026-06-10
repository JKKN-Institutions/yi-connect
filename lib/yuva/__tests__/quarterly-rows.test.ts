/**
 * Quarterly CSV row builder tests (tsx harness).
 * Run: npx tsx lib/yuva/__tests__/quarterly-rows.test.ts
 *
 * Pure function under test: lib/yuva/quarterly.ts buildQuarterlyRows —
 * the per-academy aggregation behind exportQuarterlyCsv (Phase 15).
 */

import {
  buildQuarterlyRows,
  quarterMonths,
  type QuarterAcademy,
  type QuarterSession,
} from "../quarterly";

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

const academy = (
  id: string,
  overrides: Partial<QuarterAcademy> = {}
): QuarterAcademy => ({
  id,
  display_name: `Yi ${id} Youth Academy`,
  chapter: id,
  institution_name: null,
  qualitative_notes: null,
  ...overrides,
});

const s = (
  academy_id: string,
  scheduled_at: string | null,
  category: QuarterSession["category"],
  status: QuarterSession["status"] = "completed"
): QuarterSession => ({ academy_id, scheduled_at, category, status });

// ─── quarterMonths ──────────────────────────────────────────────────

test("quarterMonths maps each quarter to its three YYYY-MM keys", () => {
  assert(
    quarterMonths(1, 2026).join(",") === "2026-01,2026-02,2026-03",
    "Q1 = Jan/Feb/Mar"
  );
  assert(
    quarterMonths(2, 2026).join(",") === "2026-04,2026-05,2026-06",
    "Q2 = Apr/May/Jun"
  );
  assert(
    quarterMonths(4, 2026).join(",") === "2026-10,2026-11,2026-12",
    "Q4 = Oct/Nov/Dec"
  );
});

// ─── quarter windowing ──────────────────────────────────────────────

test("sessions outside the quarter are excluded from quarter counts", () => {
  const rows = buildQuarterlyRows(
    [academy("Erode")],
    [
      s("Erode", "2026-03-31T10:00:00Z", "entrepreneurship"), // Q1 — out
      s("Erode", "2026-04-01T10:00:00Z", "entrepreneurship"), // Q2 — in
      s("Erode", "2026-06-30T10:00:00Z", "innovation"), // Q2 — in
      s("Erode", "2026-07-01T10:00:00Z", "learning"), // Q3 — out
    ],
    {},
    {},
    2,
    2026
  );
  assert(rows.length === 1, "one row per academy");
  assert(rows[0].sessions_total === 2, "only Q2 sessions counted");
  assert(rows[0].sessions_entrepreneurship === 1, "Q1 session excluded");
  assert(rows[0].sessions_learning === 0, "Q3 session excluded");
});

test("non-completed and undated sessions never count (sessions ARE the engagements)", () => {
  const rows = buildQuarterlyRows(
    [academy("Erode")],
    [
      s("Erode", "2026-05-05T10:00:00Z", "health"),
      s("Erode", "2026-05-06T10:00:00Z", "health", "scheduled"),
      s("Erode", "2026-05-07T10:00:00Z", "health", "cancelled"),
      s("Erode", null, "health"),
    ],
    {},
    {},
    2,
    2026
  );
  assert(rows[0].sessions_total === 1, "scheduled/cancelled/undated excluded");
  assert(rows[0].sessions_other === 1, "health counts under 'other'");
});

// ─── per-category counts ────────────────────────────────────────────

test("per-category split: E / I / L explicit, the other four roll into 'other'", () => {
  const rows = buildQuarterlyRows(
    [academy("Chennai")],
    [
      s("Chennai", "2026-04-02T10:00:00Z", "entrepreneurship"),
      s("Chennai", "2026-04-09T10:00:00Z", "entrepreneurship"),
      s("Chennai", "2026-05-02T10:00:00Z", "innovation"),
      s("Chennai", "2026-05-09T10:00:00Z", "learning"),
      s("Chennai", "2026-06-02T10:00:00Z", "climate_change"),
      s("Chennai", "2026-06-09T10:00:00Z", "road_safety"),
    ],
    {},
    {},
    2,
    2026
  );
  const r = rows[0];
  assert(r.sessions_entrepreneurship === 2, "E = 2");
  assert(r.sessions_innovation === 1, "I = 1");
  assert(r.sessions_learning === 1, "L = 1");
  assert(r.sessions_other === 2, "other = 2 (climate_change + road_safety)");
  assert(r.sessions_total === 6, "total = 6");
});

// ─── active days ────────────────────────────────────────────────────

test("active days: distinct dates in quarter; YTD spans the whole year", () => {
  const rows = buildQuarterlyRows(
    [academy("Kolkata")],
    [
      s("Kolkata", "2026-01-10T09:00:00Z", "learning"), // YTD only
      s("Kolkata", "2026-04-10T09:00:00Z", "learning"),
      s("Kolkata", "2026-04-10T14:00:00Z", "innovation"), // same day — 1 active day
      s("Kolkata", "2026-05-11T09:00:00Z", "entrepreneurship"),
      s("Kolkata", "2025-12-31T09:00:00Z", "learning"), // previous year — excluded everywhere
    ],
    {},
    {},
    2,
    2026
  );
  assert(rows[0].active_days_quarter === 2, "quarter active days = 2 (dedup same-day)");
  assert(rows[0].active_days_ytd === 3, "YTD active days = 3 (Jan + Apr + May)");
});

// ─── RAG integration ────────────────────────────────────────────────

test("norm RAG is evaluated for the LAST month of the quarter", () => {
  // June (last month of Q2) meets the monthly mix; ≥30 active days NOT met
  // → exactly one criterion met → amber.
  const june = [
    s("Nasik", "2026-06-01T10:00:00Z", "entrepreneurship"),
    s("Nasik", "2026-06-02T10:00:00Z", "innovation"),
    s("Nasik", "2026-06-03T10:00:00Z", "learning"),
  ];
  const amberRows = buildQuarterlyRows([academy("Nasik")], june, {}, {}, 2, 2026);
  assert(amberRows[0].norm_rag === "amber", "month mix met, days unmet → amber");

  // Same mix in APRIL only → June (the judged month) is empty → red.
  const april = [
    s("Nasik", "2026-04-01T10:00:00Z", "entrepreneurship"),
    s("Nasik", "2026-04-02T10:00:00Z", "innovation"),
    s("Nasik", "2026-04-03T10:00:00Z", "learning"),
  ];
  const redRows = buildQuarterlyRows([academy("Nasik")], april, {}, {}, 2, 2026);
  assert(redRows[0].norm_rag === "red", "last quarter month empty → red");
});

test("green when the last quarter month meets the mix AND ≥30 active days YTD", () => {
  const sessions: QuarterSession[] = [
    s("Bengaluru", "2026-06-01T10:00:00Z", "entrepreneurship"),
    s("Bengaluru", "2026-06-02T10:00:00Z", "innovation"),
    s("Bengaluru", "2026-06-03T10:00:00Z", "learning"),
  ];
  // 30 distinct active days across Jan+Feb.
  for (let d = 1; d <= 27; d++) {
    sessions.push(
      s("Bengaluru", `2026-01-${String(d).padStart(2, "0")}T10:00:00Z`, "learning")
    );
  }
  const rows = buildQuarterlyRows([academy("Bengaluru")], sessions, {}, {}, 2, 2026);
  assert(rows[0].active_days_ytd === 30, "30 distinct YTD days");
  assert(rows[0].norm_rag === "green", "both criteria met → green");
});

// ─── aggregates + empty academy ─────────────────────────────────────

test("enrollment/cert aggregates land on the right academy; empty academy → zero row", () => {
  const rows = buildQuarterlyRows(
    [
      academy("Erode", {
        institution_name: "JKKN College",
        qualitative_notes: "Strong cohort.",
      }),
      academy("Dehradun"), // no sessions, no aggregates
    ],
    [s("Erode", "2026-04-10T09:00:00Z", "learning")],
    { Erode: 42 },
    { Erode: 7 },
    2,
    2026
  );
  assert(rows.length === 2, "every academy gets a row");

  const erode = rows.find((r) => r.chapter === "Erode")!;
  assert(erode.students_engaged === 42, "engaged from aggregate");
  assert(erode.students_certified === 7, "certified from aggregate");
  assert(erode.institution === "JKKN College", "institution name carried");
  assert(erode.qualitative_notes === "Strong cohort.", "notes carried");

  const dehradun = rows.find((r) => r.chapter === "Dehradun")!;
  assert(dehradun.sessions_total === 0, "empty academy → zero sessions");
  assert(dehradun.active_days_quarter === 0, "zero active days (quarter)");
  assert(dehradun.active_days_ytd === 0, "zero active days (YTD)");
  assert(dehradun.students_engaged === 0, "zero engaged");
  assert(dehradun.students_certified === 0, "zero certified");
  assert(dehradun.norm_rag === "red", "no activity → red");
  assert(dehradun.qualitative_notes === "", "null notes → empty string");
});

test("sessions from another academy never bleed into a row", () => {
  const rows = buildQuarterlyRows(
    [academy("Erode"), academy("Chennai")],
    [
      s("Erode", "2026-04-10T09:00:00Z", "learning"),
      s("Chennai", "2026-04-10T09:00:00Z", "learning"),
      s("Chennai", "2026-04-11T09:00:00Z", "innovation"),
    ],
    {},
    {},
    2,
    2026
  );
  assert(
    rows.find((r) => r.chapter === "Erode")!.sessions_total === 1,
    "Erode sees only its own session"
  );
  assert(
    rows.find((r) => r.chapter === "Chennai")!.sessions_total === 2,
    "Chennai sees only its own sessions"
  );
});

console.log("\nquarterly-rows.test.ts complete");
