import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { setPreferences, getPreferences } from "@/app/yi-future/actions/preferences";

type DelegateTeamRow = {
  team_id: string;
  teams: {
    id: string;
    team_name: string;
    edition_id: string;
    chapter_id: string;
    captain_id: string | null;
    leader_delegate_id: string | null;
    is_frozen: boolean | null;
    problem_statement_id: string | null;
  };
};

type ProblemRow = {
  id: string;
  title: string;
  short_description: string;
  display_order: number | null;
  tracks: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    color_hex: string | null;
    display_order: number | null;
  } | null;
};

async function getMyTeam(delegateId: string): Promise<DelegateTeamRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("team_members")
    .select(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ("team_id, teams!inner(id, team_name, edition_id, chapter_id, captain_id, leader_delegate_id, is_frozen, problem_statement_id)" as unknown) as string
    )
    .eq("delegate_id", delegateId)
    .limit(1)
    .maybeSingle();
  return (data as unknown as DelegateTeamRow) ?? null;
}

// Fetch ALL 12 problem statements (4 tracks × 3 problems) for the edition.
// Per Yi National Chair (2026-05-06), Future 6.0 runs all 4 tracks at every chapter,
// so delegates rank across the full edition catalog — not a chapter-scoped subset.
async function getEditionProblems(editionId: string): Promise<ProblemRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, display_order, tracks!inner(id, slug, name, icon, color_hex, display_order, edition_id)"
    )
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as ProblemRow[]) ?? [];
}

