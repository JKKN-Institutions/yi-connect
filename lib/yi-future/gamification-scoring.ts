/**
 * Journey gamification scoring — attendance-based points across 90-day phases.
 *
 * Locked formula (2026-05-25):
 *   composite = jury_avg * 0.8 + (journey_score / 15) * 20
 *
 * Each phase contributes up to 5 points (proportional to attendance).
 * Max journey score = 15.
 */

import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { PHASES, type Phase } from "@/lib/yi-future/constants";

// ─── Constants ──────────────────────────────────────────────────────────────

const POINTS_PER_PHASE: Record<Phase, number> = {
  phase_a: 5,
  phase_b: 5,
  phase_c: 5,
};

/** Sum of all phase max points. */
export const JOURNEY_MAX = 15;

// ─── Types ──────────────────────────────────────────────────────────────────

export type PhaseScore = {
  phase: Phase;
  attended: number;
  total: number;
  points: number;
  maxPoints: number;
};

export type JourneyScore = {
  phases: PhaseScore[];
  totalPoints: number;
  maxPoints: number;
  /** 0-100 percentage */
  pct: number;
};

// ─── Single delegate ────────────────────────────────────────────────────────

/**
 * Compute journey gamification score for a single delegate.
 * Score per phase = (events_attended / events_total) * phase_max_points
 */
export async function computeJourneyScore(
  delegateId: string,
  chapterId: string,
  editionId: string,
): Promise<JourneyScore> {
  const svc = await createServiceClient();

  // 1. All phase events for this chapter + edition
  const { data: events } = await svc
    .schema("future")
    .from("phase_events")
    .select("id, phase")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId);

  // 2. Delegate's attendance rows (only for events in scope)
  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  let attendMap = new Map<string, boolean>();

  if (eventIds.length > 0) {
    const { data: attendance } = await svc
      .schema("future")
      .from("phase_event_attendance")
      .select("phase_event_id, attended")
      .eq("delegate_id", delegateId)
      .in("phase_event_id", eventIds);

    attendMap = new Map(
      (attendance ?? []).map((a: { phase_event_id: string; attended: boolean | null }) => [
        a.phase_event_id,
        a.attended === true,
      ]),
    );
  }

  const eventList = (events ?? []) as { id: string; phase: string }[];

  const phases: PhaseScore[] = PHASES.map((phase) => {
    const phaseEvents = eventList.filter((e) => e.phase === phase);
    const total = phaseEvents.length;
    const attended = phaseEvents.filter((e) => attendMap.get(e.id) === true).length;
    const maxPoints = POINTS_PER_PHASE[phase];
    const points = total > 0 ? Number(((attended / total) * maxPoints).toFixed(2)) : 0;
    return { phase, attended, total, points, maxPoints };
  });

  const totalPoints = Number(phases.reduce((s, p) => s + p.points, 0).toFixed(2));
  const pct = JOURNEY_MAX > 0 ? Number(((totalPoints / JOURNEY_MAX) * 100).toFixed(1)) : 0;

  return { phases, totalPoints, maxPoints: JOURNEY_MAX, pct };
}

// ─── Team average ───────────────────────────────────────────────────────────

export type TeamMemberScore = {
  delegateId: string;
  name: string;
  points: number;
};

export type TeamJourneyScore = {
  avgPoints: number;
  memberScores: TeamMemberScore[];
};

/**
 * Compute journey score for a TEAM (average of all members' scores).
 */
export async function computeTeamJourneyScore(
  teamId: string,
  chapterId: string,
  editionId: string,
): Promise<TeamJourneyScore> {
  const svc = await createServiceClient();

  const { data: members } = await svc
    .schema("future")
    .from("team_members")
    .select("delegate_id, delegates(full_name)")
    .eq("team_id", teamId);

  const memberList = (members ?? []) as {
    delegate_id: string;
    delegates: { full_name: string } | null;
  }[];

  const memberScores: TeamMemberScore[] = await Promise.all(
    memberList.map(async (m) => {
      const js = await computeJourneyScore(m.delegate_id, chapterId, editionId);
      return {
        delegateId: m.delegate_id,
        name: m.delegates?.full_name ?? "(unknown)",
        points: js.totalPoints,
      };
    }),
  );

  const avgPoints =
    memberScores.length > 0
      ? Number((memberScores.reduce((s, m) => s + m.points, 0) / memberScores.length).toFixed(2))
      : 0;

  return { avgPoints, memberScores };
}
