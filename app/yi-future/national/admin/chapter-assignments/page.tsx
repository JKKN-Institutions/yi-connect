import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  assignChapterToTrack,
  removeAssignment,
} from "@/app/yi-future/actions/assignments";

type Edition = { id: string; name: string; is_active: boolean | null };
type Track = {
  id: string;
  name: string;
  icon: string | null;
  color_hex: string | null;
  display_order: number | null;
};
type Chapter = {
  id: string;
  name: string;
  city: string;
  state: string | null;
};
type Assignment = {
  chapter_id: string;
  track_id: string;
  role: "host" | "participating";
};

async function load(editionId: string | undefined) {
  const svc = await createServiceClient();
  const { data: editions } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, is_active")
    .order("kickoff_date", { ascending: false });
  const eds = (editions as unknown as Edition[]) ?? [];
  const selected =
    eds.find((e) => e.id === editionId) ?? eds.find((e) => e.is_active) ?? eds[0];

  if (!selected) {
    return {
      editions: eds,
      selected: null,
      tracks: [],
      chapters: [],
      assignments: [] as Assignment[],
    };
  }

  const [{ data: tracks }, { data: chapters }, { data: assignments }] =
    await Promise.all([
      svc
        .schema("future")
        .from("tracks")
        .select("id, name, icon, color_hex, display_order")
        .eq("edition_id", selected.id)
        .order("display_order", { ascending: true }),
      svc
        .schema("yi")
        .from("chapters")
        .select("id, name, city, state")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      svc
        .schema("future")
        .from("chapter_track_assignments")
        .select("chapter_id, track_id, role")
        .eq("edition_id", selected.id),
    ]);

  return {
    editions: eds,
    selected,
    tracks: (tracks as unknown as Track[]) ?? [],
    chapters: (chapters as unknown as Chapter[]) ?? [],
    assignments: (assignments as unknown as Assignment[]) ?? [],
  };
}

async function assignParticipating(formData: FormData) {
  "use server";
  await assignChapterToTrack({
    editionId: String(formData.get("edition_id") ?? ""),
    chapterId: String(formData.get("chapter_id") ?? ""),
    trackId: String(formData.get("track_id") ?? ""),
    role: "participating",
  });
}

async function unassign(formData: FormData) {
  "use server";
  await removeAssignment({
    editionId: String(formData.get("edition_id") ?? ""),
    chapterId: String(formData.get("chapter_id") ?? ""),
    trackId: String(formData.get("track_id") ?? ""),
  });
}

export default async function ChapterAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition } = await searchParams;
  const { editions, selected, tracks, chapters, assignments } = await load(edition);

  const assignmentByChapter = new Map<string, Assignment>();
  for (const a of assignments) assignmentByChapter.set(a.chapter_id, a);

  const assignedCount = assignments.filter(
    (a) => a.role === "participating"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Chapter Assignments</h2>
        <p className="mt-1 text-sm text-navy/60">
          Each participating chapter is assigned one track. Host chapters
          appear here too (managed on the Host Assignments page).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {editions.map((e) => (
          <a
            key={e.id}
            href={`/national/admin/chapter-assignments?edition=${e.id}`}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
              selected?.id === e.id
                ? "bg-navy text-ivory"
                : "bg-white text-navy/70 border border-navy/20"
            }`}
          >
            {e.name}
          </a>
        ))}
      </div>

      {!selected ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-navy/50">
          No edition selected.
        </div>
      ) : (
        <>
          <div className="text-xs text-navy/60">
            {assignedCount} of {chapters.length} chapters assigned as
            participating · {assignments.length - assignedCount} as host.
          </div>

          <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy/5 text-navy/70">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Chapter</th>
                  <th className="text-left px-4 py-3 font-semibold">Role</th>
                  <th className="text-left px-4 py-3 font-semibold">Track</th>
                  <th className="text-right px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {chapters.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-navy/40">
                      No active chapters.
                    </td>
                  </tr>
                ) : (
                  chapters.map((c) => {
                    const a = assignmentByChapter.get(c.id);
                    const track = a
                      ? tracks.find((t) => t.id === a.track_id)
                      : null;

                    return (
                      <tr key={c.id} className="border-t border-navy/5">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-navy">{c.name}</div>
                          <div className="text-xs text-navy/50">
                            {c.city}
                            {c.state && `, ${c.state}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {a ? (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                a.role === "host"
                                  ? "bg-yi-gold/15 text-yi-gold"
                                  : "bg-navy/10 text-navy"
                              }`}
                            >
                              {a.role}
                            </span>
                          ) : (
                            <span className="text-xs text-navy/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {track ? (
                            <span
                              className="font-semibold flex items-center gap-1.5"
                              style={{ color: track.color_hex ?? "#1a1a3e" }}
                            >
                              <span>{track.icon ?? "•"}</span>
                              {track.name}
                            </span>
                          ) : (
                            <form
                              action={assignParticipating}
                              className="flex items-center gap-2"
                            >
                              <input type="hidden" name="edition_id" value={selected.id} />
                              <input type="hidden" name="chapter_id" value={c.id} />
                              <select
                                name="track_id"
                                required
                                className="flex-1 px-2 py-1.5 text-xs border border-navy/20 rounded"
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  — pick a track —
                                </option>
                                {tracks.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="px-3 py-1.5 text-xs font-semibold bg-navy text-ivory rounded"
                              >
                                Assign
                              </button>
                            </form>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a && (
                            <form action={unassign}>
                              <input type="hidden" name="edition_id" value={selected.id} />
                              <input type="hidden" name="chapter_id" value={a.chapter_id} />
                              <input type="hidden" name="track_id" value={a.track_id} />
                              <button
                                type="submit"
                                className="text-xs text-red-600/70 hover:text-red-600"
                              >
                                Remove
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
