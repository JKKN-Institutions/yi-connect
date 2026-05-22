import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { announceAward, deleteAward } from "@/app/yi-future/actions/awards";
import {
  AWARD_CATEGORIES,
  AWARD_CATEGORY_LABELS,
} from "@/lib/yi-future/constants";

type Award = {
  id: string;
  category: string;
  citation: string | null;
  custom_label: string | null;
  position: number | null;
  announced_at: string | null;
  teams: {
    id: string;
    team_name: string;
    chapters: { name: string } | null;
  } | null;
};

type Finalist = {
  team_id: string;
  teams: { id: string; team_name: string; chapters: { name: string } | null } | null;
};

async function getAwards(eventId: string): Promise<Award[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("awards")
    .select(
      "id, category, citation, custom_label, position, announced_at, teams(id, team_name, chapters(name))"
    )
    .eq("event_id", eventId)
    .order("announced_at", { ascending: false });
  return (data as unknown as Award[]) ?? [];
}

async function getFinalists(eventId: string): Promise<Finalist[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select("team_id, teams(id, team_name, chapters(name))")
    .eq("to_event_id", eventId);
  return (data as unknown as Finalist[]) ?? [];
}

async function announce(formData: FormData) {
  "use server";
  const eventId = String(formData.get("event_id") ?? "");
  await announceAward(eventId, formData);
}

async function remove(formData: FormData) {
  "use server";
  await deleteAward(String(formData.get("id") ?? ""));
}

export default async function HostAwardsPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const [awards, finalists] = await Promise.all([
    getAwards(ctx.nationalEvent.id),
    getFinalists(ctx.nationalEvent.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Awards</h2>
        <p className="mt-1 text-sm text-navy/60">
          {awards.length} awarded · track-level recognitions for{" "}
          {ctx.trackName}
        </p>
      </div>

      {/* Announce form */}
      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">
          Announce an award
        </h3>
        {finalists.length === 0 ? (
          <p className="text-sm text-navy/50 italic">
            No finalist teams yet.
          </p>
        ) : (
          <form action={announce} className="space-y-3">
            <input
              type="hidden"
              name="event_id"
              value={ctx.nationalEvent.id}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
                >
                  <option value="" disabled>
                    — pick —
                  </option>
                  {AWARD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {AWARD_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                  Team *
                </label>
                <select
                  name="team_id"
                  required
                  defaultValue=""
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
                >
                  <option value="" disabled>
                    — pick —
                  </option>
                  {finalists.map((f) => (
                    <option key={f.team_id} value={f.team_id}>
                      {f.teams?.team_name} ({f.teams?.chapters?.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                name="position"
                type="number"
                placeholder="Position (optional)"
                className="px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
              <input
                name="custom_label"
                placeholder="Custom label (optional)"
                className="px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <textarea
              name="citation"
              rows={2}
              placeholder="Citation / reason"
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Announce
              </button>
            </div>
          </form>
        )}
      </section>

      {/* List */}
      {awards.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-2">
            Announced awards
          </h3>
          <ul className="space-y-3">
            {awards.map((a) => (
              <li
                key={a.id}
                className="bg-white border-2 border-yi-gold/30 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold">
                      {a.custom_label ??
                        AWARD_CATEGORY_LABELS[
                          a.category as keyof typeof AWARD_CATEGORY_LABELS
                        ] ??
                        a.category}
                      {a.position && ` · #${a.position}`}
                    </div>
                    <div className="mt-1 font-bold text-navy">
                      {a.teams?.team_name ?? "—"}
                    </div>
                    <div className="text-xs text-navy/50">
                      {a.teams?.chapters?.name ?? "—"}
                    </div>
                    {a.citation && (
                      <p className="mt-2 text-sm text-navy/80 italic">
                        {a.citation}
                      </p>
                    )}
                  </div>
                  <form action={remove}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600/70 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
