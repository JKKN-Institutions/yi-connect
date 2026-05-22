import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  pickProblemStatement,
  clearProblem,
  updateTeamName,
} from "@/app/yi-future/actions/teams";
import { freezeTeam, setLeader } from "@/app/yi-future/actions/team-invites";
import { TEAM_SIZE_MIN, TEAM_SIZE_MAX } from "@/lib/yi-future/constants";

type TeamView = {
  id: string;
  edition_id: string;
  chapter_id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  leader_delegate_id: string | null;
  is_frozen: boolean | null;
  frozen_at: string | null;
  problem_statement_id: string | null;
  problem_statements: { title: string; short_description: string } | null;
  team_members: {
    delegate_id: string;
    role_in_team: string | null;
    delegates: { full_name: string; email: string | null };
  }[];
};

type Problem = {
  id: string;
  title: string;
  short_description: string;
  tracks: { name: string; icon: string | null } | null;
};

async function getMyCaptainedTeam(
  delegateId: string
): Promise<TeamView | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, edition_id, chapter_id, team_name, status, captain_id, leader_delegate_id, is_frozen, frozen_at, problem_statement_id, problem_statements(title, short_description), team_members(delegate_id, role_in_team, delegates(full_name, email))"
    )
    .eq("captain_id", delegateId)
    .maybeSingle();
  return (data as unknown as TeamView) ?? null;
}

async function getChapterTrackProblems(
  chapterId: string,
  editionId: string
): Promise<Problem[]> {
  const svc = await createServiceClient();

  // Get this chapter's track for the edition, if any
  const { data: assign } = await svc
    .schema("future")
    .from("chapter_track_assignments")
    .select("track_id")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .maybeSingle();
  const trackId = (assign as { track_id: string } | null)?.track_id ?? null;

  let q = svc
    .schema("future")
    .from("problem_statements")
    .select("id, title, short_description, tracks!inner(edition_id, name, icon, id)")
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId);
  if (trackId) q = q.eq("tracks.id", trackId);
  const { data } = await q.order("display_order", { ascending: true });
  return (data as unknown as Problem[]) ?? [];
}

