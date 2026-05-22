import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  createWhitepaper,
  updateWhitepaper,
  publishWhitepaper,
  unpublishWhitepaper,
  deleteWhitepaper,
} from "@/app/yi-future/actions/whitepapers";

type Section = { heading: string; body: string };

type Whitepaper = {
  id: string;
  title: string | null;
  executive_summary: string | null;
  sections: Section[];
  cover_image_url: string | null;
  pdf_url: string | null;
  status: string | null;
  published_at: string | null;
};

async function getWhitepaper(
  editionId: string,
  trackId: string,
  chapterId: string
): Promise<Whitepaper | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      "id, title, executive_summary, sections, cover_image_url, pdf_url, status, published_at"
    )
    .eq("edition_id", editionId)
    .eq("track_id", trackId)
    .eq("host_chapter_id", chapterId)
    .maybeSingle();
  return (data as unknown as Whitepaper) ?? null;
}

function sectionsToRaw(sections: Section[]): string {
  return sections
    .map((s) => `${s.heading}\n${s.body}`.trim())
    .join("\n\n");
}

export default async function HostWhitepaperPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost) redirect("/yi-future/host");
  if (!ctx.trackId)
    return (
      <div className="bg-white border border-navy/10 rounded-lg p-6 text-center text-sm text-navy/60">
        Your chapter isn&apos;t assigned to a track.
      </div>
    );

  const wp = await getWhitepaper(
    ctx.editionId,
    ctx.trackId,
    ctx.chapterId
  );

  async function create(formData: FormData) {
    "use server";
    await createWhitepaper(
      {
        editionId: ctx!.editionId,
        trackId: ctx!.trackId!,
        hostChapterId: ctx!.chapterId,
      },
      formData
    );
  }

  async function update(formData: FormData) {
    "use server";
    await updateWhitepaper(wp!.id, formData);
  }

  async function publish() {
    "use server";
    await publishWhitepaper(wp!.id);
  }

  async function unpublish() {
    "use server";
    await unpublishWhitepaper(wp!.id);
  }

  async function remove() {
    "use server";
    await deleteWhitepaper(wp!.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-navy">Track Whitepaper</h2>
          <p className="mt-1 text-sm text-navy/60">
            {ctx.trackIcon} {ctx.trackName} · one per host chapter per edition
          </p>
        </div>
        {wp && (
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                wp.status === "published"
                  ? "bg-yi-green/10 text-yi-green"
                  : "bg-navy/5 text-navy/60"
              }`}
            >
              {wp.status ?? "draft"}
            </span>
            {wp.published_at && (
              <div className="text-xs text-navy/50">
                Published{" "}
                {new Date(wp.published_at).toLocaleDateString("en-IN")}
              </div>
            )}
          </div>
        )}
      </div>

      {wp ? (
        <>
          <form
            action={update}
            className="space-y-4 bg-white border border-navy/10 rounded-lg p-5"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Title *
              </label>
              <input
                name="title"
                required
                defaultValue={wp.title ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Executive summary
              </label>
              <textarea
                name="executive_summary"
                rows={4}
                defaultValue={wp.executive_summary ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Sections
              </label>
              <textarea
                name="sections"
                rows={14}
                defaultValue={sectionsToRaw(wp.sections ?? [])}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
              />
              <p className="mt-1 text-xs text-navy/50">
                Format: heading on first line, body on next lines, blank line
                between sections.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                  Cover image URL
                </label>
                <input
                  name="cover_image_url"
                  type="url"
                  defaultValue={wp.cover_image_url ?? ""}
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                  PDF URL
                </label>
                <input
                  name="pdf_url"
                  type="url"
                  defaultValue={wp.pdf_url ?? ""}
                  className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-navy/10">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
              >
                Save
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {wp.status === "published" ? (
              <form action={unpublish}>
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold rounded-md border border-navy/20 text-navy/70 hover:border-navy/40"
                >
                  Unpublish
                </button>
              </form>
            ) : (
              <form action={publish}>
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold rounded-md bg-yi-green/10 text-yi-green hover:bg-yi-green/20"
                >
                  Publish
                </button>
              </form>
            )}
            <a
              href={`/api/whitepapers/${wp.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="px-3 py-2 text-xs font-semibold rounded-md bg-yi-gold/10 text-navy hover:bg-yi-gold/20 border border-yi-gold/30"
            >
              Download generated PDF ↓
            </a>
            {wp.pdf_url && (
              <a
                href={wp.pdf_url}
                target="_blank"
                rel="noopener"
                className="px-3 py-2 text-xs font-semibold rounded-md border border-navy/20 text-navy/70 hover:border-navy/40"
              >
                Open uploaded PDF ↗
              </a>
            )}
            <form action={remove} className="ml-auto">
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold text-red-600/70 hover:text-red-600"
              >
                Delete
              </button>
            </form>
          </div>
        </>
      ) : (
        <form
          action={create}
          className="space-y-4 bg-white border border-navy/10 rounded-lg p-5"
        >
          <p className="text-sm text-navy/60">
            No whitepaper drafted yet. Start one below.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Title *
            </label>
            <input
              name="title"
              required
              placeholder={`${ctx.trackName} — Policy Whitepaper`}
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Executive summary
            </label>
            <textarea
              name="executive_summary"
              rows={3}
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Sections
            </label>
            <textarea
              name="sections"
              rows={10}
              placeholder={`Introduction\nContext for the track and its importance.\n\nChallenge\nWhat the current state is, who it affects, and why.\n\nRecommendations\nPolicy + implementation steps.`}
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Cover image URL
              </label>
              <input
                name="cover_image_url"
                type="url"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                PDF URL
              </label>
              <input
                name="pdf_url"
                type="url"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Create draft
            </button>
          </div>
        </form>
      )}

      <p className="text-xs text-navy/40">
        <Link
          href="/yi-future/host/deliverables"
          className="underline hover:text-navy"
        >
          Deliverables →
        </Link>
      </p>
    </div>
  );
}
