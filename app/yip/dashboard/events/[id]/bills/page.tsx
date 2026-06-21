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

  return (
    <BillsClient
      eventId={id}
      initialBills={bills}
      initialDocuments={documents}
      canDelete={access.canDelete}
    />
  );
}
