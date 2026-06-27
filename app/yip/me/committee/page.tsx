import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
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
  return (
    <CommitteeClient
      eventId={session.eventId}
      participantId={session.id}
      participantName={session.name}
    />
  );
}
