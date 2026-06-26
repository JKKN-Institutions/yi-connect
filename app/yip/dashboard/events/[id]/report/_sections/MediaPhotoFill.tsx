"use client";

/**
 * Inline capture control for Section 7 (Media & Coverage) of the Chapter Round
 * Report. Rendered ONLY when canManage is true — it lets an organiser add a
 * gallery photo by URL + caption without leaving the report. Hidden from the
 * printout (`print:hidden`); once added, the section re-renders with the photo
 * in the gallery.
 *
 * REUSE NOTE: the bulk of event photos are uploaded on the live Media tab
 * (drag-and-drop file upload → Supabase Storage). This control is the
 * lightweight gap-filler for the report only; it calls addReportPhotoByUrl,
 * which inserts the same yip.media row shape so the photo also shows on the
 * Media tab.
 *
 * Mirrors the reference inline-capture pattern (OverviewOathFill): a small
 * "use client" child that calls its section's server action and refreshes the
 * route on success.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { addReportPhotoByUrl } from "@/app/yip/actions/report-media";

export function MediaPhotoFill({
  eventId,
  hasCover,
}: {
  eventId: string;
  /** When false, offer "make this the cover photo" (else the option is hidden). */
  hasCover: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [photographer, setPhotographer] = useState("");
  const [makeCover, setMakeCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setImageUrl("");
    setCaption("");
    setPhotographer("");
    setMakeCover(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await addReportPhotoByUrl(eventId, {
        imageUrl,
        caption,
        photographerName: photographer,
        makeCover: !hasCover && makeCover,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="print:hidden inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2.5 py-1 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10"
      >
        <ImagePlus className="size-3" />
        Add a photo by link
      </button>
    );
  }

  return (
    <div className="print:hidden mt-2 space-y-2 rounded-lg border border-[#1a1a3e]/12 bg-[#1a1a3e]/[0.02] p-3">
      <input
        type="url"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="Image URL (https://…)"
        className="w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption (optional)"
        className="w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      <input
        type="text"
        value={photographer}
        onChange={(e) => setPhotographer(e.target.value)}
        placeholder="Photographer (optional)"
        className="w-full rounded-lg border border-[#1a1a3e]/15 bg-white px-3 py-2 text-sm text-[#1a1a3e] shadow-sm focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      {!hasCover && (
        <label className="flex items-center gap-2 text-xs text-[#1a1a3e]/70">
          <input
            type="checkbox"
            checked={makeCover}
            onChange={(e) => setMakeCover(e.target.checked)}
            className="size-3.5 rounded border-[#1a1a3e]/30 text-[#FF9933] focus:ring-[#FF9933]/30"
          />
          Use as the cover photo
        </label>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add photo"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md border border-[#1a1a3e]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
