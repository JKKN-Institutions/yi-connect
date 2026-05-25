import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { redirect } from "next/navigation";
import {
  TRACK_LABELS,
  AWARD_CATEGORIES,
  AWARD_CATEGORY_LABELS,
} from "@/lib/yi-future/constants";

// ─── Types ──────────────────────────────────────────────────────────

type EditionRow = { id: string; name: string };

type TeamWithRelations = {
  id: string;
  team_name: string;
  status: string | null;
  chapter_id: string;
  problem_statements: {
    title: string;
    tracks: { slug: string; name: string; icon: string | null; color_hex: string | null } | null;
  } | null;
};

type ChapterRow = { id: string; name: string };

type AdvancementRow = {
  id: string;
  team_id: string;
  total_score: number | null;
  rank: number | null;
  from_event_id: string;
  to_event_id: string;
  teams: TeamWithRelations | null;
};

type EvaluationRow = {
  id: string;
  team_id: string;
  total_score: number;
  jury_id: string;
  status: string | null;
  submitted_at: string | null;
  event_id: string;
};

type AwardRow = {
  id: string;
  category: string;
  team_id: string;
  citation: string | null;
  announced_at: string | null;
  event_id: string;
  position: number | null;
};

type Tab = "semi_final" | "grand_final" | "awards";

const TABS: { key: Tab; label: string }[] = [
  { key: "semi_final", label: "Semi-Final" },
  { key: "grand_final", label: "Grand Final" },
  { key: "awards", label: "Awards" },
];

// Exclude chapter_local_award from national-level awards
const NATIONAL_AWARD_CATEGORIES = AWARD_CATEGORIES.filter(
  (c) => c !== "chapter_local_award"
);

// ─── Data Fetchers ──────────────────────────────────────────────────

async function getActiveEdition(): Promise<EditionRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  return (data as EditionRow | null) ?? null;
}

async function getNationalTeams(editionId: string): Promise<{
  teams: TeamWithRelations[];
  advancements: AdvancementRow[];
}> {
  const svc = await createServiceClient();

  // Try advancements table first (more reliable)
  const { data: advancements } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "id, team_id, total_score, rank, from_event_id, to_event_id, teams(id, team_name, status, chapter_id, problem_statements(title, tracks(slug, name, icon, color_hex)))"
    )
    .order("total_score", { ascending: false });

  if (advancements && advancements.length > 0) {
    // Deduplicate teams (a team may have advanced through multiple rounds)
    const teamMap = new Map<string, TeamWithRelations>();
    for (const adv of advancements as unknown as AdvancementRow[]) {
      if (adv.teams && !teamMap.has(adv.team_id)) {
        teamMap.set(adv.team_id, adv.teams);
      }
    }
    return {
      teams: Array.from(teamMap.values()),
      advancements: (advancements as unknown as AdvancementRow[]) ?? [],
    };
  }

  // Fallback: query teams with national_finalist status
  const { data: teams } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, team_name, status, chapter_id, problem_statements(title, tracks(slug, name, icon, color_hex))"
    )
    .eq("edition_id", editionId)
    .in("status", ["national_finalist", "shortlisted"])
    .order("team_name");

  return {
    teams: (teams as unknown as TeamWithRelations[]) ?? [],
    advancements: [],
  };
}

async function getChapters(): Promise<Map<string, ChapterRow>> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .eq("is_active", true);
  const map = new Map<string, ChapterRow>();
  for (const ch of (data as unknown as ChapterRow[]) ?? []) {
    map.set(ch.id, ch);
  }
  return map;
}

async function getEvaluations(editionId: string): Promise<EvaluationRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("evaluations")
    .select("id, team_id, total_score, jury_id, status, submitted_at, event_id")
    .order("total_score", { ascending: false });
  return (data as unknown as EvaluationRow[]) ?? [];
}

async function getAwards(editionId: string): Promise<AwardRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("awards")
    .select("id, category, team_id, citation, announced_at, event_id, position");
  return (data as unknown as AwardRow[]) ?? [];
}

// ─── Helpers ────────────────────────────────────────────────────────

function groupByTrack(
  teams: TeamWithRelations[]
): Map<string, { trackName: string; colorHex: string; icon: string | null; teams: TeamWithRelations[] }> {
  const groups = new Map<
    string,
    { trackName: string; colorHex: string; icon: string | null; teams: TeamWithRelations[] }
  >();

  for (const team of teams) {
    const slug = team.problem_statements?.tracks?.slug ?? "unknown";
    const trackName =
      team.problem_statements?.tracks?.name ??
      (TRACK_LABELS as Record<string, string>)[slug] ??
      "Unknown Track";
    const colorHex = team.problem_statements?.tracks?.color_hex ?? "#1a1a3e";
    const icon = team.problem_statements?.tracks?.icon ?? null;

    if (!groups.has(slug)) {
      groups.set(slug, { trackName, colorHex, icon, teams: [] });
    }
    groups.get(slug)!.teams.push(team);
  }

  return groups;
}

