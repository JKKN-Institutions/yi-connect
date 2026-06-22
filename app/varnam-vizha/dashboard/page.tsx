import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";

export const metadata: Metadata = { title: "Committee" };

// P0 gated stub: proves the access gate. No varnam role → explicit Forbidden403
// (never a silent redirect). Real dashboard modules land in P3.
export default async function VarnamDashboard() {
  const access = await getVarnamAccess();

  if (!access.canView) {
    return <Forbidden403 reason={access.reason} />;
  }

  const tier = access.canAdmin
    ? "admin"
    : access.canManage
      ? "manage"
      : "view-only";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
        Varnam Vizha — Committee
      </h1>
      <p className="mt-2 text-sm text-[#2B0A33]/60">
        Signed in as{" "}
        <span className="font-medium text-[#2B0A33]">{access.role}</span> ·{" "}
        {tier} access.
      </p>
      <div className="mt-6 rounded-xl border border-dashed border-[#3B0A45]/20 bg-white p-6 text-sm text-[#2B0A33]/70">
        Dashboard modules — events, registrations, sponsors, budget &amp;
        playbook — arrive in the next phases. This page confirms the access gate
        works.
      </div>
    </div>
  );
}
