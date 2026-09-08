import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { UnlockEvaluationButton } from "@/components/yi-future/scoring/UnlockEvaluationButton";
import { PHASES } from "@/lib/yi-future/constants";
import {
  aggregateEvaluations,
  meetsThreshold,
  rankTeams,
  type CriteriaScores,
} from "@/lib/yi-future/rubric";
import { MEMBER_CRITERIA } from "@/lib/yi-future/member-rubric";

type Team = {
  id: string;
  team_name: string;
  problem_statement_id: string | null;
  problem_statements: { title: string } | null;
};

type Evaluation = {
  // Needed so a submitted score can be named for reopening.
  id: string;
  team_id: string;
  jury_id: string;
  criteria_scores: CriteriaScores;
  total_score: number;
  status: string | null;
  jury_assignments: { jury_name: string; archetype: string } | null;
};

type RubricRow = {
  id: string;
  total_max: number | null;
  threshold_for_national: number | null;
};

async function getTeams(
  chapterId: string,
  editionId: string
): Promise<Team[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, problem_statement_id, problem_statements(title)"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as Team[]) ?? [];
}

async function getEvaluations(
  chapterId: string,
  editionId: string
): Promise<Evaluation[]> {
  const svc = await createServiceClient();
  // Would lose evaluations past PostgREST's ~1000-row cap once scoring runs at
  // scale (a chapter can have 231 teams × several jurors), dropping jurors from
  // the average and therefore mis-ranking teams against the national threshold.
  return await fetchAllRows<Evaluation>((from, to) =>
    svc
      .schema("future")
      .from("evaluations")
      .select(
        "id, team_id, jury_id, criteria_scores, total_score, status, teams!inner(chapter_id, edition_id), jury_assignments(jury_name, archetype)"
      )
      .eq("teams.chapter_id", chapterId)
      .eq("teams.edition_id", editionId)
      .order("team_id", { ascending: true })
      .order("jury_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: Evaluation[] | null;
      error: unknown;
    }>
  );
}

async function getDefaultRubric(editionId: string): Promise<RubricRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("rubrics")
    .select("id, total_max, threshold_for_national")
    .eq("edition_id", editionId)
    .eq("scope", "chapter")
    .eq("is_default", true)
    .maybeSingle();
  return (data as unknown as RubricRow) ?? null;
}

/* ── Journey gamification data ── */

type PhaseEvent = { id: string; phase: string };
type TeamMember = { team_id: string; delegate_id: string };
type AttendanceRow = { delegate_id: string; phase_event_id: string; attended: boolean | null };

async function getPhaseEvents(
  chapterId: string,
  editionId: string
): Promise<PhaseEvent[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("phase_events")
    .select("id, phase")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId);
  return (data as unknown as PhaseEvent[]) ?? [];
}

async function getTeamMembers(
  chapterId: string,
  editionId: string
): Promise<TeamMember[]> {
  const svc = await createServiceClient();
  // Was losing team members past PostgREST's ~1000-row cap. Dropped members
  // both shrank the per-team roster the journey average divides by AND short-
  // changed the delegate-id list this feeds downstream.
  return await fetchAllRows<TeamMember>((from, to) =>
    svc
      .schema("future")
      .from("team_members")
      .select("team_id, delegate_id, teams!inner(chapter_id, edition_id)")
      .eq("teams.chapter_id", chapterId)
      .eq("teams.edition_id", editionId)
      .order("team_id", { ascending: true })
      .order("delegate_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: TeamMember[] | null;
      error: unknown;
    }>
  );
}

// member_evaluations is not in the generated types yet — same cast pattern the
// action files use (placement-override.ts, team-invites.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type MemberEvalRow = {
  jury_id: string;
  team_id: string;
  delegate_id: string;
  scores: Record<string, number> | null;
};