export default async function MyTeamPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const team = await getMyCaptainedTeam(session.id);
  if (!team) {
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h2 className="text-lg font-bold text-navy">Captain only</h2>
        <p className="mt-2 text-sm text-navy/60">
          This page is for team captains. Ask your chapter admin if you should
          be captain of your team.
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

  const problems = await getChapterTrackProblems(
    team.chapter_id,
    team.edition_id
  );

  async function renameAction(formData: FormData) {
    "use server";
    await updateTeamName(team!.id, team!.edition_id, formData);
  }

  async function pickProblemAction(formData: FormData) {
    "use server";
    const pid = String(formData.get("problem_id") ?? "");
    await pickProblemStatement(team!.id, pid);
  }

  async function clearProblemAction() {
    "use server";
    await clearProblem(team!.id);
  }

  async function freezeAction() {
    "use server";
    await freezeTeam(team!.id);
  }

  async function setLeaderAction(formData: FormData) {
    "use server";
    const newLeader = String(formData.get("leader_delegate_id") ?? "");
    if (!newLeader) return;
    await setLeader(team!.id, newLeader);
  }

  const leaderMember = team.team_members.find(
    (m) => m.delegate_id === team.leader_delegate_id
  );
  const leaderName =
    leaderMember?.delegates.full_name ??
    team.team_members.find((m) => m.delegate_id === team.captain_id)?.delegates
      .full_name ??
    null;
  const isFrozen = team.is_frozen === true;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy flex items-center gap-2">
          Manage {team.team_name}
          {isFrozen && (
            <span className="px-2 py-0.5 rounded-full bg-yi-green/15 text-yi-green text-[11px] font-bold uppercase tracking-wider">
              Frozen ✓
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          You are the captain. Chapter admin controls membership.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <Link
            href="/yi-future/me/team/directory"
            className="font-semibold text-navy hover:text-yi-gold"
          >
            Chapter directory →
          </Link>
          <Link
            href="/yi-future/me/team/invites"
            className="font-semibold text-navy hover:text-yi-gold"
          >
            My invitations →
          </Link>
        </div>
      </div>

      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">Team name</h3>
        <form action={renameAction} className="flex gap-2">
          <input
            name="team_name"
            required
            defaultValue={team.team_name}
            className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Save
          </button>
        </form>
      </section>

      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-bold text-navy">Problem statement</h3>
          {team.problem_statement_id && (
            <form action={clearProblemAction}>
              <button
                type="submit"
                className="text-xs text-red-600/70 hover:text-red-600"
              >
                Re-pick
              </button>
            </form>
          )}
        </div>
        {team.problem_statements ? (
          <div className="p-3 rounded border-2 border-yi-gold/30 bg-yi-gold/5">
            <div className="font-bold text-navy">
              {team.problem_statements.title}
            </div>
            <p className="mt-1 text-sm text-navy/70">
              {team.problem_statements.short_description}
            </p>
          </div>
        ) : problems.length === 0 ? (
          <p className="text-sm text-navy/50 italic">
            No active problems yet. Check back after your chapter assignment is
            live.
          </p>
        ) : (
          <form action={pickProblemAction} className="space-y-3">
            {problems.map((p) => (
              <label
                key={p.id}
                className="block border border-navy/10 rounded-md p-3 cursor-pointer hover:border-yi-gold/50"
              >
                <input
                  type="radio"
                  name="problem_id"
                  value={p.id}
                  required
                  className="mr-2 accent-yi-gold"
                />
                <span className="font-semibold text-navy">
                  {p.tracks?.icon} {p.title}
                </span>
                <div className="mt-1 text-xs text-navy/60">
                  {p.short_description}
                </div>
              </label>
            ))}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Pick problem
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Members ({team.team_members.length}/{TEAM_SIZE_MAX})
        </h3>
        {team.team_members.length < TEAM_SIZE_MIN && (
          <div className="mb-3 p-2 rounded bg-yi-saffron/10 text-yi-saffron text-xs font-semibold">
            Need at least {TEAM_SIZE_MIN} members — ask your chapter admin.
          </div>
        )}
        <ul className="space-y-1 text-sm">
          {team.team_members.map((m) => (
            <li
              key={m.delegate_id}
              className="flex items-center justify-between p-2 border border-navy/10 rounded"
            >
              <div>
                <div className="font-semibold text-navy">
                  {m.delegates.full_name}
                </div>
                <div className="text-xs text-navy/50">
                  {m.delegates.email ?? "—"}
                </div>
              </div>
              {m.delegate_id === team.captain_id && (
                <span className="text-[10px] font-semibold text-yi-gold">
                  CAPTAIN
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-navy/50">
          Adding or removing members is done by your chapter admin.
        </p>
      </section>

      {/* Leader designation (captain-only) */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-1">Team leader</h3>
        <p className="text-xs text-navy/60 mb-3">
          Leader: <span className="font-semibold text-navy">
            {leaderName ?? "— not yet set"}
          </span>
        </p>
        {!isFrozen && (
          <form action={setLeaderAction} className="flex gap-2">
            <select
              name="leader_delegate_id"
              defaultValue={team.leader_delegate_id ?? team.captain_id ?? ""}
              className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="">— pick leader —</option>
              {team.team_members.map((m) => (
                <option key={m.delegate_id} value={m.delegate_id}>
                  {m.delegates.full_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Change leader
            </button>
          </form>
        )}
        {isFrozen && (
          <p className="text-xs text-navy/50 italic">
            Team is frozen — leader can&apos;t be changed.
          </p>
        )}
      </section>

      {/* Freeze team */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-1">Freeze team</h3>
        {isFrozen ? (
          <p className="text-xs text-navy/60">
            This team has been frozen
            {team.frozen_at && (
              <>
                {" on "}
                {new Date(team.frozen_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
            . Members and invites are locked.
          </p>
        ) : (
          <>
            <p className="text-xs text-navy/60 mb-3">
              Once your team is final, freeze it. Once frozen, no members can
              be added or removed and pending invites are cancelled.
            </p>
            <details className="group">
              <summary className="cursor-pointer list-none inline-block px-4 py-2 rounded-md bg-yi-saffron text-ivory text-sm font-semibold hover:opacity-90 select-none">
                Freeze team…
              </summary>
              <div className="mt-3 p-3 rounded-md bg-yi-saffron/10 border border-yi-saffron/30 space-y-2">
                <p className="text-sm font-semibold text-navy">
                  Once frozen, no members can be added or removed. Continue?
                </p>
                <form action={freezeAction} className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-yi-saffron text-ivory text-sm font-bold hover:opacity-90"
                  >
                    Yes, freeze the team
                  </button>
                </form>
              </div>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
