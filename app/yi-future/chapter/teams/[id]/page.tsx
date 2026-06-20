import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  updateTeamName,
  setTeamCaptain,
  pickProblemStatement,
  clearProblem,
  deleteTeam,
} from "@/app/yi-future/actions/teams";
import { validateTeamForSubmission } from "@/lib/yi-future/team-validation";
import { inviteMember, removeMember } from "@/app/yi-future/actions/members";
import { TEAM_SIZE_MAX } from "@/lib/yi-future/constants";
import { TrackIcon, trackIconText } from "@/components/yi-future/TrackIcon";
import { unfreezeTeam } from "@/app/yi-future/actions/team-invites";

type TeamDetail = {
  id: string;
  chapter_id: string;
  edition_id: string;
  team_name: string;
  status: string | null;
  captain_id: string | null;
  problem_statement_id: string | null;
  is_frozen: boolean | null;
  team_members: {
    delegate_id: string;
    role_in_team: string | null;
    delegates: { full_name: string; email: string | null };
  }[];
  problem_statements: { title: string; short_description: string } | null;
};

type Delegate = {
  id: string;
  full_name: string;
  email: string | null;
  team_members: { team_id: string }[];
};

type Problem = {
  id: string;
  title: string;
  short_description: string;
  is_active: boolean | null;
  tracks: { id: string; name: string; icon: string | null } | null;
};

async function getTeam(id: string): Promise<TeamDetail | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select(
      "id, chapter_id, edition_id, team_name, status, captain_id, problem_statement_id, is_frozen, team_members(delegate_id, role_in_team, delegates(full_name, email)), problem_statements(title, short_description)"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as TeamDetail) ?? null;
}

async function getAvailableDelegates(
  chapterId: string,
  editionId: string
): Promise<Delegate[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, full_name, email, team_members(team_id)")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data as unknown as Delegate[]) ?? [];
}

