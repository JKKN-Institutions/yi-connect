"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFees } from "./actions";

export interface FeeDefaults {
  currency: string | null;
  early_bird_amount: number | null;
  early_bird_until: string | null;
  regular_amount: number | null;
  payment_instructions: string | null;
}

const labelCls = "block text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5";
const inputCls =
  "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50 focus:ring-1 focus:ring-[#FD7215]/30";

/** Normalise an ISO/date string to a yyyy-mm-dd value for <input type="date">. */
function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.length >= 10 ? v.slice(0, 10) : v;
}

export function FeesForm({ defaults }: { defaults: FeeDefaults }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setFees(formData);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5"
    >
      <p className="text-white/50 text-sm">
        These fee tiers and payment instructions are shown to members during
        registration. Members pay manually (UPI / bank transfer) and submit a
        reference for you to verify below.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="currency" className={labelCls}>
            Currency
          </label>
          <input
            id="currency"
            name="currency"
            type="text"
            defaultValue={defaults.currency ?? "INR"}
            placeholder="INR"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="early_bird_until" className={labelCls}>
            Early-bird until
          </label>
          <input
            id="early_bird_until"
            name="early_bird_until"
            type="date"
            defaultValue={toDateInput(defaults.early_bird_until)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="early_bird_amount" className={labelCls}>
            Early-bird amount
          </label>
          <input
            id="early_bird_amount"
            name="early_bird_amount"
            type="number"
            min="0"
            step="1"
            defaultValue={defaults.early_bird_amount ?? ""}
            placeholder="0"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="regular_amount" className={labelCls}>
            Regular amount
          </label>
          <input
            id="regular_amount"
            name="regular_amount"
            type="number"
            min="0"
            step="1"
            defaultValue={defaults.regular_amount ?? ""}
            placeholder="0"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="payment_instructions" className={labelCls}>
          Payment instructions (UPI / bank details)
        </label>
        <textarea
          id="payment_instructions"
          name="payment_instructions"
          rows={4}
          defaultValue={defaults.payment_instructions ?? ""}
          placeholder={"UPI: yifi@upi\nA/c: 1234567890 · IFSC: HDFC0001234\nName: Yi Madurai"}
          className={inputCls + " resize-y"}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="text-sm px-4 py-2 rounded-lg bg-[#FD7215] text-white font-medium hover:bg-[#FD7215]/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save fees"}
        </button>
        {saved && <span className="text-[#229434] text-sm">Saved ✓</span>}
        {error && <span className="text-red-300 text-sm">{error}</span>}
      </div>
    </form>
  );
}
