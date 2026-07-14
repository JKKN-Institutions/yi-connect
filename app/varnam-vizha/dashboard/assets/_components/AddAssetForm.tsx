"use client";

import { useEffect, useState, useActionState } from "react";
import { addAsset, type AssetActionState } from "@/lib/varnam/actions/manage-assets";

const INITIAL: AssetActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";
const labelCls = "mb-1 block text-sm font-medium text-[#2B0A33]";

// Keep in sync with ASSET_KINDS in lib/varnam/actions/manage-assets.ts
// (enforced server-side there).
const KIND_OPTIONS = [
  { value: "poster", label: "Poster" },
  { value: "reel", label: "Reel" },
  { value: "video", label: "Video" },
  { value: "script", label: "Script" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
] as const;

export function AddAssetForm({
  events,
}: {
  events: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(addAsset, INITIAL);

  // Controlled inputs (React 19 resets uncontrolled fields after server
  // actions) — cleared manually only after a successful add.
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("poster");
  const [url, setUrl] = useState("");
  const [eventId, setEventId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state.ok && state.message) {
      setTitle("");
      setKind("poster");
      setUrl("");
      setEventId("");
      setNotes("");
    }
  }, [state]);

  return (
    <form
      action={action}
      className="mb-6 rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm"
    >
      <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
        Add an asset
      </h2>
      <p className="mt-0.5 mb-4 text-sm text-[#2B0A33]/60">
        Paste the Drive/Canva link — everyone sees the latest version and its
        approval status here.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="asset_title" className={labelCls}>
            Title <span className="text-[#D6336C]">*</span>
          </label>
          <input
            id="asset_title"
            name="title"
            required
            minLength={2}
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kolam Contest poster v3"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="asset_kind" className={labelCls}>
            Type
          </label>
          <select
            id="asset_kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={inputCls}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="asset_event" className={labelCls}>
            Event (optional)
          </label>
          <select
            id="asset_event"
            name="event_id"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={inputCls}
          >
            <option value="">Whole festival</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="asset_url" className={labelCls}>
            Link (optional)
          </label>
          <input
            id="asset_url"
            name="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-[#2B0A33]/45">
            Must start with https:// — you can add it later if the design
            isn&apos;t ready yet.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="asset_notes" className={labelCls}>
            Notes (optional)
          </label>
          <input
            id="asset_notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Waiting on chair sign-off for the tagline"
            className={inputCls}
          />
        </div>
      </div>

      {state.message && (
        <p
          className={`mt-3 text-sm font-medium ${
            state.ok ? "text-[#0a8485]" : "text-[#D6336C]"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-full bg-[#3B0A45] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to library"}
      </button>
    </form>
  );
}
