import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteJury,
  regenerateJuryCode,
  assignJuryToTeam,
  unassignJuryFromTeam,
  autoAllocateJury,
} from "@/app/yi-future/actions/jury";
import {
  JURY_ARCHETYPES,
  JURY_ARCHETYPE_LABELS,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";

type JuryArchetype = Database["future"]["Enums"]["jury_archetype"];

type Jury = {
  id: string;
  jury_name: string;
  jury_title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  archetype: JuryArchetype;
  access_code: string;
  is_active: boolean | null;
  jury_team_assignments: {
    team_id: string;
    teams: { team_name: string } | null;
  }[];
};

type Team = { id: string; team_name: string };

async function getJury(editionId: string): Promise<Jury[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_assignments")
    .select(
      "id, jury_name, jury_title, organization, email, phone, archetype, access_code, is_active, jury_team_assignments(team_id, teams(team_name))"
    )
    .eq("edition_id", editionId)
    .order("jury_name", { ascending: true });
  return (data as unknown as Jury[]) ?? [];
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

async function removeJury(formData: FormData) {
  "use server";
  await deleteJury(String(formData.get("id") ?? ""));
}

async function regen(formData: FormData) {
  "use server";
  await regenerateJuryCode(String(formData.get("id") ?? ""));
}

async function assign(formData: FormData) {
  "use server";
  await assignJuryToTeam(
    String(formData.get("jury_id") ?? ""),
    String(formData.get("team_id") ?? "")
  );
}

async function unassign(formData: FormData) {
  "use server";
  await unassignJuryFromTeam(
    String(formData.get("jury_id") ?? ""),
    String(formData.get("team_id") ?? "")
  );
}

const ARCHETYPE_COLOR: Record<JuryArchetype, string> = {
  policy: "bg-yi-gold/10 text-yi-gold",
  industry: "bg-navy/10 text-navy",
  senior_yi: "bg-yi-saffron/10 text-yi-saffron",
  academic: "bg-yi-green/10 text-yi-green",
};

export default async function JuryPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [jury, teams] = await Promise.all([
    getJury(ctx.editionId),
    getTeams(ctx.chapterId, ctx.editionId),
  ]);

  const archCount: Record<JuryArchetype, number> = {
    policy: 0,
    industry: 0,
    senior_yi: 0,
    academic: 0,
  };
  for (const j of jury) archCount[j.archetype]++;

  async function autoAllocate() {
    "use server";
    await autoAllocateJury(ctx!.chapterId, ctx!.editionId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Jury</h2>
          <p className="mt-1 text-sm text-navy/60">
            {jury.length} jury members · {teams.length} teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          {jury.length >= 3 && teams.length > 0 && (
            <form action={autoAllocate}>
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold rounded-md border border-navy/20 text-navy/70 hover:border-navy/40"
              >
                Auto-allocate (3-per-team)
              </button>
            </form>
          )}
          <Link
            href="/yi-future/chapter/jury/new"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            + Add jury
          </Link>
        </div>
      </div>

      {/* Archetype spread */}
      <div className="grid grid-cols-4 gap-3">
        {JURY_ARCHETYPES.map((a) => (
          <div
            key={a}
            className="bg-white border border-navy/10 rounded-lg p-3"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
              {JURY_ARCHETYPE_LABELS[a]}
            </div>
            <div className="mt-1 text-2xl font-bold text-navy">
              {archCount[a]}
            </div>
          </div>
        ))}
      </div>

      {jury.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50 text-sm">
          No jury members yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jury.map((j) => (
            <div
              key={j.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy">{j.jury_name}</div>
                  {(j.jury_title || j.organization) && (
                    <div className="text-xs text-navy/60 mt-0.5">
                      {j.jury_title}
                      {j.jury_title && j.organization && " · "}
                      {j.organization}
                    </div>
                  )}
                  <div className="text-xs text-navy/50 mt-1">
                    {j.email}
                    {j.email && j.phone && " · "}
                    {j.phone}
                  </div>
                  <span
                    className={`mt-2 inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${ARCHETYPE_COLOR[j.archetype]}`}
                  >
                    {JURY_ARCHETYPE_LABELS[j.archetype]}
                  </span>
                </div>
                <code className="text-xs font-mono font-bold tracking-wider bg-yi-gold/10 text-yi-gold px-2 py-0.5 rounded">
                  {j.access_code}
                </code>
              </div>

              {/* Team assignments */}
              <div className="mt-4 pt-3 border-t border-navy/10">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-2">
                  Reviewing ({j.jury_team_assignments.length})
                </div>
                {j.jury_team_assignments.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {j.jury_team_assignments.map((a) => (
                      <li
                        key={a.team_id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-navy">
                          {a.teams?.team_name ?? "(unnamed)"}
                        </span>
                        <form action={unassign}>
                          <input type="hidden" name="jury_id" value={j.id} />
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
                    <input type="hidden" name="jury_id" value={j.id} />
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
                            !j.jury_team_assignments.find(
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
                  href={`/chapter/jury/${j.id}/edit`}
                  className="text-xs font-semibold text-navy hover:text-yi-gold"
                >
                  Edit
                </Link>
                <form action={regen}>
                  <input type="hidden" name="id" value={j.id} />
                  <button
                    type="submit"
                    className="text-xs text-navy/60 hover:text-navy"
                  >
                    Regen code
                  </button>
                </form>
                <form action={removeJury}>
                  <input type="hidden" name="id" value={j.id} />
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
