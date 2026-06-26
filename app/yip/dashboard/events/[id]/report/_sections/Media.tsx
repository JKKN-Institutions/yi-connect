/**
 * YIP Chapter Round Report — Section 7: Media & Coverage (Photo Gallery).
 *
 * Self-fetching server component (mirrors the reference Overview section):
 *   - default-exported async server component (no "use client" here —
 *     interactivity lives in the MediaPhotoFill child).
 *   - signature: ({ eventId, canManage }: { eventId: string; canManage: boolean }).
 *   - fetches its OWN data via lib/yip/report/sections/media.ts.
 *   - renders the printable gallery; when canManage, also shows the
 *     recommended-shots checklist + the inline "add a photo by link" control
 *     (print:hidden).
 *   - returns null when the data getter returns null (no-access / missing
 *     event) so a no-access section never throws inside the page's Suspense.
 *
 * The gallery is a print-friendly grid: cover photo first (larger), then the
 * rest, captions + photographer credits below each shot.
 */
import {
  getMediaSectionData,
  RECOMMENDED_SHOTS,
} from "@/lib/yip/report/sections/media";
import { MediaPhotoFill } from "./MediaPhotoFill";

export default async function MediaSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getMediaSectionData(eventId);
  if (!data) return null;

  const { photos, photoCount, socialReach, socialLinks } = data;
  const cover = photos.find((p) => p.isCover) ?? null;
  const rest = photos.filter((p) => p.id !== cover?.id);
  const hasCover = Boolean(cover);

  return (
    <div className="space-y-6">
      {/* Summary line + social reach */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#1a1a3e]/70">
          {photoCount > 0
            ? `${photoCount} photo${photoCount === 1 ? "" : "s"} in the event gallery.`
            : "No photos in the event gallery yet."}
        </p>
        {socialReach != null && (
          <span className="rounded-full bg-[#138808]/10 px-3 py-1 text-xs font-semibold text-[#138808]">
            Social reach: {socialReach.toLocaleString("en-IN")}
          </span>
        )}
      </div>

      {/* Photo gallery */}
      {photoCount > 0 ? (
        <div className="space-y-4">
          {/* Cover photo (larger) */}
          {cover && cover.publicUrl && (
            <figure className="break-inside-avoid overflow-hidden rounded-xl border border-[#FF9933]/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover.publicUrl}
                alt={cover.caption ?? "Event cover photo"}
                className="max-h-[420px] w-full object-cover"
              />
              {(cover.caption || cover.photographerName) && (
                <figcaption className="bg-[#FF9933]/5 px-4 py-2 text-sm text-[#1a1a3e]/80">
                  {cover.caption}
                  {cover.photographerName ? (
                    <span className="block text-xs text-[#1a1a3e]/50">
                      Photo: {cover.photographerName}
                    </span>
                  ) : null}
                </figcaption>
              )}
            </figure>
          )}

          {/* Remaining photos in a print-friendly grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rest.map((p) =>
                p.publicUrl ? (
                  <figure
                    key={p.id}
                    className="break-inside-avoid overflow-hidden rounded-lg border border-[#1a1a3e]/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.publicUrl}
                      alt={p.caption ?? "Event photo"}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {(p.caption || p.photographerName) && (
                      <figcaption className="px-2 py-1.5 text-xs text-[#1a1a3e]/70">
                        {p.caption}
                        {p.photographerName ? (
                          <span className="block text-[10px] text-[#1a1a3e]/45">
                            {p.photographerName}
                          </span>
                        ) : null}
                      </figcaption>
                    )}
                  </figure>
                ) : null
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#1a1a3e]/40">
          No photos have been added to this event yet. Upload event photos from
          the Media tab, or add one by link below.
        </p>
      )}

      {/* Inline capture (managers only) — add a photo by link */}
      {canManage && (
        <div className="print:hidden">
          <MediaPhotoFill eventId={eventId} hasCover={hasCover} />
        </div>
      )}

      {/* Social coverage links (auto-derived) */}
      {socialLinks.length > 0 && (
        <div className="break-inside-avoid">
          <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
            Social Coverage
          </h3>
          <ul className="space-y-1">
            {socialLinks.map((url, i) => (
              <li key={`${url}-${i}`} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[#1a1a3e]/75 underline decoration-[#FF9933]/40 underline-offset-2 hover:text-[#FF9933]"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended shots checklist (managers only, hidden from print) */}
      {canManage && (
        <div className="print:hidden break-inside-avoid rounded-lg border border-dashed border-[#1a1a3e]/15 bg-[#1a1a3e]/[0.02] p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1a1a3e]/50">
            Recommended shots for a complete report
          </h3>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {RECOMMENDED_SHOTS.map((shot, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-[#1a1a3e]/65"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FF9933]/60" />
                {shot}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
