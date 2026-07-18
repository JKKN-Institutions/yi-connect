"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertSession } from "./actions";
import type { AdminSession } from "./sessions-table";

const SESSION_TYPES: { value: string; label: string }[] = [
  { value: "keynote", label: "Keynote" },
  { value: "panel", label: "Panel" },
  { value: "fireside", label: "Fireside" },
  { value: "workshop", label: "Workshop" },
  { value: "tour", label: "Tour" },
  { value: "peer", label: "Peer" },
];

/** Convert an ISO/timestamptz string to a value usable by <input type="datetime-local">. */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const inputClasses =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#FD7215]/60 focus:outline-none";
const labelClasses = "block text-xs text-white/50 mb-1";

interface SessionFormProps {
  /** When provided, the form is in edit mode and is prefilled. */
  session?: AdminSession;
  /** Called after a successful submit (used by the inline edit form). */
  onDone?: () => void;
  /** Called when the user cancels an edit. */
  onCancel?: () => void;
}

export function SessionForm({ session, onDone, onCancel }: SessionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Bump to remount/reset the form fields after an "add new" submit.
  const [formKey, setFormKey] = useState(0);

  const isEdit = Boolean(session?.id);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await upsertSession(formData);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
      if (onDone) {
        onDone();
      } else {
        // Reset the add-new form for the next entry.
        setFormKey((k) => k + 1);
      }
    });
  }

  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
    >
      {isEdit && <input type="hidden" name="id" value={session!.id} />}

      <div>
        <label className={labelClasses} htmlFor="sf-title">
          Title <span className="text-[#FD7215]">*</span>
        </label>
        <input
          id="sf-title"
          name="title"
          required
          defaultValue={session?.title ?? ""}
          placeholder="Session title"
          className={inputClasses}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses} htmlFor="sf-speaker-name">
            Speaker name
          </label>
          <input
            id="sf-speaker-name"
            name="speaker_name"
            defaultValue={session?.speaker_name ?? ""}
            placeholder="Speaker"
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="sf-session-type">
            Session type
          </label>
          <select
            id="sf-session-type"
            name="session_type"
            defaultValue={session?.session_type ?? ""}
            className={inputClasses}
          >
            <option value="">—</option>
            {SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClasses} htmlFor="sf-speaker-bio">
          Speaker bio
        </label>
        <textarea
          id="sf-speaker-bio"
          name="speaker_bio"
          rows={2}
          defaultValue={session?.speaker_bio ?? ""}
          placeholder="Short bio"
          className={inputClasses}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses} htmlFor="sf-start-time">
            Start time
          </label>
          <input
            id="sf-start-time"
            name="start_time"
            type="datetime-local"
            defaultValue={toLocalInput(session?.start_time)}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses} htmlFor="sf-end-time">
            End time
          </label>
          <input
            id="sf-end-time"
            name="end_time"
            type="datetime-local"
            defaultValue={toLocalInput(session?.end_time)}
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label className={labelClasses} htmlFor="sf-themes">
          Themes <span className="text-white/30">(comma or newline separated)</span>
        </label>
        <input
          id="sf-themes"
          name="themes"
          defaultValue={(session?.themes ?? []).join(", ")}
          placeholder="leadership, fundraising, scale"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses} htmlFor="sf-transcript-url">
          Transcript URL
        </label>
        <input
          id="sf-transcript-url"
          name="transcript_url"
          type="url"
          defaultValue={session?.transcript_url ?? ""}
          placeholder="https://…"
          className={inputClasses}
        />
      </div>

      <div>
        <label className={labelClasses} htmlFor="sf-transcript-text">
          Transcript text{" "}
          <span className="text-white/30">(paste raw transcript — preferred)</span>
        </label>
        <textarea
          id="sf-transcript-text"
          name="transcript_text"
          rows={5}
          defaultValue={session?.transcript_text ?? ""}
          placeholder="Paste the session transcript here…"
          className={inputClasses}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          name="consent_archiving"
          defaultChecked={session?.consent_archiving ?? false}
          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#FD7215]"
        />
        Speaker consented to archiving this session
      </label>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-[#FD7215] text-white hover:bg-[#FD7215]/90 transition-colors disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Add session"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-lg border border-white/20 text-white/60 hover:border-white/40 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
