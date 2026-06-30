import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { deleteProblem, toggleProblemActive } from "@/app/yi-future/actions/problems";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";
import { TrackIcon } from "@/components/yi-future/TrackIcon";

type Track = {
  id: string;
  edition_id: string;
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
  display_order: number | null;
  editions: { slug: string; is_active: boolean | null; name: string };
};

type Problem = {
  id: string;
  track_id: string;
  title: string;
  short_description: string;
  full_description: string | null;
  display_order: number | null;
  is_active: boolean | null;
  sdg_alignment: string[] | null;
};

async function getTracks(): Promise<Track[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select(
      "id, edition_id, slug, name, color_hex, icon, display_order, editions!tracks_edition_id_fkey(slug, name, is_active)"
    )
    .order("display_order", { ascending: true });
  return (data as unknown as Track[]) ?? [];
}

async function getProblems(trackId: string): Promise<Problem[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id, track_id, title, short_description, full_description, display_order, is_active, sdg_alignment")
    .eq("track_id", trackId)
    .order("display_order", { ascending: true });
  return (data as unknown as Problem[]) ?? [];
}

type TractionRow = {
  problemId: string;
  title: string;
  trackName: string;
  teams: number;
  participants: number;
};

// Per-problem traction across the active edition: how many teams picked each
// problem, and how many students are working on it (sum of team members).
async function getProblemTraction(editionId: string): Promise<TractionRow[]> {
  const svc = await createServiceClient();
  const [{ data: teamsData }, { data: probData }] = await Promise.all([
    svc
      .schema("future")
      .from("teams")
      .select("id, problem_statement_id, team_members(delegate_id)")
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("problem_statements")
      .select("id, title, is_active, tracks!inner(name, edition_id)")
      .eq("is_active", true)
      .eq("tracks.edition_id", editionId),
  ]);

  const teams = (teamsData ?? []) as unknown as {
    id: string;
    problem_statement_id: string | null;
    team_members: { delegate_id: string }[];
  }[];
  const problems = (probData ?? []) as unknown as {
    id: string;
    title: string;
    tracks: { name: string } | null;
  }[];

  const byProblem = new Map<string, { teams: number; participants: number }>();
  for (const t of teams) {
    if (!t.problem_statement_id) continue;
    const cur = byProblem.get(t.problem_statement_id) ?? {
      teams: 0,
      participants: 0,
    };
    cur.teams += 1;
    cur.participants += t.team_members?.length ?? 0;
    byProblem.set(t.problem_statement_id, cur);
  }

  return problems
    .map((p) => ({
      problemId: p.id,
      title: p.title,
      trackName: p.tracks?.name ?? "—",
      teams: byProblem.get(p.id)?.teams ?? 0,
      participants: byProblem.get(p.id)?.participants ?? 0,
    }))
    .sort((a, b) => b.teams - a.teams || b.participants - a.participants);
}

async function removeProblem(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  await deleteProblem(id);
}

