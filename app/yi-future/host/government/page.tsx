import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { deleteGovEngagement } from "@/app/yi-future/actions/government";

type Engagement = {
  id: string;
  official_name: string;
  official_designation: string | null;
  ministry_or_dept: string | null;
  engagement_type: string | null;
  scheduled_at: string | null;
  summary: string | null;
  whitepaper_accepted: boolean | null;
};

async function getEngagements(eventId: string): Promise<Engagement[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("government_engagements")
    .select(
      "id, official_name, official_designation, ministry_or_dept, engagement_type, scheduled_at, summary, whitepaper_accepted"
    )
    .eq("event_id", eventId)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  return (data as unknown as Engagement[]) ?? [];
}

async function remove(formData: FormData) {
  "use server";
  await deleteGovEngagement(String(formData.get("id") ?? ""));
}

export default async function GovernmentPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const engagements = await getEngagements(ctx.nationalEvent.id);
  const acceptedCount = engagements.filter((e) => e.whitepaper_accepted).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Government</h2>
          <p className="mt-1 text-sm text-navy/60">
            {engagements.length} engagement(s) · {acceptedCount} whitepaper
            accepted
          </p>
        </div>
        <Link
          href="/yi-future/host/government/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Log engagement
        </Link>
      </div>

      {engagements.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No government engagements logged yet. The handbook requires at
          least one official from a relevant ministry.
        </div>
      ) : (
        <div className="space-y-3">
          {engagements.map((e) => (
            <article
              key={e.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy">{e.official_name}</div>
                  <div className="text-xs text-navy/60 mt-0.5">
                    {e.official_designation}
                    {e.official_designation && e.ministry_or_dept && " · "}
                    {e.ministry_or_dept}
                  </div>
                  {e.engagement_type && (
                    <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-widest bg-navy/5 px-1.5 py-0.5 rounded text-navy/70">
                      {e.engagement_type}
                    </span>
                  )}
                  {e.summary && (
                    <p className="mt-2 text-sm text-navy/70">{e.summary}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {e.scheduled_at && (
                    <div className="text-xs font-mono text-navy/60">
                      {new Date(e.scheduled_at).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  {e.whitepaper_accepted && (
                    <div className="mt-1 text-[10px] font-semibold text-yi-green">
                      ✓ whitepaper accepted
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-navy/5 flex items-center justify-end gap-3">
                <Link
                  href={`/host/government/${e.id}/edit`}
                  className="text-xs font-semibold text-navy hover:text-yi-gold"
                >
                  Edit
                </Link>
                <form action={remove}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
