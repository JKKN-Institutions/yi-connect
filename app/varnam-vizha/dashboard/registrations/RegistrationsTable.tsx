"use client";

/**
 * Operations table for the registrations page — client-side filter chips
 * (All / Confirmed / Waitlist / Checked-in), status badges, and per-row
 * Check in / Undo / Promote actions. Actions call the "use server" file
 * (which re-checks authorization); revalidatePath there refreshes the rows.
 */
import { useMemo, useState, useTransition } from "react";
import type { RegistrationRow } from "@/lib/varnam/data/dashboard-detail";
import {
  checkIn,
  undoCheckIn,
  promoteFromWaitlist,
  type RegOpsState,
} from "@/lib/varnam/actions/manage-registrations";

type Filter = "all" | "confirmed" | "waitlist" | "checked_in";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "waitlist", label: "Waitlist" },
  { key: "checked_in", label: "Checked-in" },
];

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

function matchesFilter(r: RegistrationRow, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "confirmed":
      return r.status === "confirmed";
    case "waitlist":
      return r.status === "waitlist";
    case "checked_in":
      return r.checked_in_at != null;
  }
}

function StatusBadge({ row }: { row: RegistrationRow }) {
  if (row.checked_in_at) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#3B0A45]/20 bg-[#3B0A45]/8 px-2.5 py-0.5 text-xs font-medium text-[#3B0A45]">
        Checked in · {fmtTime(row.checked_in_at)}
      </span>
    );
  }
  if (row.status === "waitlist") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#F4A300]/30 bg-[#F4A300]/12 px-2.5 py-0.5 text-xs font-medium text-[#8A5C00]">
        Waitlist
      </span>
    );
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#0CA4A5]/25 bg-[#0CA4A5]/10 px-2.5 py-0.5 text-xs font-medium text-[#0a8485]">
      Confirmed
    </span>
  );
}

const actionBtnCls =
  "rounded-full border border-[#3B0A45]/15 bg-white px-3 py-1 text-xs font-medium text-[#3B0A45] transition hover:border-[#D6336C]/40 hover:text-[#D6336C] disabled:cursor-not-allowed disabled:opacity-50";

export function RegistrationsTable({ rows }: { rows: RegistrationRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<RegOpsState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: rows.length,
      confirmed: 0,
      waitlist: 0,
      checked_in: 0,
    };
    for (const r of rows) {
      if (r.status === "confirmed") c.confirmed++;
      if (r.status === "waitlist") c.waitlist++;
      if (r.checked_in_at != null) c.checked_in++;
    }
    return c;
  }, [rows]);

  const visible = useMemo(
    () => rows.filter((r) => matchesFilter(r, filter)),
    [rows, filter]
  );

  const run = (id: string, action: (rsvpId: string) => Promise<RegOpsState>) => {
    setNotice(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await action(id);
      setNotice(result.ok ? null : result);
      setPendingId(null);
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                active
                  ? "rounded-full bg-[#3B0A45] px-3.5 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-[#3B0A45]/15 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2B0A33]/70 transition hover:border-[#3B0A45]/30 hover:text-[#3B0A45]"
              }
            >
              {f.label}
              <span className={active ? "ml-1.5 opacity-70" : "ml-1.5 opacity-50"}>
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {notice && !notice.ok && (
        <p className="mb-3 rounded-lg border border-[#D6336C]/25 bg-[#D6336C]/5 px-3 py-2 text-sm font-medium text-[#D6336C]">
          {notice.message}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        {visible.length === 0 ? (
          <p className="p-6 text-sm text-[#2B0A33]/50">
            {rows.length === 0
              ? "No registrations yet."
              : "No registrations match this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const rowPending = pendingId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                    >
                      <td className="px-4 py-3 font-medium text-[#2B0A33]">
                        {r.name}
                      </td>
                      <td className="px-4 py-3 text-[#2B0A33]/70">
                        {r.email ?? <span className="text-[#2B0A33]/35">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/70">
                        {r.phone ?? <span className="text-[#2B0A33]/35">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#2B0A33]/70">
                        {r.eventTitle}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge row={r} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/55">
                        {fmtDate(r.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {r.status === "waitlist" && !r.checked_in_at && (
                            <button
                              type="button"
                              disabled={rowPending}
                              onClick={() => run(r.id, promoteFromWaitlist)}
                              className={actionBtnCls}
                            >
                              {rowPending ? "Promoting…" : "Promote"}
                            </button>
                          )}
                          {r.checked_in_at ? (
                            <button
                              type="button"
                              disabled={rowPending}
                              onClick={() => run(r.id, undoCheckIn)}
                              className={actionBtnCls}
                            >
                              {rowPending ? "Undoing…" : "Undo"}
                            </button>
                          ) : (
                            r.status === "confirmed" && (
                              <button
                                type="button"
                                disabled={rowPending}
                                onClick={() => run(r.id, checkIn)}
                                className="rounded-full bg-[#3B0A45] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#2B0A33] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowPending ? "Checking in…" : "Check in"}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
