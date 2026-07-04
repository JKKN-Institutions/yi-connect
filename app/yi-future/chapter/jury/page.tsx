import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { TrackIcon } from "@/components/yi-future/TrackIcon";
import {
  deleteJury,
  regenerateJuryCode,
  assignJuryToTeam,
  unassignJuryFromTeam,
  autoAllocateJury,
  assignJuryToTrack,
  unassignJuryFromTrack,
  autoAssignJuryToTeams,
} from "@/app/yi-future/actions/jury";
import {
  JURY_ARCHETYPES,
  JURY_ARCHETYPE_LABELS,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";

type JuryArchetype = Database["future"]["Enums"]["jury_archetype"];

type Track = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

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
    teams: { team_name: string; chapter_id: string } | null;
  }[];
};

type Team = {
  id: string;
  team_name: string;
  problem_statements: { track_id: string | null } | null;
};

type JuryTrackRow = {
  jury_id: string;
  track_id: string;
  jury_assignments: { edition_id: string; is_active: boolean | null } | null;
};

async function getJury(
  editionId: string,
  chapterId: string
): Promise<Jury[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_assignments")
    .select(
      "id, jury_name, jury_title, organization, email, phone, archetype, access_code, is_active, jury_team_assignments(team_id, teams!inner(team_name, chapter_id))"
    )
    .eq("edition_id", editionId)
    .eq("jury_team_assignments.teams.chapter_id", chapterId)
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
    .select("id, team_name, problem_statements(track_id)")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("team_name", { ascending: true });
  return (data as unknown as Team[]) ?? [];
}

// Multi-track jury memberships (future.jury_track_assignments — not in
// generated types yet, hence the cast; established codebase pattern).
async function getJuryTrackMemberships(
  editionId: string
): Promise<JuryTrackRow[]> {
  const svc = await createServiceClient();
  const { data } = await (svc as any)
    .schema("future")
    .from("jury_track_assignments")
    .select("jury_id, track_id, jury_assignments!inner(edition_id, is_active)")
    .eq("jury_assignments.edition_id", editionId);
  return (data as unknown as JuryTrackRow[]) ?? [];
}

async function getTracks(editionId: string): Promise<Track[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("id, name, slug, icon")
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as Track[]) ?? [];
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

const JURY_TRACK_CAP = 10;

const ARCHETYPE_COLOR: Record<JuryArchetype, string> = {
  policy: "bg-yi-gold/10 text-yi-gold",
  industry: "bg-navy/10 text-navy",
  senior_yi: "bg-yi-saffron/10 text-yi-saffron",
  academic: "bg-yi-green/10 text-yi-green",
};

