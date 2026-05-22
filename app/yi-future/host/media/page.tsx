import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  createMediaCoverage,
  deleteMediaCoverage,
} from "@/app/yi-future/actions/media";

type Media = {
  id: string;
  outlet: string | null;
  headline: string | null;
  url: string | null;
  media_type: string | null;
  publication_date: string | null;
  reach_estimate: number | null;
  notes: string | null;
};

async function getMedia(eventId: string): Promise<Media[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("media_coverage")
    .select(
      "id, outlet, headline, url, media_type, publication_date, reach_estimate, notes"
    )
    .eq("event_id", eventId)
    .order("publication_date", { ascending: false, nullsFirst: false });
  return (data as unknown as Media[]) ?? [];
}

async function remove(formData: FormData) {
  "use server";
  await deleteMediaCoverage(String(formData.get("id") ?? ""));
}

export default async function HostMediaPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const items = await getMedia(ctx.nationalEvent.id);
  const totalReach = items.reduce((s, i) => s + (i.reach_estimate ?? 0), 0);

  async function log(formData: FormData) {
    "use server";
    await createMediaCoverage(ctx!.nationalEvent!.id, formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Media coverage</h2>
          <p className="mt-1 text-sm text-navy/60">
            {items.length} item(s)
            {totalReach > 0 && ` · ~${totalReach.toLocaleString()} total reach`}
          </p>
        </div>
      </div>

      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-3">Log coverage</h3>
        <form action={log} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              name="outlet"
              placeholder="Outlet (e.g. The Hindu)"
              className="px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
            <input
              name="media_type"
              placeholder="Type (print, digital, TV, …)"
              className="px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
          </div>
          <input
            name="headline"
            placeholder="Headline"
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
          />
          <input
            name="url"
            type="url"
            placeholder="URL"
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="publication_date"
              type="date"
              className="px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
            <input
              name="reach_estimate"
              type="number"
              placeholder="Reach estimate"
              className="px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
          </div>
          <textarea
            name="notes"
            placeholder="Notes"
            rows={2}
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Log
            </button>
          </div>
        </form>
      </section>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((m) => (
            <li
              key={m.id}
              className="bg-white border border-navy/10 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy">
                      {m.outlet ?? "—"}
                    </span>
                    {m.media_type && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest bg-navy/5 px-1.5 py-0.5 rounded">
                        {m.media_type}
                      </span>
                    )}
                    {m.publication_date && (
                      <span className="text-xs text-navy/50">
                        {m.publication_date}
                      </span>
                    )}
                  </div>
                  {m.headline && (
                    <div className="mt-1 text-sm text-navy/80">
                      {m.headline}
                    </div>
                  )}
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener"
                      className="mt-1 inline-block text-xs font-mono text-yi-gold hover:underline truncate max-w-full"
                    >
                      {m.url}
                    </a>
                  )}
                  {m.notes && (
                    <p className="mt-2 text-xs text-navy/60">{m.notes}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {m.reach_estimate && (
                    <div className="text-sm font-mono font-bold text-navy">
                      {m.reach_estimate.toLocaleString()}
                    </div>
                  )}
                  <form action={remove}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="mt-1 text-[10px] text-red-600/70 hover:text-red-600"
                    >
                      remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
