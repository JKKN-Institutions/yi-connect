"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyPayment, waivePayment } from "./actions";

export type PaymentStatus = "unpaid" | "submitted" | "verified" | "waived";

export interface PaymentRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  member_category: string | null;
  person_id: string | null;
  in_directory: boolean;
  payment_status: PaymentStatus;
  amount_due: number | null;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  payment_verified_at: string | null;
  payment_verified_by: string | null;
}

const STATUS_META: Record<PaymentStatus, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "bg-white/10 text-white/60" },
  submitted: { label: "Submitted", cls: "bg-amber-500/20 text-amber-400" },
  verified: { label: "Verified", cls: "bg-[#229434]/20 text-[#229434]" },
  waived: { label: "Waived", cls: "bg-purple-500/20 text-purple-300" },
};

const FILTERS: Array<{ key: "all" | PaymentStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "unpaid", label: "Unpaid" },
  { key: "verified", label: "Verified" },
  { key: "waived", label: "Waived" },
];

function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.unpaid;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
  );
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [filter, setFilter] = useState<"all" | PaymentStatus>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.payment_status === filter);
  }, [rows, filter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "all" ? rows.length : rows.filter((r) => r.payment_status === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? "text-xs px-3 py-1.5 rounded-full bg-[#FD7215] text-white font-medium"
                  : "text-xs px-3 py-1.5 rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors"
              }
            >
              {f.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/50 font-medium">Member</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">
                  Reference
                </th>
                <th className="text-left px-4 py-3 text-white/50 font-medium hidden lg:table-cell">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/40 text-sm">
                    No registrants in this status.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{r.full_name}</span>
                        {!r.in_directory && (
                          <span
                            title="Not in the Yi directory — manually added or unmatched"
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300"
                          >
                            ⚠ Not in directory
                          </span>
                        )}
                      </div>
                      <span className="block text-white/40 text-xs mt-0.5">
                        {r.email || r.phone || "—"}
                        {r.member_category ? ` · ${r.member_category}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {r.payment_reference ? (
                        <span className="font-mono text-xs text-white/70">
                          {r.payment_reference}
                        </span>
                      ) : (
                        <span className="text-white/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-white/60">
                      {r.amount_due != null ? r.amount_due : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.payment_status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentActions row={r} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PaymentActions({ row }: { row: PaymentRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isResolved = row.payment_status === "verified" || row.payment_status === "waived";

  function run(action: "verify" | "waive") {
    setError(null);
    startTransition(async () => {
      const res =
        action === "verify" ? await verifyPayment(row.id) : await waivePayment(row.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => run("verify")}
          disabled={pending || row.payment_status === "verified"}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#229434]/20 text-[#229434] hover:bg-[#229434]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "…" : "Verify"}
        </button>
        <button
          type="button"
          onClick={() => run("waive")}
          disabled={pending || row.payment_status === "waived"}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:border-purple-400/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Waive
        </button>
      </div>
      {isResolved && row.payment_verified_by && (
        <span className="text-[11px] text-white/30">by {row.payment_verified_by}</span>
      )}
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