async function toggleActive(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const next = formData.get("next") === "true";
  await toggleProblemActive(id, next);
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const { track: trackParam } = await searchParams;
  const [tracks, { isPlatform }] = await Promise.all([
    getTracks(),
    isCurrentUserPlatformAdmin(),
  ]);

  // Prefer the active edition's first track
  const activeEdTracks = tracks.filter((t) => t.editions?.is_active);
  const selected =
    tracks.find((t) => t.id === trackParam) ??
    activeEdTracks[0] ??
    tracks[0];
  const problems = selected ? await getProblems(selected.id) : [];

  const activeEditionId =
    tracks.find((t) => t.editions?.is_active)?.edition_id ??
    selected?.edition_id ??
    null;
  const traction = activeEditionId
    ? await getProblemTraction(activeEditionId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Problem Statements</h2>
          <p className="mt-1 text-sm text-navy/60">
            3 problems per track. Target 12 total per edition.
          </p>
        </div>
        {selected && isPlatform && (
          <Link
            href={`/national/admin/problems/new?track=${selected.id}`}
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + New problem
          </Link>
        )}
      </div>

      {!isPlatform && (
        <div className="rounded-md border border-navy/15 bg-navy/5 px-4 py-3 text-xs text-navy/70">
          View only — only Platform admins can edit structural config.
        </div>
      )}

      {/* Problem traction — which problems teams are picking, ranked */}
      {traction.length > 0 && (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-navy/5 border-b border-navy/10">
            <div className="font-bold text-navy">Problem traction</div>
            <div className="text-xs text-navy/50">
              Teams and participants per problem across all chapters · ranked by
              most teams
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-navy/60">
                <tr className="border-b border-navy/10">
                  <th className="text-left px-4 py-2 font-semibold w-8">#</th>
                  <th className="text-left px-4 py-2 font-semibold">Problem</th>
                  <th className="text-left px-4 py-2 font-semibold">Track</th>
                  <th className="text-right px-4 py-2 font-semibold">Teams</th>
                  <th className="text-right px-4 py-2 font-semibold">
                    Participants
                  </th>
                </tr>
              </thead>
              <tbody>
                {traction.map((row, i) => (
                  <tr
                    key={row.problemId}
                    className="border-t border-navy/5 hover:bg-navy/[0.015]"
                  >
                    <td className="px-4 py-2 text-navy/40 font-mono text-xs">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      <Link
                        href={`/national/admin/problems/${row.problemId}/teams`}
                        className="text-navy hover:text-yi-gold"
                      >
                        {row.title} →
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-navy/60 text-xs">
                      {row.trackName}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-navy tabular-nums">
                      {row.teams}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-navy tabular-nums">
                      {row.participants}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Track switcher */}
      <div className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <Link
            key={t.id}
            href={`/national/admin/problems?track=${t.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              selected?.id === t.id
                ? "bg-navy text-ivory"
                : "bg-white text-navy/70 border border-navy/20 hover:border-navy/40"
            }`}
          >
            <TrackIcon icon={t.icon} name={t.name} size={16} />
            <span>{t.name}</span>
            <span className="text-[10px] opacity-60">
              ({t.editions?.slug})
            </span>
          </Link>
        ))}
      </div>

      {!selected ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No tracks yet. Create a track first.
        </div>
      ) : (
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-navy/5 flex items-center justify-between">
            <div>
              <div className="font-bold text-navy">{selected.name}</div>
              <div className="text-xs text-navy/50">
                {problems.length} problem(s)
              </div>
            </div>
          </div>

          {problems.length === 0 ? (
            <div className="p-8 text-center text-navy/50 text-sm">
              No problems yet on this track.
            </div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {problems.map((p) => (
                <li key={p.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-navy/40">
                          #{p.display_order ?? "—"}
                        </span>
                        <h3 className="font-bold text-navy">
                          {p.title}
                        </h3>
                        {!p.is_active && (
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 px-1.5 py-0.5 rounded bg-navy/5">
                            archived
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-navy/70">
                        {p.short_description}
                      </p>
                      {p.full_description && (
                        <details className="mt-2">
                          <summary className="text-xs font-semibold text-navy/50 cursor-pointer hover:text-navy">
                            Full description ▸
                          </summary>
                          <div className="mt-2 p-3 rounded bg-navy/5 text-sm text-navy/80 whitespace-pre-wrap leading-relaxed">
                            {p.full_description}
                          </div>
                        </details>
                      )}
                      {p.sdg_alignment && p.sdg_alignment.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.sdg_alignment.map((sdg) => (
                            <span
                              key={sdg}
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yi-green/10 text-yi-green"
                            >
                              {sdg}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isPlatform && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Link
                          href={`/national/admin/problems/${p.id}/edit?track=${p.track_id}`}
                          className="text-xs font-semibold text-navy hover:text-yi-gold"
                        >
                          Edit
                        </Link>
                        <form action={toggleActive}>
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            type="hidden"
                            name="next"
                            value={String(!p.is_active)}
                          />
                          <button
                            type="submit"
                            className="text-xs text-navy/60 hover:text-navy"
                          >
                            {p.is_active ? "Archive" : "Restore"}
                          </button>
                        </form>
                        <form action={removeProblem}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600/70 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
