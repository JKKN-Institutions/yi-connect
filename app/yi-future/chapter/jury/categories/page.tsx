import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { autoAssignJuryToTeams } from "@/app/yi-future/actions/jury";

type Track = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color_hex: string | null;
};

type TrackSummary = {
  track: Track;
  juryCount: number;
  teamCount: number;
  assignmentCount: number;
};

async function getTrackSummaries(
  editionId: string,
  chapterId: string
): Promise<TrackSummary[]> {
  const svc = await createServiceClient();

  // Fetch tracks, jury with track_id, and teams with problem_statement -> track
  const [{ data: tracks }, { data: juryRows }, { data: teamRows }] =
    await Promise.all([
      svc
        .schema("future")
        .from("tracks")
        .select("id, name, slug, icon, color_hex")
        .eq("edition_id", editionId)
        .order("display_order", { ascending: true }),
      svc
        .schema("future")
        .from("jury_assignments")
        .select("id, track_id")
        .eq("edition_id", editionId)
        .eq("is_active", true)
        .not("track_id", "is", null),
      svc
        .schema("future")
        .from("teams")
        .select("id, problem_statements(track_id)")
        .eq("chapter_id", chapterId)
        .eq("edition_id", editionId)
        .not("problem_statement_id", "is", null),
    ]);

  const trackList = (tracks as unknown as Track[]) ?? [];
  const juryList =
    (juryRows as unknown as { id: string; track_id: string }[]) ?? [];

  type TeamRow = {
    id: string;
    problem_statements: { track_id: string } | null;
  };
  const teamList = (teamRows as unknown as TeamRow[]) ?? [];

  // Count jury per track
  const juryPerTrack = new Map<string, number>();
  for (const j of juryList) {
    juryPerTrack.set(j.track_id, (juryPerTrack.get(j.track_id) ?? 0) + 1);
  }

  // Count teams per track
  const teamsPerTrack = new Map<string, number>();
  for (const t of teamList) {
    const tid = t.problem_statements?.track_id;
    if (tid) teamsPerTrack.set(tid, (teamsPerTrack.get(tid) ?? 0) + 1);
  }

  // Compute expected assignments per track (jury * teams)
  return trackList.map((track) => {
    const jc = juryPerTrack.get(track.id) ?? 0;
    const tc = teamsPerTrack.get(track.id) ?? 0;
    return {
      track,
      juryCount: jc,
      teamCount: tc,
      assignmentCount: jc * tc,
    };
  });
}

export default async function JuryCategoriesPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const summaries = await getTrackSummaries(ctx.editionId, ctx.chapterId);
  const totalJury = summaries.reduce((s, t) => s + t.juryCount, 0);
  const totalTeams = summaries.reduce((s, t) => s + t.teamCount, 0);
  const totalAssignments = summaries.reduce(
    (s, t) => s + t.assignmentCount,
    0
  );

  const canAutoAssign = totalJury > 0 && totalTeams > 0;

  async function handleAutoAssign() {
    "use server";
    await autoAssignJuryToTeams(ctx!.chapterId, ctx!.editionId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">
            Jury Categories by Track
          </h2>
          <p className="mt-1 text-sm text-navy/60">
            {totalJury} jury assigned to tracks · {totalTeams} teams with
            problem statements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={handleAutoAssign}>
            <button
              type="submit"
              disabled={!canAutoAssign}
              className="px-4 py-2 rounded-md bg-[#F5A623] text-navy text-sm font-bold hover:bg-[#F5A623]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Auto-assign all by track
            </button>
          </form>
          <Link
            href="/yi-future/chapter/jury"
            className="px-4 py-2 rounded-md border border-navy/20 text-navy text-sm font-semibold hover:border-navy/40"
          >
            Back to jury
          </Link>
        </div>
      </div>

      {/* Summary cards per track */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map(({ track, juryCount, teamCount, assignmentCount }) => (
          <div
            key={track.id}
            className="bg-white border border-navy/10 rounded-lg p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              {track.icon && <span className="text-lg">{track.icon}</span>}
              <h3 className="text-lg font-bold text-navy">{track.name}</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-navy/5 rounded-md p-3">
                <div className="text-2xl font-bold text-navy">{juryCount}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mt-1">
                  Jury
                </div>
              </div>
              <div className="bg-navy/5 rounded-md p-3">
                <div className="text-2xl font-bold text-navy">{teamCount}</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mt-1">
                  Teams
                </div>
              </div>
              <div className="bg-navy/5 rounded-md p-3">
                <div className="text-2xl font-bold text-navy">
                  {assignmentCount}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 mt-1">
                  Assignments
                </div>
              </div>
            </div>

            {juryCount === 0 && (
              <p className="mt-3 text-xs text-yi-saffron font-medium">
                No jury assigned to this track yet. Assign jury on the{" "}
                <Link
                  href="/yi-future/chapter/jury"
                  className="underline hover:text-navy"
                >
                  jury page
                </Link>
                .
              </p>
            )}
            {teamCount === 0 && juryCount > 0 && (
              <p className="mt-3 text-xs text-navy/50">
                No teams with problem statements in this track.
              </p>
            )}
          </div>
        ))}
      </div>

      {summaries.length === 0 && (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50 text-sm">
          No tracks found for this edition.
        </div>
      )}

      {/* Explanation */}
      <div className="bg-navy/5 rounded-lg p-4 text-sm text-navy/70">
        <p className="font-semibold text-navy mb-1">
          How track-based auto-assign works
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Assign each jury member to a track (category) on the jury page.
          </li>
          <li>
            Teams are mapped to tracks through their chosen problem statement.
          </li>
          <li>
            Click &ldquo;Auto-assign all by track&rdquo; to create
            jury↔team assignments: every jury in a track evaluates every team
            in that track.
          </li>
        </ol>
      </div>
    </div>
  );
}