/**
 * Individual Recognition scores (future.member_evaluations).
 *
 * These were written by jurors from #866 onward and read by NO admin screen
 * until now — a juror could score a delegate and nobody running the chapter
 * could ever see it. Scoped to this chapter's teams, and paginated because a
 * team can have 5 members × several jurors, which passes PostgREST's ~1000-row
 * cap faster than the team count suggests.
 *
 * Unlike the team table above this does NOT filter to submitted: an individual
 * score on a still-open scorecard is real and the organiser needs to see it.
 */
async function getMemberEvaluations(
  chapterId: string,
  editionId: string
): Promise<MemberEvalRow[]> {
  const svc = await createServiceClient();
  return await fetchAllRows<MemberEvalRow>((from, to) =>
    (svc as unknown as AnyClient)
      .schema("future")
      .from("member_evaluations")
      .select(
        "jury_id, team_id, delegate_id, scores, teams!inner(chapter_id, edition_id)"
      )
      .eq("teams.chapter_id", chapterId)
      .eq("teams.edition_id", editionId)
      .order("team_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: MemberEvalRow[] | null;
      error: unknown;
    }>
  );
}

/** delegate id -> full name, for the rows above. Names only, nothing else. */
async function getDelegateNames(
  chapterId: string,
  editionId: string
): Promise<Map<string, string>> {
  const svc = await createServiceClient();
  const rows = await fetchAllRows<{ id: string; full_name: string }>(
    (from, to) =>
      svc
        .schema("future")
        .from("delegates")
        .select("id, full_name")
        .eq("chapter_id", chapterId)
        .eq("edition_id", editionId)
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: { id: string; full_name: string }[] | null;
        error: unknown;
      }>
  );
  return new Map(rows.map((r) => [r.id, r.full_name]));
}

async function getAllAttendance(
  phaseEventIds: string[]
): Promise<AttendanceRow[]> {
  if (phaseEventIds.length === 0) return [];
  const svc = await createServiceClient();
  // Was .in("delegate_id", <every team member id>): that id list came out of a
  // capped read so it was already short, and 600+ UUIDs build a request URL
  // tens of KB long that the server rejects. Scope by the chapter's handful of
  // phase events and page the rows instead — a truncated read under-counted
  // attendance and silently deflated every team's journey score.
  return await fetchAllRows<AttendanceRow>((from, to) =>
    svc
      .schema("future")
      .from("phase_event_attendance")
      .select("delegate_id, phase_event_id, attended")
      .in("phase_event_id", phaseEventIds)
      .order("phase_event_id", { ascending: true })
      .order("delegate_id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: AttendanceRow[] | null;
      error: unknown;
    }>
  );
}

function computeTeamJourneyScores(
  teamMembers: TeamMember[],
  phaseEvents: PhaseEvent[],
  attendance: AttendanceRow[]
): Map<string, number> {
  const POINTS_PER_PHASE = 5;
  // Events by phase
  const eventsByPhase = new Map<string, string[]>();
  for (const e of phaseEvents) {
    if (!eventsByPhase.has(e.phase)) eventsByPhase.set(e.phase, []);
    eventsByPhase.get(e.phase)!.push(e.id);
  }
  // Attended set: delegate_id -> Set<event_id>
  const attendedByDelegate = new Map<string, Set<string>>();
  for (const a of attendance) {
    if (!a.attended) continue;
    if (!attendedByDelegate.has(a.delegate_id))
      attendedByDelegate.set(a.delegate_id, new Set());
    attendedByDelegate.get(a.delegate_id)!.add(a.phase_event_id);
  }
  // Group delegates by team
  const delegatesByTeam = new Map<string, string[]>();
  for (const tm of teamMembers) {
    if (!delegatesByTeam.has(tm.team_id))
      delegatesByTeam.set(tm.team_id, []);
    delegatesByTeam.get(tm.team_id)!.push(tm.delegate_id);
  }
  // Compute average journey points per team
  const result = new Map<string, number>();
  for (const [teamId, delegates] of Array.from(delegatesByTeam)) {
    if (delegates.length === 0) continue;
    let teamTotal = 0;
    for (const delId of delegates) {
      const attended = attendedByDelegate.get(delId) ?? new Set();
      let delegatePoints = 0;
      for (const phase of PHASES) {
        const phaseEventIds = eventsByPhase.get(phase) ?? [];
        if (phaseEventIds.length === 0) continue;
        const phaseAttended = phaseEventIds.filter((id) =>
          attended.has(id)
        ).length;
        delegatePoints +=
          (phaseAttended / phaseEventIds.length) * POINTS_PER_PHASE;
      }
      teamTotal += delegatePoints;
    }
    result.set(teamId, Number((teamTotal / delegates.length).toFixed(1)));
  }
  return result;
}

