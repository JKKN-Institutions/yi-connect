import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getSponsorsBoard } from "@/lib/varnam/data/manage-boards-data";
import { AddSponsorPanel } from "./_components/AddSponsorPanel";
import { SponsorsTable } from "./_components/SponsorsTable";

export const metadata: Metadata = { title: "Sponsors" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function SponsorsPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const sponsors = await getSponsorsBoard();
  const committedTotal = sponsors.reduce((s, x) => s + x.committed, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            Sponsors
          </h1>
          <p className="mt-1 text-sm text-[#2B0A33]/60">
            {sponsors.length} active sponsor{sponsors.length === 1 ? "" : "s"} in
            the pipeline.
          </p>
        </div>
        {sponsors.length > 0 ? (
          <div className="text-right">
            <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#0a8485]">
              {inr(committedTotal)}
            </p>
            <p className="text-xs text-[#2B0A33]/50">committed (FY 2026)</p>
          </div>
        ) : null}
      </div>

      {access.canManage ? <AddSponsorPanel /> : null}

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        <SponsorsTable sponsors={sponsors} canManage={access.canManage} />
      </section>
    </div>
  );
}
