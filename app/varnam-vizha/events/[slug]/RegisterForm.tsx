"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { registerForEvent, type RegisterState } from "@/lib/varnam/actions/register";
import type { VarnamFormField } from "@/lib/varnam/forms/types";

const INITIAL: RegisterState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

/**
 * Organiser-designed extra question. `required` here is UX only — the register
 * server action re-fetches the form definition and is the real gate.
 */
function CustomField({ field }: { field: VarnamFormField }) {
  const name = `cf_${field.id}`;

  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-2.5 text-sm text-[#2B0A33]">
        <input
          type="checkbox"
          name={name}
          required={field.required}
          className="mt-0.5 size-4 shrink-0 accent-[#D6336C]"
        />
        <span>
          {field.label}
          {field.required && <span className="text-[#D6336C]"> *</span>}
        </span>
      </label>
    );
  }

  const control =
    field.type === "textarea" ? (
      <textarea
        id={name}
        name={name}
        rows={3}
        placeholder={field.placeholder}
        required={field.required}
        maxLength={500}
        className={inputCls}
      />
    ) : field.type === "select" ? (
      <select
        id={name}
        name={name}
        required={field.required}
        defaultValue=""
        className={inputCls}
      >
        <option value="">{field.placeholder || "Select an option"}</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ) : (
      <input
        id={name}
        name={name}
        type={field.type === "phone" ? "tel" : "text"}
        placeholder={field.placeholder}
        required={field.required}
        maxLength={500}
        className={inputCls}
      />
    );

  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-xs font-medium text-[#2B0A33]/70"
      >
        {field.label}
        {field.required && <span className="text-[#D6336C]"> *</span>}
      </label>
      {control}
    </div>
  );
}

export function RegisterForm({
  eventId,
  mode = "open",
  spotsLeft,
  fields,
}: {
  eventId: string;
  mode?: "open" | "waitlist";
  spotsLeft?: number | null;
  fields?: VarnamFormField[];
}) {
  const [state, action, pending] = useActionState(registerForEvent, INITIAL);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-[#0CA4A5]/30 bg-[#0CA4A5]/5 p-6 text-center">
        <CheckCircle2 className="mx-auto size-9 text-[#0a8485]" />
        <p className="mt-3 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#0a8485]">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="event_id" value={eventId} />
      <h3 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
        {mode === "waitlist" ? "Join the waitlist" : "Register for this event"}
      </h3>
      <p className="mt-0.5 mb-4 text-sm text-[#2B0A33]/60">
        {mode === "waitlist"
          ? "This event is full — join the waitlist and we'll contact you if a spot opens up."
          : spotsLeft != null && spotsLeft <= 10
            ? `Free registration — only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`
            : "Free registration — no account needed."}
      </p>
      <div className="space-y-3">
        <input name="full_name" placeholder="Your name" required className={inputCls} />
        <input name="email" type="email" placeholder="Email address" required className={inputCls} />
        <input name="phone" placeholder="Phone (optional)" className={inputCls} />
        {fields?.map((f) => (
          <CustomField key={f.id} field={f} />
        ))}
      </div>
      {state.message && !state.ok && (
        <p className="mt-3 text-sm font-medium text-[#D6336C]">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-full bg-[#3B0A45] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
      >
        {pending
          ? mode === "waitlist"
            ? "Joining…"
            : "Registering…"
          : mode === "waitlist"
            ? "Join the waitlist"
            : "Register"}
      </button>
      <p className="mt-3 text-xs text-[#2B0A33]/45">
        Paid events (such as the concert) will add ticketing closer to the festival.
      </p>
    </form>
  );
}
