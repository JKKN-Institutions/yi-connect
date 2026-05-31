import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  getPostEventReport,
  saveDraft,
  submit,
  type PostEventReportRow,
} from "@/app/yi-future/actions/post-event";
import { PostEventForm } from "./PostEventForm";

type HostEventLite = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
};

async function listHostEvents(
  chapterId: string,
  editionId: string
): Promise<HostEventLite[]> {
  const svc = await createServiceClient();
  const cols = "id, name, start_date, end_date, venue";

  // Prefer the all-4-tracks regional finale; fall back to legacy
  // per-track national_track_final events so existing data still renders.
  // (Live future.event_type enum includes "regional_finale" though the
  // generated types are stale — hence the `as never` cast.)
  const { data: regional } = await svc
    .schema("future")
    .from("events")
    .select(cols)
    .eq("chapter_id", chapterId)
    .eq("edition_id", editionId)
    .eq("type", "regional_finale" as never)
    .order("start_date", { ascending: false });

  let data = regional;
  if (!data || data.length === 0) {
    const { data: legacy } = await svc
      .schema("future")
      .from("events")
      .select(cols)
      .eq("chapter_id", chapterId)
      .eq("edition_id", editionId)
      .eq("type", "national_track_final")
      .order("start_date", { ascending: false });
    data = legacy;
  }

  return (data as unknown as HostEventLite[]) ?? [];
}

