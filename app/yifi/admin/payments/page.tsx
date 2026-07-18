import { getAdminContext, hasPermission } from "../_guard";
import { AdminHeader, AccessDenied, StatTile } from "../_components";
import { createServiceClient } from "@/lib/yifi/supabase/server";
import { FeesForm, type FeeDefaults } from "./fees-form";
import { PaymentsTable, type PaymentRow } from "./payments-table";
import { ManualAddForm } from "./manual-add-form";

export const metadata = {
  title: "Payments & Fees · YiFi Admin",
};

/** The fields of the edition row we care about for fee config. */
type EditionRow = {
  currency: string | null;
  early_bird_amount: number | null;
  early_bird_until: string | null;
  regular_amount: number | null;
  payment_instructions: string | null;
};

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-white font-semibold text-lg">{title}</h2>
      {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default async function PaymentsPage() {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "registrants")) {
    return <AccessDenied permission="registrants" />;
  }

  const svc = await createServiceClient();

  const [{ data: editionData }, { data: paymentsData }] = await Promise.all([
    svc.rpc("yifi_current_edition"),
    svc.rpc("yifi_admin_list_payments", { p_edition_id: ctx.editionId }),
  ]);

  const edition = (editionData ?? {}) as EditionRow;
  const feeDefaults: FeeDefaults = {
    currency: edition.currency ?? null,
    early_bird_amount: edition.early_bird_amount ?? null,
    early_bird_until: edition.early_bird_until ?? null,
    regular_amount: edition.regular_amount ?? null,
    payment_instructions: edition.payment_instructions ?? null,
  };

  const rows: PaymentRow[] = Array.isArray(paymentsData) ? paymentsData : [];

  const unpaid = rows.filter((r) => r.payment_status === "unpaid").length;
  const submitted = rows.filter((r) => r.payment_status === "submitted").length;
  const verified = rows.filter((r) => r.payment_status === "verified").length;
  const waived = rows.filter((r) => r.payment_status === "waived").length;

  return (
    <main className="min-h-screen bg-[#000066]">
      <AdminHeader title="Payments & Fees" />

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* (a) Fees */}
        <section className="space-y-4">
          <SectionHeading
            title="Fees"
            subtitle="Set what members pay and how. Shown to members at registration."
          />
          <FeesForm defaults={feeDefaults} />
        </section>

        {/* (b) Verification */}
        <section className="space-y-4">
          <SectionHeading
            title="Verification"
            subtitle="Members pay offline and submit a reference — verify or waive each one."
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatTile label="Unpaid" value={unpaid} />
            <StatTile label="Submitted" value={submitted} />
            <StatTile label="Verified" value={verified} />
            <StatTile label="Waived" value={waived} />
          </div>
          <PaymentsTable rows={rows} />
        </section>

        {/* (c) Manual add */}
        <section className="space-y-4">
          <SectionHeading
            title="Manual add"
            subtitle="Escape hatch for a real member missing from the directory."
          />
          <ManualAddForm />
        </section>
      </div>
    </main>
  );
}
