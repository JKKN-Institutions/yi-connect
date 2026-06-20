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
} | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_assignments")
    .select("id, jury_name, edition_id")
    .eq("id", juryId)
    .maybeSingle();
  return (data as unknown as {
    id: string;
    jury_name: string;
    edition_id: string;
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

  const [assignments, evaluations] = await Promise.all([
    getAssignments(me.id),
    getEvaluations(me.id),
  ]);

  const evalByTeam = new Map<string, Evaluation>();
  for (const e of evaluations) evalByTeam.set(e.team_id, e);

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
        <p className="mt-1 text-[10px] uppercase tracking-widest text-navy/40">
          Anonymous panel · member names hidden
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/50">
          No teams assigned yet. Chapter admin will allocate shortly.
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
