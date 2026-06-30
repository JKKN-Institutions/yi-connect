"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type {
  AnnouncementAudience,
  ComposerState,
} from "@/app/yi-future/actions/announcements-types";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type Option = { id: string; label: string };

type Props = {
  mode: "chapter" | "national";
  action: (prev: ComposerState, formData: FormData) => Promise<ComposerState>;
  teams?: Option[];
  delegates?: Option[];
  chapters?: Option[];
  zones?: Option[];
};

const AUDIENCE_OPTIONS: Record<
  "chapter" | "national",
  { value: AnnouncementAudience; label: string; hint: string }[]
> = {
  chapter: [
    { value: "chapter", label: "Whole chapter", hint: "Every delegate in your chapter" },
    { value: "team", label: "One team", hint: "Just the members of a team" },
    { value: "delegate", label: "One delegate", hint: "A single person" },
  ],
  national: [
    { value: "everyone", label: "Everyone", hint: "All delegates in this edition" },
    { value: "zone", label: "One zone", hint: "All delegates in a Yi zone/region" },
    { value: "chapter", label: "One chapter", hint: "All delegates of a chapter" },
  ],
};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-60"
      style={{ background: NAVY }}
    >
      {pending ? "Sending…" : "Send announcement"}
    </button>
  );
}

export function AnnouncementComposer({
  mode,
  action,
  teams = [],
  delegates = [],
  chapters = [],
  zones = [],
}: Props) {
  const opts = AUDIENCE_OPTIONS[mode];
  const [audience, setAudience] = useState<AnnouncementAudience>(opts[0].value);
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form (but keep the chosen audience) after a successful send.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  const labelCls =
    "block text-xs font-semibold uppercase tracking-widest mb-1.5";
  const inputCls =
    "w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5 rounded-xl border bg-white p-6"
      style={{ borderColor: `${NAVY}1a` }}
    >
      {/* Audience */}
      <div>
        <span className={labelCls} style={{ color: `${NAVY}b3` }}>
          Send to
        </span>
        <div className="grid gap-2 sm:grid-cols-3">
          {opts.map((o) => {
            const active = audience === o.value;
            return (
              <label
                key={o.value}
                className="cursor-pointer rounded-lg border px-3 py-2.5 transition"
                style={{
                  borderColor: active ? GOLD : `${NAVY}22`,
                  background: active ? `${GOLD}14` : "white",
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value={o.value}
                  checked={active}
                  onChange={() => setAudience(o.value)}
                  className="sr-only"
                />
                <span
                  className="block text-sm font-semibold"
                  style={{ color: NAVY }}
                >
                  {o.label}
                </span>
                <span className="block text-xs" style={{ color: `${NAVY}80` }}>
                  {o.hint}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Conditional target picker */}
      {mode === "chapter" && audience === "team" && (
        <div>
          <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="team_id">
            Team
          </label>
          <select
            id="team_id"
            name="team_id"
            required
            defaultValue=""
            className={inputCls}
            style={{ borderColor: `${NAVY}33`, color: NAVY }}
          >
            <option value="" disabled>
              — choose a team —
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {teams.length === 0 && (
            <p className="mt-1 text-xs" style={{ color: `${NAVY}80` }}>
              No teams in your chapter yet.
            </p>
          )}
        </div>
      )}

      {mode === "chapter" && audience === "delegate" && (
        <div>
          <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="delegate_id">
            Delegate
          </label>
          <select
            id="delegate_id"
            name="delegate_id"
            required
            defaultValue=""
            className={inputCls}
            style={{ borderColor: `${NAVY}33`, color: NAVY }}
          >
            <option value="" disabled>
              — choose a delegate —
            </option>
            {delegates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "national" && audience === "zone" && (
        <div>
          <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="zone">
            Zone / region
          </label>
          <select
            id="zone"
            name="zone"
            required
            defaultValue=""
            className={inputCls}
            style={{ borderColor: `${NAVY}33`, color: NAVY }}
          >
            <option value="" disabled>
              — choose a zone —
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === "national" && audience === "chapter" && (
        <div>
          <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="chapter_id">
            Chapter
          </label>
          <select
            id="chapter_id"
            name="chapter_id"
            required
            defaultValue=""
            className={inputCls}
            style={{ borderColor: `${NAVY}33`, color: NAVY }}
          >
            <option value="" disabled>
              — choose a chapter —
            </option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Title */}
      <div>
        <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="e.g. Submission deadline moved to Friday"
          className={inputCls}
          style={{ borderColor: `${NAVY}33`, color: NAVY }}
        />
      </div>

      {/* Body */}
      <div>
        <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="body">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          placeholder="Write the announcement delegates will see on their dashboard."
          className={inputCls}
          style={{ borderColor: `${NAVY}33`, color: NAVY }}
        />
      </div>

      {/* Optional link */}
      <div>
        <label className={labelCls} style={{ color: `${NAVY}b3` }} htmlFor="url">
          Link (optional)
        </label>
        <input
          id="url"
          name="url"
          placeholder="/yi-future/me/submissions"
          className={inputCls}
          style={{ borderColor: `${NAVY}33`, color: NAVY }}
        />
        <p className="mt-1 text-xs" style={{ color: `${NAVY}80` }}>
          A page link delegates can tap (e.g. a submissions or journey page).
        </p>
      </div>

      {state && !state.ok && (
        <p className="text-sm font-medium text-red-600">{state.error}</p>
      )}
      {state && state.ok && (
        <p className="text-sm font-medium" style={{ color: "#138808" }}>
          {state.message ?? "Sent."}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitBtn />
      </div>
    </form>
  );
}
