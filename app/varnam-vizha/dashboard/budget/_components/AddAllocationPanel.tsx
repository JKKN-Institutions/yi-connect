"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { addAllocation } from "@/lib/varnam/actions/manage-budget";
import type { BoardActionState } from "@/lib/varnam/actions/manage-sponsors";

const INITIAL: BoardActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

const labelCls = "mb-1 block text-xs font-semibold text-[#2B0A33]/60";

/** Expanding "Add allocation" panel — canManage-gated by the server page. */
export function AddAllocationPanel({
  budgetId,
  unallocated,
}: {
  budgetId: string;
  unallocated: number;
}) {
  const [state, action, pending] = useActionState(addAllocation, INITIAL);
  const unallocatedLabel = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, unallocated));

  return (
    <details className="group mt-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 font-[family-name:var(--font-vv-display)] text-base font-bold text-[#3B0A45]">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#3B0A45] text-white">
            <Plus className="size-4" />
          </span>
          Add allocation
        </span>
        <span className="text-xs font-medium text-[#2B0A33]/45">
          {unallocatedLabel} unallocated
        </span>
      </summary>

      <form action={action} className="border-t border-[#3B0A45]/8 px-5 pb-5 pt-4">
        <input type="hidden" name="budget_id" value={budgetId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="alloc-vertical">
              Vertical *
            </label>
            <input
              id="alloc-vertical"
              name="vertical_name"
              required
              minLength={2}
              maxLength={100}
              placeholder="e.g. Cultural Night"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="alloc-amount">
              Allocated amount (₹) *
            </label>
            <input
              id="alloc-amount"
              name="allocated_amount"
              type="number"
              min={1}
              step="1"
              required
              placeholder="e.g. 200000"
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
          className="mt-4 rounded-full bg-[#3B0A45] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add allocation"}
        </button>
      </form>
    </details>
  );
}
