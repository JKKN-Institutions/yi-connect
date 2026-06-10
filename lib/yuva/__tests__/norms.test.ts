/**
 * Usage-norm engine tests (tsx harness).
 * Run: npx tsx lib/yuva/__tests__/norms.test.ts
 */

import {
  engagementsByMonth,
  activeDaysYTD,
  normRag,
  NORM_MIN_ENGAGEMENTS_PER_MONTH,
  NORM_MIN_ACTIVE_DAYS_PER_YEAR,
  type NormSession,
} from "../norms";

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

const s = (
  scheduled_at: string | null,
  category: NormSession["category"],
  status: NormSession["status"] = "completed"
): NormSession => ({ scheduled_at, category, status });

// ─── engagementsByMonth ─────────────────────────────────────────────

test("engagementsByMonth groups completed sessions by month × category", () => {
  const sessions: NormSession[] = [
    s("2026-06-05T10:00:00Z", "entrepreneurship"),
    s("2026-06-12T10:00:00Z", "entrepreneurship"),
    s("2026-06-20T10:00:00Z", "innovation"),
    s("2026-07-01T10:00:00Z", "learning"),
  ];
  const grouped = engagementsByMonth(sessions);
  assert(grouped["2026-06"]?.entrepreneurship === 2, "2026-06 entrepreneurship = 2");
  assert(grouped["2026-06"]?.innovation === 1, "2026-06 innovation = 1");
  assert(grouped["2026-07"]?.learning === 1, "2026-07 learning = 1");
  assert(grouped["2026-06"]?.learning === undefined, "no learning in 2026-06");
});

test("engagementsByMonth: sessions ARE the engagements — only completed count", () => {
  const sessions: NormSession[] = [
    s("2026-06-05T10:00:00Z", "health"),
    s("2026-06-06T10:00:00Z", "health", "scheduled"),
    s("2026-06-07T10:00:00Z", "health", "cancelled"),
  ];
  const grouped = engagementsByMonth(sessions);
  assert(grouped["2026-06"]?.health === 1, "scheduled/cancelled excluded");
});

test("engagementsByMonth: null scheduled_at skipped, empty input returns empty object", () => {
  const grouped = engagementsByMonth([s(null, "health")]);
  assert(Object.keys(grouped).length === 0, "null-dated session skipped");
  assert(Object.keys(engagementsByMonth([])).length === 0, "empty input → {}");
});

// ─── activeDaysYTD ──────────────────────────────────────────────────

test("activeDaysYTD counts DISTINCT dates of completed sessions in the year", () => {
  const sessions: NormSession[] = [
    s("2026-03-01T09:00:00Z", "health"),
    s("2026-03-01T15:00:00Z", "learning"), // same date — counts once
    s("2026-03-02T09:00:00Z", "innovation"),
    s("2025-12-31T09:00:00Z", "health"), // other year — excluded
    s("2026-04-01T09:00:00Z", "health", "scheduled"), // not completed — excluded
    s(null, "health"), // no date — excluded
  ];
  assert(activeDaysYTD(sessions, 2026) === 2, "2 distinct active days in 2026");
  assert(activeDaysYTD(sessions, 2025) === 1, "1 distinct active day in 2025");
  assert(activeDaysYTD([], 2026) === 0, "empty input → 0");
});

// ─── normRag ────────────────────────────────────────────────────────

/** Build n completed sessions on n distinct dates in the given year (Jan–Feb), category cycling E/I/L. */
function manyDays(n: number, year: number): NormSession[] {
  const cats: NormSession["category"][] = ["entrepreneurship", "innovation", "learning"];
  return Array.from({ length: n }, (_, i) => {
    const month = i < 28 ? "01" : "02";
    const day = String((i % 28) + 1).padStart(2, "0");
    return s(`${year}-${month}-${day}T10:00:00Z`, cats[i % 3]);
  });
}

test("normRag: GREEN when month has one each E/I/L (≥3) AND ≥30 active days YTD", () => {
  const sessions: NormSession[] = [
    ...manyDays(30, 2026), // Jan–Feb: 30 distinct days
    s("2026-06-05T10:00:00Z", "entrepreneurship"),
    s("2026-06-12T10:00:00Z", "innovation"),
    s("2026-06-20T10:00:00Z", "learning"),
  ];
  assert(normRag(sessions, "2026-06") === "green", "both criteria met → green");
});

test("normRag: month criterion needs one EACH of E/I/L, not just ≥3 total", () => {
  const sessions: NormSession[] = [
    ...manyDays(30, 2026),
    // 3 engagements in June but all entrepreneurship — mix not met
    s("2026-06-05T10:00:00Z", "entrepreneurship"),
    s("2026-06-12T10:00:00Z", "entrepreneurship"),
    s("2026-06-20T10:00:00Z", "entrepreneurship"),
  ];
  assert(normRag(sessions, "2026-06") === "amber", "days met, E/I/L mix not → amber");
});

test("normRag: AMBER when only the monthly criterion is met", () => {
  const sessions: NormSession[] = [
    // only 3 active days all year — days criterion fails
    s("2026-06-05T10:00:00Z", "entrepreneurship"),
    s("2026-06-12T10:00:00Z", "innovation"),
    s("2026-06-20T10:00:00Z", "learning"),
  ];
  assert(normRag(sessions, "2026-06") === "amber", "month met, days not → amber");
});

test("normRag: RED when neither criterion is met", () => {
  const sessions: NormSession[] = [
    s("2026-06-05T10:00:00Z", "entrepreneurship"),
    s("2026-06-12T10:00:00Z", "innovation"),
  ];
  assert(normRag(sessions, "2026-06") === "red", "2 engagements, 2 days → red");
  assert(normRag([], "2026-06") === "red", "no sessions at all → red");
});

test("norm threshold constants match the spec (≥3/month, ≥30 days/year)", () => {
  assert(NORM_MIN_ENGAGEMENTS_PER_MONTH === 3, "3 engagements per month");
  assert(NORM_MIN_ACTIVE_DAYS_PER_YEAR === 30, "30 active days per year");
});

console.log("\nDone.");
