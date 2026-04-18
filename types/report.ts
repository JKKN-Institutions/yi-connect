/**
 * Chapter Report Types
 *
 * Types for the Quarterly Report Generator (Yi National submission format).
 */

export type ChapterReportType = 'quarterly' | 'monthly' | 'annual';

export interface ChapterReport {
  id: string;
  chapter_id: string;
  report_type: ChapterReportType;
  period_start: string; // ISO date
  period_end: string; // ISO date
  fiscal_year: number;
  generated_by: string;
  generated_at: string;
  pdf_url: string | null;
  data_snapshot: ReportDataSnapshot;
  sent_to_national: boolean;
  sent_at: string | null;
}

export interface ReportEventSummary {
  id: string;
  title: string;
  start_date: string;
  category: string;
  status: string;
  rsvp_count: number;
  attended_count: number;
  attendance_rate: number;
  feedback_rating: number | null;
}

export interface ReportVerticalStatus {
  id: string;
  name: string;
  planned_activities: number;
  completed_activities: number;
  ec_participation: number;
  non_ec_participation: number;
  on_track: boolean;
}

export interface ReportTopMember {
  member_id: string;
  full_name: string;
  email: string | null;
  total_points: number;
  events_attended: number;
}

export interface ReportFinanceSnapshot {
  total_expenses: number;
  approved_amount: number;
  pending_amount: number;
  rejected_amount: number;
  total_sponsorship: number;
}

export interface ReportTakePrideNominee {
  member_id: string;
  full_name: string;
  email: string | null;
  engagement_score: number;
  rationale: string;
}

export interface ReportDataSnapshot {
  chapter: {
    id: string;
    name: string;
    region: string | null;
  };
  period: {
    start: string;
    end: string;
    label: string; // e.g. "Q1 FY2026 (Jan-Mar 2026)"
    fiscal_year: number;
    quarter: 1 | 2 | 3 | 4 | null; // null for monthly/annual
  };
  events: {
    total_count: number;
    list: ReportEventSummary[];
    total_attendance: number;
    average_attendance_rate: number;
  };
  verticals: {
    list: ReportVerticalStatus[];
    on_track_count: number;
    behind_count: number;
  };
  top_members: ReportTopMember[];
  finance: ReportFinanceSnapshot;
  take_pride_nominees: ReportTakePrideNominee[];
  generated_at: string;
  generated_by: {
    id: string;
    name: string;
  };
}

export interface GenerateReportOptions {
  chapter_id: string;
  report_type: ChapterReportType;
  period_start: string;
  period_end: string;
  fiscal_year: number;
}

export interface GenerateReportResult {
  success: boolean;
  report_id?: string;
  pdf_url?: string;
  data_snapshot?: ReportDataSnapshot;
  error?: string;
}

/**
 * Helper: detect quarter number from a date (Jan-Mar = Q1).
 */
export function detectQuarter(date: Date): 1 | 2 | 3 | 4 {
  const m = date.getMonth();
  if (m < 3) return 1;
  if (m < 6) return 2;
  if (m < 9) return 3;
  return 4;
}

/**
 * Helper: get the start/end dates of a quarter.
 */
export function getQuarterRange(
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4
): { start: Date; end: Date; label: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(fiscalYear, startMonth, 1);
  const end = new Date(fiscalYear, startMonth + 3, 0); // last day of last month
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startMonthName = monthNames[startMonth];
  const endMonthName = monthNames[startMonth + 2];
  const label = `Q${quarter} FY${fiscalYear} (${startMonthName}-${endMonthName} ${fiscalYear})`;
  return { start, end, label };
}

/**
 * Helper: get the last completed quarter relative to a reference date.
 */
export function getLastCompletedQuarter(reference: Date = new Date()): {
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
} {
  const q = detectQuarter(reference);
  const y = reference.getFullYear();
  if (q === 1) return { fiscalYear: y - 1, quarter: 4 };
  return { fiscalYear: y, quarter: (q - 1) as 1 | 2 | 3 | 4 };
}
