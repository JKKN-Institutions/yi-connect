import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getBills } from "@/app/yip/actions/bills";
import { BillsClient } from "./bills-client";

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

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

  // Fetch bills with committee member names
  const bills = await getBills(id);

  return <BillsClient eventId={id} initialBills={bills} />;
}
