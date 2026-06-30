import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  createNationalAnnouncement,
  deleteAnnouncement,
  listNationalAnnouncements,
} from "@/app/yi-future/actions/announcements";
import type { ComposerState } from "@/app/yi-future/actions/announcements-types";
import { AnnouncementComposer } from "@/components/yi-future/announcements/AnnouncementComposer";

export const metadata = {
  title: "Announcements · Yi National · Yi Future 6.0",
};

const NAVY = "#1a1a3e";

async function getActiveEdition(): Promise<{ id: string; name: string } | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}

async function getChapters(): Promise<{ id: string; label: string }[]> {
  // future.chapters is a VIEW (not in the generated `future` Tables type) — use
  // a loose client, the established pattern for view/cross-schema reads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data } = await svc
    .schema("future")
    .from("chapters")
    .select("id, name, city")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return ((data as { id: string; name: string; city: string | null }[]) ?? []).map(
    (c) => ({ id: c.id, label: c.city ? `${c.name} · ${c.city}` : c.name })
  );
}

async function getZones(): Promise<{ id: string; label: string }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;
  const { data } = await svc
    .schema("future")
    .from("chapters")
    .select("region")
    .eq("is_active", true);
  const regions = [
    ...new Set(
      ((data as { region: string | null }[]) ?? [])
        .map((r) => r.region)
        .filter((r): r is string => !!r)
    ),
  ].sort();
  return regions.map((r) => ({ id: r, label: r }));
}

const AUDIENCE_LABEL: Record<string, string> = {
  everyone: "Everyone",
  chapter: "One chapter",
  zone: "Zone",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function NationalAnnouncementsPage() {
  const edition = await getActiveEdition();
  if (!edition) {
    return (
      <div
        className="rounded-lg border bg-white p-6 text-center text-sm"
        style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
      >
        No active edition. Activate one under Editions first.
      </div>
    );
  }

  const [chapters, zones, sent] = await Promise.all([
    getChapters(),
    getZones(),
    listNationalAnnouncements(edition.id),
  ]);

  async function postAction(
    _prev: ComposerState,
    formData: FormData
  ): Promise<ComposerState> {
    "use server";
    return createNationalAnnouncement({ editionId: edition!.id }, formData);
  }

  async function removeAnnouncement(formData: FormData) {
    "use server";
    await deleteAnnouncement(String(formData.get("id") ?? ""));
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: NAVY }}>
          Announcements
        </h2>
        <p className="mt-1 text-sm" style={{ color: `${NAVY}99` }}>
          Broadcast to every delegate in {edition.name}, or to a single
          chapter. Appears on each delegate&apos;s dashboard.
        </p>
      </div>

      <AnnouncementComposer
        mode="national"
        action={postAction}
        chapters={chapters}
        zones={zones}
      />

      <section className="space-y-3">
        <h3
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: `${NAVY}99` }}
        >
          Sent ({sent.length})
        </h3>
        {sent.length === 0 ? (
          <div
            className="rounded-lg border bg-white p-6 text-center text-sm"
            style={{ borderColor: `${NAVY}1a`, color: `${NAVY}80` }}
          >
            Nothing sent yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sent.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border bg-white p-4"
                style={{ borderColor: `${NAVY}1a` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold" style={{ color: NAVY }}>
                      {a.title}
                    </div>
                    <p
                      className="mt-0.5 text-sm whitespace-pre-wrap"
                      style={{ color: `${NAVY}b3` }}
                    >
                      {a.body}
                    </p>
                    <div
                      className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"
                      style={{ color: `${NAVY}80` }}
                    >
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{ background: "#F5A62314", color: "#9a6a00" }}
                      >
                        {AUDIENCE_LABEL[a.audience] ?? a.audience}
                        {a.audience === "zone" && a.zone ? ` · ${a.zone}` : ""}
                      </span>
                      <span>{when(a.created_at)}</span>
                      <span>· {a.read_count} read</span>
                    </div>
                  </div>
                  <form action={removeAnnouncement}>
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
        )}
      </section>
    </div>
  );
}
