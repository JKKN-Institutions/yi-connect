import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getMyPrivateMemberBill } from "@/app/yip/actions/bills";
import { PrivateBillClient } from "./private-bill-client";

// A Member's own Private Member's Bill.
//
// The yip_session cookie is httpOnly, so identity is read server-side here and
// handed to the client. The bill itself is read here too and passed down as
// initial state — the same shape the questionnaire admin screen uses. That is
// not only house style: it means a Member on a phone in a hall sees their bill
// on first paint instead of a spinner, and the client needs no load-on-mount
// effect at all.
//
// Eligibility is NOT decided here. The action re-checks parliament_role on
// every call, because a role can change between this page rendering and a save
// landing — and the action is the only real guard.
export default async function PrivateMemberBillPage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  const res = await getMyPrivateMemberBill(session.eventId, session.id);

  return (
    <PrivateBillClient
      eventId={session.eventId}
      participantId={session.id}
      participantName={session.name}
      initialBill={res.success ? res.data.bill : null}
      initialError={res.success ? null : res.error}
    />
  );
}
