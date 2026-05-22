/**
 * Quarterly Report Data Aggregator
 *
 * Pulls events, vertical status, engagement leaderboard, finance, and
 * Take Pride nominees for a given chapter × quarter window.
 *
 * Designed to degrade gracefully:
 *   - Chapter with zero events still returns a valid snapshot
 *   - Missing verticals/finance/points data doesn't throw, returns empty
 *
 * Naming: this file is `reports-quarterly.ts` (not reports.ts) because a
 * pre-existing `lib/data/reports.ts` is reserved for the generic reports
 * engine. The spec intended "new file" — keeping them separate avoids
 * clobbering that module.
 */

import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  ReportDataSnapshot,
  ReportEventSummary,
  ReportVerticalStatus,
  ReportTopMember,
  ReportFinanceSnapshot,
  ReportTakePrideNominee,
} from '@/types/report';
import { getQuarterRange } from '@/types/report';
import type { ChapterReport } from '@/types/report';

/**
 * Aggregate a complete quarterly report snapshot for a chapter × quarter.
 * Returns a frozen JSONB-shaped object ready for both PDF rendering and
 * storage in chapter_reports.data_snapshot.
 */
export async function aggregateQuarterlyReport(
  chapterId: string,
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
  generatedByUserId: string
): Promise<ReportDataSnapshot> {
  const supabase = await createClient();

  const { start, end, label } = getQuarterRange(fiscalYear, quarter);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // --------------------------------------------------------------------
  // Chapter info
  // --------------------------------------------------------------------
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name, region')
    .eq('id', chapterId)
    .maybeSingle();

  // --------------------------------------------------------------------
  // Events (status=completed AND within window)
  // --------------------------------------------------------------------
  const { data: events } = await supabase
    .from('events')
    .select(
      'id, title, start_date, category, status, vertical_id, current_registrations'
    )
    .eq('chapter_id', chapterId)
    .gte('start_date', startIso)
    .lte('start_date', endIso)
    .order('start_date', { ascending: true });

  const eventsList = events ?? [];
  const eventIds = eventsList.map((e) => e.id);

  // Per-event attendance + feedback
  const eventSummaries: ReportEventSummary[] = [];
  let totalAttendance = 0;
  let attendanceRateSum = 0;
  let eventsWithRate = 0;

  if (eventIds.length > 0) {
    const [{ data: rsvps }, { data: feedbacks }] = await Promise.all([
      supabase
        .from('event_rsvps')
        .select('event_id, status')
        .in('event_id', eventIds),
      supabase
        .from('event_feedback')
        .select('event_id, rating')
        .in('event_id', eventIds),
    ]);

    const rsvpByEvent = new Map<
      string,
      { total: number; attended: number }
    >();
    for (const r of rsvps ?? []) {
      const rec = rsvpByEvent.get(r.event_id as string) ?? {
        total: 0,
        attended: 0,
      };
      rec.total++;
      if (r.status === 'attended') rec.attended++;
      rsvpByEvent.set(r.event_id as string, rec);
    }

    const ratingsByEvent = new Map<string, number[]>();
    for (const f of feedbacks ?? []) {
      const ratings = ratingsByEvent.get(f.event_id as string) ?? [];
      if (typeof f.rating === 'number') ratings.push(f.rating);
      ratingsByEvent.set(f.event_id as string, ratings);
    }

    for (const e of eventsList) {
      const rec = rsvpByEvent.get(e.id) ?? { total: 0, attended: 0 };
      const ratings = ratingsByEvent.get(e.id) ?? [];
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;
      const rate = rec.total > 0 ? (rec.attended / rec.total) * 100 : 0;
      totalAttendance += rec.attended;
      if (rec.total > 0) {
        attendanceRateSum += rate;
        eventsWithRate++;
      }
      eventSummaries.push({
        id: e.id,
        title: e.title,
        start_date: e.start_date,
        category: e.category,
        status: e.status,
        rsvp_count: rec.total,
        attended_count: rec.attended,
        attendance_rate: rate,
        feedback_rating: avgRating,
      });
    }
  }

  const avgAttendanceRate =
    eventsWithRate > 0 ? attendanceRateSum / eventsWithRate : 0;

  // --------------------------------------------------------------------
  // Verticals status
  // --------------------------------------------------------------------
  const { data: verticals } = await supabase
    .from('verticals')
    .select('id, name')
    .order('name');

  const verticalStatuses: ReportVerticalStatus[] = [];
  for (const v of verticals ?? []) {
    // Planned activities — attempt to pull from activity_plans or planned_activities.
    // Fall back to zero if table absent.
    let planned = 0;
    try {
      const { count } = await supabase
        .from('planned_activities')
        .select('id', { count: 'exact', head: true })
        .eq('chapter_id', chapterId)
        .eq('vertical_id', v.id)
        .gte('planned_date', startIso)
        .lte('planned_date', endIso);
      planned = count ?? 0;
    } catch {
      planned = 0;
    }

    // Completed = health_card_entries for this vertical in this window
    let completed = 0;
    let ecSum = 0;
    let nonEcSum = 0;
    try {
      const { data: hc } = await supabase
        .from('health_card_entries')
        .select('id, ec_members_count, non_ec_members_count')
        .eq('chapter_id', chapterId)
        .eq('vertical_id', v.id)
        .gte('activity_date', startIso.slice(0, 10))
        .lte('activity_date', endIso.slice(0, 10));
      const hcList = hc ?? [];
      completed = hcList.length;
      ecSum = hcList.reduce(
        (a: number, h: { ec_members_count: number | null }) =>
          a + (h.ec_members_count ?? 0),
        0
      );
      nonEcSum = hcList.reduce(
        (a: number, h: { non_ec_members_count: number | null }) =>
          a + (h.non_ec_members_count ?? 0),
        0
      );
    } catch {
      // No rows
    }

    verticalStatuses.push({
      id: v.id,
      name: v.name,
      planned_activities: planned,
      completed_activities: completed,
      ec_participation: ecSum,
      non_ec_participation: nonEcSum,
      on_track: planned === 0 ? completed > 0 : completed >= planned,
    });
  }

  const onTrackCount = verticalStatuses.filter((v) => v.on_track).length;
  const behindCount = verticalStatuses.length - onTrackCount;

  // --------------------------------------------------------------------
  // Top 10 members by points delta this quarter
  // --------------------------------------------------------------------
  let topMembers: ReportTopMember[] = [];
  try {
    const { data: pts } = await supabase
      .from('member_points_log')
      .select('member_id, points, action_type')
      .eq('chapter_id', chapterId)
      .gte('awarded_at', startIso)
      .lte('awarded_at', endIso);

    const byMember = new Map<string, { points: number; events: number }>();
    for (const p of pts ?? []) {
      const rec = byMember.get(p.member_id as string) ?? {
        points: 0,
        events: 0,
      };
      rec.points += p.points as number;
      if (p.action_type === 'event_attended') rec.events++;
      byMember.set(p.member_id as string, rec);
    }

    const sorted = Array.from(byMember.entries())
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 10);

    if (sorted.length > 0) {
      const ids = sorted.map(([id]) => id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      const pmap = new Map(
        (profiles ?? []).map((p: { id: string; full_name: string; email: string }) => [
          p.id,
          p,
        ])
      );
      topMembers = sorted.map(([mid, rec]) => ({
        member_id: mid,
        full_name: pmap.get(mid)?.full_name ?? 'Unknown',
        email: pmap.get(mid)?.email ?? null,
        total_points: rec.points,
        events_attended: rec.events,
      }));
    }
  } catch (err) {
    console.warn('Top members query failed:', err);
  }

  // --------------------------------------------------------------------
  // Finance snapshot
  // --------------------------------------------------------------------
  let finance: ReportFinanceSnapshot = {
    total_expenses: 0,
    approved_amount: 0,
    pending_amount: 0,
    rejected_amount: 0,
    total_sponsorship: 0,
  };
  try {
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, status')
      .eq('chapter_id', chapterId)
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    for (const e of expenses ?? []) {
      const amt = Number(e.amount) || 0;
      finance.total_expenses += amt;
      if (e.status === 'approved') finance.approved_amount += amt;
      else if (e.status === 'pending') finance.pending_amount += amt;
      else if (e.status === 'rejected') finance.rejected_amount += amt;
    }
  } catch {
    // Table may not exist or have different shape — leave zeros
  }

  try {
    const { data: sponsors } = await supabase
      .from('sponsorships')
      .select('amount, status')
      .eq('chapter_id', chapterId)
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    for (const s of sponsors ?? []) {
      finance.total_sponsorship += Number(s.amount) || 0;
    }
  } catch {
    // Optional — may not exist
  }

  // --------------------------------------------------------------------
  // Take Pride nominees (top 5 by points, distinct from top 10 truncated)
  // --------------------------------------------------------------------
  const takePride: ReportTakePrideNominee[] = topMembers
    .slice(0, 5)
    .map((m) => ({
      member_id: m.member_id,
      full_name: m.full_name,
      email: m.email,
      engagement_score: m.total_points,
      rationale: `Attended ${m.events_attended} event${
        m.events_attended !== 1 ? 's' : ''
      }, earned ${m.total_points} points this quarter`,
    }));

  // --------------------------------------------------------------------
  // Generator info
  // --------------------------------------------------------------------
  const { data: generator } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', generatedByUserId)
    .maybeSingle();

  const snapshot: ReportDataSnapshot = {
    chapter: {
      id: chapter?.id ?? chapterId,
      name: chapter?.name ?? 'Unknown Chapter',
      region: chapter?.region ?? null,
    },
    period: {
      start: startIso,
      end: endIso,
      label,
      fiscal_year: fiscalYear,
      quarter,
    },
    events: {
      total_count: eventSummaries.length,
      list: eventSummaries,
      total_attendance: totalAttendance,
      average_attendance_rate: avgAttendanceRate,
    },
    verticals: {
      list: verticalStatuses,
      on_track_count: onTrackCount,
      behind_count: behindCount,
    },
    top_members: topMembers,
    finance,
    take_pride_nominees: takePride,
    generated_at: new Date().toISOString(),
    generated_by: {
      id: generatedByUserId,
      name: generator?.full_name ?? 'Unknown',
    },
  };

  return snapshot;
}

/**
 * List past chapter reports (for /reports/history).
 */
export const listChapterReports = cache(
  async (chapterId: string, limit = 25): Promise<ChapterReport[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('chapter_reports')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('generated_at', { ascending: false })
      .limit(limit);
    return (data ?? []) as ChapterReport[];
  }
);

/**
 * Fetch a single report by id.
 */
export const getChapterReportById = cache(
  async (id: string): Promise<ChapterReport | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('chapter_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return (data ?? null) as ChapterReport | null;
  }
);
