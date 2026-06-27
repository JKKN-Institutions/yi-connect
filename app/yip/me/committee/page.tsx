import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { BillFeedbackCard } from "@/app/yip/me/bill/bill-feedback-card";
import { CommitteeClient } from "./committee-client";

// The Committee Room — the participant's single surface for their committee:
// the bill draft (per-clause), discussion, amendments, and roles. The
// yip_session cookie is httpOnly, so it is read server-side here and the
// identity is handed to the client (which then loads the room via the gated
// getCommitteeRoom action). The committee itself is derived from the
// participant's own allocation inside that action — never trusted from the URL.
export default async function CommitteeRoomPage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  // The AI bill-feedback card is a SERVER component (it reads server-only AI
  // data), so it is rendered HERE and passed into the client Room as a slot — a
  // client component cannot import it without pulling server-only code into the
  // browser bundle. Resolve the committee server-side (same as the old bill
  // page) so the card knows which bill to comment on.
  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("committee_name")
    .eq("id", session.id)
    .maybeSingle();
  const committeeName = (p?.committee_name as string | null) ?? null;

  return (
    <CommitteeClient
      eventId={session.eventId}
      participantId={session.id}
      participantName={session.name}
      billFeedback={
        committeeName ? (
          <BillFeedbackCard
            eventId={session.eventId}
            committeeName={committeeName}
          />
        ) : null
      }
    />
  );
}
