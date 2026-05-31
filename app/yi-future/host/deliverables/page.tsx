import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";

type EventRow = { id: string; name: string };
type DeliverableRow = {
  id: string;
  event_id: string;
  whitepaper_url: string | null;
  media_coverage_doc_url: string | null;
  internship_outcomes_doc_url: string | null;
  participation_metrics_doc_url: string | null;
  shortlist_winners_doc_url: string | null;
  submitted_at: string | null;
};

async function getHostEvent(
  chapterId: string,
  editionId: string
): Promise<EventRow | null> {
  const svc = await createServiceClient();

  // Prefer the all-4-tracks regional finale; fall back to legacy per-track
  // national_track_final so existing data still renders. (Live
  // future.event_type enum includes "regional_finale" though the generated
  // types are stale — hence the `as never` cast.)
  const { data: regional } = await svc
    .schema("future")
    .from("events")
    .select("id, name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("type", "regional_finale" as never)
    .limit(1)
    .maybeSingle();
  if (regional) return regional as unknown as EventRow;

  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, name")
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("type", "national_track_final")
    .limit(1)
    .maybeSingle();
  return (data as unknown as EventRow) ?? null;
}

async function getDeliverable(eventId: string): Promise<DeliverableRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("host_deliverables")
    .select(
      "id, event_id, whitepaper_url, media_coverage_doc_url, internship_outcomes_doc_url, participation_metrics_doc_url, shortlist_winners_doc_url, submitted_at"
    )
    .eq("event_id", eventId)
    .maybeSingle();
  return (data as unknown as DeliverableRow) ?? null;
}

async function saveDeliverables(eventId: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  const whitepaper_url =
    String(formData.get("whitepaper_url") ?? "").trim() || null;
  const media_coverage_doc_url =
    String(formData.get("media_coverage_doc_url") ?? "").trim() || null;
  const internship_outcomes_doc_url =
    String(formData.get("internship_outcomes_doc_url") ?? "").trim() || null;
  const participation_metrics_doc_url =
    String(formData.get("participation_metrics_doc_url") ?? "").trim() || null;
  const shortlist_winners_doc_url =
    String(formData.get("shortlist_winners_doc_url") ?? "").trim() || null;

  const svc = await createServiceClient();
  await svc
    .schema("future")
    .from("host_deliverables")
    .upsert(
      {
        event_id: eventId,
        whitepaper_url,
        media_coverage_doc_url,
        internship_outcomes_doc_url,
        participation_metrics_doc_url,
        shortlist_winners_doc_url,
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
      },
      { onConflict: "event_id" }
    );

  revalidatePath("/yi-future/host/deliverables");
}

export default async function HostDeliverablesPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/login");

  const event = await getHostEvent(ctx.chapterId, ctx.editionId);

  if (!event) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy">Deliverables</h2>
          <p className="mt-1 text-sm text-navy/60">
            Final documents uploaded after the National Track Final concludes.
          </p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-navy/60 text-sm">
            Create a National Track Final first.
          </div>
          <Link
            href="/yi-future/host"
            className="mt-3 inline-block text-xs font-semibold text-yi-gold hover:text-navy"
          >
            Go to Host overview →
          </Link>
        </div>
      </div>
    );
  }

  const deliverable = await getDeliverable(event.id);

  async function action(formData: FormData) {
    "use server";
    await saveDeliverables(event!.id, formData);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Deliverables</h2>
        <p className="mt-1 text-sm text-navy/60">
          Post-event submission for{" "}
          <span className="font-semibold text-navy">{event.name}</span>. Paste
          shareable links (Drive, Docs, Notion, etc.).
        </p>
        {deliverable?.submitted_at && (
          <p className="mt-1 text-xs text-navy/50">
            Last saved:{" "}
            {new Date(deliverable.submitted_at).toLocaleString("en-IN")}
          </p>
        )}
      </div>

      <form
        action={action}
        className="bg-white border border-navy/10 rounded-lg p-6 space-y-5"
      >
        <UrlField
          label="Whitepaper URL"
          name="whitepaper_url"
          hint="Consolidated policy whitepaper for this track"
          defaultValue={deliverable?.whitepaper_url ?? ""}
        />
        <UrlField
          label="Media coverage doc"
          name="media_coverage_doc_url"
          hint="Press releases, clippings, social coverage"
          defaultValue={deliverable?.media_coverage_doc_url ?? ""}
        />
        <UrlField
          label="Internship outcomes doc"
          name="internship_outcomes_doc_url"
          hint="Offers extended, accepted, conversions"
          defaultValue={deliverable?.internship_outcomes_doc_url ?? ""}
        />
        <UrlField
          label="Participation metrics doc"
          name="participation_metrics_doc_url"
          hint="Delegates, chapters, sessions, feedback"
          defaultValue={deliverable?.participation_metrics_doc_url ?? ""}
        />
        <UrlField
          label="Shortlist & winners doc"
          name="shortlist_winners_doc_url"
          hint="Final shortlist, ranked winners, award citations"
          defaultValue={deliverable?.shortlist_winners_doc_url ?? ""}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy/10">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Save deliverables
          </button>
        </div>
      </form>
    </div>
  );
}

function UrlField({
  label,
  name,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-semibold uppercase tracking-widest text-navy/70"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="url"
        defaultValue={defaultValue}
        placeholder="https://..."
        className="w-full px-3 py-2 border border-navy/20 rounded-md focus:border-yi-gold focus:outline-none focus:ring-2 focus:ring-yi-gold/20 text-sm text-navy"
      />
      {hint && <p className="text-xs text-navy/50">{hint}</p>}
    </div>
  );
}
