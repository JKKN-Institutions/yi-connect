import { redirect } from "next/navigation";

import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getMySelfNomination } from "@/app/yip/actions/self-nomination";
import { NominateClient } from "./nominate-client";

/**
 * /yip/me/nominate — the student's self-nomination screen.
 *
 * The `yip_session` cookie is httpOnly, so identity is resolved server-side
 * (same pattern as app/yip/me/vote/page.tsx). Nothing about the participant is
 * passed down to the client as an authorization signal: `getMySelfNomination`
 * and `submitSelfNomination` each re-read the cookie themselves.
 *
 * Reads are allowed while the window is CLOSED — a student who nominated must
 * still be able to see what they submitted. Fails CLOSED: any read error hands
 * the client `open: false` plus the reason to display.
 */
export default async function SelfNominationPage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  const res = await getMySelfNomination(session.eventId);
  const nomination = res.success ? res.data.nomination : null;

  return (
    <NominateClient
      eventId={session.eventId}
      initialOpen={res.success ? res.data.open : false}
      initialRoles={nomination?.roles ?? []}
      initialSubmitted={nomination !== null}
      eligibleRoles={res.success ? res.data.eligibleRoles : []}
      offeredMinistries={res.success ? res.data.offeredMinistries : []}
      initialMinistries={nomination?.ministries ?? []}
      loadError={res.success ? null : res.error}
    />
  );
}
