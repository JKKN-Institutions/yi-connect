"use client";

import { useActionState } from "react";
import { createBudget } from "@/lib/varnam/actions/manage-budget";
import type { BoardActionState } from "@/lib/varnam/actions/manage-sponsors";

const INITIAL: BoardActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

const labelCls = "mb-1 block text-xs font-semibold text-[#2B0A33]/60";

/** Empty-state card: shown when the live edition has no budget yet. */
export function CreateBudgetCard() {
  const [state, action, pending] = useActionState(createBudget, INITIAL);

  return (
    <section className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
      <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
        Create the edition budget
      </h2>
      <p className="mt-1 text-sm text-[#2B0A33]/60">
        No budget has been set for this edition yet. Set the overall envelope,
        then allocate it across the festival&rsquo;s verticals.
      </p>

      <form action={action} className="mt-4 max-w-md space-y-3">
        <div>
          <label className={labelCls} htmlFor="budget-name">
            Budget name
          </label>
          <input
            id="budget-name"
            name="name"
            defaultValue="Varnam Vizha 2026 Budget"
            maxLength={255}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="budget-total">
            Total amount (₹) *
          </label>
          <input
            id="budget-total"
            name="total_amount"
            type="number"
            min={1}
            step="1"
            required
            placeholder="e.g. 1500000"
            className={inputCls}
          />
        </div>

        {state.message && (
          <p
            className={`text-sm font-medium ${
              state.ok ? "text-[#0a8485]" : "text-[#D6336C]"
            }`}
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#3B0A45] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create budget"}
        </button>
      </form>
    </section>
  );
}
