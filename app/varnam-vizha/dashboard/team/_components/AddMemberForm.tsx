"use client";

import { useActionState } from "react";
import { addMember, type TeamActionState } from "@/lib/varnam/actions/manage-team";

const INITIAL: TeamActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

const ROLE_OPTIONS = [
  { value: "co_chair", label: "Co-chair" },
  { value: "organizer", label: "Organizer" },
  { value: "forum_lead", label: "Forum lead" },
  { value: "viewer", label: "Viewer" },
];

export function AddMemberForm() {
  const [state, action, pending] = useActionState(addMember, INITIAL);

  return (
    <form
      action={action}
      className="h-fit rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm"
    >
      <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
        Add a committee member
      </h2>
      <p className="mt-0.5 mb-4 text-sm text-[#2B0A33]/60">
        They&apos;ll appear on the team right away.
      </p>

      <div className="space-y-3">
        <input
          name="full_name"
          placeholder="Full name"
          required
          className={inputCls}
        />
        <input
          name="email"
          type="email"
          placeholder="Email address"
          required
          className={inputCls}
        />
        <select name="role" required defaultValue="organizer" className={inputCls}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          name="title"
          placeholder="Title (optional, e.g. Stalls Lead)"
          className={inputCls}
        />
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
        className="mt-4 w-full rounded-full bg-[#3B0A45] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to committee"}
      </button>

      <p className="mt-3 text-xs text-[#2B0A33]/45">
        Members sign in with their Yi Connect account. If they don&apos;t have
        one yet, they&apos;ll get dashboard access once their account is linked
        — ask the platform admin to send a directory invite.
      </p>
    </form>
  );
}
