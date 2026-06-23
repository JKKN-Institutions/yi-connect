import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { ReportClient, type ParticipantSession } from "./report-client";

// Mirrors app/yip/me/bill/page.tsx: the yip_session cookie is httpOnly, and the
// participant's parliament_role + committee_name live on RLS-protected columns,
// so both are resolved server-side and passed down.

export default async function CommitteeReportPage() {
  const session = await getYipSession();

  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("parliament_role, committee_name, committee_number")
    .eq("id", session.id)
    .maybeSingle();

  // The committee's official topic + linked scheme from the yip.topics catalog
  // (category = 'committee', title = the committee name) — shown so students
  // know what their report should be about. Same lookup as the bill page.
  let committeeTopic: string | null = null;
  let committeeScheme: string | null = null;
  if (p?.committee_name) {
    const { data: ct } = await supabase
      .from("topics")
      .select("description, linked_scheme")
      .eq("category", "committee")
      .eq("title", p.committee_name)
      .eq("is_active", true)
      .maybeSingle();
    committeeTopic = ct?.description ?? null;
    committeeScheme = ct?.linked_scheme ?? null;
  }

  return (
    <ReportClient
      initialSession={session as ParticipantSession}
      committeeName={p?.committee_name ?? null}
      committeeNumber={p?.committee_number ?? null}
      committeeTopic={committeeTopic}
      committeeScheme={committeeScheme}
    />
  );
}
