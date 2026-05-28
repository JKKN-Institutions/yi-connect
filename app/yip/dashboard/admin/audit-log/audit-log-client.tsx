"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface AuditLogRow {
  id: string;
  action_type: string;
  target_table: string;
  target_id: string | null;
  target_event_id: string | null;
  performed_by_user_id: string | null;
  performed_by_organizer_id: string | null;
  performed_by_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EventOption {
  id: string;
  label: string;
}

const ACTION_TYPES = [
  "create",
  "update",
  "delete",
  "login",
  "wipe",
  "import",
  "export",
];

interface AuditLogClientProps {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  eventNameById: Record<string, string>;
  eventOptions: EventOption[];
  filters: {
    action_type: string;
    target_event_id: string;
    target_table: string;
  };
}

function badgeClass(actionType: string): string {
  switch (actionType) {
    case "delete":
    case "wipe":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    case "create":
    case "import":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "update":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "login":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
    case "export":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogClient({
  rows,
  total,
  page,
  pageSize,
  eventNameById,
  eventOptions,
  filters,
}: AuditLogClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Reset page when filters change
    if (key !== "page") next.delete("page");
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#1a1a3e]">Audit Log</h1>
        <p className="text-sm text-[#1a1a3e]/60 mt-1">
          Every destructive action, import, and login across YIP admin
          surfaces. Showing {rows.length} of {total} entries.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded-lg border border-[#1a1a3e]/10 p-4">
        <label className="block">
          <span className="text-xs font-medium text-[#1a1a3e]/70 block mb-1">
            Action type
          </span>
          <select
            value={filters.action_type}
            onChange={(e) => setParam("action_type", e.target.value)}
            className="w-full rounded-md border border-[#1a1a3e]/15 px-3 py-2 text-sm min-h-[44px]"
            disabled={pending}
          >
            <option value="">All</option>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[#1a1a3e]/70 block mb-1">
            Event
          </span>
          <select
            value={filters.target_event_id}
            onChange={(e) => setParam("target_event_id", e.target.value)}
            className="w-full rounded-md border border-[#1a1a3e]/15 px-3 py-2 text-sm min-h-[44px]"
            disabled={pending}
          >
            <option value="">All</option>
            {eventOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[#1a1a3e]/70 block mb-1">
            Target table
          </span>
          <input
            type="text"
            placeholder="e.g. participants"
            value={filters.target_table}
            onChange={(e) => setParam("target_table", e.target.value)}
            className="w-full rounded-md border border-[#1a1a3e]/15 px-3 py-2 text-sm min-h-[44px]"
            disabled={pending}
          />
        </label>
      </div>

      <div className="bg-white rounded-lg border border-[#1a1a3e]/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a3e]/[0.03] text-[#1a1a3e]/70">
            <tr>
              <th className="px-3 py-2 text-left font-medium">When</th>
              <th className="px-3 py-2 text-left font-medium">Action</th>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-left font-medium">By</th>
              <th className="px-3 py-2 text-left font-medium">Event</th>
              <th className="px-3 py-2 text-left font-medium">Target / Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-12 text-center text-[#1a1a3e]/50"
                >
                  No audit entries match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#1a1a3e]/5">
                <td className="px-3 py-2 whitespace-nowrap text-[#1a1a3e]/80">
                  {fmtDate(r.created_at)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass(
                      r.action_type
                    )}`}
                  >
                    {r.action_type}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[#1a1a3e]/70">
                  {r.target_table}
                </td>
                <td className="px-3 py-2 text-[#1a1a3e]/80">
                  {r.performed_by_email ?? (
                    <span className="text-[#1a1a3e]/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[#1a1a3e]/80">
                  {r.target_event_id ? (
                    eventNameById[r.target_event_id] ?? (
                      <span className="font-mono text-xs">
                        {r.target_event_id.slice(0, 8)}…
                      </span>
                    )
                  ) : (
                    <span className="text-[#1a1a3e]/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[#1a1a3e]/70">
                  <div className="flex flex-col gap-0.5">
                    {r.target_id && (
                      <span className="font-mono text-xs">
                        id: {r.target_id.length > 12 ? `${r.target_id.slice(0, 12)}…` : r.target_id}
                      </span>
                    )}
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <span className="text-xs text-[#1a1a3e]/60 max-w-md truncate">
                        {JSON.stringify(r.metadata)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-[#1a1a3e]/60">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || pending}
            onClick={() => setParam("page", String(page - 1))}
            className="rounded-md border border-[#1a1a3e]/15 px-3 py-2 text-sm min-h-[44px] disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || pending}
            onClick={() => setParam("page", String(page + 1))}
            className="rounded-md border border-[#1a1a3e]/15 px-3 py-2 text-sm min-h-[44px] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
