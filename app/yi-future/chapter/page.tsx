import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { advanceEditionStage, peekNextStage } from "@/app/yi-future/actions/stages";
import { linkSelfToChapter } from "@/app/yi-future/actions/chapter-bootstrap";
import {
  CORE_TEAM_ROLES,
  CORE_TEAM_ROLE_LABELS,
  PHASES,
  type Phase,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";
import { PhaseTracker, type PhaseEventStatus } from "@/components/yi-future/phase/PhaseTracker";
import { PushSubscribe } from "@/components/yi-future/pwa/PushSubscribe";
import { TrackIcon } from "@/components/yi-future/TrackIcon";

type CoreTeamRole = Database["future"]["Enums"]["user_role"];

type TrackBreakdown = {
  trackId: string;
  trackName: string;
  trackIcon: string | null;
  trackColor: string | null;
  teamCount: number;
  topProblemTitle: string | null;
  topProblemCount: number;
};

async function getTrackBreakdown(
  chapterId: string,
  editionId: string
): Promise<TrackBreakdown[]> {
  const svc = await createServiceClient();

  // All tracks for this edition
  const { data: trackRows } = await svc
    .schema("future")
    .from("tracks")
    .select("id, name, icon, color_hex")
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });

  if (!trackRows || trackRows.length === 0) return [];

  // All teams for this chapter with their problem_statement's track_id
  const { data: teamRows } = await svc
    .schema("future")
    .from("teams")
    .select("id, problem_statement_id, problem_statements(track_id, title)")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId);

  type TeamRow = {
    id: string;
    problem_statement_id: string | null;
    problem_statements: { track_id: string; title: string } | null;
  };
  const teams = (teamRows as unknown as TeamRow[]) ?? [];

  return trackRows.map((t) => {
    const trackTeams = teams.filter(
      (tm) => tm.problem_statements?.track_id === t.id
    );
    // Count per problem statement title
    const psCounts: Record<string, number> = {};
    for (const tm of trackTeams) {
      if (tm.problem_statements?.title) {
        const title = tm.problem_statements.title;
        psCounts[title] = (psCounts[title] ?? 0) + 1;
      }
    }
    const topEntry = Object.entries(psCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      trackId: t.id,
      trackName: t.name,
      trackIcon: t.icon ?? null,
      trackColor: t.color_hex ?? null,
      teamCount: trackTeams.length,
      topProblemTitle: topEntry?.[0] ?? null,
      topProblemCount: topEntry?.[1] ?? 0,
    };
  });
}

async function getCounts(chapterId: string, editionId: string) {
  const svc = await createServiceClient();
  const [teams, delegates, mentors, colleges, core, outreach] = await Promise.all([
    svc
      .schema("future")
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("delegates")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("mentors")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId),
    svc
      .schema("future")
      .from("colleges")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId),
    svc
      .schema("future")
      .from("chapter_core_team")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .eq("is_active", true),
    svc
      .schema("future")
      .from("outreach_log")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId),
  ]);

  return {
    teams: teams.count ?? 0,
    delegates: delegates.count ?? 0,
    mentors: mentors.count ?? 0,
    colleges: colleges.count ?? 0,
    core: core.count ?? 0,
    outreach: outreach.count ?? 0,
  };
}