// ─── Page ───────────────────────────────────────────────────────────

export default async function FinalsLivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  const sp = await searchParams;
  const activeTab = (sp.tab ?? "semi_final") as Tab;

  const edition = await getActiveEdition();
  if (!edition) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-navy">National Finals Live</h2>
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No active edition configured.{" "}
          <Link
            href="/yi-future/national/admin/editions"
            className="text-yi-gold font-semibold"
          >
            Configure one
          </Link>
          .
        </div>
      </div>
    );
  }

  const [{ teams, advancements }, chaptersMap, evaluations, awards] = await Promise.all([
    getNationalTeams(edition.id),
    getChapters(),
    getEvaluations(edition.id),
    getAwards(edition.id),
  ]);

  // Build evaluation lookup: team_id → evaluations[]
  const evalsByTeam = new Map<string, EvaluationRow[]>();
  for (const e of evaluations) {
    const list = evalsByTeam.get(e.team_id) ?? [];
    list.push(e);
    evalsByTeam.set(e.team_id, list);
  }

  // Build award lookup: category → AwardRow
  const awardByCategory = new Map<string, AwardRow>();
  for (const a of awards) {
    awardByCategory.set(a.category, a);
  }

  // Team lookup by id
  const teamById = new Map<string, TeamWithRelations>();
  for (const t of teams) {
    teamById.set(t.id, t);
  }

  const trackGroups = groupByTrack(teams);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">National Finals Live</h2>
          <p className="mt-1 text-sm text-navy/60">
            Day 2 competition dashboard &middot; {edition.name}
          </p>
        </div>
        <Link
          href="/yi-future/national/admin"
          className="text-xs font-semibold text-navy hover:text-yi-gold"
        >
          &larr; Dashboard
        </Link>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="National Teams" value={teams.length} sub="competing" />
        <KPI
          label="Tracks"
          value={trackGroups.size}
          sub="with teams"
        />
        <KPI
          label="Scores In"
          value={evaluations.filter((e) => e.status === "submitted" || e.submitted_at).length}
          sub={`of ${evaluations.length} expected`}
        />
        <KPI
          label="Awards Assigned"
          value={awards.length}
          sub={`of ${NATIONAL_AWARD_CATEGORIES.length} categories`}
        />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-navy/10 gap-0">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/yi-future/national/admin/finals/live?tab=${tab.key}`}
            className={`px-5 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-yi-gold text-navy font-bold"
                : "text-navy/50 hover:text-navy/70"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "semi_final" && (
        <SemiFinalTab
          trackGroups={trackGroups}
          chaptersMap={chaptersMap}
          evalsByTeam={evalsByTeam}
        />
      )}

      {activeTab === "grand_final" && (
        <GrandFinalTab
          trackGroups={trackGroups}
          chaptersMap={chaptersMap}
          evalsByTeam={evalsByTeam}
          advancements={advancements}
        />
      )}

      {activeTab === "awards" && (
        <AwardsTab
          awards={awards}
          awardByCategory={awardByCategory}
          teamById={teamById}
          chaptersMap={chaptersMap}
          teams={teams}
        />
      )}
    </div>
  );
}

// ─── Semi-Final Tab ─────────────────────────────────────────────────

function SemiFinalTab({
  trackGroups,
  chaptersMap,
  evalsByTeam,
}: {
  trackGroups: Map<
    string,
    { trackName: string; colorHex: string; icon: string | null; teams: TeamWithRelations[] }
  >;
  chaptersMap: Map<string, ChapterRow>;
  evalsByTeam: Map<string, EvaluationRow[]>;
}) {
  if (trackGroups.size === 0) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
        <div className="text-3xl mb-3">&#9203;</div>
        <div className="text-lg font-bold text-navy mb-2">No national teams yet</div>
        <div className="text-sm text-navy/60 max-w-md mx-auto">
          Teams will appear here once they advance from chapter or regional finals.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Array.from(trackGroups.entries()).map(([slug, group]) => (
        <div key={slug}>
          <div className="flex items-center gap-3 mb-4">
            {group.icon && (
              <span className="text-xl">{group.icon}</span>
            )}
            <h3
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: group.colorHex + "99" }}
            >
              {group.trackName}
            </h3>
            <span className="text-xs text-navy/40">
              {group.teams.length} team{group.teams.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold w-8">#</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Team</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Chapter</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Problem</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Jury Progress</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {group.teams.map((team, idx) => {
                  const ch = chaptersMap.get(team.chapter_id);
                  const teamScores = evalsByTeam.get(team.id) ?? [];
                  const submitted = teamScores.filter(
                    (s) => s.status === "submitted" || s.submitted_at
                  );
                  const avgScore =
                    submitted.length > 0
                      ? submitted.reduce((sum, s) => sum + s.total_score, 0) / submitted.length
                      : null;

                  return (
                    <tr
                      key={team.id}
                      className="border-t border-navy/5 hover:bg-navy/[0.015]"
                    >
                      <td className="px-3 py-2.5 text-navy/40 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-navy">
                          {team.team_name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-navy/70">
                        {ch?.name ?? <span className="text-navy/30">--</span>}
                      </td>
                      <td className="px-3 py-2.5 text-navy/70 max-w-[200px] truncate">
                        {team.problem_statements?.title ?? (
                          <span className="text-navy/30">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <JuryProgressPill
                          submitted={submitted.length}
                          total={teamScores.length}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {avgScore !== null ? (
                          <span className="font-mono text-lg font-bold text-navy">
                            {avgScore.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-navy/30 text-xs">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Grand Final Tab ────────────────────────────────────────────────

function GrandFinalTab({
  trackGroups,
  chaptersMap,
  evalsByTeam,
  advancements,
}: {
  trackGroups: Map<
    string,
    { trackName: string; colorHex: string; icon: string | null; teams: TeamWithRelations[] }
  >;
  chaptersMap: Map<string, ChapterRow>;
  evalsByTeam: Map<string, EvaluationRow[]>;
  advancements: AdvancementRow[];
}) {
  // Grand final teams: teams with the highest scores from each track (top ~3)
  // Or teams that have been explicitly advanced (rank = 1, 2, 3)
  const advancedTeamIds = new Set(
    advancements
      .filter((a) => a.rank !== null && a.rank <= 3)
      .map((a) => a.team_id)
  );

  // For each track, pick top teams by average score if no explicit advancements
  const grandFinalByTrack = new Map<
    string,
    { trackName: string; colorHex: string; icon: string | null; teams: TeamWithRelations[] }
  >();

  for (const [slug, group] of trackGroups.entries()) {
    let finalists: TeamWithRelations[];

    // Check if any teams in this track were explicitly advanced
    const explicitlyAdvanced = group.teams.filter((t) =>
      advancedTeamIds.has(t.id)
    );

    if (explicitlyAdvanced.length > 0) {
      finalists = explicitlyAdvanced;
    } else {
      // Take top 3 by average score
      const scored = group.teams.map((t) => {
        const teamScores = evalsByTeam.get(t.id) ?? [];
        const submitted = teamScores.filter(
          (s) => s.status === "submitted" || s.submitted_at
        );
        const avg =
          submitted.length > 0
            ? submitted.reduce((sum, s) => sum + s.total_score, 0) / submitted.length
            : 0;
        return { team: t, avg };
      });
      scored.sort((a, b) => b.avg - a.avg);
      finalists = scored.slice(0, 3).map((s) => s.team);
    }

    grandFinalByTrack.set(slug, {
      trackName: group.trackName,
      colorHex: group.colorHex,
      icon: group.icon,
      teams: finalists,
    });
  }

  const totalFinalists = Array.from(grandFinalByTrack.values()).reduce(
    (sum, g) => sum + g.teams.length,
    0
  );

  if (totalFinalists === 0) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-10 text-center">
        <div className="text-3xl mb-3">&#127942;</div>
        <div className="text-lg font-bold text-navy mb-2">Grand Final not started</div>
        <div className="text-sm text-navy/60 max-w-md mx-auto">
          Top teams from each track's semi-final will appear here once scoring is
          complete and teams are shortlisted.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-yi-gold/5 border border-yi-gold/20 rounded-lg p-4">
        <p className="text-sm text-navy/70">
          <span className="font-bold text-navy">{totalFinalists} teams</span> have
          advanced to the Grand Final stage across {grandFinalByTrack.size} tracks.
        </p>
      </div>

      {Array.from(grandFinalByTrack.entries()).map(([slug, group]) => (
        <div key={slug}>
          <div className="flex items-center gap-3 mb-4">
            {group.icon && <span className="text-xl">{group.icon}</span>}
            <h3
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: group.colorHex + "99" }}
            >
              {group.trackName} &mdash; Grand Final
            </h3>
            <span className="text-xs text-navy/40">
              {group.teams.length} finalist{group.teams.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold w-8">#</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Team</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Chapter</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Problem</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Jury Progress</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {group.teams.map((team, idx) => {
                  const ch = chaptersMap.get(team.chapter_id);
                  const teamScores = evalsByTeam.get(team.id) ?? [];
                  const submitted = teamScores.filter(
                    (s) => s.status === "submitted" || s.submitted_at
                  );
                  const avgScore =
                    submitted.length > 0
                      ? submitted.reduce((sum, s) => sum + s.total_score, 0) /
                        submitted.length
                      : null;

                  return (
                    <tr
                      key={team.id}
                      className="border-t border-navy/5 hover:bg-navy/[0.015]"
                    >
                      <td className="px-3 py-2.5 text-navy/40 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-navy">
                          {team.team_name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-navy/70">
                        {ch?.name ?? <span className="text-navy/30">--</span>}
                      </td>
                      <td className="px-3 py-2.5 text-navy/70 max-w-[200px] truncate">
                        {team.problem_statements?.title ?? (
                          <span className="text-navy/30">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <JuryProgressPill
                          submitted={submitted.length}
                          total={teamScores.length}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {avgScore !== null ? (
                          <span className="font-mono text-lg font-bold text-navy">
                            {avgScore.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-navy/30 text-xs">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Awards Tab ─────────────────────────────────────────────────────

function AwardsTab({
  awards,
  awardByCategory,
  teamById,
  chaptersMap,
  teams,
}: {
  awards: AwardRow[];
  awardByCategory: Map<string, AwardRow>;
  teamById: Map<string, TeamWithRelations>;
  chaptersMap: Map<string, ChapterRow>;
  teams: TeamWithRelations[];
}) {
  return (
    <div className="space-y-4">
      <div className="bg-yi-gold/5 border border-yi-gold/20 rounded-lg p-4">
        <p className="text-sm text-navy/70">
          <span className="font-bold text-navy">{awards.length}</span> of{" "}
          <span className="font-bold text-navy">{NATIONAL_AWARD_CATEGORIES.length}</span>{" "}
          national awards assigned.
        </p>
      </div>

      <div className="grid gap-4">
        {NATIONAL_AWARD_CATEGORIES.map((category) => {
          const award = awardByCategory.get(category);
          const winningTeam = award ? teamById.get(award.team_id) : null;
          const winningChapter = winningTeam
            ? chaptersMap.get(winningTeam.chapter_id)
            : null;

          return (
            <div
              key={category}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-yi-gold/10 text-yi-gold px-3 py-1 rounded-full font-bold text-xs">
                      {AWARD_CATEGORY_LABELS[category as keyof typeof AWARD_CATEGORY_LABELS]}
                    </span>
                  </div>

                  {award && winningTeam ? (
                    <div className="mt-3">
                      <div className="text-lg font-bold text-navy">
                        {winningTeam.team_name}
                      </div>
                      <div className="text-sm text-navy/60 mt-0.5">
                        {winningChapter?.name ?? "Unknown chapter"}
                        {winningTeam.problem_statements?.title && (
                          <span>
                            {" "}
                            &middot; {winningTeam.problem_statements.title}
                          </span>
                        )}
                      </div>
                      {award.citation && (
                        <p className="mt-2 text-sm text-navy/70 italic">
                          &ldquo;{award.citation}&rdquo;
                        </p>
                      )}
                      {award.announced_at && (
                        <p className="mt-1 text-[11px] text-navy/40">
                          Announced{" "}
                          {new Date(award.announced_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-navy/40 italic">
                      Not yet assigned
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {award ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yi-green">
                      <span className="w-2 h-2 rounded-full bg-yi-green" />
                      Assigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy/30">
                      <span className="w-2 h-2 rounded-full bg-navy/20" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────

function JuryProgressPill({
  submitted,
  total,
}: {
  submitted: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <span className="inline-block text-xs text-navy/30 bg-navy/5 px-2 py-0.5 rounded-full">
        No jury
      </span>
    );
  }

  const complete = submitted === total;
  const pct = Math.round((submitted / total) * 100);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
        complete
          ? "bg-yi-green/10 text-yi-green"
          : submitted > 0
            ? "bg-yi-gold/10 text-yi-gold"
            : "bg-navy/5 text-navy/40"
      }`}
    >
      <span className="font-mono">
        {submitted}/{total}
      </span>
      <span className="text-[10px]">({pct}%)</span>
    </span>
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
