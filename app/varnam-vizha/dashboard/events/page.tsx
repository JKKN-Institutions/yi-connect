import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getEventsManagement } from "@/lib/varnam/data/dashboard-detail";

export const metadata: Metadata = { title: "Events" };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

export default async function EventsManagementPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const events = await getEventsManagement();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Events
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          {events.length} event{events.length === 1 ? "" : "s"} this edition.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        {events.length === 0 ? (
          <p className="p-6 text-sm text-[#2B0A33]/50">
            No events have been added to this edition yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Registrations
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-[#2B0A33]">
                        {e.title}
                      </span>
                      {e.venue_address ? (
                        <span className="mt-0.5 block truncate text-xs text-[#2B0A33]/45">
                          {e.venue_address}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/70">
                      {fmtDate(e.start_date)}
                    </td>
                    <td className="px-4 py-3">
                      {e.category ? (
                        <span className="inline-flex rounded-full bg-[#0CA4A5]/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#0a8485]">
                          {e.category}
                        </span>
                      ) : (
                        <span className="text-[#2B0A33]/35">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[#3B0A45]/8 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#3B0A45]/70">
                        {e.status ?? "draft"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#D6336C]">
                      {e.registrations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
