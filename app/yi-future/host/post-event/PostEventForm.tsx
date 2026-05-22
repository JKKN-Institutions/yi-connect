"use client";

/**
 * Client wrapper for the post-event editable form.
 * Owns MediaGallery state so signed-URL fetches and uploads happen
 * browser-side, while the parent page (server component) handles
 * form submission via a "use server" action.
 */

import { useState } from "react";
import { MediaGallery } from "@/components/ui/MediaGallery";

interface PostEventFormProps {
  eventId: string;
  selectedEventName: string;
  selectedStartDate: string | null;
  selectedVenue: string | null;
  /** "draft" | "submitted" | null (no report yet) */
  status: string | null;
  turnoutCount: number | null;
  keyMoments: string | null;
  initialLinks: string[];
  initialGallery: string[];
  /** Draft saved timestamp (ISO string) */
  savedAt: string | null;
  hasDraft: boolean;
  /** Passed-in server actions as props */
  onSaveDraft: (formData: FormData) => Promise<void>;
  onSubmit: (formData: FormData) => Promise<void>;
}

export function PostEventForm({
  eventId,
  turnoutCount,
  keyMoments,
  initialLinks,
  initialGallery,
  savedAt,
  hasDraft,
  onSaveDraft,
  onSubmit,
}: PostEventFormProps): React.JSX.Element {
  const [galleryPaths, setGalleryPaths] = useState<string[]>(initialGallery);

  return (
    <>
      <form action={onSaveDraft} className="space-y-6">
        <input type="hidden" name="event_id" value={eventId} />
        {/* Serialize gallery paths as JSON for the server action to read */}
        <input
          type="hidden"
          name="media_gallery_json"
          value={JSON.stringify(galleryPaths)}
        />

        {/* Turnout */}
        <section className="bg-white border border-navy/10 rounded-lg p-6">
          <label
            htmlFor="turnout_count"
            className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
          >
            Turnout (number of attendees)
          </label>
          <input
            id="turnout_count"
            name="turnout_count"
            type="number"
            min={0}
            defaultValue={turnoutCount ?? ""}
            placeholder="e.g. 240"
            className="w-full md:w-64 px-3 py-2 border border-navy/20 rounded-md text-sm"
          />
        </section>

        {/* Key moments */}
        <section className="bg-white border border-navy/10 rounded-lg p-6">
          <label
            htmlFor="key_moments"
            className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5"
          >
            Key moments
          </label>
          <p className="text-xs text-navy/50 mb-2">
            Markdown allowed. Cover top-3 moments, notable speeches, surprises.
          </p>
          <textarea
            id="key_moments"
            name="key_moments"
            rows={6}
            defaultValue={keyMoments ?? ""}
            placeholder={
              "- Opening keynote by …\n- Track winner …\n- Press table reception …"
            }
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
          />
        </section>

        {/* Press coverage */}
        <section className="bg-white border border-navy/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70">
              Press coverage links
            </label>
            <span className="text-[10px] text-navy/40">Add one URL per row</span>
          </div>
          <div id="press-links" className="space-y-2">
            {initialLinks.map((url, i) => (
              <input
                key={i}
                name={`press_link_${i}`}
                type="url"
                defaultValue={url}
                placeholder="https://…"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            ))}
          </div>
          <p className="text-[11px] text-navy/40 mt-2">
            Submit the form to save current rows; reload to add more rows (each
            save preserves whatever you typed).
          </p>
        </section>

        {/* Media gallery */}
        <section className="bg-white border border-navy/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70">
              Media gallery
            </label>
            <span className="text-[10px] text-navy/40 font-mono">
              future-media / events/{eventId}
            </span>
          </div>
          <MediaGallery
            bucketName="future-media"
            pathPrefix={`events/${eventId}`}
            initialPaths={initialGallery}
            onChange={setGalleryPaths}
            maxImages={12}
            disabled={false}
          />
        </section>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-navy/50">
            {savedAt
              ? `Draft saved · ${new Date(savedAt).toLocaleString()}`
              : "Not saved yet."}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-md border border-navy/20 text-sm font-semibold text-navy hover:bg-navy/5"
            >
              Save draft
            </button>
          </div>
        </div>
      </form>

      {/* Submit-final is a separate form so Save Draft does not accidentally finalise */}
      {hasDraft && (
        <form action={onSubmit} className="flex justify-end mt-4">
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy/90"
          >
            Submit final report →
          </button>
        </form>
      )}
    </>
  );
}