export default async function ChapterDashboard() {
  const ctx = await getChapterContext();

  if (!ctx) {
    // Bootstrap UX: let the signed-in user self-link to a chapter so a
    // new Yi National admin is not stuck on the "no chapter assigned"
    // dead-end. Only renders for authed Supabase users (middleware
    // already enforces that on /chapter).
    const svc = await createServiceClient();
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();

    const { data: chapterRows } = await svc
      .schema("yi")
      .from("chapters")
      .select("id, name, city")
      .eq("is_active", true)
      .order("name", { ascending: true });
    const chapters =
      (chapterRows as unknown as {
        id: string;
        name: string;
        city: string | null;
      }[]) ?? [];

    async function selfLinkAction(formData: FormData) {
      "use server";
      const chapterId = String(formData.get("chapter_id") ?? "").trim();
      const role = String(formData.get("role") ?? "").trim() as CoreTeamRole;
      await linkSelfToChapter({ chapterId, role });
      revalidatePath("/yi-future/chapter");
    }

    return (
      <div className="max-w-2xl mx-auto bg-white border border-navy/10 rounded-lg p-8">
        <div className="text-center">
          <div className="text-4xl mb-3">🔑</div>
          <h2 className="text-xl font-bold text-navy">
            You&apos;re signed in but not yet linked to a chapter
          </h2>
          <p className="mt-3 text-sm text-navy/60">
            Signed in as{" "}
            <strong>{user?.email ?? "an admin"}</strong>. Pick a chapter and a
            core-team role to link yourself, or go to a different admin panel.
          </p>
          <div className="mt-3 flex justify-center gap-3 text-xs">
            <Link
              href="/yi-future/national/admin"
              className="px-3 py-1.5 rounded-md bg-navy text-ivory font-semibold hover:bg-navy-dark"
            >
              National admin →
            </Link>
            <Link
              href="/yi-future/host"
              className="px-3 py-1.5 rounded-md border border-navy/20 text-navy font-semibold hover:bg-navy/5"
            >
              Host admin →
            </Link>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div className="mt-6 p-4 rounded-md bg-navy/5 text-sm text-navy/70 text-center">
            No active chapters found yet.{" "}
            <Link
              href="/yi-future/national/admin/chapters"
              className="font-semibold text-yi-gold hover:underline"
            >
              Create a chapter →
            </Link>
          </div>
        ) : (
          <form action={selfLinkAction} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="chapter_id"
                className="block text-xs font-semibold uppercase tracking-widest text-navy/60"
              >
                Chapter
              </label>
              <select
                id="chapter_id"
                name="chapter_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/30"
              >
                <option value="" disabled>
                  Select a chapter…
                </option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` — ${c.city}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-xs font-semibold uppercase tracking-widest text-navy/60"
              >
                Your core-team role
              </label>
              <select
                id="role"
                name="role"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-navy/15 bg-white px-3 py-2 text-sm text-navy focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/30"
              >
                <option value="" disabled>
                  Select a role…
                </option>
                {CORE_TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {CORE_TEAM_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-ivory hover:bg-navy-dark"
            >
              Link me to this chapter
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-navy/10 text-center">
          <Link
            href="/yi-future/national/admin"
            className="text-xs font-semibold uppercase tracking-widest text-navy/60 hover:text-yi-gold"
          >
            Or go to /national/admin to manage the program nationally →
          </Link>
        </div>
      </div>
    );
  }

  const [counts, trackBreakdown] = await Promise.all([
    getCounts(ctx.chapterId, ctx.editionId),
    getTrackBreakdown(ctx.chapterId, ctx.editionId),
  ]);
  const coreReady = counts.core >= CORE_TEAM_ROLES.length;

  // Phase tracker: count events per phase
  const svc = await createServiceClient();
  const { data: phaseRows } = await svc
    .schema("future")
    .from("phase_events")
    .select("phase, completed")
    .eq("chapter_id", ctx.chapterId)
    .eq("edition_id", ctx.editionId);
  const phaseEvents = (phaseRows as unknown as {
    phase: Phase;
    completed: boolean | null;
  }[]) ?? [];
  const phaseStatuses: PhaseEventStatus[] = PHASES.map((p) => {
    const pe = phaseEvents.filter((e) => e.phase === p);
    return {
      phase: p,
      completed: pe.filter((e) => e.completed).length,
      scheduled: pe.length,
    };
  });

  // Next-stage peek
  const nextPeek = await peekNextStage(ctx.editionId);

  async function advanceAction() {
    "use server";
    await advanceEditionStage({ editionId: ctx!.editionId });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-navy/50 font-semibold tracking-widest uppercase">
            <span>{ctx.editionName}</span>
            <span>·</span>
            <span className="text-yi-gold">{ctx.editionStage ?? "—"}</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-navy">
            {ctx.chapterName}
          </h2>
          {ctx.chapterCity && (
            <p className="mt-1 text-sm text-navy/60">{ctx.chapterCity}</p>
          )}
        </div>
        <PushSubscribe />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            label: "Core team",
            value: `${counts.core}/4`,
            href: "/chapter/setup",
            ready: coreReady,
          },
          {
            label: "Colleges",
            value: String(counts.colleges),
            href: "/chapter/colleges",
            ready: counts.colleges >= 3,
          },
          {
            label: "Outreach activities",
            value: String(counts.outreach),
            href: "/chapter/outreach",
            ready: counts.outreach >= 1,
          },
          {
            label: "Delegates",
            value: String(counts.delegates),
            href: "/chapter/teams",
            ready: counts.delegates >= 15,
          },
          {
            label: "Teams",
            value: String(counts.teams),
            href: "/chapter/teams",
            ready: counts.teams >= 5,
          },
          {
            label: "Mentors",
            value: String(counts.mentors),
            href: "/chapter/mentors",
            ready: counts.mentors >= 4,
          },
        ].map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white border border-navy/10 rounded-lg p-5 hover:border-yi-gold/50 hover:shadow-sm transition-all"
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
              {s.label}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-navy">{s.value}</div>
              {s.ready ? (
                <span className="text-[10px] font-semibold text-yi-green">
                  ✓ READY
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-navy/30">
                  ▲ IN PROGRESS
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* 4 Track sub-sections */}
      {trackBreakdown.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            All 4 Tracks — This Chapter
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {trackBreakdown.map((track) => {
              const headerBg = track.trackColor ?? "#1a1a3e";
              return (
                <div
                  key={track.trackId}
                  className="bg-white border border-navy/10 rounded-lg overflow-hidden"
                >
                  <div
                    className="px-4 py-3 flex items-center gap-2"
                    style={{ backgroundColor: headerBg }}
                  >
                    {track.trackIcon && (
                      <span className="text-base leading-none">
                        <TrackIcon icon={track.trackIcon} name={track.trackName} size={20} />
                      </span>
                    )}
                    <span className="text-xs font-bold uppercase tracking-widest text-white truncate">
                      {track.trackName}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                        Teams
                      </div>
                      <div className="mt-0.5 text-3xl font-bold text-navy">
                        {track.teamCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40">
                        Top problem statement
                      </div>
                      {track.topProblemTitle ? (
                        <p className="mt-0.5 text-xs text-navy/70 line-clamp-2">
                          {track.topProblemTitle}
                          <span className="ml-1 font-semibold text-yi-gold">
                            ({track.topProblemCount})
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-navy/30">
                          No teams yet
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/yi-future/chapter/teams?track=${track.trackId}`}
                      className="inline-flex items-center text-xs font-semibold text-navy hover:text-yi-gold transition-colors"
                    >
                      View teams →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase tracker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50">
            90-Day Journey
          </h3>
          <Link
            href="/yi-future/chapter/journey"
            className="text-xs font-semibold text-navy hover:text-yi-gold"
          >
            Manage →
          </Link>
        </div>
        <PhaseTracker statuses={phaseStatuses} />
      </div>

      {/* Stage advance */}
      {nextPeek.to && (
        <div className="bg-navy/5 border border-navy/10 rounded-lg p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
                Next stage
              </div>
              <div className="mt-1 text-sm">
                <code className="px-1.5 py-0.5 bg-white rounded font-mono text-xs">
                  {nextPeek.from}
                </code>
                <span className="mx-2 text-navy/40">→</span>
                <code className="px-1.5 py-0.5 bg-yi-gold/10 text-yi-gold rounded font-mono text-xs">
                  {nextPeek.to}
                </code>
              </div>
            </div>
            <form action={advanceAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Advance
              </button>
            </form>
          </div>
          <p className="mt-2 text-xs text-navy/50">
            Advancing checks prerequisites server-side. National admin can
            force a transition via override.
          </p>
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy">Your role</h3>
        <p className="mt-2 text-sm text-navy/70">
          You are signed in as{" "}
          <strong>{ctx.userEmail ?? "an admin"}</strong> with role{" "}
          <code className="px-1.5 py-0.5 bg-navy/5 rounded text-xs font-mono">
            {ctx.role}
          </code>
          . Your edits are scoped to this chapter and the active edition.
        </p>
      </div>
    </div>
  );
}
