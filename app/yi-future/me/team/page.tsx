import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import {
  freezeTeam,
  setLeader,
  pickProblemAsDelegate,
  clearProblemAsDelegate,
  createTeamAsDelegate,
  sendInvite,
} from "@/app/yi-future/actions/team-invites";
import { updateTeamName } from "@/app/yi-future/actions/teams";
import { TEAM_SIZE_MIN, TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { trackIconText } from "@/components/yi-future/TrackIcon";

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

async function getMyTeam(delegateId: string): Promise<TeamView | null> {
  const svc = await createServiceClient();

  const { data: membership } = await svc
    .schema("future")
    .from("team_members")
    .select("team_id")
    .eq("delegate_id", delegateId)
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const teamId = (membership as { team_id: string }).team_id;

  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, edition_id, chapter_id, team_name, status, captain_id, leader_delegate_id, is_frozen, frozen_at, problem_statement_id, problem_statements(title, short_description), team_members(delegate_id, role_in_team, delegates(full_name, email))"
    )
    .eq("id", teamId)
    .maybeSingle();
  return (data as unknown as TeamView) ?? null;
}

type AvailableDelegate = {
  id: string;
  full_name: string;
  hasPendingInvite: boolean;
};

async function getAvailableDelegates(
  chapterId: string,
  editionId: string,
  teamId: string,
  myId: string
): Promise<AvailableDelegate[]> {
  const svc = await createServiceClient();

  const { data: allDelegates } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, team_members(team_id)")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const delegates = (allDelegates ?? []) as unknown as {
    id: string;
    full_name: string;
    team_members: { team_id: string }[];
  }[];

  // Get pending invites for this team
  const { data: pending } = await (svc as any)
    .schema("future")
    .from("team_invitations")
    .select("invited_delegate_id")
    .eq("team_id", teamId)
    .eq("status", "pending");
  const pendingIds = new Set(
    ((pending ?? []) as { invited_delegate_id: string }[]).map((r) => r.invited_delegate_id)
  );

  return delegates
    .filter((d) => d.id !== myId && d.team_members.length === 0)
    .map((d) => ({
      id: d.id,
      full_name: d.full_name,
      hasPendingInvite: pendingIds.has(d.id),
    }));
}

async function getChapterTrackProblems(
  chapterId: string,
  editionId: string
): Promise<Problem[]> {
  const svc = await createServiceClient();

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
    .select(
      "id, title, short_description, tracks!inner(edition_id, name, icon, id)"
    )
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId);
  if (trackId) q = q.eq("tracks.id", trackId);
  const { data } = await q.order("display_order", { ascending: true });
  return (data as unknown as Problem[]) ?? [];
}