async function getChapterProblems(editionId: string): Promise<Problem[]> {
  const svc = await createServiceClient();

  // Future 6.0: every chapter runs all 4 tracks, so the admin can allocate
  // ANY of the 12 problem statements (4 tracks × 3 each) for the active
  // edition — do NOT filter by the chapter's primary track assignment.
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, title, short_description, is_active, tracks!inner(id, edition_id, name, icon)"
    )
    .eq("is_active", true)
    .eq("tracks.edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as Problem[]) ?? [];
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const team = await getTeam(id);
  if (!team) notFound();
  if (team.chapter_id !== ctx.chapterId) redirect("/yi-future/chapter/teams");

  const [delegates, problems] = await Promise.all([
    getAvailableDelegates(team.chapter_id, team.edition_id),
    getChapterProblems(team.edition_id),
  ]);

  // Group the 12 problems by track so the picker reads track-by-track.
  const problemsByTrack = problems.reduce<
    { trackId: string; trackName: string; trackIcon: string | null; items: Problem[] }[]
  >((acc, p) => {
    const tId = p.tracks?.id ?? "untracked";
    const tName = p.tracks?.name ?? "Other";
    let group = acc.find((g) => g.trackId === tId);
    if (!group) {
      group = {
        trackId: tId,
        trackName: tName,
        trackIcon: p.tracks?.icon ?? null,
        items: [],
      };
      acc.push(group);
    }
    group.items.push(p);
    return acc;
  }, []);

  const memberIds = new Set(team.team_members.map((m) => m.delegate_id));
  const validation = validateTeamForSubmission({
    members_count: team.team_members.length,
    captain_id: team.captain_id,
    problem_statement_id: team.problem_statement_id,
  });

  async function renameAction(formData: FormData) {
    "use server";
    await updateTeamName(team!.id, team!.edition_id, formData);
  }

  async function inviteMemberAction(formData: FormData) {
    "use server";
    const did = String(formData.get("delegate_id") ?? "");
    await inviteMember(team!.id, did);
  }

  async function removeMemberAction(formData: FormData) {
    "use server";
    const did = String(formData.get("delegate_id") ?? "");
    await removeMember(team!.id, did);
  }

  async function setCaptainAction(formData: FormData) {
    "use server";
    const did = String(formData.get("delegate_id") ?? "");
    await setTeamCaptain(team!.id, did);
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

  async function deleteTeamAction() {
    "use server";
    await deleteTeam(team!.id);
    redirect("/yi-future/chapter/teams");
  }

  async function unfreezeTeamAction() {
    "use server";
    await unfreezeTeam(team!.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/chapter/teams"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← All teams
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-navy">
          {team.team_name}
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {team.team_members.length} member(s) · status:{" "}
          <code className="px-1.5 py-0.5 bg-navy/5 rounded text-xs font-mono">
            {team.status ?? "registered"}
          </code>
        </p>
      </div>

      {/* Submission readiness */}
      {validation.ok ? (
        <div className="bg-yi-green/10 border border-yi-green/30 text-yi-green rounded-md p-3 text-sm font-semibold">
          ✓ Ready for submissions. Captain set, problem picked, team has at
          least 3 members.
        </div>
      ) : (
        <div className="bg-yi-saffron/10 border border-yi-saffron/30 rounded-md p-3 text-sm">
          <div className="font-semibold text-yi-saffron">
            Not ready yet:
          </div>
          <ul className="mt-1 ml-4 list-disc text-navy/80">
            {validation.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Frozen banner + unfreeze (chapter-admin) */}
      {team.is_frozen && (
        <div className="bg-navy/5 border border-navy/20 rounded-md p-3 flex items-center justify-between gap-4">
          <div className="text-sm text-navy/80">
            <span className="font-semibold text-navy">Team is frozen.</span>{" "}
            Members cannot change their roster or problem statement until you
            unfreeze it.
          </div>
          <form action={unfreezeTeamAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark whitespace-nowrap"
            >
              Unfreeze team
            </button>
          </form>
        </div>
      )}

      {/* Name edit */}
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

      {/* Members */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Members ({team.team_members.length}/{TEAM_SIZE_MAX})
        </h3>
        {team.team_members.length === 0 ? (
          <p className="text-sm text-navy/50 italic mb-4">
            No members yet. Add delegates from the dropdown below.
          </p>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {team.team_members.map((m) => (
              <li
                key={m.delegate_id}
                className="flex items-center justify-between p-2 rounded border border-navy/10"
              >
                <div>
                  <div className="font-semibold text-navy">
                    {m.delegates.full_name}
                    {team.captain_id === m.delegate_id && (
                      <span className="ml-2 text-[10px] font-semibold text-yi-gold bg-yi-gold/10 px-1.5 py-0.5 rounded">
                        CAPTAIN
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-navy/50">
                    {m.delegates.email ?? "—"} · role: {m.role_in_team ?? "member"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {team.captain_id !== m.delegate_id && (
                    <form action={setCaptainAction}>
                      <input
                        type="hidden"
                        name="delegate_id"
                        value={m.delegate_id}
                      />
                      <button
                        type="submit"
                        className="text-xs text-navy/60 hover:text-yi-gold"
                      >
                        Make captain
                      </button>
                    </form>
                  )}
                  <form action={removeMemberAction}>
                    <input
                      type="hidden"
                      name="delegate_id"
                      value={m.delegate_id}
                    />
                    <button
                      type="submit"
                      className="text-xs text-red-600/70 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {team.team_members.length < TEAM_SIZE_MAX && (
          <form action={inviteMemberAction} className="flex gap-2 pt-3 border-t border-navy/10">
            <select
              name="delegate_id"
              required
              defaultValue=""
              className="flex-1 px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="" disabled>
                — pick a delegate —
              </option>
              {delegates
                .filter(
                  (d) =>
                    !memberIds.has(d.id) && d.team_members.length === 0
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} {d.email && `(${d.email})`}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Invite
            </button>
          </form>
        )}
      </section>

      {/* Problem */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-bold text-navy">Problem statement</h3>
          {team.problem_statement_id && (
            <form action={clearProblemAction}>
              <button
                type="submit"
                className="text-xs text-red-600/70 hover:text-red-600"
              >
                Clear pick
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
        ) : (
          <form action={pickProblemAction} className="space-y-3">
            {/* Track legend — all 4 tracks the chapter can allocate from */}
            {problemsByTrack.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-navy/60">
                {problemsByTrack.map((g) => (
                  <span key={g.trackId} className="flex items-center gap-1.5">
                    <TrackIcon
                      icon={g.trackIcon}
                      name={g.trackName}
                      size={16}
                      className="inline-block"
                    />
                    {g.trackName}
                  </span>
                ))}
              </div>
            )}
            <select
              name="problem_id"
              required
              defaultValue=""
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="" disabled>
                — pick a problem —
              </option>
              {problemsByTrack.map((g) => (
                <optgroup
                  key={g.trackId}
                  label={`${trackIconText(g.trackIcon)} ${g.trackName}`}
                >
                  {g.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Pick problem
              </button>
            </div>
            {problems.length === 0 && (
              <p className="text-xs text-navy/50">
                No active problems available. National admin needs to add
                some.
              </p>
            )}
          </form>
        )}
      </section>

      {/* Danger zone */}
      <section className="bg-white border border-red-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-red-600 mb-2">Danger zone</h3>
        <form action={deleteTeamAction}>
          <button
            type="submit"
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Delete team
          </button>
        </form>
        <p className="mt-1 text-xs text-navy/50">
          All members will be freed up to join another team. Submissions
          cannot be recovered.
        </p>
      </section>
    </div>
  );
}
