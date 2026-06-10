/**
 * Yi Youth Academy — quarterly review row builder (pure engine, zero I/O).
 * Spec: docs/yi-youth-academy-spec.md §"National — dashboard" (quarterly
 * review summary + CSV export) + §"Metrics derivations".
 *
 * One row per academy for a given quarter: sessions conducted in the quarter
 * split E / I / L / other (sessions ARE the engagements — only COMPLETED,
 * dated sessions count), active days (quarter + YTD), students engaged /
 * certified (caller-supplied to-date aggregates), norm RAG, qualitative notes.
 *
 * Tested by lib/yuva/__tests__/quarterly-rows.test.ts. I/O assembly lives in
 * app/youth-academy/actions/national-reports.ts.
 */

import {
  activeDaysYTD,
  normRag,
  type NormRag,
  type NormSession,
} from "./norms";

export type Quarter = 1 | 2 | 3 | 4;

/** Academy fields the quarterly row needs (subset of the academies row). */
export interface QuarterAcademy {
  id: string;
  display_name: string;
  chapter: string;
  institution_name: string | null;
  qualitative_notes: string | null;
}

/** A run session attributed to its academy (caller joins session → run). */
export interface QuarterSession extends NormSession {
  academy_id: string;
}

export interface QuarterlyRow {
  academy: string;
  chapter: string;
  institution: string;
  sessions_total: number;
  sessions_entrepreneurship: number;
  sessions_innovation: number;
  sessions_learning: number;
  /** The remaining four categories (accessibility / climate change / health / road safety). */
  sessions_other: number;
  active_days_quarter: number;
  active_days_ytd: number;
  /** To-date aggregate supplied by the caller (distinct enrolled persons). */
  students_engaged: number;
  /** To-date aggregate supplied by the caller (certificates issued). */
  students_certified: number;
  /** Norm standing evaluated for the LAST month of the quarter. */
  norm_rag: NormRag;
  qualitative_notes: string;
}

/** The three "YYYY-MM" keys of a quarter, in order. */
export function quarterMonths(quarter: Quarter, year: number): string[] {
  const first = (quarter - 1) * 3 + 1;
  return [first, first + 1, first + 2].map(
    (m) => `${year}-${String(m).padStart(2, "0")}`
  );
}

/**
 * Builds one QuarterlyRow per academy (academies order preserved; an academy
 * with zero activity still yields a zero row — it must appear in the review).
 *
 * @param enrollmentsAgg academy_id → distinct enrolled persons (to date)
 * @param certsAgg       academy_id → certificates issued (to date)
 */
export function buildQuarterlyRows(
  academies: QuarterAcademy[],
  sessions: QuarterSession[],
  enrollmentsAgg: Record<string, number>,
  certsAgg: Record<string, number>,
  quarter: Quarter,
  year: number
): QuarterlyRow[] {
  const months = new Set(quarterMonths(quarter, year));
  // RAG is judged for the last month of the quarter (the review's "as of"
  // standing; activeDaysYTD inside normRag spans the month's whole year).
  const ragMonth = quarterMonths(quarter, year)[2];

  const byAcademy = new Map<string, QuarterSession[]>();
  for (const session of sessions) {
    const bucket = byAcademy.get(session.academy_id);
    if (bucket) bucket.push(session);
    else byAcademy.set(session.academy_id, [session]);
  }

  return academies.map((academy) => {
    const own = byAcademy.get(academy.id) ?? [];

    // Completed, dated sessions inside the quarter window.
    const inQuarter = own.filter(
      (s) =>
        s.status === "completed" &&
        s.scheduled_at &&
        months.has(s.scheduled_at.slice(0, 7))
    );

    let entrepreneurship = 0;
    let innovation = 0;
    let learning = 0;
    let other = 0;
    const quarterDays = new Set<string>();
    for (const s of inQuarter) {
      quarterDays.add((s.scheduled_at as string).slice(0, 10));
      if (s.category === "entrepreneurship") entrepreneurship++;
      else if (s.category === "innovation") innovation++;
      else if (s.category === "learning") learning++;
      else other++;
    }

    return {
      academy: academy.display_name,
      chapter: academy.chapter,
      institution: academy.institution_name ?? "",
      sessions_total: inQuarter.length,
      sessions_entrepreneurship: entrepreneurship,
      sessions_innovation: innovation,
      sessions_learning: learning,
      sessions_other: other,
      active_days_quarter: quarterDays.size,
      active_days_ytd: activeDaysYTD(own, year),
      students_engaged: enrollmentsAgg[academy.id] ?? 0,
      students_certified: certsAgg[academy.id] ?? 0,
      norm_rag: normRag(own, ragMonth),
      qualitative_notes: academy.qualitative_notes ?? "",
    };
  });
}