export default async function MyTeamPage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const team = await getMyTeam(session.id);
  if (!team) {
    async function createAction(formData: FormData) {
      "use server";
      const name = String(formData.get("team_name") ?? "").trim();
      await createTeamAsDelegate(name);
    }

    return (
      <div className="space-y-5">
        <div>
          <Link
            href="/yi-future/me"
            className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
          >
            ← Dashboard
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-navy">My team</h2>
        </div>

        {/* Create team */}
        <section className="bg-white border border-navy/10 rounded-lg p-6">
          <div className="text-center mb-5">
            <div className="text-4xl mb-2">🚀</div>
            <h3 className="text-lg font-bold text-navy">
              Start your own team
            </h3>
            <p className="mt-1 text-sm text-navy/60">
              Pick a name, become the captain, then invite up to 4 members from your chapter.
            </p>
          </div>
          <form action={createAction} className="max-w-md mx-auto flex gap-2">
            <input
              name="team_name"
              required
              placeholder="e.g. Green Innovators"
              maxLength={80}
              className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-[#F5A623] text-navy text-sm font-bold hover:bg-[#F5A623]/90"
            >
              Create team
            </button>
          </form>
        </section>

        {/* Or check invites */}
        <section className="bg-navy/5 border border-navy/10 rounded-lg p-5 text-center">
          <p className="text-sm text-navy/60">
            Already invited by someone?{" "}
            <Link
              href="/yi-future/me/team/invites"
              className="font-semibold text-navy hover:text-yi-gold"
            >
              Check your invitations →
            </Link>
          </p>
        </section>
      </div>
    );
  }

  const isCaptain = team.captain_id === session.id;
  const isLeader = team.leader_delegate_id === session.id;
  const isFrozen = team.is_frozen === true;
  const canInvite = !isFrozen && team.team_members.length < TEAM_SIZE_MAX;

  const availableDelegates = canInvite
    ? await getAvailableDelegates(team.chapter_id, team.edition_id, team.id, session.id)
    : [];

  const problems = await getChapterTrackProblems(team.chapter_id, team.edition_id);

  async function inviteAction(formData: FormData) {
    "use server";
    const toDelegateId = String(formData.get("to_delegate_id") ?? "");
    await sendInvite({ teamId: team!.id, toDelegateId });
  }

  async function renameAction(formData: FormData) {
    "use server";
    await updateTeamName(team!.id, team!.edition_id, formData);
  }

  async function pickProblemAction(formData: FormData) {
    "use server";
    const pid = String(formData.get("problem_id") ?? "");
    await pickProblemAsDelegate(team!.id, pid);
  }

  async function clearProblemAction() {
    "use server";
    await clearProblemAsDelegate(team!.id);
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
          {team.team_name}
          {isFrozen && (
            <span className="px-2 py-0.5 rounded-full bg-yi-green/15 text-yi-green text-[11px] font-bold uppercase tracking-wider">
              Confirmed ✓
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {isCaptain ? "You are the captain." : "You are a team member."}
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

      {/* Team name (captain only) */}
      {isCaptain && (
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
      )}

      {/* Members */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Members ({team.team_members.length}/{TEAM_SIZE_MAX})
        </h3>
        {team.team_members.length < TEAM_SIZE_MIN && (
          <div className="mb-3 p-2 rounded bg-yi-saffron/10 text-yi-saffron text-xs font-semibold">
            Need at least {TEAM_SIZE_MIN} members.
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
                  {m.delegate_id === session.id && (
                    <span className="ml-1 text-xs text-navy/40">(you)</span>
                  )}
                </div>
                {isCaptain && m.delegates.email && (
                  <div className="text-xs text-navy/50">{m.delegates.email}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {m.delegate_id === team.captain_id && (
                  <span className="text-[10px] font-semibold text-yi-gold">
                    CAPTAIN
                  </span>
                )}
                {m.delegate_id === team.leader_delegate_id &&
                  m.delegate_id !== team.captain_id && (
                    <span className="text-[10px] font-semibold text-yi-green">
                      LEADER
                    </span>
                  )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Invite members — inline list of available chapter delegates */}
      {canInvite && availableDelegates.length > 0 && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-bold text-navy mb-1">
            Invite members
          </h3>
          <p className="text-xs text-navy/50 mb-3">
            {availableDelegates.length} delegate{availableDelegates.length !== 1 ? "s" : ""} available in your chapter
          </p>
          <ul className="space-y-1">
            {availableDelegates.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between p-2 border border-navy/10 rounded"
              >
                <span className="font-semibold text-navy text-sm">
                  {d.full_name}
                </span>
                {d.hasPendingInvite ? (
                  <span className="text-[10px] font-semibold text-yi-gold uppercase tracking-wider">
                    Invite sent
                  </span>
                ) : (
                  <form action={inviteAction}>
                    <input type="hidden" name="to_delegate_id" value={d.id} />
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
                    >
                      Invite
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canInvite && availableDelegates.length === 0 && !isFrozen && (
        <section className="bg-navy/5 border border-navy/10 rounded-lg p-4 text-center text-xs text-navy/50">
          No other delegates available to invite in your chapter yet.
        </section>
      )}

      {/* Problem statement — always visible */}
      {!isFrozen && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-bold text-navy">Problem statement</h3>
            {team.problem_statement_id && (isCaptain || isLeader) && (
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
              <p className="text-xs text-navy/60 mb-2">
                Any team member can pick the problem statement. Choose wisely —
                this is what you&apos;ll work on for 90 days.
              </p>
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
                    {trackIconText(p.tracks?.icon)} {p.title}
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
      )}

      {/* PS shown when frozen (read-only) */}
      {isFrozen && team.problem_statements && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-bold text-navy mb-2">Problem statement</h3>
          <div className="p-3 rounded border-2 border-yi-gold/30 bg-yi-gold/5">
            <div className="font-bold text-navy">{team.problem_statements.title}</div>
            <p className="mt-1 text-sm text-navy/70">{team.problem_statements.short_description}</p>
          </div>
          <p className="mt-2 text-xs text-navy/50">Team is submitted — problem statement is locked.</p>
        </section>
      )}

      {/* Leader designation (captain-only) */}
      {isCaptain && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-bold text-navy mb-1">Team leader</h3>
          <p className="text-xs text-navy/60 mb-3">
            Leader:{" "}
            <span className="font-semibold text-navy">
              {leaderName ?? "— not yet set"}
            </span>
          </p>
          {!isFrozen && (
            <form action={setLeaderAction} className="flex gap-2">
              <select
                name="leader_delegate_id"
                defaultValue={
                  team.leader_delegate_id ?? team.captain_id ?? ""
                }
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
              Team is confirmed — leader can&apos;t be changed.
            </p>
          )}
        </section>
      )}

      {/* Freeze team (captain/leader only) */}
      {(isCaptain || isLeader) && (
        <section className="bg-white border border-navy/10 rounded-lg p-5">
          <h3 className="text-sm font-bold text-navy mb-1">Submit &amp; lock team</h3>
          {isFrozen ? (
            <p className="text-xs text-navy/60">
              This team was confirmed
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
                When you&apos;re done adding members and have picked a problem
                statement, submit to lock your team. After submission, nothing
                can be changed.
              </p>
              {!team.problem_statement_id && (
                <p className="text-xs text-yi-saffron font-semibold mb-3">
                  Pick a problem statement above before submitting.
                </p>
              )}
              <details className="group">
                <summary
                  className={`cursor-pointer list-none inline-block px-4 py-2 rounded-md text-sm font-bold select-none ${
                    team.problem_statement_id
                      ? "bg-[#F5A623] text-navy hover:opacity-90"
                      : "bg-navy/20 text-navy/40 cursor-not-allowed"
                  }`}
                >
                  Submit &amp; lock team…
                </summary>
                {team.problem_statement_id && (
                  <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 space-y-2">
                    <p className="text-sm font-semibold text-navy">
                      This is final. Team members, captain, and problem statement
                      will all be locked. Continue?
                    </p>
                    <form action={freezeAction} className="flex gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                      >
                        Yes, submit and lock
                      </button>
                    </form>
                  </div>
                )}
              </details>
            </>
          )}
        </section>
      )}
    </div>
  );
}
