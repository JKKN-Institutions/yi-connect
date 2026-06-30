"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AnnouncementResult } from "@/app/yi-future/actions/announcements-types";

const NAVY = "#1a1a3e";
const GOLD = "#F5A623";

type State = AnnouncementResult | null;

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      style={{ background: NAVY }}
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

/**
 * Inline "Edit" affordance for a sent announcement — a <details> disclosure
 * revealing a small title/body/link form. Only the text is editable (audience
 * and target are fixed once sent). Surfaces the action result inline.
 */
export function EditAnnouncement({
  id,
  title,
  body,
  url,
  action,
}: {
  id: string;
  title: string;
  body: string;
  url: string | null;
  action: (prev: State, fd: FormData) => Promise<State>;
}) {
  const [state, formAction] = useActionState(action, null);
  const inputCls =
    "w-full px-2.5 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2";
  const inputStyle = { borderColor: `${NAVY}33`, color: NAVY } as const;

  return (
    <details className="mt-2 group">
      <summary
        className="cursor-pointer list-none text-xs font-semibold"
        style={{ color: GOLD }}
      >
        Edit
      </summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={id} />
        <input
          name="title"
          defaultValue={title}
          required
          maxLength={120}
          placeholder="Title"
          className={inputCls}
          style={inputStyle}
        />
        <textarea
          name="body"
          defaultValue={body}
          required
          rows={3}
          placeholder="Message"
          className={inputCls}
          style={inputStyle}
        />
        <input
          name="url"
          defaultValue={url ?? ""}
          placeholder="Link (optional)"
          className={inputCls}
          style={inputStyle}
        />
        <div className="flex items-center gap-3">
          <SaveBtn />
          {state && !state.ok && (
            <span className="text-xs text-red-600">{state.error}</span>
          )}
          {state && state.ok && (
            <span className="text-xs font-medium" style={{ color: "#138808" }}>
              {state.message ?? "Saved."}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
