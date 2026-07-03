import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getAllRegistrations } from "@/lib/varnam/data/dashboard-detail";
import { ExportCsvButton } from "./ExportCsvButton";
import { RegistrationsTable } from "./RegistrationsTable";

export const metadata: Metadata = { title: "Registrations" };

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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            Registrations
          </h1>
          <p className="mt-1 text-sm text-[#2B0A33]/60">
            {`${rows.length} registration${rows.length === 1 ? "" : "s"} across this edition’s events — check guests in on event day and promote from the waitlist.`}
          </p>
        </div>
        <ExportCsvButton rows={rows} />
      </div>

      <RegistrationsTable rows={rows} />
    </div>
  );
}
