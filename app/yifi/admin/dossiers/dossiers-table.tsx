"use client";

import { useMemo, useState, useTransition } from "react";
import { deliverOneDossier } from "./actions";

interface DossierRegistrant {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
}

interface DossierRow {
  id: string;
  status: string | null;
  delivered_at: string | null;
  viewed_at: string | null;
  view_count: number | null;
  created_at: string | null;
  registrant: DossierRegistrant | null;
}

interface DossiersTableProps {
  rows: DossierRow[];
}

type FilterKey = "all" | "pending" | "ready" | "delivered" | "viewed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "viewed", label: "Viewed" },
];

/**
 * Bucket any status string into one of the display buckets.
 * Unknown / unexpected statuses fall through to "pending" so nothing is hidden.
 */
function bucketOf(row: DossierRow): "pending" | "ready" | "delivered" | "viewed" {
  if ((row.view_count ?? 0) > 0 || row.viewed_at != null) return "viewed";
  const status = (row.status ?? "").toLowerCase();
  if (status === "viewed") return "viewed";
  if (status === "delivered" || row.delivered_at != null) return "delivered";
  if (status === "ready") return "ready";
  return "pending";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ row }: { row: DossierRow }) {
  const bucket = bucketOf(row);
  const label = (row.status ?? bucket).replace(/_/g, " ");

  const className =
    bucket === "delivered"
      ? "bg-[#229434]/20 text-[#229434]"
      : bucket === "viewed"
      ? "bg-[#FD7215]/20 text-[#FD7215]"
      : bucket === "ready"
      ? "bg-blue-400/20 text-blue-300"
      : "bg-white/10 text-white/40";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${className}`}>
      {label}
    </span>
  );
}

/**
 * Per-row deliver control. Enabled only when the dossier is 'ready'. Sends one
 * WhatsApp message via the gated deliverOneDossier action (one explicit click).
 * Shows "Delivered"/"Viewed" labels for rows past the ready stage.
 */
function DeliverCell({ row }: { row: DossierRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bucket = bucketOf(row);

  if (bucket === "viewed") {
    return <span className="text-xs text-[#FD7215]">Viewed</span>;
  }
  if (bucket === "delivered") {
    return <span className="text-xs text-[#229434]">Delivered</span>;
  }
  if (bucket !== "ready") {
    return <span className="text-xs text-white/30">Not ready</span>;
  }

  function handleDeliver() {
    setError(null);
    const formData = new FormData();
    formData.set("dossierId", row.id);
    formData.set("phone", row.registrant?.phone ?? "");
    formData.set("fullName", row.registrant?.full_name ?? "");

    startTransition(async () => {
      const result = await deliverOneDossier(formData);
      if (!result.ok) {
        setError(result.error ?? "Delivery failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDeliver}
        disabled={pending}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#FD7215]/20 text-[#FD7215] border border-[#FD7215]/40 hover:bg-[#FD7215]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Sending…" : "Deliver"}
      </button>
      {error && <span className="text-[10px] text-red-300 max-w-[180px] text-right">{error}</span>}
    </div>
  );
}

export function DossiersTable({ rows }: DossiersTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, ready: 0, delivered: 0, viewed: 0 };
    for (const row of rows) c[bucketOf(row)] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => bucketOf(row) === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-[#FD7215]/20 text-[#FD7215] border-[#FD7215]/40"
                  : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"
              }`}
            >
              {label} ({counts[key]})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-white/40 text-sm">No dossiers in this view.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">
                    Registrant
                  </th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium hidden sm:table-cell">
                    Delivered
                  </th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">
                    Views
                  </th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">
                        {row.registrant?.full_name || "Unnamed registrant"}
                      </p>
                      <p className="text-white/40 text-xs">
                        {row.registrant?.organisation || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden md:table-cell">
                      {row.registrant?.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden sm:table-cell">
                      {formatDate(row.delivered_at)}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-right tabular-nums">
                      {row.view_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeliverCell row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
