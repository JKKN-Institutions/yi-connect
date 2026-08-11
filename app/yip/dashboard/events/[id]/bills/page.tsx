import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getBills } from "@/app/yip/actions/bills";
import { listBillDocuments } from "@/app/yip/actions/bill-documents";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { BillsClient } from "./bills-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function BillsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's bills. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Fetch bills with committee member names
  const bills = await getBills(id);

  // Committee supporting documents (gated action: canView) + the viewer's
  // capability — Delete renders only for canDelete (chair-only), mirroring
  // participants/page.tsx.
  const docsResult = await listBillDocuments(id);
  const documents = docsResult.success ? docsResult.data : [];
  const access = await getYipEventAccess(id);

  // Committee list for the manual Add-Bill picker (distinct, sorted).
  const { data: committeeRows } = await supabase
    .from("participants")
    .select("committee_name")
    .eq("event_id", id)
    .not("committee_name", "is", null);
  const committees = Array.from(
    new Set(
      (committeeRows ?? [])
        .map((r) => (r.committee_name ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  // People list for the Government / Private Member's bill mover pickers
  // (Regional Round). The client filters by role via lib/yip/bill-sources.
  // cabinet_portfolio is a newer column not in the generated types, hence the
  // loose builder cast (house pattern — see actions/positions.ts).
  const { data: peopleRows } = await (
    supabase.from("participants") as ReturnType<typeof supabase.from>
  )
    .select(
      "id, full_name, parliament_role, cabinet_portfolio, constituency_number"
    )
    .eq("event_id", id)
    .order("full_name");
  const people = ((peopleRows ?? []) as unknown as {
    id: string;
    full_name: string;
    parliament_role: string | null;
    cabinet_portfolio: string | null;
    constituency_number: number | null;
  }[]).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    parliament_role: p.parliament_role,
    cabinet_portfolio: p.cabinet_portfolio,
    constituency_number: p.constituency_number,
  }));

  return (
    <BillsClient
      eventId={id}
      initialBills={bills}
      initialDocuments={documents}
      canDelete={access.canDelete}
      canManage={access.canManage}
      committees={committees}
      people={people}
    />
  );
}
