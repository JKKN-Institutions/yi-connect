import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteMentor,
  regenerateMentorAccessCode,
  assignMentorToTeam,
  unassignMentorFromTeam,
} from "@/app/yi-future/actions/mentors";
import { autoAllocateMentors } from "@/app/yi-future/actions/feedback";

type Mentor = {
  id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  expertise: string | null;
  access_code: string;
  is_active: boolean | null;
  mentor_team_assignments: {
    team_id: string;
    teams: { team_name: string } | null;
  }[];
};

type Team = { id: string; team_name: string };

async function getMentors(
  chapterId: string,
  editionId: string
): Promise<Mentor[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("mentors")
    .select(
      "id, full_name, title, organization, email, phone, expertise, access_code, is_active, mentor_team_assignments(team_id, teams(team_name))"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("full_name", { ascending: true });
  return (data as unknown as Mentor[]) ?? [];
}

async function getTeams(
  chapterId: string,
  editionId: string
): Promise<Team[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("teams")
    .select("id, team_name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as Team[]) ?? [];
}

async function removeMentor(formData: FormData) {
  "use server";
  await deleteMentor(String(formData.get("id") ?? ""));
}

async function regen(formData: FormData) {
  "use server";
  await regenerateMentorAccessCode(String(formData.get("id") ?? ""));
}

async function assign(formData: FormData) {
  "use server";
  const mentorId = String(formData.get("mentor_id") ?? "");
  const teamId = String(formData.get("team_id") ?? "");
  await assignMentorToTeam(mentorId, teamId);
}

async function unassign(formData: FormData) {
  "use server";
  const mentorId = String(formData.get("mentor_id") ?? "");
  const teamId = String(formData.get("team_id") ?? "");
  await unassignMentorFromTeam(mentorId, teamId);
}

export default async function MentorsPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [mentors, teams] = await Promise.all([
    getMentors(ctx.chapterId, ctx.editionId),
    getTeams(ctx.chapterId, ctx.editionId),
  ]);

  const unassignedTeams = teams.length > 0;

  async function autoAllocate() {
    "use server";
    await autoAllocateMentors(ctx!.editionId, ctx!.chapterId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Mentors</h2>
          <p className="mt-1 text-sm text-navy/60">
            {mentors.length} mentors · {teams.length} teams to support
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mentors.length > 0 && unassignedTeams && (
            <form action={autoAllocate}>
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold rounded-md border border-navy/20 text-navy/70 hover:border-navy/40"
              >
                Auto-allocate
              </button>
            </form>
          )}
          <Link
            href="/yi-future/chapter/mentors/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + Add mentor
          </Link>
        </div>
      </div>

      {mentors.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50 text-sm">
          No mentors onboarded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mentors.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy">{m.full_name}</div>
                  {(m.title || m.organization) && (
                    <div className="text-xs text-navy/60 mt-0.5">
                      {m.title}
                      {m.title && m.organization && " · "}
                      {m.organization}
                    </div>
                  )}
                  <div className="text-xs text-navy/50 mt-1">
                    {m.email}
                    {m.email && m.phone && " · "}
                    {m.phone}
                  </div>
                  {m.expertise && (
                    <div className="mt-2 text-xs text-navy/70">
                      <span className="text-navy/40">Expertise: </span>
                      {m.expertise}
                    </div>
                  )}
                </div>
                <code className="text-xs font-mono font-bold tracking-wider bg-yi-gold/10 text-yi-gold px-2 py-0.5 rounded">
                  {m.access_code}
                </code>
              </div>

              {/* Team assignments */}
              <div className="mt-4 pt-3 border-t border-navy/10">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-2">
                  Assigned teams ({m.mentor_team_assignments.length})
                </div>
                {m.mentor_team_assignments.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {m.mentor_team_assignments.map((a) => (
                      <li
                        key={a.team_id}
                        className="flex items-center justify-between text-xs"
                      >
                        <Link
                          href={`/yi-future/chapter/teams/${a.team_id}`}
                          className="font-semibold text-navy hover:text-yi-gold"
                        >
                          {a.teams?.team_name ?? "(unnamed)"}
                        </Link>
                        <form action={unassign}>
                          <input type="hidden" name="mentor_id" value={m.id} />
                          <input type="hidden" name="team_id" value={a.team_id} />
                          <button
                            type="submit"
                            className="text-red-600/60 hover:text-red-600"
                          >
                            remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                {teams.length > 0 && (
                  <form action={assign} className="flex gap-2">
                    <input type="hidden" name="mentor_id" value={m.id} />
                    <select
                      name="team_id"
                      required
                      defaultValue=""
                      className="flex-1 px-2 py-1 text-xs border border-navy/20 rounded bg-white"
                    >
                      <option value="" disabled>
                        — assign team —
                      </option>
                      {teams
                        .filter(
                          (t) =>
                            !m.mentor_team_assignments.find(
                              (a) => a.team_id === t.id
                            )
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.team_name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs font-semibold bg-navy text-ivory rounded"
                    >
                      Assign
                    </button>
                  </form>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 pt-3 border-t border-navy/10 flex items-center justify-between">
                <Link
                  href={`/yi-future/chapter/mentors/${m.id}/edit`}
                  className="text-xs font-semibold text-navy hover:text-yi-gold"
                >
                  Edit
                </Link>
                <form action={regen}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs text-navy/60 hover:text-navy"
                  >
                    Regen code
                  </button>
                </form>
                <form action={removeMentor}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