export default async function ScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ present?: string }>;
}) {
  const { present: presentFlag } = await searchParams;
  const showPresentOnly = presentFlag === "1";
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [
    teams,
    evals,
    rubric,
    phaseEvents,
    teamMembers,
    memberEvals,
    delegateNames,
  ] = await Promise.all([
    getTeams(ctx.chapterId, ctx.editionId),
    getEvaluations(ctx.chapterId, ctx.editionId),
    getDefaultRubric(ctx.editionId),
    getPhaseEvents(ctx.chapterId, ctx.editionId),
    getTeamMembers(ctx.chapterId, ctx.editionId),
    getMemberEvaluations(ctx.chapterId, ctx.editionId),
    getDelegateNames(ctx.chapterId, ctx.editionId),
  ]);

  // Individual Recognition, grouped team -> delegate -> that delegate's scores
  // averaged across whichever jurors scored them. These do NOT feed the team
  // total by design (see lib/yi-future/member-rubric.ts) — this section only
  // makes them visible.
  // Juror names come from the evaluations join. A juror who scored a delegate
  // but has no team evaluation row yet falls back to "a juror" rather than
  // leaking a raw uuid onto the screen.
  const jurorNameById = new Map(
    evals
      .filter((e) => e.jury_assignments?.jury_name)
      .map((e) => [e.jury_id, e.jury_assignments!.jury_name])
  );
  const memberScoresByTeam = new Map<
    string,
    {
      delegateId: string;
      name: string;
      perCriterion: Map<string, { total: number; count: number }>;
      jurors: Set<string>;
    }[]
  >();
  for (const row of memberEvals) {
    if (!row.scores) continue;
    if (!memberScoresByTeam.has(row.team_id)) {
      memberScoresByTeam.set(row.team_id, []);
    }
    const list = memberScoresByTeam.get(row.team_id)!;
    let entry = list.find((d) => d.delegateId === row.delegate_id);
    if (!entry) {
      entry = {
        delegateId: row.delegate_id,
        name: delegateNames.get(row.delegate_id) ?? "(unknown delegate)",
        perCriterion: new Map(),
        jurors: new Set(),
      };
      list.push(entry);
    }
    entry.jurors.add(jurorNameById.get(row.jury_id) ?? "a juror");
    for (const c of MEMBER_CRITERIA) {
      const v = row.scores[c.key];
      if (typeof v !== "number") continue;
      const acc = entry.perCriterion.get(c.key) ?? { total: 0, count: 0 };
      acc.total += v;
      acc.count += 1;
      entry.perCriterion.set(c.key, acc);
    }
  }
  const totalMemberScored = memberEvals.length;

  // Journey score computation. Fetch attendance by phase event (a handful per
  // chapter) rather than by a huge delegate-id list; computeTeamJourneyScores
  // only ever reads the delegates that are actually on a team, so any extra
  // rows are ignored.
  const allAttendance = await getAllAttendance(phaseEvents.map((e) => e.id));
  const journeyByTeam = computeTeamJourneyScores(
    teamMembers,
    phaseEvents,
    allAttendance
  );
  const MAX_JOURNEY = 15;

  // Group evals by team
  const byTeam = new Map<string, Evaluation[]>();
  for (const e of evals) {
    if (e.status !== "submitted") continue;
    if (!byTeam.has(e.team_id)) byTeam.set(e.team_id, []);
    byTeam.get(e.team_id)!.push(e);
  }

  // ─── Scorecards that are OPEN, and therefore NOT counted above ────────
  //
  // Only a submitted evaluation counts toward a team's average. A scorecard
  // that a juror started and never submitted — or that an admin reopened so a
  // mistake could be corrected — silently drops out of the average, and until
  // now nothing on this page said so. The team simply appeared to have been
  // judged by fewer people.
  //
  // That is not hypothetical. At the Erode chapter final on 12 Aug, five
  // scorecards were left unsubmitted and THREE teams ended with no counted
  // jury score at all. Nobody could see it while it was still fixable.
  const openByTeam = new Map<string, number>();
  for (const e of evals) {
    if (e.status === "submitted") continue;
    openByTeam.set(e.team_id, (openByTeam.get(e.team_id) ?? 0) + 1);
  }
  const teamsWithOpenScores = teams.filter((t) => (openByTeam.get(t.id) ?? 0) > 0);
  // The sharpest case: a juror has an open card and the team has NO counted
  // score at all, so it is currently unrankable.
  const teamsWithNoCountedScore = teamsWithOpenScores.filter(
    (t) => (byTeam.get(t.id)?.length ?? 0) === 0
  );

  const teamAggregates = teams.map((t) => {
    const list = byTeam.get(t.id) ?? [];
    const agg = aggregateEvaluations(list);
    return {
      team_id: t.id,
      team_name: t.team_name,
      problem_title: t.problem_statements?.title ?? "—",
      count: agg.count,
      total: agg.averageTotal,
      clears:
        rubric && list.length > 0
          ? meetsThreshold(agg.averageTotal, {
              name: "",
              criteria: [],
              total_max: rubric.total_max ?? 0,
              threshold_for_national: rubric.threshold_for_national ?? 0,
            })
          : false,
    };
  });

  // Ranks are computed across EVERY team before any display filter, so hiding
  // absent teams can never change who is #1.
  const ranked = rankTeams(teamAggregates.filter((a) => a.count > 0));
  const rankByTeam = new Map(ranked.map((r) => [r.team_id, r.rank]));

  // "Checked in only" — teams with at least one member marked present, which is
  // exactly the set the jury screen now shows. Reuses attendance and membership
  // already loaded above, so the toggle costs no extra query.
  const presentDelegateIds = new Set(
    allAttendance.filter((a) => a.attended).map((a) => a.delegate_id)
  );
  const presentTeamIds = new Set(
    teamMembers
      .filter((m) => presentDelegateIds.has(m.delegate_id))
      .map((m) => m.team_id)
  );
  const visibleAggregates = showPresentOnly
    ? teamAggregates.filter((a) => presentTeamIds.has(a.team_id))
    : teamAggregates;
  const absentCount = teamAggregates.length - presentTeamIds.size;

  const totalMax = rubric?.total_max ?? 100;
  const threshold = rubric?.threshold_for_national ?? 70;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold tracking-widest text-yi-gold uppercase mb-1">
            Visible to chapter admin only
          </div>
          <h2 className="text-2xl font-bold text-navy">Scoring</h2>
          <p className="mt-1 text-sm text-navy/60">
            Evaluations averaged across jurors. Threshold {threshold}/
            {totalMax} to advance to nationals.
          </p>
          {/* Same set the jury screen shows: at least one member checked in.
              Ranks are computed across every team before this filter, so the
              numbers never move — only which rows are listed. */}
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Link
              href="/yi-future/chapter/scoring"
              className={
                showPresentOnly
                  ? "px-2 py-1 rounded-full border border-navy/20 text-navy/60 hover:border-navy/40"
                  : "px-2 py-1 rounded-full bg-navy text-ivory font-semibold"
              }
            >
              All teams ({teamAggregates.length})
            </Link>
            <Link
              href="/yi-future/chapter/scoring?present=1"
              className={
                showPresentOnly
                  ? "px-2 py-1 rounded-full bg-navy text-ivory font-semibold"
                  : "px-2 py-1 rounded-full border border-navy/20 text-navy/60 hover:border-navy/40"
              }
            >
              Checked in only ({presentTeamIds.size})
            </Link>
            {showPresentOnly && absentCount > 0 && (
              <span className="text-navy/50">
                {absentCount} {absentCount === 1 ? "team" : "teams"} hidden —
                nobody checked in. Ranks still count every team.
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/api/csv/scoring?chapter_id=${ctx.chapterId}`}
          className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
        >
          <span>↓</span> CSV
        </Link>
      </div>

      {!rubric && (
        <div className="bg-yi-saffron/10 border border-yi-saffron/30 rounded-md p-3 text-sm text-yi-saffron">
          No default chapter rubric — configure one in national admin.
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Rank</th>
              <th className="text-left px-4 py-3 font-semibold">Team</th>
              <th className="text-left px-4 py-3 font-semibold">Problem</th>
              <th className="text-right px-4 py-3 font-semibold">Jurors</th>
              <th className="text-right px-4 py-3 font-semibold">Average</th>
              <th className="text-right px-4 py-3 font-semibold">Journey</th>
              <th className="text-right px-4 py-3 font-semibold">Threshold</th>
            </tr>
          </thead>
          <tbody>
            {visibleAggregates.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-navy/40"
                >
                  {showPresentOnly && teamAggregates.length > 0
                    ? "No team has anyone checked in yet."
                    : "No teams."}
                </td>
              </tr>
            ) : (
              visibleAggregates.map((a) => {
                const rank = rankByTeam.get(a.team_id);
                return (
                  <tr key={a.team_id} className="border-t border-navy/5">
                    <td className="px-4 py-3 font-mono font-bold text-navy">
                      {rank ? `#${rank}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{a.team_name}</td>
                    <td className="px-4 py-3 text-xs text-navy/60 truncate max-w-[200px]">
                      {a.problem_title}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {a.count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {a.count > 0 ? (
                        <>
                          {a.total} / {totalMax}
                        </>
                      ) : (
                        <span className="text-navy/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const jp = journeyByTeam.get(a.team_id);
                        if (jp === undefined)
                          return <span className="text-navy/30 text-xs">—</span>;
                        const pct = Math.round((jp / MAX_JOURNEY) * 100);
                        return (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-navy/10">
                              <div
                                className="h-1.5 rounded-full bg-yi-gold"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-bold">
                              {jp}/{MAX_JOURNEY}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.count === 0 ? (
                        <span className="text-navy/30 text-xs">—</span>
                      ) : a.clears ? (
                        <span className="text-xs font-semibold text-yi-green">
                          ✓ clears
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-navy/40">
                          below
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Open scorecards ───────────────────────────────────────────
          Named BEFORE the ranking below, because the ranking is computed
          without them. An admin reading a table of averages has no other way
          to know a juror is still holding a card. */}
      {teamsWithOpenScores.length > 0 && (
        <section
          role="alert"
          className="border-2 border-yi-gold/60 bg-yi-gold/5 rounded-lg p-4"
        >
          <h3 className="text-sm font-bold text-navy">
            {teamsWithOpenScores.length}{" "}
            {teamsWithOpenScores.length === 1 ? "team has" : "teams have"} a
            juror still editing
          </h3>
          <p className="mt-1 text-xs text-navy/70 leading-relaxed">
            A scorecard only counts once the juror presses Submit. The
            scorecards below are open — reopened, or started and never
            finished — so they are <strong>not</strong> included in the
            averages or the ranking. Ask those jurors to submit before treating
            any result as final.
          </p>
          <ul className="mt-3 space-y-1">
            {teamsWithOpenScores.map((t) => {
              const open = openByTeam.get(t.id) ?? 0;
              const counted = byTeam.get(t.id)?.length ?? 0;
              return (
                <li key={t.id} className="text-xs text-navy">
                  <strong>{t.team_name}</strong> — {counted} counted,{" "}
                  <span className="font-semibold text-red-600">
                    {open} still open
                  </span>
                  {counted === 0 && (
                    <span className="font-semibold text-red-600">
                      {" "}
                      · no jury score at all yet
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {teamsWithNoCountedScore.length > 0 && (
            <p className="mt-3 text-xs font-semibold text-red-600">
              {teamsWithNoCountedScore.length}{" "}
              {teamsWithNoCountedScore.length === 1
                ? "team currently has no counted jury score"
                : "teams currently have no counted jury score"}{" "}
              and cannot be ranked fairly until those scorecards are submitted.
            </p>
          )}
        </section>
      )}

      {/* Per-team jury breakdown */}
      {teamAggregates.some((a) => a.count > 0) && (
        <section>
          <h3 className="text-sm font-bold text-navy mb-3">
            Juror-by-juror breakdown
          </h3>
          <div className="space-y-3">
            {teams.map((t) => {
              const list = byTeam.get(t.id) ?? [];
              if (list.length === 0) return null;
              return (
                <div
                  key={t.id}
                  className="bg-white border border-navy/10 rounded-lg p-4"
                >
                  <div className="font-bold text-navy mb-2">{t.team_name}</div>
                  <ul className="space-y-1 text-sm">
                    {list.map((e) => (
                      <li
                        key={`${e.team_id}-${e.jury_id}`}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 border border-navy/10 rounded"
                      >
                        <div>
                          <div className="font-semibold">
                            {e.jury_assignments?.jury_name ?? "—"}
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                            {e.jury_assignments?.archetype ?? "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-mono font-bold text-navy">
                            {e.total_score} / {totalMax}
                          </div>
                          {/* Reopen. The juror's numbers stay put; only they can
                              enter a new one. Every use is logged. */}
                          <UnlockEvaluationButton
                            evaluationId={e.id}
                            juryName={e.jury_assignments?.jury_name ?? null}
                            teamName={t.team_name}
                            score={e.total_score}
                            totalMax={totalMax}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Individual Recognition — per-delegate scores. Written by jurors since
          #866 and, until now, displayed nowhere. Deliberately does NOT feed any
          team total; this is for best-delegate style recognition only. */}
      <div className="bg-white border border-navy/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-navy">
          Individual Recognition
        </h3>
        <p className="mt-1 text-xs text-navy/50">
          Per-delegate scores from the jury screen, averaged across whichever
          jurors scored that delegate. These do not change any team&apos;s total
          or rank — they are for individual awards.
        </p>

        {totalMemberScored === 0 ? (
          <p className="mt-3 text-sm text-navy/50">
            No delegate has been scored individually yet. Scores appear here as
            jurors fill in the Individual Recognition section.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {teams.map((t) => {
              const rows = memberScoresByTeam.get(t.id);
              if (!rows || rows.length === 0) return null;
              return (
                <div key={t.id}>
                  <div className="text-xs font-semibold text-navy">
                    {t.team_name}
                  </div>
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-widest text-navy/40">
                          <th className="py-1 pr-3">Delegate</th>
                          {MEMBER_CRITERIA.map((c) => (
                            <th key={c.key} className="py-1 pr-3">
                              {c.label} /{c.max}
                            </th>
                          ))}
                          <th className="py-1 pr-3">Scored by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((d) => (
                          <tr
                            key={d.delegateId}
                            className="border-t border-navy/5"
                          >
                            <td className="py-1 pr-3 font-medium text-navy">
                              {d.name}
                            </td>
                            {MEMBER_CRITERIA.map((c) => {
                              const acc = d.perCriterion.get(c.key);
                              return (
                                <td key={c.key} className="py-1 pr-3">
                                  {acc && acc.count > 0
                                    ? (acc.total / acc.count).toFixed(1)
                                    : "—"}
                                </td>
                              );
                            })}
                            <td className="py-1 pr-3 text-xs text-navy/50">
                              {Array.from(d.jurors).join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-navy/40">
        <Link
          href="/yi-future/chapter/jury"
          className="underline hover:text-navy"
        >
          Manage jury
        </Link>{" "}
        ·{" "}
        <Link
          href="/yi-future/national/admin/rubrics"
          className="underline hover:text-navy"
        >
          Edit rubric
        </Link>
      </p>
    </div>
  );
}
