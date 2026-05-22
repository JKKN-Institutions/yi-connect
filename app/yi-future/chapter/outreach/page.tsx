import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import {
  deleteOutreachEntry,
  logOutreachActivity,
} from "@/app/yi-future/actions/outreach";

type OutreachRow = {
  id: string;
  activity_type: string;
  activity_date: string | null;
  attendees_count: number | null;
  notes: string | null;
  college_id: string | null;
  colleges: { name: string } | null;
};

type College = { id: string; name: string };

async function getEntries(
  chapterId: string,
  editionId: string
): Promise<OutreachRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("outreach_log")
    .select(
      "id, activity_type, activity_date, attendees_count, notes, college_id, colleges(name)"
    )
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .order("activity_date", { ascending: false, nullsFirst: false });
  return (data as unknown as OutreachRow[]) ?? [];
}

async function getColleges(chapterId: string): Promise<College[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name")
    .eq("chapter_id", chapterId)
    .order("name", { ascending: true });
  return (data as unknown as College[]) ?? [];
}

export default async function OutreachPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const [entries, colleges] = await Promise.all([
    getEntries(ctx.chapterId, ctx.editionId),
    getColleges(ctx.chapterId),
  ]);

  const totalAttendees = entries.reduce(
    (s, e) => s + (e.attendees_count ?? 0),
    0
  );

  async function addEntry(formData: FormData) {
    "use server";
    await logOutreachActivity(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  async function removeEntry(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    await deleteOutreachEntry(id);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-navy">Outreach Log</h2>
        <p className="mt-1 text-sm text-navy/60">
          {entries.length} activities · {totalAttendees} total attendees reached
        </p>
      </div>

      {/* Add new entry */}
      <section className="bg-white border border-navy/10 rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy mb-4">Log an activity</h3>
        <form action={addEntry} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Activity type
              </label>
              <select
                name="activity_type"
                required
                defaultValue=""
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                <option value="" disabled>
                  — pick —
                </option>
                <option>Campus visit</option>
                <option>Info session</option>
                <option>Workshop</option>
                <option>Drive / registration event</option>
                <option>Faculty meeting</option>
                <option>Social post / email blast</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Date
              </label>
              <input
                name="activity_date"
                type="date"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                College (optional)
              </label>
              <select
                name="college_id"
                defaultValue=""
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                <option value="">— none —</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Attendees
              </label>
              <input
                name="attendees_count"
                type="number"
                min={0}
                placeholder="e.g. 45"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Outcomes, leads, anything worth remembering…"
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Log activity
            </button>
          </div>
        </form>
      </section>

      {/* Log */}
      <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-navy/5 text-sm font-bold text-navy">
          Activity history
        </div>
        {entries.length === 0 ? (
          <div className="p-8 text-center text-navy/50 text-sm">
            No activities logged yet.
          </div>
        ) : (
          <ul className="divide-y divide-navy/5">
            {entries.map((e) => (
              <li key={e.id} className="px-5 py-4 flex items-start gap-4">
                <div className="text-xs font-mono text-navy/40 w-24 flex-shrink-0 pt-0.5">
                  {e.activity_date ?? "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy">
                      {e.activity_type}
                    </span>
                    {e.attendees_count && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-navy/5">
                        {e.attendees_count} attendees
                      </span>
                    )}
                  </div>
                  {e.colleges?.name && (
                    <div className="text-xs text-navy/60 mt-0.5">
                      @ {e.colleges.name}
                    </div>
                  )}
                  {e.notes && (
                    <p className="mt-1 text-sm text-navy/70">{e.notes}</p>
                  )}
                </div>
                <form action={removeEntry}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
