"use client";

import { useState, useActionState } from "react";
import { recordSpend } from "@/lib/varnam/actions/manage-budget";
import type { BoardActionState } from "@/lib/varnam/actions/manage-sponsors";
import type { BudgetBoardAllocation } from "@/lib/varnam/data/manage-boards-data";

const INITIAL: BoardActionState = { ok: false, message: "" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

function RecordSpendForm({
  allocation,
  onClose,
}: {
  allocation: BudgetBoardAllocation;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(recordSpend, INITIAL);

  return (
    <div className="bg-[#FFF9F0] px-6 py-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="allocation_id" value={allocation.id} />
        <div className="w-full max-w-xs">
          <label
            className="mb-1 block text-xs font-semibold text-[#2B0A33]/60"
            htmlFor={`spend-${allocation.id}`}
          >
            Spent to date for {allocation.vertical} (₹) — absolute, not an
            increment
          </label>
          <input
            id={`spend-${allocation.id}`}
            name="spent_amount"
            type="number"
            min={0}
            step="1"
            required
            defaultValue={allocation.spent}
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#3B0A45] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Record spend"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#3B0A45]/15 bg-white px-5 py-2.5 text-sm font-medium text-[#2B0A33]/70 transition hover:border-[#3B0A45]/30"
        >
          Close
        </button>
        {state.message && (
          <p
            className={`w-full text-sm font-medium ${
              state.ok ? "text-[#0a8485]" : "text-[#D6336C]"
            }`}
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}

/** Allocations-by-vertical table with a per-row "Record spend" editor. */
export function AllocationsTable({
  allocations,
  canManage,
}: {
  allocations: BudgetBoardAllocation[];
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (allocations.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-[#2B0A33]/50">
        No allocations have been set yet.
      </p>
    );
  }

  const colCount = canManage ? 6 : 5;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
            <th className="px-6 py-3 font-semibold">Vertical</th>
            <th className="px-4 py-3 text-right font-semibold">Allocated</th>
            <th className="px-4 py-3 text-right font-semibold">Spent</th>
            <th className="px-4 py-3 text-right font-semibold">Remaining</th>
            <th className="px-6 py-3 text-right font-semibold">% spent</th>
            {canManage ? <th className="px-4 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => {
            const pct =
              a.allocated > 0
                ? Math.min(100, Math.round((a.spent / a.allocated) * 100))
                : 0;
            const editing = editingId === a.id;
            return (
              <RowPair
                key={a.id}
                allocation={a}
                pct={pct}
                canManage={canManage}
                editing={editing}
                colCount={colCount}
                onToggle={() =>
                  setEditingId((cur) => (cur === a.id ? null : a.id))
                }
                onClose={() => setEditingId(null)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowPair({
  allocation: a,
  pct,
  canManage,
  editing,
  colCount,
  onToggle,
  onClose,
}: {
  allocation: BudgetBoardAllocation;
  pct: number;
  canManage: boolean;
  editing: boolean;
  colCount: number;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]">
        <td className="px-6 py-3 font-medium text-[#2B0A33]">{a.vertical}</td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
          {inr(a.allocated)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
          {inr(a.spent)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#0a8485]">
          {inr(a.remaining)}
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center justify-end gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-[#3B0A45]/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F4A300] to-[#D6336C]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs font-semibold text-[#2B0A33]/60">
              {pct}%
            </span>
          </div>
        </td>
        {canManage ? (
          <td className="px-4 py-3 text-right">
            <button
              type="button"
              onClick={onToggle}
              className="whitespace-nowrap rounded-full border border-[#3B0A45]/15 bg-white px-3.5 py-1 text-xs font-semibold text-[#3B0A45] transition hover:border-[#D6336C]/40 hover:text-[#b02a59]"
            >
              {editing ? "Close" : "Record spend"}
            </button>
          </td>
        ) : null}
      </tr>
      {canManage && editing ? (
        <tr className="border-b border-[#3B0A45]/6 last:border-0">
          <td colSpan={colCount} className="p-0">
            <RecordSpendForm allocation={a} onClose={onClose} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
