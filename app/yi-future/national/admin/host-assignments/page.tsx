import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  assignChapterToTrack,
  removeAssignment,
} from "@/app/yi-future/actions/assignments";

type Edition = {
  id: string;
  name: string;
  is_active: boolean | null;
};

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
  const selected = eds.find((e) => e.id === editionId) ?? eds.find((e) => e.is_active) ?? eds[0];

  if (!selected) {
    return { editions: eds, selected: null, tracks: [], chapters: [], assignments: [] as Assignment[] };
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

async function assignHost(formData: FormData) {
  "use server";
  await assignChapterToTrack({
    editionId: String(formData.get("edition_id") ?? ""),
    chapterId: String(formData.get("chapter_id") ?? ""),
    trackId: String(formData.get("track_id") ?? ""),
    role: "host",
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

export default async function HostAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition } = await searchParams;
  const { editions, selected, tracks, chapters, assignments } = await load(edition);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Host Assignments</h2>
        <p className="mt-1 text-sm text-navy/60">
          Each track gets one host chapter — they run the 2-day National Track
          Final.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {editions.map((e) => (
          <a
            key={e.id}
            href={`/national/admin/host-assignments?edition=${e.id}`}
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
        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Track</th>
                <th className="text-left px-4 py-3 font-semibold">Host chapter</th>
                <th className="text-right px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-navy/40">
                    No tracks on this edition.
                  </td>
                </tr>
              ) : (
                tracks.map((t) => {
                  const hostAssign = assignments.find(
                    (a) => a.track_id === t.id && a.role === "host"
                  );
                  const hostChapter = hostAssign
                    ? chapters.find((c) => c.id === hostAssign.chapter_id)
                    : null;

                  return (
                    <tr key={t.id} className="border-t border-navy/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{t.icon ?? "•"}</span>
                          <span
                            className="font-semibold"
                            style={{ color: t.color_hex ?? "#1a1a3e" }}
                          >
                            {t.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {hostChapter ? (
                          <div>
                            <div className="font-semibold text-navy">
                              {hostChapter.name}
                            </div>
                            <div className="text-xs text-navy/50">
                              {hostChapter.city}
                              {hostChapter.state && `, ${hostChapter.state}`}
                            </div>
                          </div>
                        ) : (
                          <form
                            action={assignHost}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="edition_id" value={selected.id} />
                            <input type="hidden" name="track_id" value={t.id} />
                            <select
                              name="chapter_id"
                              required
                              className="flex-1 px-2 py-1.5 text-xs border border-navy/20 rounded"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                — pick a chapter —
                              </option>
                              {chapters.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.city})
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="px-3 py-1.5 text-xs font-semibold bg-navy text-ivory rounded"
                            >
                              Assign host
                            </button>
                          </form>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hostAssign && (
                          <form action={unassign}>
                            <input type="hidden" name="edition_id" value={selected.id} />
                            <input type="hidden" name="chapter_id" value={hostAssign.chapter_id} />
                            <input type="hidden" name="track_id" value={hostAssign.track_id} />
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
      )}

      <p className="text-xs text-navy/40">
        Note: a chapter can be either host OR participating for a given edition
        (not both). Setting a host replaces any prior role.
      </p>
    </div>
  );
}