export default async function HostPostEventPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost) redirect("/yi-future/host");

  const events = await listHostEvents(ctx.chapterId, ctx.editionId);
  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy">Post-event report</h2>
          <p className="mt-1 text-sm text-navy/60">
            {ctx.chapterName} · {ctx.editionName}
          </p>
        </div>
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-bold text-navy">
            No National Track Final found
          </h3>
          <p className="mt-2 text-sm text-navy/60">
            Once the host event is scheduled and held, this page is where you
            file the post-event report.
          </p>
          <Link
            href="/yi-future/host"
            className="mt-4 inline-block text-sm text-navy font-semibold hover:text-yi-gold"
          >
            ← Back to host dashboard
          </Link>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const selectedId =
    sp.event && events.some((e) => e.id === sp.event)
      ? sp.event
      : events[0].id;
  const selected = events.find((e) => e.id === selectedId)!;

  const report: PostEventReportRow | null = await getPostEventReport(
    selectedId
  );
  const isSubmitted = report?.status === "submitted";

  // ─── Form action wrappers ────────────────────────────────────────────
  async function onSaveDraft(formData: FormData) {
    "use server";
    const eventId = String(formData.get("event_id") ?? "");
    const turnoutRaw = String(formData.get("turnout_count") ?? "").trim();
    const turnout = turnoutRaw === "" ? null : Number(turnoutRaw);
    const keyMoments = String(formData.get("key_moments") ?? "");

    // Press links — N rows, named press_link_0, press_link_1, ...
    const links: string[] = [];
    for (const [k, v] of formData.entries()) {
      if (k.startsWith("press_link_") && typeof v === "string" && v.trim()) {
        links.push(v.trim());
      }
    }

    // Prefer media_gallery_json (set by the MediaGallery client component).
    // Fall back to legacy media_path_N entries for zero-JS compatibility.
    const galleryJson = formData.get("media_gallery_json");
    let gallery: string[] = [];
    if (typeof galleryJson === "string" && galleryJson.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(galleryJson);
        if (Array.isArray(parsed)) {
          gallery = parsed
            .filter((v): v is string => typeof v === "string" && v.trim() !== "")
            .map((s) => s.trim());
        }
      } catch {
        // fall through to legacy
      }
    }
    if (gallery.length === 0) {
      for (const [k, v] of formData.entries()) {
        if (k.startsWith("media_path_") && typeof v === "string" && v.trim()) {
          gallery.push(v.trim());
        }
      }
    }

    await saveDraft(eventId, {
      turnout_count: turnout,
      key_moments: keyMoments || null,
      press_coverage_links: links,
      media_gallery_paths: gallery,
    });
  }

  async function onSubmit(formData: FormData) {
    "use server";
    const eventId = String(formData.get("event_id") ?? "");
    await submit(eventId);
  }

  // ─── Submitted (readonly) view ───────────────────────────────────────
  if (isSubmitted && report) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy">Post-event report</h2>
          <p className="mt-1 text-sm text-navy/60">
            {selected.name} ·{" "}
            <span className="text-yi-green font-semibold">✓ SUBMITTED</span>
            {report.submitted_at && (
              <span className="text-navy/40">
                {" "}
                · {new Date(report.submitted_at).toLocaleString()}
              </span>
            )}
          </p>
        </div>

        {events.length > 1 && (
          <EventSwitcher events={events} selectedId={selectedId} />
        )}

        <section className="bg-white border border-navy/10 rounded-lg p-6 space-y-5">
          <Readonly
            label="Turnout count"
            value={
              report.turnout_count !== null
                ? report.turnout_count.toLocaleString()
                : "—"
            }
          />
          <Readonly
            label="Key moments"
            value={report.key_moments ?? "—"}
            multiline
          />
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2">
              Press coverage ({report.press_coverage_links.length})
            </div>
            {report.press_coverage_links.length === 0 ? (
              <p className="text-sm text-navy/40">No links recorded.</p>
            ) : (
              <ul className="space-y-1">
                {report.press_coverage_links.map((u, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener"
                      className="text-yi-gold hover:underline font-mono"
                    >
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2">
              Media gallery ({report.media_gallery_paths.length})
            </div>
            {report.media_gallery_paths.length === 0 ? (
              <p className="text-sm text-navy/40">No files uploaded.</p>
            ) : (
              <ul className="space-y-1">
                {report.media_gallery_paths.map((p, i) => (
                  <li
                    key={i}
                    className="text-xs font-mono text-navy/70 truncate"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ─── Editable view ───────────────────────────────────────────────────
  const initialLinks =
    report?.press_coverage_links && report.press_coverage_links.length > 0
      ? report.press_coverage_links
      : [""];
  const initialGallery =
    report?.media_gallery_paths && report.media_gallery_paths.length > 0
      ? report.media_gallery_paths
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Post-event report</h2>
        <p className="mt-1 text-sm text-navy/60">
          {selected.name}
          {selected.start_date && (
            <span> · {selected.start_date}</span>
          )}
          {selected.venue && <span> · {selected.venue}</span>}
        </p>
      </div>

      {events.length > 1 && (
        <EventSwitcher events={events} selectedId={selectedId} />
      )}

      <PostEventForm
        eventId={selectedId}
        selectedEventName={selected.name}
        selectedStartDate={selected.start_date}
        selectedVenue={selected.venue}
        status={report?.status ?? null}
        turnoutCount={report?.turnout_count ?? null}
        keyMoments={report?.key_moments ?? null}
        initialLinks={initialLinks}
        initialGallery={initialGallery}
        savedAt={report?.created_at ?? null}
        hasDraft={!!report}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────
function EventSwitcher({
  events,
  selectedId,
}: {
  events: HostEventLite[];
  selectedId: string;
}): React.JSX.Element {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-navy/50">
        Event
      </span>
      <div className="flex flex-wrap gap-2">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/host/post-event?event=${e.id}`}
            className={`px-3 py-1 rounded-md text-xs font-semibold ${
              e.id === selectedId
                ? "bg-navy text-ivory"
                : "border border-navy/20 text-navy/70 hover:border-navy/40"
            }`}
          >
            {e.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Readonly({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1">
        {label}
      </div>
      {multiline ? (
        <pre className="text-sm text-navy whitespace-pre-wrap font-sans">
          {value}
        </pre>
      ) : (
        <p className="text-sm text-navy">{value}</p>
      )}
    </div>
  );
}
