import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { GuideNudge } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";
import { getCompletedSteps, logGuideEvent } from "@/lib/yi-future/guide/actions";

type Assignment = {
  team_id: string;
  teams: {
    id: string;
    team_name: string;
    status: string | null;
    problem_statements: { title: string } | null;
  } | null;
};

type Evaluation = {
  team_id: string;
  status: string | null;
  total_score: number | null;
};

async function getMyJury(
  juryId: string
): Promise<{
  id: string;
  jury_name: string;
  edition_id: string;
  chapter_id: string | null;
} | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("id, jury_name, edition_id, chapter_id")
    .eq("id", juryId)
    .maybeSingle();
  return (data as unknown as {
    id: string;
    jury_name: string;
    edition_id: string;
    chapter_id: string | null;
  }) ?? null;
}

async function getAssignments(juryId: string): Promise<Assignment[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_team_assignments")
    .select(
      "team_id, teams(id, team_name, status, problem_statements(title))"
    )
    .eq("jury_id", juryId);
  return (data as unknown as Assignment[]) ?? [];
}

/**
 * Team ids with AT LEAST ONE member checked in at this chapter's sessions.
 *
 * ANTI-BIAS [PRD §5.1]: this reads team_members ONLY to map attendance to a
 * team id. It selects no delegate name and returns none — the dashboard still
 * never learns who is on a team. Do not widen this select.
 *
 * Returns null when the chapter has NO attendance rows at all, which the caller
 * treats as "no check-in desk running, show every team". That distinction is
 * load-bearing: this page serves all chapters, and a chapter that never checks
 * anyone in must not have its jury's entire list disappear.
 */
async function getPresentTeamIds(
  chapterId: string | null
): Promise<Set<string> | null> {
  if (!chapterId) return null; // unknown scope -> do not filter anything out
  const svc = await createServiceClient();
  const { data, error } = await svc
    .schema("future")
    .from("phase_event_attendance")
    .select("delegate_id, phase_events!inner(chapter_id)")
    .eq("attended", true)
    .eq("phase_events.chapter_id", chapterId);
  if (error) return null; // fail OPEN on read error: never hide a real team
  const delegateIds = Array.from(
    new Set(
      ((data ?? []) as unknown as { delegate_id: string }[]).map(
        (r) => r.delegate_id
      )
    )
  );
  if (delegateIds.length === 0) return null; // nobody checked in anywhere yet

  const { data: rows, error: memberErr } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .in("delegate_id", delegateIds);
  if (memberErr) return null;
  return new Set(
    ((rows ?? []) as unknown as { team_id: string }[]).map((r) => r.team_id)
  );
}

async function getEvaluations(juryId: string): Promise<Evaluation[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select("team_id, status, total_score")
    .eq("jury_id", juryId);
  return (data as unknown as Evaluation[]) ?? [];
}

export default async function JuryDashboard({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await readSession();
  if (!session || session.type !== "jury") redirect("/yi-future/join");

  const me = await getMyJury(session.id);
  if (!me) redirect("/yi-future/join");

  const { submitted: submittedFlag } = await searchParams;
  const justSubmitted = submittedFlag === "1";

  const [allAssignments, presentTeamIds, evaluations] = await Promise.all([
    getAssignments(me.id),
    getPresentTeamIds(me.chapter_id),
    getEvaluations(me.id),
  ]);

  const evalByTeam = new Map<string, Evaluation>();
  for (const e of evaluations) evalByTeam.set(e.team_id, e);

  // Show only teams with at least one member checked in, so a juror is not
  // scrolling past teams that never turned up. Self-healing: a late arrival is
  // checked in at the desk and their team reappears on the next page load, with
  // nobody having to re-run a sync.
  //
  // Two deliberate fail-OPEN cases, both meaning "we cannot tell who is here",
  // where hiding teams would be worse than showing extras:
  //   • presentTeamIds === null — no attendance anywhere for this chapter (no
  //     check-in desk running), or the lookup failed.
  //   • a team already carries this juror's evaluation — never hide a team
  //     someone has started or finished scoring, whatever attendance says.
  const assignments =
    presentTeamIds === null
      ? allAssignments
      : allAssignments.filter(
          (a) => presentTeamIds.has(a.team_id) || evalByTeam.has(a.team_id)
        );
  const hiddenAbsentCount = allAssignments.length - assignments.length;

  const pending = assignments.filter(
    (a) => !evalByTeam.get(a.team_id) || evalByTeam.get(a.team_id)!.status === "draft"
  ).length;

  const guideCompleted = await getCompletedSteps("jury");

  return (
    <div className="space-y-5">
      {justSubmitted && (
        <div className="bg-yi-green/10 border border-yi-green/30 rounded-md p-3 text-sm font-semibold text-yi-green">
          ✓ Evaluation submitted. Pick the next team below.
        </div>
      )}
      <GuideNudge
        guide={GUIDES.lanes.jury}
        basePath="/yi-future/guide"
        completed={guideCompleted}
        onEvent={logGuideEvent}
      />
      {/* ANTI-BIAS [PRD §5.1]: Show only team_name, problem, status, your score.
          Never join team_members or render delegate names on this dashboard. */}
      <div>
        <h2 className="text-2xl font-bold text-navy">Your teams</h2>
        <p className="mt-1 text-sm text-navy/60">
          {me.jury_name} · {assignments.length} assigned · {pending} to score
        </p>
        {hiddenAbsentCount > 0 && (
          <p className="mt-1 text-xs text-navy/50">
            {hiddenAbsentCount} more{" "}
            {hiddenAbsentCount === 1 ? "team has" : "teams have"} nobody checked
            in yet, so {hiddenAbsentCount === 1 ? "it is" : "they are"} hidden.{" "}
            {hiddenAbsentCount === 1 ? "It" : "They"} will appear here once a
            member checks in at the desk.
          </p>
        )}
        <p className="mt-1 text-[10px] uppercase tracking-widest text-navy/40">
          Anonymous panel · member names hidden
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
          {hiddenAbsentCount > 0
            ? "None of your teams have checked in yet. They will appear here as soon as a member checks in at the desk."
            : "No teams assigned yet. Chapter admin will allocate shortly."}
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => {
            const ev = evalByTeam.get(a.team_id);
            const status = ev?.status ?? "pending";
            return (
              <li key={a.team_id}>
                <Link
                  href={`/yi-future/jury/${a.team_id}`}
                  prefetch
                  className="block bg-white border border-navy/10 rounded-lg p-4 hover:border-yi-gold/50 hover:shadow-sm active:scale-[0.99] active:bg-navy/5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-navy">
                        {a.teams?.team_name ?? "(unnamed)"}
                      </div>
                      <div className="text-xs text-navy/60 mt-0.5 truncate">
                        {a.teams?.problem_statements?.title ?? "No problem picked"}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {status === "submitted" ? (
                        <>
                          <div className="text-xs font-semibold text-yi-green">
                            ✓ Submitted
                          </div>
                          <div className="text-xs font-mono text-navy/60 mt-0.5">
                            {ev?.total_score ?? "—"}
                          </div>
                        </>
                      ) : status === "draft" ? (
                        <div className="text-xs font-semibold text-yi-saffron">
                          Draft saved
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-navy/40">
                          Pending
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