export default async function PreferencesPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const teamRow = await getMyTeam(session.id);
  if (!teamRow) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">🤔</div>
        <h2 className="text-lg font-bold text-navy">No team yet</h2>
        <p className="mt-2 text-sm text-navy/60">
          You're not on a team yet. Join or form a team first.
        </p>
        <Link
          href="/yi-future/me"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const team = teamRow.teams;
  const isCaptain =
    team.captain_id === session.id || team.leader_delegate_id === session.id;

  if (!isCaptain) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-lg font-bold text-navy">Captain only</h2>
        <p className="mt-2 text-sm text-navy/60">
          Only the captain can rank problems. Talk to your captain about which
          three to pick.
        </p>
        <Link
          href="/yi-future/me/team"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back to team
        </Link>
      </div>
    );
  }

  if (team.is_frozen === true) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">❄️</div>
        <h2 className="text-lg font-bold text-navy">Team frozen</h2>
        <p className="mt-2 text-sm text-navy/60">
          Your team is frozen. Ask your chapter admin if you need to re-rank.
        </p>
        <Link
          href="/yi-future/me/team"
          className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
        >
          ← Back to team
        </Link>
      </div>
    );
  }

  const [problems, existingPrefs] = await Promise.all([
    getEditionProblems(team.edition_id),
    getPreferences(team.id),
  ]);

  // Build map: problem_id -> rank (1|2|3) for defaults
  const prefMap: Record<string, number> = {};
  for (const p of existingPrefs) prefMap[p.problem.id] = p.rank;

  // Group by track for display
  type TrackBucket = {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
    colorHex: string;
    displayOrder: number;
    items: ProblemRow[];
  };
  const tracksMap = new Map<string, TrackBucket>();
  for (const p of problems) {
    if (!p.tracks) continue;
    const key = p.tracks.id;
    if (!tracksMap.has(key)) {
      tracksMap.set(key, {
        id: p.tracks.id,
        slug: p.tracks.slug,
        name: p.tracks.name,
        icon: p.tracks.icon,
        colorHex: p.tracks.color_hex ?? "#1a1a3e",
        displayOrder: p.tracks.display_order ?? 0,
        items: [],
      });
    }
    tracksMap.get(key)!.items.push(p);
  }
  // Order tracks by their display_order so all chapters see the same 4-track sequence
  const trackBuckets = Array.from(tracksMap.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  // Sort problems within each bucket by display_order (already ordered by query, defensive)
  for (const tr of trackBuckets) {
    tr.items.sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
  }

  async function saveAction(formData: FormData) {
    "use server";
    // Collect picks: rank_1 / rank_2 / rank_3 each holds a problem_statement_id
    const r1 = String(formData.get("rank_1") ?? "").trim();
    const r2 = String(formData.get("rank_2") ?? "").trim();
    const r3 = String(formData.get("rank_3") ?? "").trim();
    if (!r1 || !r2 || !r3) {
      redirect("/yi-future/me/team/preferences?error=missing");
    }
    const result = await setPreferences(teamRow!.teams.id, [r1, r2, r3]);
    if (!result.ok) {
      redirect(`/me/team/preferences?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/yi-future/me/team/preferences?saved=1");
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me/team"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Team
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">
          Rank your top 3 problems
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          Future 6.0 runs all 4 tracks at every chapter. Pick any 3 problems
          from the full edition catalog below — your chapter admin will
          allocate one problem per team aiming for an even spread, honouring
          your preference where possible.
        </p>
      </div>

      <div className="bg-yi-gold/10 border border-yi-gold/30 rounded-lg p-4 text-sm text-navy">
        <strong>How it works:</strong> Future 6.0 runs all{" "}
        <strong>{trackBuckets.length} tracks</strong> at every chapter. Pick
        any <strong>3 problems</strong> from the {problems.length} below — one
        as your <strong>1st</strong>, one as <strong>2nd</strong>, one as{" "}
        <strong>3rd</strong>. They can come from the same track or different
        tracks; what matters is your team's interest. Each rank can only be
        assigned to one problem. The admin allocates after preferences are in.
      </div>

      <form action={saveAction} className="space-y-6">
        {trackBuckets.map((tr) => (
          <section
            key={tr.id}
            className="bg-white border border-navy/10 rounded-lg p-5 border-l-4"
            style={{ borderLeftColor: tr.colorHex }}
          >
            <h3
              className="text-base font-bold mb-1 flex items-center gap-2"
              style={{ color: tr.colorHex }}
            >
              <span className="text-xl">{tr.icon ?? "•"}</span>
              <span>{tr.name}</span>
            </h3>
            <p className="text-xs text-navy/50 mb-4 uppercase tracking-wider font-semibold">
              {tr.items.length} problem{tr.items.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-3">
              {tr.items.map((p) => {
                const currentRank = prefMap[p.id];
                return (
                  <div
                    key={p.id}
                    className="border border-navy/10 rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-navy text-sm">
                        {p.title}
                      </div>
                      <div className="mt-1 text-xs text-navy/60">
                        {p.short_description}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      {[1, 2, 3].map((rank) => (
                        <label
                          key={rank}
                          className="cursor-pointer min-h-[44px] px-3 py-2 border border-navy/20 rounded-md text-xs font-semibold text-navy/70 hover:border-yi-gold/60 hover:bg-yi-gold/5 has-[:checked]:bg-yi-gold has-[:checked]:text-navy has-[:checked]:border-yi-gold flex items-center gap-1.5"
                        >
                          <input
                            type="radio"
                            name={`rank_${rank}`}
                            value={p.id}
                            defaultChecked={currentRank === rank}
                            className="accent-yi-gold"
                          />
                          <span>
                            {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {problems.length === 0 ? (
          <p className="text-sm text-navy/50 italic">
            No active problems yet. Check back after your edition is set up.
          </p>
        ) : (
          <div className="sticky bottom-2 bg-white border border-navy/10 rounded-lg p-4 flex items-center justify-between shadow-sm">
            <p className="text-xs text-navy/60">
              You must select a different problem for 1st, 2nd, and 3rd.
            </p>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Save my top 3
            </button>
          </div>
        )}
      </form>

      {existingPrefs.length === 3 && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-bold text-navy mb-3">Currently saved</h3>
          <ol className="space-y-2 text-sm">
            {existingPrefs.map((p) => (
              <li
                key={p.problem.id}
                className="flex items-start gap-3 p-2 border border-navy/10 rounded"
              >
                <span className="text-yi-gold font-bold w-6 shrink-0">
                  #{p.rank}
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-navy">
                    {p.problem.title}
                  </div>
                  <div className="text-xs text-navy/50">
                    {p.problem.track_name}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
