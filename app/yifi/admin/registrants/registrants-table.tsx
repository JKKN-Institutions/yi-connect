"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleCheckIn } from "./actions";

export interface Registrant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  designation: string | null;
  sector: string | null;
  city: string | null;
  member_category: string | null;
  access_code: string | null;
  census_complete: boolean;
  checked_in: boolean;
  checked_in_at: string | null;
  cluster_colour: string | null;
  is_couple: boolean;
  created_at: string | null;
}

export function RegistrantsTable({ rows }: { rows: Registrant[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [r.full_name, r.organisation, r.email, r.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, organisation, email, or city…"
          className="w-full max-w-md px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#FD7215]/50 focus:ring-1 focus:ring-[#FD7215]/30"
        />
        <span className="text-white/40 text-xs whitespace-nowrap">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/50 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">
                  Organisation
                </th>
                <th className="text-left px-4 py-3 text-white/50 font-medium hidden lg:table-cell">
                  Sector
                </th>
                <th className="text-left px-4 py-3 text-white/50 font-medium hidden lg:table-cell">
                  City
                </th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Census</th>
                <th className="text-left px-4 py-3 text-white/50 font-medium">Check-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-white/40 text-sm">
                    No registrants match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white">{r.full_name}</span>
                        {r.is_couple && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                            Couple
                          </span>
                        )}
                      </div>
                      {r.access_code && (
                        <span className="block font-mono text-[11px] text-white/40 mt-0.5">
                          {r.access_code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-white/70">{r.organisation || "—"}</span>
                      {r.designation && (
                        <span className="block text-white/40 text-xs mt-0.5">
                          {r.designation}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden lg:table-cell">
                      {r.sector || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/50 hidden lg:table-cell">
                      {r.city || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.census_complete ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#229434]/20 text-[#229434]">
                          Complete
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CheckInButton registrant={r} />
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

function CheckInButton({ registrant }: { registrant: Registrant }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const res = await toggleCheckIn(registrant.id, !registrant.checked_in);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={
          registrant.checked_in
            ? "text-xs px-3 py-1.5 rounded-lg bg-[#229434]/20 text-[#229434] hover:bg-[#229434]/30 disabled:opacity-50 transition-colors"
            : "text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:border-[#FD7215]/50 hover:text-white disabled:opacity-50 transition-colors"
        }
      >
        {pending
          ? "…"
          : registrant.checked_in
            ? "Checked in ✓"
            : "Check in"}
      </button>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
