import { createServiceClient } from "@/lib/yi-future/supabase/server";

type EditionRow = {
  id: string;
  name: string;
  slug: string;
  current_stage: string | null;
};

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
};

type DelegateRow = {
  id: string;
  chapter_id: string;
  registered_at: string | null;
};

type TeamRow = {
  id: string;
  problem_statement_id: string | null;
};

type SubmissionRow = {
  team_id: string;
  phase: "phase_a" | "phase_b" | "phase_c";
  status: "draft" | "submitted" | "approved" | "rejected" | null;
};

type EvaluationRow = {
  team_id: string;
};

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;
const REGION_LABELS: Record<string, string> = {
  ER: "East",
  NER: "North-East",
  NR: "North",
  SRTKKA: "South (TN/KKA)",
  SRTN: "South (TN)",
  WR: "West",
};

async function getActiveEdition(): Promise<EditionRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug, current_stage")
    .eq("is_active", true)
    .maybeSingle();
  return (data as EditionRow | null) ?? null;
}

export default async function NationalMetricsPage() {
  const edition = await getActiveEdition();

  if (!edition) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-navy">Platform Metrics</h2>
        <div className="bg-white border border-navy/10 rounded-lg p-6 text-sm text-navy/60">
          No active edition.
        </div>
      </div>
    );
  }

  const svc = await createServiceClient();

  // Parallel queries
  const [
    delegatesRes,
    chaptersRes,
    mentorsRes,
    juryRes,
    collegesApprovedRes,
    collegesPendingRes,
    teamsRes,
    teamMembersRes,
    submissionsRes,
    evaluationsRes,
  ] = await Promise.all([
    svc
      .schema("future")
      .from("delegates")
      .select("id, chapter_id, registered_at")
      .eq("edition_id", edition.id),
    svc
      .schema("yi")
      .from("chapters")
      .select("id, name, region")
      .eq("is_active", true),
    svc
      .schema("future")
      .from("mentors")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition.id),
    svc
      .schema("future")
      .from("jury_assignments")
      .select("id", { count: "exact", head: true })
      .eq("edition_id", edition.id)
      .eq("is_active", true),
    svc
      .schema("future")
      .from("colleges")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", true),
    svc
      .schema("future")
      .from("colleges")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", false),
    svc
      .schema("future")
      .from("teams")
      .select("id, problem_statement_id")
      .eq("edition_id", edition.id),
    svc.schema("future").from("team_members").select("delegate_id, team_id"),
    svc
      .schema("future")
      .from("submissions")
      .select("team_id, phase, status"),
    svc.schema("future").from("evaluations").select("team_id"),
  ]);

  const delegates: DelegateRow[] = (delegatesRes.data as DelegateRow[]) ?? [];
  const chapters: ChapterRow[] = (chaptersRes.data as ChapterRow[]) ?? [];
  const teams: TeamRow[] = (teamsRes.data as TeamRow[]) ?? [];
  const teamMembers: { delegate_id: string; team_id: string }[] =
    (teamMembersRes.data as { delegate_id: string; team_id: string }[]) ?? [];
  const submissions: SubmissionRow[] =
    (submissionsRes.data as SubmissionRow[]) ?? [];
  const evaluations: EvaluationRow[] =
    (evaluationsRes.data as EvaluationRow[]) ?? [];

  const totalDelegates = delegates.length;
  const totalChapters = chapters.length;
  const chaptersWithDelegates = new Set(delegates.map((d) => d.chapter_id))
    .size;
  const totalMentors = mentorsRes.count ?? 0;
  const totalJury = juryRes.count ?? 0;
  const totalCollegesApproved = collegesApprovedRes.count ?? 0;
  const totalCollegesPending = collegesPendingRes.count ?? 0;
  const totalTeams = teams.length;

  // ── Registrations over time (last 30 days) ─────────────────────────────
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: { date: Date; key: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: d, key, count: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.key, d]));
  for (const d of delegates) {
    if (!d.registered_at) continue;
    const key = d.registered_at.slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket) bucket.count += 1;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const totalLast30 = days.reduce((acc, d) => acc + d.count, 0);

  // ── By region ──────────────────────────────────────────────────────────
  const chapterIdToRegion = new Map(
    chapters.map((c) => [c.id, c.region ?? "—"])
  );
  const regionCounts: Record<string, number> = {};
  for (const r of REGIONS) regionCounts[r] = 0;
  for (const d of delegates) {
    const region = chapterIdToRegion.get(d.chapter_id);
    if (region && region in regionCounts) regionCounts[region] += 1;
  }
  const regionMax = Math.max(1, ...Object.values(regionCounts));

  // ── Conversion funnel ──────────────────────────────────────────────────
  // Stage 1: Registered
  const stage1 = totalDelegates;
  // Stage 2: On a team
  const delegatesOnTeam = new Set(teamMembers.map((m) => m.delegate_id));
  // Limit "on team" count to delegates belonging to active edition
  const stage2 = delegates.filter((d) => delegatesOnTeam.has(d.id)).length;
  // Stage 3: Team has a problem chosen — count delegates whose team has problem_statement_id
  const teamsWithProblem = new Set(
    teams.filter((t) => t.problem_statement_id !== null).map((t) => t.id)
  );
  const delegateToTeam = new Map(
    teamMembers.map((m) => [m.delegate_id, m.team_id])
  );
  const stage3 = delegates.filter((d) => {
    const tid = delegateToTeam.get(d.id);
    return tid && teamsWithProblem.has(tid);
  }).length;
  // Stage 4: Phase A submitted — count delegates on teams that have submissions for phase_a with status='submitted' or 'approved'
  const teamsWithPhaseA = new Set(
    submissions
      .filter(
        (s) =>
          s.phase === "phase_a" &&
          (s.status === "submitted" || s.status === "approved")
      )
      .map((s) => s.team_id)
  );
  const stage4 = delegates.filter((d) => {
    const tid = delegateToTeam.get(d.id);
    return tid && teamsWithPhaseA.has(tid);
  }).length;
  // Stage 5: Evaluated — distinct team_ids in evaluations; convert to delegate count
  const evaluatedTeams = new Set(evaluations.map((e) => e.team_id));
  const stage5 = delegates.filter((d) => {
    const tid = delegateToTeam.get(d.id);
    return tid && evaluatedTeams.has(tid);
  }).length;

  const funnel = [
    { name: "Registered", count: stage1 },
    { name: "On a team", count: stage2 },
    { name: "Team has problem", count: stage3 },
    { name: "Phase A submitted", count: stage4 },
    { name: "Evaluated", count: stage5 },
  ];
  const funnelMax = Math.max(1, stage1);

  // ── Top performing chapters ────────────────────────────────────────────
  const chapterCounts = new Map<string, number>();
  for (const d of delegates) {
    chapterCounts.set(
      d.chapter_id,
      (chapterCounts.get(d.chapter_id) ?? 0) + 1
    );
  }
  const topChapters = chapters
    .map((c) => ({
      id: c.id,
      name: c.name,
      region: c.region,
      count: chapterCounts.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-navy">Platform Metrics</h2>
        <p className="mt-1 text-sm text-navy/60">
          {edition.name}{" "}
          <span className="text-xs px-1.5 py-0.5 rounded bg-yi-gold/10 text-yi-gold ml-1">
            {edition.current_stage ?? "—"}
          </span>
        </p>
      </div>

      {/* ── KPI TILES ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPI label="Delegates" value={totalDelegates} sub="registered" />
        <KPI label="Chapters" value={totalChapters} sub="active in Yi" />
        <KPI
          label="Chapters with delegates"
          value={`${chaptersWithDelegates}/${totalChapters}`}
          sub={`${totalChapters - chaptersWithDelegates} at 0`}
        />
        <KPI label="Mentors" value={totalMentors} sub="this edition" />
        <KPI label="Jury" value={totalJury} sub="active pool" />
        <KPI
          label="Colleges"
          value={totalCollegesApproved}
          sub={`${totalCollegesPending} pending`}
        />
        <KPI label="Teams" value={totalTeams} sub="this edition" />
      </div>

      {/* ── REGISTRATIONS OVER TIME ──────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50">
            Registrations · last 30 days
          </h3>
          <p className="text-[11px] text-navy/40">
            {totalLast30} delegates · peak {maxDay}/day
          </p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="flex items-end gap-1 h-32 relative">
            {/* Y-axis labels */}
            <div className="absolute -left-1 top-0 text-[10px] text-navy/40 font-mono">
              {maxDay}
            </div>
            <div className="absolute -left-1 bottom-0 text-[10px] text-navy/40 font-mono">
              0
            </div>
            <div className="flex items-end gap-[3px] h-full w-full pl-5">
              {days.map((d, i) => {
                const heightPct = (d.count / maxDay) * 100;
                const isMarked = [0, 6, 13, 20, 29].includes(i);
                return (
                  <div
                    key={d.key}
                    className="flex-1 flex flex-col justify-end relative group"
                    title={`${d.key}: ${d.count} delegates`}
                  >
                    <div
                      className="bg-yi-gold rounded-t-sm hover:bg-yi-saffron transition-colors"
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                    />
                    {isMarked && (
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-navy/40 font-mono">
                        {i + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-5 flex justify-between text-[10px] text-navy/40 pl-5">
            <span>Day 1 ({days[0]?.key.slice(5)})</span>
            <span>Today ({days[29]?.key.slice(5)})</span>
          </div>
        </div>
      </section>

      {/* ── BY REGION ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
          By Region
        </h3>
        <div className="bg-white border border-navy/10 rounded-lg p-4 space-y-2.5">
          {REGIONS.map((r) => {
            const count = regionCounts[r];
            const widthPct = (count / regionMax) * 100;
            const sharePct =
              totalDelegates > 0
                ? Math.round((count / totalDelegates) * 100)
                : 0;
            return (
              <div key={r} className="flex items-center gap-3 text-sm">
                <div className="w-24 shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-yi-gold">
                    {r}
                  </div>
                  <div className="text-[10px] text-navy/50">
                    {REGION_LABELS[r]}
                  </div>
                </div>
                <div className="flex-1 relative h-7 bg-navy/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-navy/80 transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 text-[11px] font-semibold text-navy">
                    {sharePct}%
                  </div>
                </div>
                <div className="w-12 text-right font-bold text-navy tabular-nums">
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CONVERSION FUNNEL ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50">
            Conversion Funnel
          </h3>
          <p className="text-[11px] text-navy/40">
            Where delegates drop off in the 90-day journey
          </p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-4 space-y-2">
          {funnel.map((stage, i) => {
            const widthPct = (stage.count / funnelMax) * 100;
            const prev = i > 0 ? funnel[i - 1].count : null;
            const vsPrev =
              prev !== null && prev > 0
                ? Math.round((stage.count / prev) * 100)
                : null;
            const vsStage1 =
              i > 0 && stage1 > 0
                ? Math.round(((stage1 - stage.count) / stage1) * 100)
                : null;
            const tone =
              i === 0
                ? "bg-navy"
                : vsPrev !== null && vsPrev < 50
                ? "bg-yi-saffron"
                : "bg-yi-gold";
            return (
              <div key={stage.name} className="text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-navy">
                    {i + 1}. {stage.name}
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    {vsPrev !== null && (
                      <span className="text-navy/60">
                        {vsPrev}% of prev
                      </span>
                    )}
                    {vsStage1 !== null && (
                      <span className="text-red-600 font-medium">
                        −{vsStage1}% vs Stage 1
                      </span>
                    )}
                    <span className="font-bold text-navy tabular-nums w-12 text-right">
                      {stage.count}
                    </span>
                  </div>
                </div>
                <div className="h-5 bg-navy/5 rounded overflow-hidden">
                  <div
                    className={`h-full ${tone} transition-all`}
                    style={{ width: `${Math.max(1, widthPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── TOP CHAPTERS ──────────────────────────────────────────────── */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
          Top 5 Performing Chapters
        </h3>
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-3 py-2 font-semibold w-8">#</th>
                <th className="text-left px-3 py-2 font-semibold">Chapter</th>
                <th className="text-left px-3 py-2 font-semibold">Region</th>
                <th className="text-right px-3 py-2 font-semibold">
                  Delegates
                </th>
              </tr>
            </thead>
            <tbody>
              {topChapters.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center px-3 py-6 text-navy/40 text-xs"
                  >
                    No chapters with delegates yet.
                  </td>
                </tr>
              )}
              {topChapters.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-t border-navy/5 hover:bg-navy/[0.015]"
                >
                  <td className="px-3 py-2.5 text-navy/40 font-mono text-xs">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-navy">
                    {c.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-navy/50">
                      {c.region ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-yi-gold tabular-nums">
                    {c.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-navy">{value}</div>
      <div className="mt-0.5 text-[11px] text-navy/50">{sub}</div>
    </div>
  );
}
