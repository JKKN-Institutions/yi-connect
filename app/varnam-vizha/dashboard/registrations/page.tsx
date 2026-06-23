import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getAllRegistrations } from "@/lib/varnam/data/dashboard-detail";
import { ExportCsvButton } from "./ExportCsvButton";

export const metadata: Metadata = { title: "Registrations" };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

export default async function RegistrationsPage() {
  const access = await getVarnamAccess();
  // The sign-up list holds people's contact details — restricted to the chair,
  // co-chair and admins (not every committee member).
  const canSeePeople =
    access.canAdmin || access.role === "chair" || access.role === "co_chair";
  if (!canSeePeople) {
    return (
      <Forbidden403 reason="The sign-up list (with people's contact details) is limited to the chair and admins." />
    );
  }

  const rows = await getAllRegistrations();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            Registrations
          </h1>
          <p className="mt-1 text-sm text-[#2B0A33]/60">
            {`${rows.length} registration${rows.length === 1 ? "" : "s"} across this edition’s events.`}
          </p>
        </div>
        <ExportCsvButton rows={rows} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#2B0A33]/50">
            No registrations yet.
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
                  <th className="px-4 py-3 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.email ?? r.phone ?? r.name}-${i}`}
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
                    <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/55">
                      {fmtDate(r.created_at)}
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