export default async function JuryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const sp = await searchParams;
  const [jury, teams, tracks, juryTrackRows] = await Promise.all([
    getJury(ctx.editionId, ctx.chapterId),
    getTeams(ctx.chapterId, ctx.editionId),
    getTracks(ctx.editionId),
    getJuryTrackMemberships(ctx.editionId),
  ]);

  const archCount: Record<JuryArchetype, number> = {
    policy: 0,
    industry: 0,
    senior_yi: 0,
    academic: 0,
  };
  for (const j of jury) archCount[j.archetype]++;

  // Multi-track membership maps
  const juryTracks = new Map<string, Set<string>>(); // juryId -> trackIds
  const trackPanelCount = new Map<string, number>(); // trackId -> ACTIVE member count
  for (const row of juryTrackRows) {
    if (!juryTracks.has(row.jury_id)) juryTracks.set(row.jury_id, new Set());
    juryTracks.get(row.jury_id)!.add(row.track_id);
    if (row.jury_assignments?.is_active) {
      trackPanelCount.set(
        row.track_id,
        (trackPanelCount.get(row.track_id) ?? 0) + 1
      );
    }
  }

  // Teams per track (via each team's chosen problem statement)
  const teamsPerTrack = new Map<string, number>();
  for (const t of teams) {
    const tid = t.problem_statements?.track_id;
    if (tid) teamsPerTrack.set(tid, (teamsPerTrack.get(tid) ?? 0) + 1);
  }

  const unassignedJury = jury.filter(
    (j) => (juryTracks.get(j.id)?.size ?? 0) === 0
  ).length;

  async function autoAllocate() {
    "use server";
    await autoAllocateJury(ctx!.chapterId, ctx!.editionId);
  }

  async function syncTeams() {
    "use server";
    const res = await autoAssignJuryToTeams(ctx!.chapterId, ctx!.editionId);
    if (!res.ok) {
      redirect(
        `/yi-future/chapter/jury?error=${encodeURIComponent(res.error)}`
      );
    }
    if (res.message) {
      redirect(
        `/yi-future/chapter/jury?msg=${encodeURIComponent(res.message)}`
      );
    }
  }

  async function toggleTrack(formData: FormData) {
    "use server";
    const juryId = String(formData.get("jury_id") ?? "");
    const trackId = String(formData.get("track_id") ?? "");
    const isAssigned = String(formData.get("assigned") ?? "") === "1";
    const res = isAssigned
      ? await unassignJuryFromTrack(juryId, trackId)
      : await assignJuryToTrack(juryId, trackId);
    if (!res.ok) {
      redirect(
        `/yi-future/chapter/jury?error=${encodeURIComponent(res.error)}`
      );
    }
    // Auto-sync team assignments after every successful toggle (best-effort;
    // only ADDS jury↔team rows) so chapters never hand-assign teams.
    await autoAssignJuryToTeams(ctx!.chapterId, ctx!.editionId);
  }

  return (
    <div className="space-y-6">
      {sp.error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.msg && (
        <div className="p-3 rounded-md bg-yi-green/10 border border-yi-green/30 text-sm text-yi-green">
          {sp.msg}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Jury</h2>
          <p className="mt-1 text-sm text-navy/60">
            {jury.length} jury members · {teams.length} teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/yi-future/chapter/jury/categories"
            className="px-3 py-2 text-xs font-semibold rounded-md border border-navy/20 text-navy/70 hover:border-navy/40"
          >
            Track categories
          </Link>
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
          <form action={syncTeams}>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-[#F5A623] text-navy text-sm font-bold hover:bg-[#F5A623]/90 transition-colors"
            >
              Sync team assignments
            </button>
          </form>
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

      {/* Track juries summary */}
      {tracks.length > 0 && (
        <div className="bg-white border border-navy/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
              Track juries
            </div>
            <div className="text-xs text-navy/40">
              {unassignedJury} jury not on any track
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tracks.map((t) => {
              const members = trackPanelCount.get(t.id) ?? 0;
              const teamCount = teamsPerTrack.get(t.id) ?? 0;
              return (
                <div
                  key={t.id}
                  className="border border-navy/10 rounded-md p-3"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                    <TrackIcon icon={t.icon} name={t.name} size={18} className="shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-navy/60">
                    <span
                      className={
                        members >= JURY_TRACK_CAP
                          ? "font-bold text-yi-saffron"
                          : "font-bold text-navy"
                      }
                    >
                      {members}/{JURY_TRACK_CAP}
                    </span>{" "}
                    jury · {teamCount} team{teamCount === 1 ? "" : "s"}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-navy/50">
            Teams are assigned to their track jury automatically based on the
            problem statement they picked. Adding a jury to a track syncs their
            teams on its own; removing a jury from a track keeps already-synced
            teams until you clean them up under Manual overrides.
          </p>
        </div>
      )}

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
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`inline-block text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${ARCHETYPE_COLOR[j.archetype]}`}
                    >
                      {JURY_ARCHETYPE_LABELS[j.archetype]}
                    </span>
                  </div>
                </div>
                <code className="text-xs font-mono font-bold tracking-wider bg-yi-gold/10 text-yi-gold px-2 py-0.5 rounded">
                  {j.access_code}
                </code>
              </div>

              {/* Track jury toggles (multi-track, max 10 per track) */}
              {tracks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-navy/10">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/40 mb-1.5">
                    Track juries (max {JURY_TRACK_CAP} per track)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tracks.map((t) => {
                      const isOn = juryTracks.get(j.id)?.has(t.id) ?? false;
                      const members = trackPanelCount.get(t.id) ?? 0;
                      const isFull = !isOn && members >= JURY_TRACK_CAP;
                      return (
                        <form key={t.id} action={toggleTrack}>
                          <input type="hidden" name="jury_id" value={j.id} />
                          <input type="hidden" name="track_id" value={t.id} />
                          <input
                            type="hidden"
                            name="assigned"
                            value={isOn ? "1" : "0"}
                          />
                          <button
                            type="submit"
                            disabled={isFull}
                            title={
                              isFull
                                ? `This track jury is full (${JURY_TRACK_CAP}/${JURY_TRACK_CAP}).`
                                : isOn
                                  ? "Click to remove from this track jury"
                                  : "Click to add to this track jury"
                            }
                            className={
                              isOn
                                ? "px-2 py-1 text-xs font-semibold rounded-full bg-navy text-ivory hover:bg-navy/85"
                                : isFull
                                  ? "px-2 py-1 text-xs font-semibold rounded-full border border-navy/10 text-navy/30 cursor-not-allowed"
                                  : "px-2 py-1 text-xs font-semibold rounded-full border border-navy/20 text-navy/60 hover:border-navy/50"
                            }
                          >
                            <TrackIcon
                              icon={t.icon}
                              name={t.name}
                              size={12}
                              className="inline-block align-[-2px] mr-1"
                            />
                            {t.name} · {members}/{JURY_TRACK_CAP}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Team assignments — auto-filled by track sync; manual UI kept as advanced override */}
              <details className="mt-3 pt-3 border-t border-navy/10">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest text-navy/40 hover:text-navy/70 select-none">
                  Manual overrides (advanced) · reviewing{" "}
                  {j.jury_team_assignments.length}
                </summary>
                <div className="mt-2">
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
              </details>

              {/* Actions */}
              <div className="mt-3 pt-3 border-t border-navy/10 flex items-center justify-between">
                <Link
                  href={`/yi-future/chapter/jury/${j.id}/edit`}
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
