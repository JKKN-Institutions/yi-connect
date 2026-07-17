import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { TEAM_SIZE_MIN, TEAM_SIZE_MAX } from "@/lib/yi-future/constants";

type Team = {
  id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  problem_statement_id: string | null;
  problem_statements:
    | { title: string; tracks: { slug: string; name: string; color_hex: string | null } | null }
    | null;
  captain: { full_name: string } | null;
  team_members: { delegate_id: string }[];
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
      "id, team_name, status, captain_id, problem_statement_id, problem_statements(title, tracks(slug, name, color_hex)), captain:delegates!teams_captain_id_fkey(full_name), team_members(delegate_id)"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as Team[]) ?? [];
}

// teamId -> mentor names for this chapter (field request 2026-07-17:
// admins need to see which teams still have no mentor assigned).
async function getMentorsByTeam(
  chapterId: string
): Promise<Map<string, string[]>> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("mentor_team_assignments" as never)
    .select("team_id, mentors!inner(full_name, chapter_id)")
    .eq("mentors.chapter_id", chapterId);
  const map = new Map<string, string[]>();
  for (const r of ((data as unknown as {
    team_id: string;
    mentors: { full_name: string } | null;
  }[]) ?? [])) {
    if (!r.mentors?.full_name) continue;
    const list = map.get(r.team_id) ?? [];
    list.push(r.mentors.full_name);
    map.set(r.team_id, list);
  }
  return map;
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");
  const sp = await searchParams;
  const trackFilter = sp.track?.trim() || "all";

  const allTeams = await getTeams(ctx.chapterId, ctx.editionId);
  const mentorsByTeam = await getMentorsByTeam(ctx.chapterId);
  const withMentor = allTeams.filter(
    (t) => (mentorsByTeam.get(t.id) ?? []).length > 0
  ).length;
  const teams =
    trackFilter === "all"
      ? allTeams
      : allTeams.filter(
          (t) => t.problem_statements?.tracks?.slug === trackFilter
        );
  const readyCount = teams.filter(
    (t) =>
      t.team_members.length >= TEAM_SIZE_MIN &&
      t.captain_id &&
      t.problem_statement_id
  ).length;

  // Track chips — derived from teams' problem→track joins
  const tracksInChapter = Array.from(
    new Map(
      allTeams
        .map((t) => t.problem_statements?.tracks)
        .filter((tr): tr is { slug: string; name: string; color_hex: string | null } => !!tr)
        .map((tr) => [tr.slug, tr])
    ).values()
  );
  // Always show the canonical 4 chips even if no teams yet, in stable order
  const allTrackChips: { slug: string; name: string; color_hex: string | null }[] = [
    { slug: "climate_change", name: "Climate Change", color_hex: "#138808" },
    { slug: "road_safety", name: "Road Safety", color_hex: "#FF9933" },
    { slug: "accessibility", name: "Accessibility", color_hex: "#1a1a3e" },
    { slug: "public_health", name: "Health", color_hex: "#F5A623" },
  ];
  // Prefer real DB track meta (color_hex) when available
  const chips = allTrackChips.map((canonical) => {
    const real = tracksInChapter.find((t) => t.slug === canonical.slug);
    return real ?? canonical;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Teams</h2>
          <p className="mt-1 text-sm text-navy/60">
            {teams.length} total · {readyCount} ready to submit ·{" "}
            {withMentor} with mentor · {allTeams.length - withMentor} awaiting
            mentor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/api/csv/teams?chapter_id=${ctx.chapterId}`}
            className="text-xs font-semibold text-navy hover:text-yi-gold border border-navy/20 rounded px-3 py-1.5 inline-flex items-center gap-1.5"
          >
            <span>↓</span> CSV
          </Link>
          <Link
            href="/yi-future/chapter/teams/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + New team
          </Link>
        </div>
      </div>

      {/* Track filter chips (Future 6.0: every chapter runs all 4 tracks) */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/yi-future/chapter/teams"
          className={`min-h-[36px] inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
            trackFilter === "all"
              ? "border-navy bg-navy text-ivory"
              : "border-navy/15 bg-white text-navy/70 hover:border-navy/40"
          }`}
        >
          All ({allTeams.length})
        </Link>
        {chips.map((tr) => {
          const count = allTeams.filter(
            (t) => t.problem_statements?.tracks?.slug === tr.slug
          ).length;
          const active = trackFilter === tr.slug;
          const color = tr.color_hex ?? "#1a1a3e";
          return (
            <Link
              key={tr.slug}
              href={`/yi-future/chapter/teams?track=${tr.slug}`}
              className="min-h-[36px] inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
              style={
                active
                  ? { borderColor: color, backgroundColor: color, color: "#FEFCF6" }
                  : { borderColor: color + "33", backgroundColor: "#FFFFFF", color }
              }
            >
              {tr.name} ({count})
            </Link>
          );
        })}
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          {trackFilter === "all"
            ? "No teams yet. You can form a team as soon as 1 delegate has registered."
            : "No teams yet on this track. Pick a different track or create a team."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((t) => {
            const size = t.team_members.length;
            const sizeOk = size >= TEAM_SIZE_MIN;
            return (
              <Link
                key={t.id}
                href={`/yi-future/chapter/teams/${t.id}`}
                className="bg-white border border-navy/10 rounded-lg p-5 hover:border-yi-gold/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy truncate">
                      {t.team_name}
                    </div>
                    <div className="text-xs text-navy/50 mt-0.5">
                      {t.status ?? "registered"}
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      sizeOk
                        ? "bg-yi-green/10 text-yi-green"
                        : "bg-navy/5 text-navy/60"
                    }`}
                  >
                    {size}/{TEAM_SIZE_MAX}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 w-16">
                      Captain
                    </span>
                    <span className="text-navy/80">
                      {t.captain?.full_name ?? (
                        <span className="text-red-600/70">not set</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 w-16">
                      Problem
                    </span>
                    <span className="text-navy/80 truncate">
                      {t.problem_statements?.title ?? (
                        <span className="text-red-600/70">not picked</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 w-16">
                      Mentor
                    </span>
                    <span className="text-navy/80 truncate">
                      {(mentorsByTeam.get(t.id) ?? []).length > 0 ? (
                        mentorsByTeam.get(t.id)!.join(", ")
                      ) : (
                        <span className="text-red-600/70">not assigned</span>
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
